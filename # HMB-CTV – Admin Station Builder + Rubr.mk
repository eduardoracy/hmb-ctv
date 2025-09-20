# HMB-CTV – **Pages Router Pack (Final, copy‑paste)**

This pack contains **only Pages Router** files. No `app/` paths. It includes:
- Google Auth (sign in/out) and claim‑on‑register
- Admin CSV Import
- Admin Stations & Rubrics (unique station numbers with transactions)
- Evaluator: per‑category grading + rubric toggles
- Firestore helpers & rules

> Create the folders/files exactly as shown. If a file already exists, replace it with the version below.

---

## package.json (versions you can keep)
```json
{
  "name": "hmb-ctv",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "firebase": "^10.12.4",
    "next": "14.2.5",
    "papaparse": "^5.4.1",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "20.12.12",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "eslint": "8.57.0",
    "eslint-config-next": "14.2.5",
    "typescript": "5.4.5"
  }
}
```

---

## next.config.js (optional; Pages Router works fine without special config)
```js
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true }
module.exports = nextConfig
```

---

## tsconfig.json (ensure alias for `@/*`)
```json
{
  "compilerOptions": {
    "target": "es2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "baseUrl": ".",
    "paths": { "@/*": ["*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

---

## .env.local (example; fill with your Firebase web config)
```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

---

## /styles/globals.css
```css
* { box-sizing: border-box; }
html, body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; }
button { padding: 6px 10px; }
input, select, textarea { padding: 6px 8px; margin-left: 6px; }
code { background: #f6f6f6; padding: 2px 4px; border-radius: 4px; }
```

---

## /lib/firebaseClient.ts
```ts
'use client'
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
```

---

## /lib/types.ts
```ts
export type UserRole = 'rookie' | 'veteran' | 'evaluator' | 'admin'

export interface UserDoc {
  id: string               // preassigned roster ID
  name: string
  role: UserRole
  claimedByUid?: string    // UID that claimed this identity
  createdAt: number
}

export type Grade = 'Needs Work' | 'Proficient' | 'Advanced'

export interface StationRubricLevels { developing: string; proficient: string; mastery: string }

export interface StationDoc {
  id: string               // Firestore doc id
  name: string
  order: number            // unique station number
  active: boolean
  categories: string[]
  rubric: Record<string, StationRubricLevels> // key = category
}

export interface EvaluationDoc {
  id: string
  userId: string
  stationId: string
  grade: Grade              // derived from categoryGrades
  categoryGrades: Record<string, Grade>
  evaluatorName: string
  evaluatorId?: string
  notes?: string
  createdAt: number
}

export interface ProgressDoc {
  userId: string
  byStation: Record<string, Grade | undefined> // stationId -> best overall grade
  updatedAt: number
}
```

---

