import type { AppProps } from 'next/app'
import '@/styles/globals.css'
import AuthProvider from '@/components/AuthProvider'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { googleSignOut } from '@/lib/auth'

function Nav() {
  const { user } = useAuth()
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, maxWidth: 960, marginInline: 'auto', padding: 16 }}>
      <h1><Link href="/">HMB-CTV</Link></h1>
      <nav style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link href="/claim">Claim</Link>
        <Link href="/evaluator">Evaluator</Link>
        <Link href="/admin/import">Admin</Link>
        <Link href="/signin">Sign in</Link>
        {user && (<>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{user.displayName || user.email}</span>
          <button onClick={googleSignOut}>Sign out</button>
        </>)}
      </nav>
    </header>
  )
}

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Nav />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
        <Component {...pageProps} />
      </div>
    </AuthProvider>
  )
}
