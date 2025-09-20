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
