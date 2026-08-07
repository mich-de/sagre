import { useEffect, useState, type FormEvent } from 'react'
import { LogIn, LogOut, Upload, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import { getPoster, upsertPoster, deletePoster, resizeImageToDataUrl } from '../lib/posters'
import type { CalendarEvent } from '../lib/googleCalendar'

export function Admin() {
  const { user, loading, login, logout } = useAuth()

  if (loading) {
    return <main className="mx-auto max-w-md px-4 py-16 text-center text-sm text-[var(--color-on-surface-variant-dark)]">Caricamento…</main>
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {user ? <PosterManager userEmail={user.email ?? ''} onLogout={logout} /> : <LoginForm onLogin={login} />}
    </main>
  )
}

function LoginForm({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onLogin(email, password)
    } catch {
      setError('Accesso non riuscito. Controlla email e password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-[var(--color-outline-dark)] bg-[var(--color-surface-dark)] p-6">
      <h1 className="mb-1 font-[var(--font-display)] text-xl font-semibold text-[var(--color-on-bg-dark)]">
        Accesso amministratore
      </h1>
      <p className="mb-5 text-sm text-[var(--color-on-surface-variant-dark)]">
        Gestisci le locandine degli eventi.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          required
          autoComplete="username"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-[var(--color-outline-dark)] bg-[var(--color-bg-dark)] px-3 py-2 text-sm text-[var(--color-on-bg-dark)] outline-none focus:border-[var(--color-orange-warm)]"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-[var(--color-outline-dark)] bg-[var(--color-bg-dark)] px-3 py-2 text-sm text-[var(--color-on-bg-dark)] outline-none focus:border-[var(--color-orange-warm)]"
        />
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-300">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--color-orange-hot)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <LogIn size={16} />
          {submitting ? 'Accesso…' : 'Accedi'}
        </button>
      </form>
    </div>
  )
}

function PosterManager({ userEmail, onLogout }: { userEmail: string; onLogout: () => void }) {
  const { events, loading, error } = useCalendarEvents()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = events.find((e) => e.id === selectedId) ?? null

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-xl font-semibold text-[var(--color-on-bg-dark)]">
            Locandine eventi
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant-dark)]">{userEmail}</p>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 rounded-full border border-[var(--color-outline-dark)] px-3 py-1.5 text-xs text-[var(--color-on-surface-variant-dark)] hover:text-[var(--color-on-bg-dark)]"
        >
          <LogOut size={14} />
          Esci
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <div className="max-h-[70vh] space-y-1 overflow-y-auto rounded-xl border border-[var(--color-outline-dark)] bg-[var(--color-surface-dark)] p-2">
          {loading && <p className="p-2 text-xs text-[var(--color-on-surface-variant-dark)]">Caricamento eventi…</p>}
          {!loading && events.length === 0 && (
            <p className="p-2 text-xs text-[var(--color-on-surface-variant-dark)]">Nessun evento trovato.</p>
          )}
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedId(e.id)}
              className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                selectedId === e.id
                  ? 'bg-[var(--color-orange-hot)] text-white'
                  : 'text-[var(--color-on-surface-dark)] hover:bg-[var(--color-surface2-dark)]'
              }`}
            >
              {e.title}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--color-outline-dark)] bg-[var(--color-surface-dark)] p-4">
          {selected ? (
            <PosterUploader key={selected.id} event={selected} userEmail={userEmail} />
          ) : (
            <p className="text-sm text-[var(--color-on-surface-variant-dark)]">
              Seleziona un evento dalla lista per caricarne la locandina.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function PosterUploader({ event, userEmail }: { event: CalendarEvent; userEmail: string }) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [posterLoading, setPosterLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    setPosterLoading(true)
    setMessage(null)
    getPoster(event.id)
      .then((p) => {
        if (!cancelled) setPosterUrl(p?.dataUrl ?? null)
      })
      .finally(() => {
        if (!cancelled) setPosterLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [event.id])

  async function handleFile(file: File) {
    setBusy(true)
    setMessage(null)
    try {
      const dataUrl = await resizeImageToDataUrl(file)
      await upsertPoster(event.id, dataUrl, userEmail)
      setPosterUrl(dataUrl)
      setMessage({ kind: 'ok', text: 'Locandina caricata.' })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Errore durante il caricamento.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    setMessage(null)
    try {
      await deletePoster(event.id)
      setPosterUrl(null)
      setMessage({ kind: 'ok', text: 'Locandina rimossa.' })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Errore durante la rimozione.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2 className="mb-3 font-medium text-[var(--color-on-bg-dark)]">{event.title}</h2>

      <div className="mb-4 flex h-48 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-surface2-dark)]">
        {posterLoading ? (
          <div className="h-full w-full animate-pulse bg-[var(--color-surface3-dark)]" />
        ) : posterUrl ? (
          <img src={posterUrl} alt={event.title} className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm text-[var(--color-on-surface-variant-dark)]">Nessuna locandina</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[var(--color-orange-hot)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
          <Upload size={16} />
          {busy ? 'Caricamento…' : 'Carica immagine'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />
        </label>
        {posterUrl && (
          <button
            onClick={handleDelete}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            <Trash2 size={16} />
            Rimuovi
          </button>
        )}
      </div>

      {message && (
        <div className={`mt-3 flex items-center gap-2 text-sm ${message.kind === 'ok' ? 'text-green-300' : 'text-red-300'}`}>
          {message.kind === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {message.text}
        </div>
      )}
    </div>
  )
}
