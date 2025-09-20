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
<p>Paste CSV/TSV with headers: <code>id,name,role,rookieClass,stationId,grade,evaluatorName</code></p>
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
