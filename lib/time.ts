// lib/time.ts
import type { Timestamp } from "firebase/firestore";

type MaybeTs =
    | Timestamp
    | { seconds: number; nanoseconds?: number }
    | null
    | undefined;

type WithToDate = { toDate: () => Date };

function hasToDate(x: unknown): x is WithToDate {
    return (
        typeof x === "object" &&
        x !== null &&
        "toDate" in x &&
        typeof (x as { toDate?: unknown }).toDate === "function"
    );
}

/** Safely format a Firestore Timestamp-like value to a locale string. */
export function formatTimestamp(ts: MaybeTs): string {
    if (!ts) return "—";

    if (hasToDate(ts)) {
        try {
            return ts.toDate().toLocaleString();
        } catch {
            // fall through to object-with-seconds handling
        }
    }

    if (
        typeof (ts as { seconds?: unknown }).seconds === "number" &&
        (typeof (ts as { nanoseconds?: unknown }).nanoseconds === "number" ||
            typeof (ts as { nanoseconds?: unknown }).nanoseconds === "undefined")
    ) {
        const obj = ts as { seconds: number; nanoseconds?: number };
        const ms =
            obj.seconds * 1000 + Math.floor(((obj.nanoseconds ?? 0) as number) / 1e6);
        return new Date(ms).toLocaleString();
    }

    return "—";
}