## /lib/firestore.ts
```ts
'use client'
import { db } from './firebaseClient'
import {
  doc, setDoc, getDoc, getDocs, collection, query, orderBy, writeBatch, runTransaction
} from 'firebase/firestore'
import type { UserDoc, StationDoc, EvaluationDoc, ProgressDoc, Grade, StationRubricLevels } from './types'

export const colUsers = () => collection(db, 'users')
export const colStations = () => collection(db, 'stations')
export const colEvaluations = () => collection(db, 'evaluations')
export const colProgress = () => collection(db, 'progress')

export async function getStationsOrdered(): Promise<StationDoc[]> {
  const qs = await getDocs(query(colStations(), orderBy('order', 'asc')))
  return qs.docs.map(d => d.data() as StationDoc)
}

export async function getUserById(id: string): Promise<UserDoc | null> {
  const ref = doc(db, 'users', id)
  const snap = await getDoc(ref)
  return snap.exists() ? (snap.data() as UserDoc) : null
}

export async function upsertEvaluation(e: EvaluationDoc): Promise<void> {
  const b = writeBatch(db)
  const evalRef = doc(db, 'evaluations', e.id)

  // Derive overall grade from category grades (min rule)
  const rank = (g: Grade | undefined) => (g === 'Advanced' ? 3 : g === 'Proficient' ? 2 : g === 'Needs Work' ? 1 : 0)
  const categories = Object.values(e.categoryGrades || {})
  const overallRank = categories.length ? Math.min(...categories.map(rank)) : rank(e.grade)
  const overall: Grade = overallRank >= 3 ? 'Advanced' : overallRank >= 2 ? 'Proficient' : 'Needs Work'
  const evalToSave: EvaluationDoc = { ...e, grade: overall }

  b.set(evalRef, evalToSave)

  // update Progress best grade per station
  const progRef = doc(db, 'progress', e.userId)
  const existing = await getDoc(progRef)
  const prev: ProgressDoc = existing.exists() ? (existing.data() as ProgressDoc) : { userId: e.userId, byStation: {}, updatedAt: Date.now() }
  const current = prev.byStation?.[e.stationId]
  if (rank(overall) >= rank(current)) {
    prev.byStation = { ...(prev.byStation || {}), [e.stationId]: overall }
  }
  prev.updatedAt = Date.now()
  b.set(progRef, prev)

  await b.commit()
}

export async function canAttemptStation(userId: string, stationId: string): Promise<{ ok: boolean; reason?: string }>{
  const [stations, progSnap] = await Promise.all([
    getStationsOrdered(),
    getDoc(doc(db, 'progress', userId))
  ])
  const target = stations.find(s => s.id === stationId)
  if (!target) return { ok: false, reason: 'Unknown station' }

  const byOrder = [...stations].sort((a,b) => a.order - b.order)
  const prereqs = byOrder.filter(s => s.order < target.order)

  const prog = progSnap.exists() ? (progSnap.data() as ProgressDoc) : { byStation: {} as ProgressDoc['byStation'] }
  const unmet = prereqs.filter(s => (prog.byStation?.[s.id] ?? 'Needs Work') !== 'Proficient' && (prog.byStation?.[s.id] ?? 'Needs Work') !== 'Advanced')
  if (unmet.length) {
    return { ok: false, reason: `Must be Proficient in: ${unmet.map(u => u.name).join(', ')}` }
  }
  return { ok: true }
}

export async function importUsersAndProgress(rows: Array<Record<string, string>>): Promise<{ inserted: number }>{
  const b = writeBatch(db)
  let count = 0
  for (const r of rows) {
    const id = (r.id || '').trim()
    const name = (r.name || '').trim()
    const role = (r.role || 'rookie').trim() as UserDoc['role']
    if (!id || !name) continue

    const u: UserDoc = { id, name, role, createdAt: Date.now() }
    b.set(doc(db, 'users', id), u, { merge: true })
    count++

    const stationId = (r.stationId || '').trim()
    const grade = (r.grade || '').trim() as Grade
    if (stationId && grade) {
      const pRef = doc(db, 'progress', id)
      const snap = await getDoc(pRef)
      const prev: ProgressDoc = snap.exists() ? (snap.data() as ProgressDoc) : { userId: id, byStation: {}, updatedAt: Date.now() }
      prev.byStation = { ...(prev.byStation || {}), [stationId]: grade }
      prev.updatedAt = Date.now()
      b.set(pRef, prev)

      const ev: EvaluationDoc = {
        id: `${id}_${stationId}_${Date.now()}`,
        userId: id,
        stationId,
        grade,
        categoryGrades: {},
        evaluatorName: (r.evaluatorName || 'Import'),
        createdAt: Date.now(),
      }
      b.set(doc(db, 'evaluations', ev.id), ev)
    }
  }
  await b.commit()
  return { inserted: count }
}

// ---- Stations with unique numbers via transaction ----
export async function createStationUniqueNumber(input: {
  name: string
  order: number
  active?: boolean
  categories: string[]
  rubric: Record<string, StationRubricLevels>
}): Promise<string> {
  const id = crypto.randomUUID()
  const stationRef = doc(db, 'stations', id)
  const orderRef = doc(db, 'stations_by_order', String(input.order))

  await runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef)
    if (orderSnap.exists()) {
      throw new Error(`Station #${input.order} already exists`)
    }
    tx.set(stationRef, {
      id,
      name: input.name,
      order: input.order,
      active: input.active ?? true,
      categories: input.categories,
      rubric: input.rubric,
    } as StationDoc)
    tx.set(orderRef, { stationId: id })
  })
  return id
}

export async function updateStationWithPossibleNumberChange(input: {
  id: string
  name: string
  newOrder: number
  categories: string[]
  rubric: Record<string, StationRubricLevels>
  active: boolean
  prevOrder: number
}): Promise<void> {
  const stationRef = doc(db, 'stations', input.id)
  const oldOrderRef = doc(db, 'stations_by_order', String(input.prevOrder))
  const newOrderRef = doc(db, 'stations_by_order', String(input.newOrder))

  await runTransaction(db, async (tx) => {
    const stSnap = await tx.get(stationRef)
    if (!stSnap.exists()) throw new Error('Station not found')

    if (input.newOrder !== input.prevOrder) {
      const newOrderSnap = await tx.get(newOrderRef)
      if (newOrderSnap.exists()) throw new Error(`Station #${input.newOrder} already exists`)
      tx.delete(oldOrderRef)
      tx.set(newOrderRef, { stationId: input.id })
    }

    tx.set(stationRef, {
      id: input.id,
      name: input.name,
      order: input.newOrder,
      active: input.active,
      categories: input.categories,
      rubric: input.rubric,
    } as StationDoc)
  })
}

export async function deleteStationAndFreeNumber(id: string, order: number): Promise<void> {
  const stationRef = doc(db, 'stations', id)
  const orderRef = doc(db, 'stations_by_order', String(order))
  await runTransaction(db, async (tx) => {
    tx.delete(stationRef)
    tx.delete(orderRef)
  })
}
```

---

## /lib/auth.ts
```ts
'use client'
import { auth } from './firebaseClient'
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

export async function googleSignIn() {
  try {
    return await signInWithPopup(auth, provider)
  } catch (e) {
    return await signInWithRedirect(auth, provider)
  }
}

export async function googleSignOut() { await signOut(auth) }
```

---

## /components/AuthProvider.tsx
```tsx
'use client'
import { ReactNode, useEffect, useState, createContext, useContext } from 'react'
import { auth } from '@/lib/firebaseClient'
import { onAuthStateChanged, User } from 'firebase/auth'

