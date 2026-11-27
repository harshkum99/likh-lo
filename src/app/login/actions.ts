'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

// The app has a single shared account; this email is used in the background to provide a secure session.
const FIXED_EMAIL = 'driver@likh-lo.com'

// shortcut: Supabase rate-limits sign-ins per IP, and these now come from the server's IP; move to per-user accounts
// (or add a captcha) if the login is ever attacked.
export async function signIn(_prev: { error: string } | null, formData: FormData): Promise<{ error: string } | null> {
  const password = formData.get('password')
  if (typeof password !== 'string' || !password) return { error: 'Enter the password.' }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email: FIXED_EMAIL, password })
  if (error) {
    // Supabase answers 400 for several different problems; name the real one so a setup issue isn't mistaken for a typo.
    console.error('Sign-in failed:', error.status, error.code, error.message)
    if (error.code === 'invalid_credentials') return { error: 'Incorrect password. Please try again.' }
    if (error.code === 'email_not_confirmed') return { error: 'This account is not confirmed yet. Confirm driver@likh-lo.com in Supabase → Authentication → Users.' }
    if (error.status && error.status < 500) return { error: `Could not sign in: ${error.message}` }
    return { error: 'Could not sign in. Check your internet and try again.' }
  }
  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
