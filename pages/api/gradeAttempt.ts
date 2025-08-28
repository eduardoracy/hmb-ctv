import type { NextApiRequest, NextApiResponse } from "next";
import admin, { adminDb } from "@/lib/admin";

type Level = "developing" | "proficient" | "mastery";
interface Roles { admin?: boolean; sectionLeader?: boolean }
interface UserDoc {
    roles?: Roles;
    canEvaluate?: Record<string, boolean>;
    sectionId?: string;
    leaderOfSections?: Record<string, true>;
}
interface StationCategory { id: string; label: string; requirements: { id: string; label: string }[] }
interface StationDoc { order?: number; categories?: StationCategory[] }
interface ProgressDoc { stationId: string; userId: string; level?: Level; score?: number | null; }
interface GradeRequest {
    progressId: string; userId: string; stationId: string;
    comment?: string; requirementRatings?: Record<string, Level>; score?: number | null;
}

const levelRank: Record<Level, number> = { developing: 0, proficient: 1, mastery: 2 };
const minLevel = (a: Level, b: Level): Level => (levelRank[a] <= levelRank[b] ? a : b);
const clampLevel = (s: unknown): Level => {
    const l = String(s ?? "").toLowerCase();
    if (l === "mastery") return "mastery";
    if (l === "proficient") return "proficient";
    return "developing";
};

function isRecord(x: unknown): x is Record<string, unknown> {
    return typeof x === "object" && x !== null;
}
function parseReq(body: unknown): GradeRequest {
    if (!isRecord(body)) throw new Error("Payload must be an object.");
    const progressId = String(body.progressId ?? "");
    const userId = String(body.userId ?? "");
    const stationId = String(body.stationId ?? "");
    if (!progressId || !userId || !stationId) throw new Error("Missing progressId/userId/stationId.");

    const comment = "comment" in body && typeof body.comment === "string" ? (body.comment as string) : "";
    const score =
        "score" in body && (typeof body.score === "number" || body.score === null)
            ? (body.score as number | null)
            : null;
    const ratings: Record<string, Level> = {};
    if ("requirementRatings" in body && isRecord(body.requirementRatings)) {
        for (const [k, v] of Object.entries(body.requirementRatings)) ratings[k] = clampLevel(v);
    }
    return { progressId, userId, stationId, comment, score, requirementRatings: ratings };
}

async function recomputeEvaluatorEligibilityForUser(userId: string) {
    const stationsSnap = await adminDb.collection("stations").get();
    const stations = stationsSnap.docs
        .map((d) => ({ id: d.id, order: typeof d.data().order === "number" ? (d.data().order as number) : 0 }))
        .sort((a, b) => a.order - b.order);
    const lastOrder = stations.length ? stations[stations.length - 1].order : 0;

    const progSnap = await adminDb.collection("progress").where("userId", "==", userId).get();
    const levelByStation: Record<string, Level> = {};
    progSnap.forEach((d) => {
        const p = d.data() as ProgressDoc;
        if (p?.stationId) levelByStation[p.stationId] = clampLevel(p.level);
    });

    const hasAtLeast = (stationId: string, needed: Level) => {
        const have = levelByStation[stationId] ?? "developing";
        return levelRank[have] >= levelRank[needed];
    };

    const flags: Record<string, boolean> = {};
    for (const s of stations) {
        const prevOk = stations.filter((x) => x.order < s.order).every((x) => hasAtLeast(x.id, "mastery"));
        const selfOk = hasAtLeast(s.id, "mastery");
        const next = stations.find((x) => x.order === s.order + 1);
        const nextOk = next ? hasAtLeast(next.id, "proficient") : true;
        const lastOk = s.order === lastOrder ? stations.every((x) => hasAtLeast(x.id, "mastery")) : true;
        flags[s.id] = prevOk && selfOk && nextOk && lastOk;
    }

    const userRef = adminDb.doc(`users/${userId}`);
    await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists) return;
        const curr = (snap.data() as UserDoc).canEvaluate ?? {};
        const changed = Object.keys(flags).some((k) => !!curr[k] !== !!flags[k]);
        if (changed) {
            const update: Record<string, boolean> = {};
            for (const [k, v] of Object.entries(flags)) update[`canEvaluate.${k}`] = v;
            tx.update(userRef, update);
        }
    });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            return res.status(405).json({ error: "Method not allowed" });
        }

        // Verify Firebase ID token
        const authHeader = req.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token) return res.status(401).json({ error: "Missing Authorization: Bearer <idToken>" });

        const decoded = await admin.auth().verifyIdToken(token);
        const graderUid = decoded.uid;
        if (!graderUid) return res.status(401).json({ error: "Unauthenticated" });

        const { progressId, userId, stationId, comment, score, requirementRatings } = parseReq(req.body);
        if (userId === graderUid) return res.status(400).json({ error: "You cannot grade yourself." });

        // Permissions
        const graderSnap = await adminDb.doc(`users/${graderUid}`).get();
        if (!graderSnap.exists) return res.status(403).json({ error: "No grader profile." });
        const grader = graderSnap.data() as UserDoc;
        const isAdmin = !!grader.roles?.admin;
        const canEval = !!grader.canEvaluate?.[stationId];
        if (!isAdmin && !canEval) return res.status(403).json({ error: "Not allowed to evaluate this station." });

        // Station
        const stationSnap = await adminDb.doc(`stations/${stationId}`).get();
        if (!stationSnap.exists) return res.status(404).json({ error: `Station ${stationId} not found.` });
        const station = stationSnap.data() as StationDoc;
        const categories: StationCategory[] = station.categories ?? [];

        // Compute grades
        let overall: Level = "mastery";
        const categoryGrades: Record<string, Level> = {};
        for (const cat of categories) {
            let catLevel: Level = "mastery";
            for (const req of cat.requirements ?? []) {
                const reqLevel = clampLevel(requirementRatings?.[req.id]);
                catLevel = minLevel(catLevel, reqLevel);
            }
            categoryGrades[cat.id] = catLevel;
            overall = minLevel(overall, catLevel);
        }
        if (categories.length === 0) overall = "developing";

        // Write snapshot + history
        const progRef = adminDb.doc(`progress/${progressId}`);
        await adminDb.runTransaction(async (tx) => {
            const progSnap = await tx.get(progRef);
            if (!progSnap.exists) throw new Error("Progress doc not found.");
            const before = progSnap.data() as ProgressDoc | undefined;
            const now = admin.firestore.FieldValue.serverTimestamp();

            tx.update(progRef, {
                level: overall,
                score: typeof score === "number" ? score : null,
                lastEvaluatorId: graderUid,
                updatedAt: now,
                attemptsCount: admin.firestore.FieldValue.increment(1),
            });

            tx.set(progRef.collection("history").doc(), {
                evaluatorId: graderUid,
                from: { level: before?.level ?? null, score: typeof before?.score === "number" ? before?.score : null },
                to: { level: overall, score: typeof score === "number" ? score : null },
                comment,
                rubric: {
                    requirementRatings: requirementRatings ?? {},
                    categoryGrades,
                    categoriesSnapshot: categories,
                },
                at: now,
            });
        });

        await recomputeEvaluatorEligibilityForUser(userId);
        return res.status(200).json({ ok: true, level: overall, categoryGrades });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return res.status(500).json({ error: msg });
    }
}
