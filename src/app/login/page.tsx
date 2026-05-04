'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Truck } from 'lucide-react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // This email is used in the background to provide a secure session
  const FIXED_EMAIL = 'driver@likh-lo.com'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ 
      email: FIXED_EMAIL, 
      password 
    })

    if (error) {
      setError('Incorrect password. Please try again.')
    } else {
      router.push('/expenses')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-black p-6">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="h-16 w-16 bg-[#1a365d] rounded-2xl flex items-center justify-center shadow-xl">
          <Truck className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Likh-lo</h1>
      </div>

      <Card className="w-full max-w-sm border-none shadow-none">
        <CardHeader className="text-center px-0">
          <CardTitle className="text-xl">Enter Password</CardTitle>
          <CardDescription>Enter the driver access code to continue</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••"
                className="h-14 text-center text-2xl tracking-[0.5em] rounded-xl bg-zinc-50 border-zinc-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required 
              />
            </div>
            
            {error && (
              <p className="text-sm font-medium text-red-500 text-center">
                {error}
              </p>
            )}

            <Button 
              type="submit"
              className="w-full h-14 text-lg font-bold bg-[#1a365d] hover:bg-[#1a365d]/90 text-white rounded-xl shadow-lg transition-all active:scale-[0.98]" 
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <p className="mt-8 text-xs text-zinc-400">
        Secured by Supabase Auth
      </p>
    </div>
  )
}

