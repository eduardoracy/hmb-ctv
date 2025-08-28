import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "./firebaseClient";
import { doc, onSnapshot } from "firebase/firestore";
import { UserDoc } from "./types";

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); }), []);
    return { user, loading };
}

export function useMeDoc() {
    const { user } = useAuth();
    const [me, setMe] = useState<UserDoc | null>(null);
    useEffect(() => {
        if (!user) return setMe(null);
        const ref = doc(db, "users", user.uid);
        return onSnapshot(ref, (snap) => setMe(snap.exists() ? (snap.data() as UserDoc) : null));
    }, [user]);
    return me;
}