interface AuthCtx { user: User | null; loading: boolean }
const Ctx = createContext<AuthCtx>({ user: null, loading: true })
export const useAuth = () => useContext(Ctx)

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setLoading(false) }), [])
  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>
}
```

---

## /components/RequireAuth.tsx
```tsx
'use client'
import { useAuth } from './AuthProvider'
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p>Loading...</p>
  if (!user) return <p>You must be signed in. Go to <a href="/signin">Sign in</a>.</p>
  return <>{children}</>
}
```

---

## /components/RequireAdmin.tsx
```tsx
'use client'
import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    async function check() {
      if (!user) { setIsAdmin(false); return }
      const token = await user.getIdTokenResult()
      if (!alive) return
      setIsAdmin(!!token.claims.admin)
    }
    if (!loading) check()
    return () => { alive = false }
  }, [user, loading])
  if (loading || isAdmin === null) return <p>Checking admin…</p>
  if (!user) return <p>You must be signed in. Go to <a href="/signin">Sign in</a>.</p>
  if (!isAdmin) return <p>Admins only.</p>
  return <>{children}</>
}
```

---

## /pages/_app.tsx
```tsx
import type { AppProps } from 'next/app'
import '@/styles/globals.css'
import AuthProvider from '@/components/AuthProvider'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { googleSignOut } from '@/lib/auth'

function Nav() {
  const { user } = useAuth()
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, maxWidth: 960, marginInline: 'auto', padding: 16 }}>
      <h1><Link href="/">HMB-CTV</Link></h1>
      <nav style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link href="/claim">Claim</Link>
        <Link href="/evaluator">Evaluator</Link>
        <Link href="/admin/import">Admin</Link>
        <Link href="/signin">Sign in</Link>
        {user && (<>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{user.displayName || user.email}</span>
          <button onClick={googleSignOut}>Sign out</button>
        </>)}
      </nav>
    </header>
  )
}

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Nav />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
        <Component {...pageProps} />
      </div>
    </AuthProvider>
  )
}
```

---

## /pages/index.tsx
```tsx
'use client'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
export default function HomePage() {
  const { user } = useAuth()
  return (
    <main>
      <p>Welcome to HMB-CTV.</p>
      {user ? (
        <p>Hi {user.displayName || user.email}! If you haven’t yet, please <Link href="/claim">claim your identity</Link>.</p>
      ) : (
        <p>Please <Link href="/signin">sign in with Google</Link> to continue.</p>
      )}
    </main>
  )}
```

---

## /pages/signin.tsx
```tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { googleSignIn } from '@/lib/auth'
import { useAuth } from '@/components/AuthProvider'
export default function SignInPage() {
  const { user } = useAuth()
  const router = useRouter()
  useEffect(() => { if (user) router.replace('/claim') }, [user, router])
  return (
    <main>
      <h2>Sign in</h2>
      <p>Use your Google account to sign in/sign up.</p>
      <button onClick={googleSignIn}>Sign in with Google</button>
    </main>
  )
}
```

---

## /pages/claim.tsx
```tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import type { UserDoc } from '@/lib/types'
import RequireAuth from '@/components/RequireAuth'
import { useAuth } from '@/components/AuthProvider'

function ClaimInner() {
  const { user } = useAuth()
  const [term, setTerm] = useState('')
  const [users, setUsers] = useState<UserDoc[]>([])
  const [selected, setSelected] = useState<UserDoc | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => { (async () => {
    const qs = await getDocs(collection(db, 'users'))
    setUsers(qs.docs.map(d => d.data() as UserDoc))
  })() }, [])

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase()
    if (!t) return users
    return users.filter(u => u.name.toLowerCase().includes(t) || u.id.toLowerCase().includes(t))
  }, [term, users])

  async function claim(u: UserDoc) {
    if (!user) return
    setStatus('Claiming...')
    await setDoc(doc(db, 'users', u.id), { claimedByUid: user.uid }, { merge: true })
    setSelected(u)
    setStatus('Claimed!')
  }

  return (
    <main>
      <h2>Claim Your Identity</h2>
      <p>Signed in as <strong>{user?.displayName || user?.email}</strong></p>
      <input placeholder="Search name or ID" value={term} onChange={e => setTerm(e.target.value)} />
      <ul>
        {filtered.slice(0, 20).map(u => {
          const claimed = !!u.claimedByUid
          const youOwnIt = claimed && u.claimedByUid === user?.uid
          return (
            <li key={u.id} style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
              <span>{u.name} — <code>{u.id}</code> ({u.role}) {youOwnIt ? '✅ yours' : claimed ? '🔒 claimed' : '❌ unclaimed'}</span>
              <button disabled={claimed && !youOwnIt} onClick={() => claim(u)}>
                {youOwnIt ? 'Re-claim' : 'Claim'}
              </button>
            </li>
          )
        })}
      </ul>
      {selected && <p>Claimed {selected.name} ({selected.id}).</p>}
      {status && <p>{status}</p>}
    </main>
  )
}

export default function ClaimPage() {
  return (
    <RequireAuth>
      <ClaimInner />
    </RequireAuth>
  )
}
```

---

## /pages/evaluator.tsx
```tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import { getDocs, collection } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import type { StationDoc, UserDoc, Grade } from '@/lib/types'
import { canAttemptStation, upsertEvaluation } from '@/lib/firestore'
import RequireAuth from '@/components/RequireAuth'
import { useAuth } from '@/components/AuthProvider'

