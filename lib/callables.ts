import { auth } from "./firebaseClient";
import type { Level } from "./types";

export async function gradeAttemptCallable(input: {
    progressId: string;
    userId: string;
    stationId: string;
    comment?: string;
    score?: number | null;
    requirementRatings: Record<string, Level>;
}) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in");
    const idToken = await user.getIdToken();

    const res = await fetch("/api/gradeAttempt", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(input),
    });

    if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as {
        ok: true;
        level: Level;
        categoryGrades: Record<string, Level>;
    };
}
