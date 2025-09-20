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
