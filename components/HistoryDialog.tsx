import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import type { HistoryEntry, StationCategory } from "@/lib/types";
import { formatTimestamp } from "@/lib/time";

export default function HistoryDialog({
    progressId, open, onClose,
}: { progressId: string; open: boolean; onClose: () => void }) {
    const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

    useEffect(() => {
        if (!open) return;
        const q = query(collection(db, "progress", progressId, "history"), orderBy("at", "desc"));
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map((d) => d.data() as unknown as HistoryEntry);
            setEntries(list);
        });
    }, [open, progressId]);

    if (!open) return null;

    return (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ background: "#fff", width: "min(820px,96%)", borderRadius: 12, padding: 16, boxShadow: "0 10px 30px rgba(0,0,0,.2)" }}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0 }}>Attempt History</h3>
                    <button onClick={onClose} aria-label="Close">✕</button>
                </header>

                {!entries && <p style={{ marginTop: 12 }}>Loading history…</p>}
                {entries && entries.length === 0 && <p style={{ marginTop: 12 }}>No prior attempts.</p>}

                {entries && entries.length > 0 && (
                    <ul style={{ marginTop: 12, paddingLeft: 18 }}>
                        {entries.map((e, idx) => {
                            const rubric = e.rubric;
                            const catGrades = rubric?.categoryGrades ?? {};
                            const reqRatings = rubric?.requirementRatings ?? {};
                            const catsSnap = (rubric?.categoriesSnapshot ?? []) as StationCategory[];

                            const at = formatTimestamp(e.at);

                            return (
                                <li key={idx} style={{ marginBottom: 14 }}>
                                    <div>
                                        {at} — <strong style={{ textTransform: "capitalize" }}>{e.to.level}</strong>
                                        {typeof e.to.score === "number" ? ` (${e.to.score})` : ""}
                                        <span style={{ color: "#666" }}> — by {e.evaluatorId}</span>
                                    </div>

                                    {e.comment ? <div style={{ marginTop: 4 }}>💬 {e.comment}</div> : null}

                                    {catsSnap.length > 0 && (
                                        <div style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
                                            {catsSnap.map((c) => (
                                                <div key={c.id} style={{ marginBottom: 8 }}>
                                                    <div><strong>{c.label}</strong> — <span style={{ textTransform: "capitalize" }}>{catGrades[c.id] ?? "developing"}</span></div>
                                                    <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                                                        {c.requirements.map((r) => (
                                                            <li key={r.id}>
                                                                {r.label}: <em style={{ textTransform: "capitalize" }}>{reqRatings[r.id] ?? "developing"}</em>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
