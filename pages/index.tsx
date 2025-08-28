import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import { nanoid } from "nanoid";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useRouter } from "next/router";

export default function Home() {
    const [mode, setMode] = useState<"in" | "up">("in");
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const router = useRouter();

    async function bootstrapProfile(uid: string, emailAddr: string, displayName: string) {
        const ref = doc(db, "users", uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            await setDoc(ref, {
                name: displayName,
                email: emailAddr,
                year: "rookie",
                roles: { admin: false, sectionLeader: false },
                canEvaluate: {},
                sectionId: "Saxes",
                leaderOfSections: {},
                memberId: "MBR-" + nanoid(6).toUpperCase(),
                createdAt: serverTimestamp()
            });
        }
    }

    async function onSignUp() {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        await bootstrapProfile(cred.user.uid, email, name || email.split("@")[0]);
        router.push("/me");
    }
    async function onSignIn() {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await bootstrapProfile(cred.user.uid, email, cred.user.displayName || email);
        router.push("/me");
    }

    return (
        <main style={{ maxWidth: 420, margin: "64px auto", fontFamily: "system-ui" }}>
            <h1>HMB VTC</h1>
            {mode === "up" && (
                <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", padding: 8, marginBottom: 8 }} />
            )}
            <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", padding: 8, marginBottom: 8 }} />
            <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", padding: 8, marginBottom: 8 }} />
            <button onClick={mode === "up" ? onSignUp : onSignIn} style={{ padding: "10px 16px" }}>{mode === "up" ? "Create account" : "Sign in"}</button>
            <button onClick={() => setMode(mode === "up" ? "in" : "up")} style={{ marginLeft: 8 }}>
                {mode === "up" ? "I have an account" : "Create an account"}
            </button>
        </main>
    );
}
