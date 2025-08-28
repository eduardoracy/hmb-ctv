import { useEffect, useState } from "react";
import { StationDoc, Level } from "@/lib/types";
import { gradeAttemptCallable } from "@/lib/callables";

const LEVELS: Level[] = ["developing", "proficient", "mastery"];

export default function GradeDialog({
    open, onClose, row, station,
}: {
    open: boolean;
    onClose: () => void;
    row: { id: string; userId: string; stationId: string; level: Level; score: number | null };
    station: StationDoc | null;
}) {
    const [comment, setComment] = useState("");
    const [score, setScore] = useState<number | "">(typeof row.score === "number" ? row.score : "");
    const [ratings, setRatings] = useState<Record<string, Level>>({});

    const categories = station?.categories ?? [];

    useEffect(() => {
        if (!open || !station) return;
        const init: Record<string, Level> = {};
        for (const c of station.categories) {
            for (const r of c.requirements) init[r.id] = "developing";
        }
        setRatings(init);
        setComment("");
        setScore(row.score ?? "");
    }, [open, station, row.score]);

    function setReq(reqId: string, level: Level) {
        setRatings((prev) => ({ ...prev, [reqId]: level }));
    }

    async function submit() {
        await gradeAttemptCallable({
            progressId: row.id,
            userId: row.userId,
            stationId: row.stationId,
            comment,
            score: typeof score === "number" ? score : null,
            requirementRatings: ratings,
        });
        onClose();
    }

    if (!open) return null;

    return (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ background: "#fff", width: "min(760px,96%)", borderRadius: 12, padding: 16, boxShadow: "0 10px 30px rgba(0,0,0,.2)" }}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0 }}>Grade — {station?.name ?? row.stationId}</h3>
                    <button onClick={onClose}>✕</button>
                </header>

                {categories.length === 0 ? (
                    <p style={{ marginTop: 12, color: "#b00" }}>This station has no categories/requirements configured.</p>
                ) : (
                    <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
                        {categories.map((cat) => (
                            <fieldset key={cat.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
                                <legend style={{ padding: "0 6px" }}>{cat.label}</legend>
                                {cat.requirements.map((req) => (
                                    <div key={req.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, alignItems: "center", padding: "6px 0", borderTop: "1px dashed #f0f0f0" }}>
                                        <div>{req.label}</div>
                                        {LEVELS.map((l) => (
                                            <label key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <input
                                                    type="radio"
                                                    name={`${cat.id}:${req.id}`}
                                                    checked={(ratings[req.id] || "developing") === l}
                                                    onChange={() => setReq(req.id, l)}
                                                />
                                                <span style={{ textTransform: "capitalize" }}>{l}</span>
                                            </label>
                                        ))}
                                    </div>
                                ))}
                            </fieldset>
                        ))}

                        <label>Comment:
                            <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Specific feedback…" style={{ display: "block", width: "100%", marginTop: 4 }} />
                        </label>

                        <label>Optional numeric score:
                            <input type="number" value={score} onChange={e => setScore(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g., 90" style={{ display: "block", width: 140, marginTop: 4 }} />
                        </label>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                            <button onClick={onClose}>Cancel</button>
                            <button onClick={submit}>Save</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
