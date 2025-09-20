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
