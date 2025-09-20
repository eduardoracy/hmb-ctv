'use client'
import { useAuth } from './AuthProvider'
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p>Loading...</p>
  if (!user) return <p>You must be signed in. Go to <a href="/signin">Sign in</a>.</p>
  return <>{children}</>
}
