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
  if (error) return { error: error.status === 400 ? 'Incorrect password. Please try again.' : 'Could not sign in. Check your internet and try again.' }
  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
