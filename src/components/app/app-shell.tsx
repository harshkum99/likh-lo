'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Truck, ScanLine, ReceiptIndianRupee, Gauge, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/app/login/actions'

const NAV = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Trips', href: '/trips', icon: Truck },
  { name: 'Scan', href: '/scan', icon: ScanLine, primary: true },
  { name: 'Add', href: '/expenses', icon: ReceiptIndianRupee, long: 'Add expense' },
  { name: 'Fleet', href: '/fleet', icon: Gauge },
] as const

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + '/')

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn('flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-hero-from to-hero-to text-white shadow-md shadow-primary/20', className)}>
      <Truck className="size-5" />
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === '/login') return <>{children}</>

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card/60 px-4 py-5 backdrop-blur-xl lg:flex">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <BrandMark />
          <div>
            <p className="text-base font-semibold tracking-tight">Likh-lo</p>
            <p className="text-xs text-muted-foreground">Fleet ledger</p>
          </div>
        </Link>

        <Link
          href="/scan"
          className="mt-6 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-md shadow-primary/25 transition hover:bg-primary/90 active:scale-[0.98]"
        >
          <ScanLine className="size-4" />
          Scan register page
        </Link>

        <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
          {NAV.filter(n => !('primary' in n)).map(item => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                  active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-[18px]" />
                {'long' in item ? item.long : item.name}
              </Link>
            )
          })}
        </nav>

        <form action={signOut} className="mt-auto">
          <button className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <LogOut className="size-[18px]" />
            Sign out
          </button>
        </form>
      </aside>

      <main className="pb-safe-nav lg:pb-12">{children}</main>

      {/* Mobile tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center px-2">
          {NAV.map(item => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon
            if ('primary' in item) {
              return (
                <Link key={item.href} href={item.href} aria-label="Scan register page" className="flex justify-center">
                  <span
                    className={cn(
                      '-mt-7 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-hero-to text-white shadow-lg shadow-primary/30 ring-4 ring-background transition active:scale-95',
                      active && 'ring-primary/20',
                    )}
                  >
                    <Icon className="size-6" />
                  </span>
                </Link>
              )
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className={cn('size-5', active && 'stroke-[2.25]')} />
                {item.name}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
