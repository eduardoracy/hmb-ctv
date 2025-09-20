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
