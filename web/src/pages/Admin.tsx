import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { LogIn, LogOut, Upload, Trash2, CheckCircle2, AlertTriangle, Search, ImageOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import { getPoster, upsertPoster, deletePoster, resizeImageToDataUrl } from '../lib/posters'
import { shortRange, eventStart } from '../lib/dates'
import type { CalendarEvent } from '../lib/googleCalendar'

export function Admin() {
  const { user, loading, login, logout } = useAuth()

  if (loading) {
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="eyebrow animate-pulse">Apertura dell'ufficio…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {user ? <PosterManager userEmail={user.email ?? ''} onLogout={logout} /> : <LoginForm onLogin={login} />}
    </main>
  )
}

/* --------------------------------------------------------------- login -- */

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
    <div className="ink-box mx-auto mt-12 max-w-sm animate-ink-rise p-6">
      <p className="eyebrow">Ufficio manifesti</p>
      <h1 className="mt-2 font-display text-3xl leading-none font-black text-ink">Accesso</h1>
      <div className="rule-double my-5" />
      <p className="mb-5 text-sm text-ink-soft">
        Solo l'organizzatore può affiggere le locandine sul cartellone.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Email">
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border-2 border-ink bg-paper px-3 py-2 text-sm text-ink outline-none focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio focus:ring-offset-2 focus:ring-offset-paper-hi"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border-2 border-ink bg-paper px-3 py-2 text-sm text-ink outline-none focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio focus:ring-offset-2 focus:ring-offset-paper-hi"
          />
        </Field>

        {error && (
          <div className="flex items-center gap-2 border-2 border-vermiglio bg-vermiglio/10 p-2.5 text-xs font-medium text-ink">
            <AlertTriangle size={14} className="shrink-0 text-vermiglio" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="stamp-btn flex w-full items-center justify-center gap-2 bg-vermiglio px-4 py-2.5 text-[0.7rem] font-bold tracking-[0.14em] uppercase text-paper-hi"
        >
          <LogIn size={15} />
          {submitting ? 'Accesso…' : 'Entra'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 block">{label}</span>
      {children}
    </label>
  )
}

/* ------------------------------------------------------------- gestione -- */

function PosterManager({ userEmail, onLogout }: { userEmail: string; onLogout: () => void }) {
  const { events, loading, error } = useCalendarEvents()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const selected = events.find((e) => e.id === selectedId) ?? null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...events].sort((a, b) => eventStart(b).getTime() - eventStart(a).getTime())
    if (!q) return sorted
    return sorted.filter((e) => `${e.title} ${e.location}`.toLowerCase().includes(q))
  }, [events, query])

  return (
    <div className="animate-ink-rise">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Ufficio manifesti</p>
          <h1 className="mt-1 font-display text-3xl leading-none font-black text-ink sm:text-4xl">
            Locandine
          </h1>
          <p className="mt-2 text-xs text-ink-soft">{userEmail}</p>
        </div>
        <button
          onClick={onLogout}
          className="stamp-btn flex items-center gap-2 bg-paper-hi px-3 py-1.5 text-[0.65rem] font-bold tracking-[0.12em] uppercase text-ink"
        >
          <LogOut size={13} />
          Esci
        </button>
      </div>

      <div className="rule-double mt-5 mb-6" />

      {error && (
        <div className="mb-5 flex items-start gap-2.5 border-2 border-vermiglio bg-vermiglio/10 p-4 text-sm text-ink">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-vermiglio" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-[15rem_1fr]">
        <div>
          <div className="relative mb-2">
            <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca evento…"
              className="w-full border-2 border-ink bg-paper-hi py-1.5 pr-2 pl-8 text-xs text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-vermiglio"
            />
          </div>

          <div className="ink-box-sm max-h-[60vh] overflow-y-auto p-1.5">
            {loading && <p className="p-2 text-xs text-ink-faint">Caricamento eventi…</p>}
            {!loading && filtered.length === 0 && (
              <p className="p-2 text-xs text-ink-faint">Nessun evento trovato.</p>
            )}
            {filtered.map((e) => {
              const active = selectedId === e.id
              return (
                <button
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className={`block w-full border-b border-ink/15 px-2.5 py-2 text-left transition-colors last:border-b-0 ${
                    active ? 'bg-ink text-paper-hi' : 'text-ink hover:bg-paper-2'
                  }`}
                >
                  <span className="block truncate text-xs font-semibold">{e.title}</span>
                  <span
                    className={`mt-0.5 block text-[0.65rem] tracking-wide ${
                      active ? 'text-paper-hi/70' : 'text-ink-faint'
                    }`}
                  >
                    {shortRange(e)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="ink-box p-4 sm:p-5">
          {selected ? (
            <PosterUploader key={selected.id} event={selected} userEmail={userEmail} />
          ) : (
            <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-center">
              <ImageOff size={28} className="text-ink-faint" />
              <p className="max-w-xs text-sm text-ink-soft">
                Scegli un evento dall'elenco per affiggerne la locandina.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- caricamento -- */

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
      setMessage({ kind: 'ok', text: 'Locandina affissa.' })
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
      <p className="eyebrow">{shortRange(event)}</p>
      <h2 className="mt-1 font-display text-xl leading-tight font-black text-ink">{event.title}</h2>

      <div className="relative mt-4 mb-4 flex h-56 items-center justify-center overflow-hidden border-2 border-ink bg-paper-2">
        {posterLoading ? (
          <div className="h-full w-full animate-pulse bg-paper-3" />
        ) : posterUrl ? (
          <img src={posterUrl} alt={event.title} className="h-full w-full object-contain" />
        ) : (
          <div className="relative flex flex-col items-center gap-2 text-ink-faint">
            <div className="halftone pointer-events-none absolute -inset-20" aria-hidden />
            <ImageOff size={22} className="relative" />
            <span className="text-xs font-semibold tracking-wide uppercase">Nessuna locandina</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="stamp-btn flex cursor-pointer items-center gap-2 bg-vermiglio px-4 py-2 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-paper-hi">
          <Upload size={15} />
          {busy ? 'Attendere…' : posterUrl ? 'Sostituisci' : 'Carica immagine'}
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
            className="stamp-btn flex items-center gap-2 bg-paper-hi px-4 py-2 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-ink"
          >
            <Trash2 size={15} />
            Rimuovi
          </button>
        )}
      </div>

      <p className="mt-3 text-[0.68rem] leading-relaxed text-ink-faint">
        L'immagine viene ridimensionata e compressa nel browser prima di essere salvata.
      </p>

      {message && (
        <div
          className={`mt-3 flex items-center gap-2 border-2 p-2.5 text-xs font-semibold ${
            message.kind === 'ok'
              ? 'border-oliva bg-oliva/10 text-ink'
              : 'border-vermiglio bg-vermiglio/10 text-ink'
          }`}
        >
          {message.kind === 'ok' ? (
            <CheckCircle2 size={15} className="shrink-0 text-oliva" />
          ) : (
            <AlertTriangle size={15} className="shrink-0 text-vermiglio" />
          )}
          {message.text}
        </div>
      )}
    </div>
  )
}
