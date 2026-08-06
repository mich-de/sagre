import { Link, useLocation } from 'react-router-dom'
import { CalendarDays, ShieldCheck } from 'lucide-react'

export function Header() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-outline-dark)] bg-[var(--color-bg-dark)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-lg"
            style={{ background: 'linear-gradient(135deg, var(--color-orange-hot), var(--color-purple-mid))' }}
          >
            🎪
          </span>
          <span className="font-[var(--font-display)] text-lg font-semibold tracking-tight text-[var(--color-on-bg-dark)]">
            Eventi <span className="text-[var(--color-orange-warm)]">e</span> Sagre
          </span>
        </Link>

        <nav className="flex items-center gap-4 text-sm text-[var(--color-on-surface-variant-dark)]">
          <Link
            to="/"
            className="flex items-center gap-1.5 transition-colors hover:text-[var(--color-on-bg-dark)]"
          >
            <CalendarDays size={16} />
            <span className="hidden sm:inline">Calendario</span>
          </Link>
          <Link
            to="/admin"
            className={`flex items-center gap-1.5 transition-colors hover:text-[var(--color-on-bg-dark)] ${
              isAdmin ? 'text-[var(--color-orange-warm)]' : ''
            }`}
          >
            <ShieldCheck size={16} />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </nav>
      </div>
    </header>
  )
}
