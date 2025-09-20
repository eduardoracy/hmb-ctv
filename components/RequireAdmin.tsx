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
