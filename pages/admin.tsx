import { useAuth, useMeDoc } from "@/lib/hooks";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useState } from "react";

export default function Admin() {
    const { user } = useAuth();
    const me = useMeDoc();

    const [stationId, setStationId] = useState("");
    const [stationName, setStationName] = useState("");
    const [order, setOrder] = useState<number | "">("");

    if (!user || !me?.role?.admin) return <p style={{ padding: 24 }}>Admins only.</p>;

    async function createStation() {
        if (!stationId.trim() || !stationName.trim() || order === "") return;
        await setDoc(doc(db, "stations", stationId.trim()), {
            name: stationName.trim(),
            description: "",
            active: true,
            order: Number(order),
            levels: ["developing", "proficient", "mastery"],
            categories: [
                {
                    id: "posture",
                    label: "Posture",
                    requirements: [
                        { id: "stance", label: "Balanced stance" },
                        { id: "knees", label: "Knees soft (not locked)" },
                        { id: "shoulders", label: "Shoulders relaxed" }
                    ]
                },
                {
                    id: "tone",
                    label: "Tone",
                    requirements: [
                        { id: "support", label: "Breath support" },
                        { id: "centered", label: "Centered sound" }
                    ]
                }
            ]
        });
        setStationId(""); setStationName(""); setOrder("");
    }

    async function seedProgressFor(uid: string, sid: string) {
        const id = `${uid}__${sid}`;
        await setDoc(doc(db, "progress", id), {
            userId: uid,
            stationId: sid,
            level: "developing",
            score: null,
            lastEvaluatorId: null,
            updatedAt: serverTimestamp(),
            attemptsCount: 0,
        });
    }

    return (
        <main style={{ maxWidth: 800, margin: "32px auto", fontFamily: "system-ui" }}>
            <h2>Admin Console</h2>

            <section style={{ marginTop: 16 }}>
                <h3>Create Station (with explicit ID)</h3>
                <input placeholder="Station ID (e.g., Station1)" value={stationId} onChange={e => setStationId(e.target.value)} />
                <input placeholder="Station Name" value={stationName} onChange={e => setStationName(e.target.value)} style={{ marginLeft: 8 }} />
                <input type="number" placeholder="Order (1,2,3…)" value={order} onChange={e => setOrder(e.target.value === "" ? "" : Number(e.target.value))} style={{ marginLeft: 8, width: 140 }} />
                <button onClick={createStation} style={{ marginLeft: 8 }}>Add</button>
            </section>

            <section style={{ marginTop: 24 }}>
                <h3>Seed Example</h3>
                <button onClick={() => seedProgressFor(user.uid, "Station1")}>Seed me for Station1</button>
            </section>

            <section style={{ marginTop: 24 }}>
                <h3>Admin Toggle</h3>
                <p>Set your admin role once in Firestore: users/{user.uid} → roles.admin = true</p>
            </section>
        </main>
    );
}
