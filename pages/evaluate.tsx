import { useAuth, useMeDoc } from "@/lib/hooks";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useEffect, useMemo, useState } from "react";
import { ProgressDoc, StationDoc } from "@/lib/types";
import GradeDialog from "@/components/GradeDialog";

export default function Evaluate() {
    const { user } = useAuth();
    const me = useMeDoc();
    const [rows, setRows] = useState<(ProgressDoc & { id: string })[]>([]);
    const [stations, setStations] = useState<Record<string, StationDoc>>({});
    const [grading, setGrading] = useState<null | (ProgressDoc & { id: string })>(null);

    const stationIds = useMemo(() => Object.keys(me?.canEvaluate || {}), [me]);

    useEffect(() => {
        const qStations = query(collection(db, "stations"));
        return onSnapshot(qStations, (snap) => {
            const map: Record<string, StationDoc> = {};
            snap.forEach((d) => { map[d.id] = d.data() as StationDoc; });
            setStations(map);
        });
    }, []);

    useEffect(() => {
        if (!user || stationIds.length === 0) { setRows([]); return; }
        const chunk = stationIds.slice(0, 10); // Firestore "in" requires <=10
        const qProg = query(
            collection(db, "progress"),
            where("stationId", "in", chunk),
            orderBy("updatedAt", "desc"),
            limit(50)
        );
        return onSnapshot(qProg, (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProgressDoc) }))));
    }, [user, stationIds]);

    return (
        <main style={{ maxWidth: 960, margin: "32px auto", fontFamily: "system-ui" }}>
            <h2>Evaluate — Your stations</h2>
            {stationIds.length === 0 && <p>You don’t have evaluator permissions yet.</p>}
            <table width="100%" cellPadding={8} style={{ marginTop: 16, borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#f5f5f5" }}>
                    <th align="left">Member</th><th align="left">Station</th><th align="left">Level</th><th align="left">Score</th><th align="left">Action</th>
                </tr></thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.id} style={{ borderTop: "1px solid #eee", opacity: r.userId === user?.uid ? 0.5 : 1 }}>
                            <td>{r.userId}</td>
                            <td>{stations[r.stationId]?.name ?? r.stationId}</td>
                            <td style={{ textTransform: "capitalize" }}>{r.level}</td>
                            <td>{r.score ?? "—"}</td>
                            <td><button onClick={() => setGrading(r)}>Open Grade</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {grading && (
                <GradeDialog
                    open={!!grading}
                    onClose={() => setGrading(null)}
                    row={grading}
                    station={stations[grading.stationId] || null}
                />
            )}
        </main>
    );
}
