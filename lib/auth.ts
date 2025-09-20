'use client'
import { auth } from './firebaseClient'
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

export async function googleSignIn() {
  try {
    return await signInWithPopup(auth, provider)
  } catch (e) {
    return await signInWithRedirect(auth, provider)
  }
}

export async function googleSignOut() { await signOut(auth) }