function EvaluatorInner() {
  const { user } = useAuth()
  const [stations, setStations] = useState<StationDoc[]>([])
  const [users, setUsers] = useState<UserDoc[]>([])
  const [stationId, setStationId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null)
  const [categoryGrades, setCategoryGrades] = useState<Record<string, Grade>>({})
  const [notes, setNotes] = useState('')
  const [rubricOpen, setRubricOpen] = useState<Record<string, boolean>>({})

  useEffect(() => { (async () => {
    const st = await getDocs(collection(db, 'stations'))
    setStations(st.docs.map(d => d.data() as StationDoc).sort((a,b) => a.order - b.order))
    const us = await getDocs(collection(db, 'users'))
    setUsers(us.docs.map(d => d.data() as UserDoc))
  })() }, [])

  useEffect(() => {
    const s = stations.find(x => x.id === stationId)
    if (s) {
      const init: Record<string, Grade> = {}
      for (const cat of s.categories) init[cat] = 'Needs Work'
      setCategoryGrades(init)
      setRubricOpen({})
    } else {
      setCategoryGrades({})
    }
  }, [stationId, stations])

  const filteredUsers = useMemo(() => {
    const t = search.trim().toLowerCase()
    if (!t) return []
    return users.filter(u => u.name.toLowerCase().includes(t) || u.id.toLowerCase().includes(t)).slice(0, 8)
  }, [search, users])

  function setCat(cat: string, g: Grade) { setCategoryGrades(prev => ({ ...prev, [cat]: g })) }

  async function submit() {
    if (!selectedUser) return alert('Pick a user')
    if (!stationId) return alert('Pick a station (stays locked until you change it)')

    const gate = await canAttemptStation(selectedUser.id, stationId)
    if (!gate.ok) return alert(`Cannot attempt: ${gate.reason}`)

    const e = {
      id: `${selectedUser.id}_${stationId}_${Date.now()}`,
      userId: selectedUser.id,
      stationId,
      grade: 'Needs Work', // derived in upsert
      categoryGrades,
      evaluatorName: user?.displayName || user?.email || 'Evaluator',
      evaluatorId: user?.uid,
      notes,
      createdAt: Date.now(),
    }
    // @ts-expect-error narrowed
    await upsertEvaluation(e)
    alert('Saved')
    setSelectedUser(null); setSearch(''); setCategoryGrades({}); setNotes('')
  }

  const currentStation = stations.find(s => s.id === stationId)

  return (
    <main>
      <h2>Evaluator</h2>
      <div style={{ marginBottom: 12 }}>
        <label>Selected Station (locked until changed): </label>
        <select value={stationId} onChange={e => setStationId(e.target.value)}>
          <option value="">— choose —</option>
          {stations.map(s => (<option key={s.id} value={s.id}>{s.order}. {s.name}</option>))}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>Find Student (type ID or Name): </label>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="e.g., 12345 or Alex" />
        {filteredUsers.length > 0 && (
          <ul style={{ border: '1px solid #ccc', padding: 8, marginTop: 4 }}>
            {filteredUsers.map(u => (
              <li key={u.id} style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                <span>{u.name} — <code>{u.id}</code></span>
                <button onClick={() => setSelectedUser(u)}>Select</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedUser && currentStation && (
        <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
          <p>Evaluating: <strong>{selectedUser.name}</strong> (<code>{selectedUser.id}</code>) · Station <strong>#{currentStation.order} {currentStation.name}</strong></p>
          <div style={{ display: 'grid', gap: 12 }}>
            {currentStation.categories.map(cat => (
              <div key={cat} style={{ border: '1px solid #ddd', padding: 8, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{cat}</strong>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label>
                      Grade:
                      <select style={{ marginLeft: 6 }} value={categoryGrades[cat] || 'Needs Work'} onChange={e => setCat(cat, e.target.value as Grade)}>
                        <option>Needs Work</option>
                        <option>Proficient</option>
                        <option>Advanced</option>
                      </select>
                    </label>
                    <button onClick={() => setRubricOpen(r => ({ ...r, [cat]: !r[cat] }))}>{rubricOpen[cat] ? 'Hide rubric' : 'View rubric'}</button>
                  </div>
                </div>
                {rubricOpen[cat] && (
                  <div style={{ marginTop: 8, background: '#fafafa', padding: 8, borderRadius: 6 }}>
                    <p style={{ margin: 0 }}><em>Developing:</em> {currentStation.rubric[cat]?.developing || '—'}</p>
                    <p style={{ margin: 0 }}><em>Proficient:</em> {currentStation.rubric[cat]?.proficient || '—'}</p>
                    <p style={{ margin: 0 }}><em>Mastery:</em> {currentStation.rubric[cat]?.mastery || '—'}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <label>General notes: </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
          <button onClick={submit} style={{ marginTop: 12 }}>Save Evaluation</button>
        </div>
      )}
    </main>
  )
}

export default function EvaluatorPage() {
  return (
    <RequireAuth>
      <EvaluatorInner />
    </RequireAuth>
  )
}
```

---

## /pages/admin/import.tsx
```tsx
'use client'
import { useState } from 'react'
import Papa from 'papaparse'
import { importUsersAndProgress } from '@/lib/firestore'
import RequireAuth from '@/components/RequireAuth'

function AdminImportInner() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  function parse(text: string) {
    const res = Papa.parse(text.trim(), { header: true, skipEmptyLines: true })
    return res.data as Array<Record<string, string>>
  }

  async function handleImport() {
    try {
      setStatus('Importing...')
      const rows = parse(text)
      const { inserted } = await importUsersAndProgress(rows)
      setStatus(`Imported ${inserted} users. Also seeded progress/evals when provided.`)
    } catch (e: any) {
      setStatus('Error: ' + e.message)
    }
  }

  return (
    <main>
      <h2>Admin Import</h2>
      <p>Paste CSV/TSV with headers: <code>id,name,role,stationId,grade,evaluatorName</code></p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={12} style={{ width: '100%' }} placeholder={`id,name,role,stationId,grade,evaluatorName
A123,Alex Johnson,rookie,station-1,Proficient,Coach K`}></textarea>
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button onClick={handleImport}>Import</button>
        {status && <span>{status}</span>}
      </div>
    </main>
  )
}

export default function AdminImportPage() {
  return (
    <RequireAuth>
      <AdminImportInner />
    </RequireAuth>
  )
}
```

---

## /pages/admin/stations.tsx
```tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import type { StationDoc, StationRubricLevels } from '@/lib/types'
import RequireAdmin from '@/components/RequireAdmin'
import { createStationUniqueNumber, updateStationWithPossibleNumberChange, deleteStationAndFreeNumber } from '@/lib/firestore'

function emptyLevels(): StationRubricLevels { return { developing: '', proficient: '', mastery: '' } }

function AdminStationsInner() {
  const [stations, setStations] = useState<StationDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<StationDoc | null>(null)
  const [form, setForm] = useState<{ name: string; order: number; active: boolean; categories: string[]; rubric: Record<string, StationRubricLevels> }>({ name: '', order: 1, active: true, categories: [], rubric: {} })

  async function refresh() {
    setLoading(true)
    const qs = await getDocs(collection(db, 'stations'))
    const list = qs.docs.map(d => d.data() as StationDoc).sort((a,b) => a.order - b.order)
    setStations(list)
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  const filtered = useMemo(() => {
    const t = filter.trim().toLowerCase()
    if (!t) return stations
    return stations.filter(s => s.name.toLowerCase().includes(t) || String(s.order) === t)
  }, [filter, stations])

  function resetForm() {
    setEditing(null)
    setForm({ name: '', order: 1, active: true, categories: [], rubric: {} })
  }

  function addCategory() {
    const name = prompt('New category name?')?.trim()
    if (!name) return
    if (form.categories.includes(name)) return alert('Already exists')
    setForm(f => ({ ...f, categories: [...f.categories, name], rubric: { ...f.rubric, [name]: emptyLevels() } }))
  }
  function removeCategory(cat: string) {
    const { [cat]: _, ...rest } = form.rubric
    setForm(f => ({ ...f, categories: f.categories.filter(c => c !== cat), rubric: rest }))
  }
  function setLevel(cat: string, level: keyof StationRubricLevels, value: string) {
    setForm(f => ({ ...f, rubric: { ...f.rubric, [cat]: { ...(f.rubric[cat] || emptyLevels()), [level]: value } } }))
  }

  async function submitCreate() {
    if (!form.name) return alert('Name is required')
    if (!form.order || form.order < 1) return alert('Order must be >= 1')
    try {
      await createStationUniqueNumber({ name: form.name, order: form.order, active: form.active, categories: form.categories, rubric: form.rubric })
      resetForm(); await refresh()
    } catch (e: any) { alert(e.message) }
  }

  async function submitUpdate() {
    if (!editing) return
    try {
      await updateStationWithPossibleNumberChange({ id: editing.id, name: form.name, newOrder: form.order, active: form.active, categories: form.categories, rubric: form.rubric, prevOrder: editing.order })
      resetForm(); await refresh()
    } catch (e: any) { alert(e.message) }
  }

  async function handleDelete(s: StationDoc) {
    if (!confirm(`Delete station #${s.order} – ${s.name}?`)) return
    await deleteStationAndFreeNumber(s.id, s.order)
    if (editing?.id === s.id) resetForm()
    await refresh()
  }

  function startEdit(s: StationDoc) {
    setEditing(s)
    setForm({ name: s.name, order: s.order, active: s.active, categories: s.categories, rubric: s.rubric })
  }

  return (
    <main>
      <h2>Admin · Stations & Rubrics</h2>
      <section style={{ marginBottom: 16 }}>
        <input placeholder="Filter by name or number" value={filter} onChange={e => setFilter(e.target.value)} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h3>{editing ? `Edit Station #${editing.order}` : 'Create Station'}</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <label>Number
              <input type="number" value={form.order} onChange={e => setForm({ ...form, order: Number(e.target.value) })} />
            </label>
            <label>Name
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Active
            </label>

            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <strong>Categories</strong>
                <button onClick={addCategory}>+ Add</button>
              </div>
              {form.categories.length === 0 && <p style={{ opacity: 0.7 }}>No categories yet.</p>}
              {form.categories.map(cat => (
                <div key={cat} style={{ border: '1px solid #ddd', padding: 8, borderRadius: 8, marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{cat}</strong>
                    <button onClick={() => removeCategory(cat)}>Remove</button>
                  </div>
                  <div>
                    <label>Developing
                      <textarea rows={2} value={form.rubric[cat]?.developing || ''} onChange={e => setLevel(cat, 'developing', e.target.value)} />
                    </label>
                  </div>
                  <div>
                    <label>Proficient
                      <textarea rows={2} value={form.rubric[cat]?.proficient || ''} onChange={e => setLevel(cat, 'proficient', e.target.value)} />
                    </label>
                  </div>
                  <div>
                    <label>Mastery
                      <textarea rows={2} value={form.rubric[cat]?.mastery || ''} onChange={e => setLevel(cat, 'mastery', e.target.value)} />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {editing ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={submitUpdate}>Update</button>
                <button onClick={resetForm}>Cancel</button>
              </div>
            ) : (
              <button onClick={submitCreate}>Create</button>
            )}
          </div>
        </div>

        <div>
          <h3>Existing Stations</h3>
          {loading ? <p>Loading…</p> : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {filtered.map(s => (
                <li key={s.id} style={{ border: '1px solid #eee', padding: 10, borderRadius: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>#{s.order}</strong> — {s.name} {s.active ? '' : '(inactive)'}
                      <div style={{ fontSize: 12, opacity: 0.8 }}>Categories: {s.categories.join(', ') || '—'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => startEdit(s)}>Edit</button>
                      <button onClick={() => handleDelete(s)}>Delete</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  )
}

export default function AdminStationsPage() {
  return (
    <RequireAdmin>
      <AdminStationsInner />
    </RequireAdmin>
  )
}
```

---

## /pages/api/seed-stations.ts
```ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/firebaseClient'
import { doc, setDoc } from 'firebase/firestore'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const stations = [
    { id: 'station-1', name: 'Attention Hold', order: 1, active: true, categories: [], rubric: {} },
    { id: 'station-2', name: 'Horns Up', order: 2, active: true, categories: [], rubric: {} },
    { id: 'station-3', name: 'Mark Time', order: 3, active: true, categories: [], rubric: {} },
    { id: 'station-4', name: 'Forward March', order: 4, active: true, categories: [], rubric: {} }
  ]
  await Promise.all(stations.map(s => setDoc(doc(db, 'stations', s.id), s)))
  res.json({ ok: true })
}
```

---

## /firebase.rules (paste into Firestore rules)
```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function isAdmin() { return isSignedIn() && request.auth.token.admin == true; }

    match /users/{userId} {
      allow read: if isSignedIn();
      // allow first claim or same-owner updates
      allow write: if isAdmin() || (
        isSignedIn() &&
        request.resource.data.claimedByUid == request.auth.uid &&
        (
          !('claimedByUid' in resource.data) ||
          resource.data.claimedByUid == null ||
          resource.data.claimedByUid == request.auth.uid
        )
      );
    }

    match /stations/{stationId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /evaluations/{evalId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update, delete: if isAdmin();
    }

    match /progress/{userId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn();
    }

    match /stations_by_order/{id} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }
  }
}
```

---

## How to run
```bash
pnpm i
pnpm dev
# (optional) seed stations
curl -X POST http://localhost:3000/api/seed-stations
```

**Admin claim:** use Firebase Admin SDK to set `admin: true` on your UID, then sign out/in.

That’s the complete **Pages Router** bundle — no `app/` references anywhere. Paste these in and you’re good to go.

---

## Update: Add `rookieClass` to users (year / pledge class)
This adds a `rookieClass` string to `UserDoc`, wires it through CSV import, shows it in Claim and Evaluator UIs, and adds a filter by class on the Evaluator search.

### 1) `/lib/types.ts` — add field
```ts
export interface UserDoc {
  id: string               // preassigned roster ID
  name: string
  role: UserRole
  rookieClass?: string     // e.g., "Fall 2025", "Alpha", etc.
  claimedByUid?: string    // UID that claimed this identity
  createdAt: number
}
```

### 2) `/lib/firestore.ts` — import supports rookieClass
Replace the `importUsersAndProgress(...)` function with this version:
```ts
export async function importUsersAndProgress(rows: Array<Record<string, string>>): Promise<{ inserted: number }>{
  const b = writeBatch(db)
  let count = 0
  for (const r of rows) {
    const id = (r.id || '').trim()
    const name = (r.name || '').trim()
    const role = (r.role || 'rookie').trim() as UserDoc['role']
    const rookieClass = (r.rookieClass || r.class || r.rookie_class || '').trim()
    if (!id || !name) continue

    const u: UserDoc = { id, name, role, rookieClass, createdAt: Date.now() }
    b.set(doc(db, 'users', id), u, { merge: true })
    count++

    const stationId = (r.stationId || '').trim()
    const grade = (r.grade || '').trim() as Grade
    if (stationId && grade) {
      const pRef = doc(db, 'progress', id)
      const snap = await getDoc(pRef)
      const prev: ProgressDoc = snap.exists() ? (snap.data() as ProgressDoc) : { userId: id, byStation: {}, updatedAt: Date.now() }
      prev.byStation = { ...(prev.byStation || {}), [stationId]: grade }
      prev.updatedAt = Date.now()
      b.set(pRef, prev)

      const ev: EvaluationDoc = {
        id: `${id}_${stationId}_${Date.now()}`,
        userId: id,
        stationId,
        grade,
        categoryGrades: {},
        evaluatorName: (r.evaluatorName || 'Import'),
        createdAt: Date.now(),
      }
      b.set(doc(db, 'evaluations', ev.id), ev)
    }
  }
  await b.commit()
  return { inserted: count }
}
```

### 3) `pages/admin/import.tsx` — update header hint
Replace the paragraph above the textarea with:
```tsx
<p>Paste CSV/TSV with headers: <code>id,name,role,rookieClass,stationId,grade,evaluatorName</code></p>
```

### 4) `pages/claim.tsx` — show rookieClass and sanitize reads (full file)
```tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import type { UserDoc } from '@/lib/types'
import RequireAuth from '@/components/RequireAuth'
import { useAuth } from '@/components/AuthProvider'

function ClaimInner() {
  const { user } = useAuth()
  const [term, setTerm] = useState<string>('')
  const [users, setUsers] = useState<UserDoc[]>([])
  const [selected, setSelected] = useState<UserDoc | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const qs = await getDocs(collection(db, 'users'))
      const list: UserDoc[] = qs.docs
        .map(d => {
          const raw: any = d.data()
          const id = String(raw?.id ?? d.id ?? '').trim()
          const name = String(raw?.name ?? '').trim()
          const role = (raw?.role ?? 'rookie') as UserDoc['role']
          const rookieClass = raw?.rookieClass ? String(raw.rookieClass) : undefined
          const claimedByUid = raw?.claimedByUid ? String(raw.claimedByUid) : undefined
          if (!id || !name) return null
          return { id, name, role, rookieClass, claimedByUid, createdAt: Number(raw?.createdAt ?? Date.now()) }
        })
        .filter((u): u is UserDoc => !!u)
      setUsers(list)
    })()
  }, [])

  const filtered = useMemo(() => {
    const t = (term ?? '').toString().trim().toLowerCase()
    if (!t) return users
    return users.filter(u => {
      const name = (u?.name ?? '').toString().toLowerCase()
      const id = (u?.id ?? '').toString().toLowerCase()
      const klass = (u?.rookieClass ?? '').toString().toLowerCase()
      return name.includes(t) || id.includes(t) || klass.includes(t)
    })
  }, [term, users])

  async function claim(u: UserDoc) {
    if (!user) return
    setStatus('Claiming...')
    await setDoc(doc(db, 'users', u.id), { claimedByUid: user.uid }, { merge: true })
    setSelected(u)
    setStatus('Claimed!')
    setUsers(prev => prev.map(x => (x.id === u.id ? { ...x, claimedByUid: user.uid } : x)))
  }

  return (
    <main>
      <h2>Claim Your Identity</h2>
      <p>Signed in as <strong>{user?.displayName || user?.email}</strong></p>
      <input
        placeholder="Search name, ID, or class (e.g., Fall 2025)"
        value={term}
        onChange={e => setTerm(e.target.value ?? '')}
      />
      <ul>
        {filtered.slice(0, 20).map(u => {
          const claimed = !!u.claimedByUid
          const youOwnIt = claimed && u.claimedByUid === user?.uid
          return (
            <li key={u.id} style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
              <span>
                {(u.name ?? '—')} — <code>{u.id}</code> ({u.role}){u.rookieClass ? ` · ${u.rookieClass}` : ''}
              </span>
              <button disabled={claimed && !youOwnIt} onClick={() => claim(u)}>
                {youOwnIt ? 'Re-claim' : 'Claim'}
              </button>
            </li>
          )
        })}
      </ul>
      {selected && <p>Claimed {selected.name} ({selected.id}).</p>}
      {status && <p>{status}</p>}
    </main>
  )
}

export default function ClaimPage() {
  return (
    <RequireAuth>
      <ClaimInner />
    </RequireAuth>
  )
}
```

### 5) `pages/evaluator.tsx` — show class + add class filter (full file)
```tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import { getDocs, collection } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import type { StationDoc, UserDoc, Grade } from '@/lib/types'
import { canAttemptStation, upsertEvaluation } from '@/lib/firestore'
import RequireAuth from '@/components/RequireAuth'
import { useAuth } from '@/components/AuthProvider'

function EvaluatorInner() {
  const { user } = useAuth()
  const [stations, setStations] = useState<StationDoc[]>([])
  const [users, setUsers] = useState<UserDoc[]>([])
  const [stationId, setStationId] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [classFilter, setClassFilter] = useState<string>('')
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null)
  const [categoryGrades, setCategoryGrades] = useState<Record<string, Grade>>({})
  const [notes, setNotes] = useState<string>('')
  const [rubricOpen, setRubricOpen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    (async () => {
      const st = await getDocs(collection(db, 'stations'))
      const stList: StationDoc[] = st.docs
        .map(d => {
          const raw: any = d.data()
          if (!raw) return null
          return {
            id: String(raw.id ?? d.id),
            name: String(raw.name ?? 'Untitled'),
            order: Number(raw.order ?? 0),
            active: Boolean(raw.active ?? true),
            categories: Array.isArray(raw.categories) ? raw.categories.map((c: any) => String(c)) : [],
            rubric: typeof raw.rubric === 'object' && raw.rubric ? raw.rubric : {},
          } as StationDoc
        })
        .filter((s): s is StationDoc => !!s)
        .sort((a, b) => a.order - b.order)
      setStations(stList)

      const us = await getDocs(collection(db, 'users'))
      const userList: UserDoc[] = us.docs
        .map(d => {
          const raw: any = d.data()
          const id = String(raw?.id ?? d.id ?? '').trim()
          const name = String(raw?.name ?? '').trim()
          if (!id || !name) return null
          return {
            id,
            name,
            role: (raw?.role ?? 'rookie') as UserDoc['role'],
            rookieClass: raw?.rookieClass ? String(raw.rookieClass) : undefined,
            claimedByUid: raw?.claimedByUid ? String(raw.claimedByUid) : undefined,
            createdAt: Number(raw?.createdAt ?? Date.now()),
          } as UserDoc
        })
        .filter((u): u is UserDoc => !!u)
      setUsers(userList)
    })()
  }, [])

  useEffect(() => {
    const s = stations.find(x => x.id === stationId)
    if (s) {
      const init: Record<string, Grade> = {}
      for (const cat of (s.categories ?? [])) init[String(cat)] = 'Needs Work'
      setCategoryGrades(init)
      setRubricOpen({})
    } else {
      setCategoryGrades({})
    }
  }, [stationId, stations])

  const classes = useMemo(() => Array.from(new Set(users.map(u => u.rookieClass).filter(Boolean))) as string[], [users])

  const filteredUsers = useMemo(() => {
    const t = (search ?? '').toString().trim().toLowerCase()
    return users
      .filter(u => (classFilter ? u.rookieClass === classFilter : true))
      .filter(u => {
        if (!t) return true
        const name = (u?.name ?? '').toString().toLowerCase()
        const id = (u?.id ?? '').toString().toLowerCase()
        const klass = (u?.rookieClass ?? '').toString().toLowerCase()
        return name.includes(t) || id.includes(t) || klass.includes(t)
      })
      .slice(0, 8)
  }, [search, users, classFilter])

  function setCat(cat: string, g: Grade) {
    setCategoryGrades(prev => ({ ...prev, [String(cat)]: g }))
  }

  async function submit() {
    if (!selectedUser) return alert('Pick a user')
    if (!stationId) return alert('Pick a station (stays locked until you change it)')

    const gate = await canAttemptStation(selectedUser.id, stationId)
    if (!gate.ok) return alert(`Cannot attempt: ${gate.reason}`)

    const e = {
      id: `${selectedUser.id}_${stationId}_${Date.now()}`,
      userId: selectedUser.id,
      stationId,
      grade: 'Needs Work', // derived in upsert
      categoryGrades,
      evaluatorName: user?.displayName || user?.email || 'Evaluator',
      evaluatorId: user?.uid,
      notes,
      createdAt: Date.now(),
    }
    // @ts-expect-error narrowed type
    await upsertEvaluation(e)
    alert('Saved')
    setSelectedUser(null)
    setSearch('')
    setCategoryGrades({})
    setNotes('')
  }

  const currentStation = stations.find(s => s.id === stationId)

  return (
    <main>
      <h2>Evaluator</h2>
      <div style={{ marginBottom: 12 }}>
        <label>Selected Station (locked until changed): </label>
        <select value={stationId} onChange={e => setStationId(e.target.value)}>
          <option value="">— choose —</option>
          {stations.map(s => (
            <option key={s.id} value={s.id}>
              {s.order}. {s.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>Find Student (type ID, Name, or Class): </label>
        <input
          value={search}
          onChange={e => setSearch(e.target.value ?? '')}
          placeholder="e.g., 12345 or Alex or Fall 2025"
        />
        {classes.length > 0 && (
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="">All classes</option>
            {classes.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        {filteredUsers.length > 0 && (
          <ul style={{ border: '1px solid #ccc', padding: 8, marginTop: 4 }}>
            {filteredUsers.map(u => (
              <li key={u.id} style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                <span>{u.name} — <code>{u.id}</code>{u.rookieClass ? ` · ${u.rookieClass}` : ''}</span>
                <button onClick={() => setSelectedUser(u)}>Select</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedUser && currentStation && (
        <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
          <p>
            Evaluating: <strong>{selectedUser.name}</strong> (<code>{selectedUser.id}</code>) · Station{' '}
            <strong>#{currentStation.order} {currentStation.name}</strong>
          </p>
          <div style={{ display: 'grid', gap: 12 }}>
            {(currentStation.categories ?? []).map(cat => (
              <CategoryBox
                key={String(cat)}
                cat={String(cat)}
                rubric={currentStation.rubric?.[String(cat)]}
                value={categoryGrades[String(cat)] ?? 'Needs Work'}
                onChange={g => setCat(String(cat), g)}
              />
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <label>General notes: </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value ?? '')} rows={3} />
          </div>
          <button onClick={submit} style={{ marginTop: 12 }}>Save Evaluation</button>
        </div>
      )}
    </main>
  )
}

function CategoryBox({
  cat,
  rubric,
  value,
  onChange,
}: {
  cat: string
  rubric?: { developing?: string; proficient?: string; mastery?: string }
  value: Grade
  onChange: (g: Grade) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid #ddd', padding: 8, borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{cat}</strong>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label>
            Grade:
            <select style={{ marginLeft: 6 }} value={value} onChange={e => onChange(e.target.value as Grade)}>
              <option>Needs Work</option>
              <option>Proficient</option>
              <option>Advanced</option>
            </select>
          </label>
          <button onClick={() => setOpen(v => !v)}>{open ? 'Hide rubric' : 'View rubric'}</button>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 8, background: '#fafafa', padding: 8, borderRadius: 6 }}>
          <p style={{ margin: 0 }}><em>Developing:</em> {rubric?.developing ?? '—'}</p>
          <p style={{ margin: 0 }}><em>Proficient:</em> {rubric?.proficient ?? '—'}</p>
          <p style={{ margin: 0 }}><em>Mastery:</em> {rubric?.mastery ?? '—'}</p>
        </div>
      )}
    </div>
  )
}

export default function EvaluatorPage() {
  return (
    <RequireAuth>
      <EvaluatorInner />
    </RequireAuth>
  )
}
```

**That’s all you need** to track rookie classes across users, display them in the UI, import them via CSV, and filter by class on the evaluator search.
