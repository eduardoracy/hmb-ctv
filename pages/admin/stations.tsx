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
