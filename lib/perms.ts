import { UserDoc } from "./types";

export function canSeeHistory(viewer: UserDoc | null, target: UserDoc | null): boolean {
    if (!viewer || !target) return false;
    if (viewer.roles?.admin) return true;
    if (viewer.email === target.email) return true;
    if (viewer.roles?.sectionLeader && viewer.leaderOfSections?.[target.sectionId || ""]) return true;
    return false;
}
