import { useAuth, useMeDoc } from "@/lib/hooks";
import { collection, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useEffect, useMemo, useState } from "react";
import { ProgressDoc, StationDoc, UserDoc } from "@/lib/types";
import StationRow from "@/components/StationRow";

export default function Section() {
    const { user } = useAuth();
    const me = useMeDoc();
    const [members, setMembers] = useState<{ id: string; data: UserDoc }[]>([]);
    const [stations, setStations] = useState<Record<string, StationDoc>>({});
    const [progressByUser, setProgressByUser] = useState<Record<string, (ProgressDoc & { id: string })[]>>({});

    const sectionIds = useMemo(() => Object.keys(me?.leaderOfSections || {}), [me]);

    useEffect(() => {
        const qStations = query(collection(db, "stations"));
        return onSnapshot(qStations, (snap) => {
            const map: Record<string, StationDoc> = {};
            snap.forEach((d) => { map[d.id] = d.data() as StationDoc; });
            setStations(map);
        });
    }, []);

    useEffect(() => {
        if (!me?.roles?.sectionLeader || sectionIds.length === 0) { setMembers([]); return; }
        (async () => {
            const all: { id: string; data: UserDoc }[] = [];
            for (const sec of sectionIds) {
                const qUsers = query(collection(db, "users"), where("sectionId", "==", sec));
                const res = await getDocs(qUsers);
                res.forEach((docu) => all.push({ id: docu.id, data: docu.data() as UserDoc }));
            }
            setMembers(all);
        })();
    }, [me, sectionIds]);

    useEffect(() => {
        const unsubs = members.map((m) => {
            const qProg = query(collection(db, "progress"), where("userId", "==", m.id), orderBy("stationId", "asc"));
            return onSnapshot(qProg, (snap) => {
                setProgressByUser((prev) => ({ ...prev, [m.id]: snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProgressDoc) })) }));
            });
        });
        return () => unsubs.forEach((u) => u());
    }, [members]);

    if (!user || !me?.roles?.sectionLeader) return <p style={{ padding: 24 }}>Section leaders only.</p>;

    return (
        <main style={{ maxWidth: 1100, margin: "32px auto", fontFamily: "system-ui" }}>
            <h2>Section View</h2>
            {members.map((m) => (
                <section key={m.id} style={{ marginTop: 24 }}>
                    <h3 style={{ marginBottom: 8 }}>{m.data.name} ({m.data.memberId}) — {m.data.sectionId}</h3>
                    <table width="100%" cellPadding={8} style={{ borderCollapse: "collapse" }}>
                        <thead><tr style={{ background: "#f5f5f5" }}>
                            <th align="left">Station</th><th align="left">Level</th><th align="left">Score</th><th align="left">Updated</th><th />
                        </tr></thead>
                        <tbody>
                            {(progressByUser[m.id] || []).map((r) => (
                                <StationRow
                                    key={r.id}
                                    progressId={r.id}
                                    snapshot={r}
                                    station={stations[r.stationId] || null}
                                    viewer={me}
                                    targetUser={m.data}
                                />
                            ))}
                        </tbody>
                    </table>
                </section>
            ))}
        </main>
    );
}
