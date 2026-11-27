'use client'

import { useActionState, useState } from 'react'
import { AlertCircle, Eye, EyeOff, Loader2, ScanLine, ShieldCheck, TrendingUp, Truck } from 'lucide-react'
import { BrandMark } from '@/components/app/app-shell'
import { Panel } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signIn } from './actions'

const VALUE_PROPS = [
  { icon: ScanLine, title: 'Scan register pages with on-device AI', body: 'Snap a photo — every line is read and filled in for you.' },
  { icon: Truck, title: 'Track every truck and trip', body: 'Diesel, toll, driver cash and more, logged against each trip.' },
  { icon: TrendingUp, title: 'Know your profit instantly', body: 'See what each truck and trip earns, without a calculator.' },
]

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  // Sign-in runs on the server, so phones don't download the Supabase client just for this form.
  const [state, formAction, loading] = useActionState(signIn, null)
  const error = state?.error ?? null

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-hero p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 size-96 rounded-full bg-white/5 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <BrandMark className="size-11" />
          <span className="text-xl font-semibold tracking-tight">Likh-lo</span>
        </div>

        <div className="relative max-w-md space-y-10">
          <div className="space-y-3">
            <h1 className="text-4xl leading-tight font-semibold tracking-tight">Your truck register, digitised</h1>
            <p className="text-base text-white/70">Everything you write in the register — now searchable, totalled and safe.</p>
          </div>
          <ul className="space-y-5">
            {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="block text-sm text-white/65">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">Likh-lo · Fleet ledger for truck owners</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm space-y-6 animate-in fade-in-0">
          <div className="flex flex-col items-center gap-3 text-center lg:hidden">
            <BrandMark className="size-14 rounded-2xl" />
            <div>
              <p className="text-xl font-semibold tracking-tight">Likh-lo</p>
              <p className="text-sm text-muted-foreground">Your truck register, digitised</p>
            </div>
          </div>

          <Panel className="space-y-6 p-6 sm:p-8">
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold tracking-tight">Welcome back</h2>
              <p className="text-sm text-muted-foreground">Enter your password to open your ledger.</p>
            </div>

            <form action={formAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={show ? 'text' : 'password'}
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="Enter password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    aria-invalid={!!error}
                    aria-describedby={error ? 'password-error' : undefined}
                    autoFocus
                    required
                    className="h-11 rounded-xl pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(s => !s)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    aria-pressed={show}
                    className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {error && (
                  <p id="password-error" role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertCircle className="size-4 shrink-0" />
                    {error}
                  </p>
                )}
              </div>

              <Button type="submit" className="h-11 w-full rounded-xl text-sm active:scale-[0.98]" disabled={loading || !password}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" /> Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </Panel>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Secured by Supabase Auth
          </p>
        </div>
      </main>
    </div>
  )
}
