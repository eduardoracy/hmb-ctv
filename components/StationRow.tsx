import { useMemo, useState } from "react";
import { ProgressDoc, StationDoc, UserDoc } from "@/lib/types";
import { canSeeHistory } from "@/lib/perms";
import AttemptsBadge from "./AttemptsBadge";
import HistoryDialog from "./HistoryDialog";
import { formatTimestamp } from "@/lib/time";

export default function StationRow({
    progressId, snapshot, station, viewer, targetUser
}: {
    progressId: string; snapshot: ProgressDoc; station: StationDoc | null; viewer: UserDoc | null; targetUser: UserDoc | null;
}) {
    const [openHistory, setOpenHistory] = useState(false);
    const allowed = useMemo(() => canSeeHistory(viewer, targetUser), [viewer, targetUser]);

    const updated = formatTimestamp(snapshot.updatedAt);


    return (
        <>
            <tr style={{ borderTop: "1px solid #eee" }}>
                <td>
                    <div style={{ display: "flex", alignItems: "center" }}>
                        <span>{station?.name ?? snapshot.stationId}</span>
                        {allowed && <AttemptsBadge count={snapshot.attemptsCount} />}
                    </div>
                </td>
                <td style={{ textTransform: "capitalize" }}>{snapshot.level}</td>
                <td>{snapshot.score ?? "—"}</td>
                <td>{updated}</td>
                <td>{allowed && <button onClick={() => setOpenHistory(true)} aria-haspopup="dialog">View history</button>}</td>
            </tr>
            {allowed && <HistoryDialog progressId={progressId} open={openHistory} onClose={() => setOpenHistory(false)} />}
        </>
    );
}
