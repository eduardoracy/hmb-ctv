import type { Timestamp } from "firebase/firestore";

export type RoleMap = { admin?: boolean; sectionLeader?: boolean };
export type CanEvalMap = { [stationId: string]: boolean };
export type Level = "developing" | "proficient" | "mastery";

export interface UserDoc {
    name: string;
    email: string;
    year: "rookie" | "second" | "upper" | "staff";
    roles: RoleMap;
    canEvaluate: CanEvalMap;
    sectionId?: string;
    leaderOfSections?: { [id: string]: true };
    memberId: string;
    createdAt: Timestamp | { seconds: number; nanoseconds: number } | null;
}

export interface StationCategory {
    id: string;
    label: string;
    requirements: { id: string; label: string }[];
}

export interface StationDoc {
    name: string;
    description?: string;
    active: boolean;
    order: number;
    levels: Level[];
    categories: StationCategory[];
}

export interface ProgressDoc {
    userId: string;
    stationId: string;
    level: Level;
    score: number | null;
    lastEvaluatorId: string | null;
    updatedAt: Timestamp | { seconds: number; nanoseconds: number } | null;
    attemptsCount?: number;
    history?: never;
}

export interface HistoryRubric {
    requirementRatings: Record<string, Level>;
    categoryGrades: Record<string, Level>;
    categoriesSnapshot: StationCategory[];
}

export interface HistoryEntry {
    evaluatorId: string;
    from: { level: Level | null; score: number | null };
    to: { level: Level; score: number | null };
    comment: string;
    rubric: HistoryRubric;
    at: Timestamp | { seconds: number; nanoseconds: number } | null;
}
