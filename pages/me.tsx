import { useAuth, useMeDoc } from "@/lib/hooks";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useEffect, useState } from "react";
import { ProgressDoc, StationDoc } from "@/lib/types";
import Link from "next/link";
import StationRow from "@/components/StationRow";

export default function Me() {
    const { user, loading } = useAuth();
    const me = useMeDoc();
    const [rows, setRows] = useState<(ProgressDoc & { id: string })[]>([]);
    const [stations, setStations] = useState<Record<string, StationDoc>>({});

    useEffect(() => {
        if (!user) return;
        const qProg = query(collection(db, "progress"), where("userId", "==", user.uid), orderBy("stationId", "asc"));
        return onSnapshot(qProg, (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProgressDoc) }))));
    }, [user]);

    useEffect(() => {
        const qStations = query(collection(db, "stations"));
        return onSnapshot(qStations, (snap) => {
            const map: Record<string, StationDoc> = {};
            snap.forEach((d) => { map[d.id] = d.data() as StationDoc; });
            setStations(map);
        });
    }, []);

    if (loading) return <p style={{ padding: 24 }}>Loading…</p>;
    if (!user || !me) return <p style={{ padding: 24 }}>Sign in first.</p>;

    return (
        <main style={{ maxWidth: 960, margin: "32px auto", fontFamily: "system-ui" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2>Your Progress — {me.name} ({me.memberId})</h2>
                <nav style={{ display: "flex", gap: 12 }}>
                    <Link href="/evaluate">Evaluate</Link>
                    {me.roles?.sectionLeader && <Link href="/section">Section</Link>}
                    {me.roles?.admin && <Link href="/admin">Admin</Link>}
                </nav>
            </header>

            <table width="100%" cellPadding={8} style={{ marginTop: 16, borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#f5f5f5" }}>
                    <th align="left">Station</th><th align="left">Level</th><th align="left">Score</th><th align="left">Updated</th><th />
                </tr></thead>
                <tbody>
                    {rows.map((r) => (
                        <StationRow
                            key={r.id}
                            progressId={r.id}
                            snapshot={r}
                            station={stations[r.stationId] || null}
                            viewer={me}
                            targetUser={me}
                        />
                    ))}
                </tbody>
            </table>
        </main>
    );
}
