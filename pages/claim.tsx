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
