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
