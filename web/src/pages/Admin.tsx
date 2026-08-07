import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  LogIn,
  LogOut,
  Upload,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Search,
  ImageOff,
  Star,
  Link2,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Save,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import { useEventExtras } from '../hooks/useEventExtras'
import {
  getEventMedia,
  saveExtras,
  addPhoto,
  deletePhoto,
  reorderPhotos,
  deleteAllPhotos,
  makeThumb,
  migrateLegacyCover,
  resizeImageToDataUrl,
  EMPTY_EXTRAS,
  MAX_PHOTOS,
  MAX_LINKS,
  MAX_NOTE,
  type EventMedia,
  type EventExtras,
  type EventStatus,
  type ExtrasPatch,
} from '../lib/posters'
import { normalizeUrl, isValidUrl, suggestLinkLabel, type EventLink } from '../lib/links'
import { CATEGORIES, categorize } from '../lib/categorize'
import { shortRange, eventStart, isOver } from '../lib/dates'
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
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
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

type AdminFilter = 'tutti' | 'senza' | 'con' | 'evidenza' | 'annullati' | 'passati'

const FILTERS: Array<{ key: AdminFilter; label: string }> = [
  { key: 'tutti', label: 'Tutti' },
  { key: 'senza', label: 'Senza locandina' },
  { key: 'con', label: 'Con locandina' },
  { key: 'evidenza', label: 'In evidenza' },
  { key: 'annullati', label: 'Annullati' },
  { key: 'passati', label: 'Passati' },
]

function PosterManager({ userEmail, onLogout }: { userEmail: string; onLogout: () => void }) {
  const { events, loading, error } = useCalendarEvents()
  const { extras, loading: extrasLoading } = useEventExtras()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<AdminFilter>('tutti')

  /* Copia locale della mappa: dopo ogni salvataggio si aggiorna la riga
     interessata, invece di riscaricare tutte le miniature della collezione. */
  const [local, setLocal] = useState<Record<string, EventExtras>>({})
  useEffect(() => setLocal(extras), [extras])

  const extrasOf = (eventId: string): EventExtras => local[eventId] ?? { ...EMPTY_EXTRAS, eventId }

  function patchLocal(eventId: string, next: EventExtras) {
    setLocal((prev) => ({ ...prev, [eventId]: next }))
  }

  const selected = events.find((e) => e.id === selectedId) ?? null

  const stats = useMemo(() => {
    let withPoster = 0
    let featured = 0
    let cancelled = 0
    for (const event of events) {
      const ex = local[event.id]
      if (!ex) continue
      if (ex.thumb) withPoster++
      if (ex.featured) featured++
      if (ex.status === 'annullato') cancelled++
    }
    return { total: events.length, withPoster, featured, cancelled }
  }, [events, local])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...events].sort((a, b) => eventStart(b).getTime() - eventStart(a).getTime())
    return sorted.filter((e) => {
      const ex = extrasOf(e.id)
      if (filter === 'senza' && ex.thumb) return false
      if (filter === 'con' && !ex.thumb) return false
      if (filter === 'evidenza' && !ex.featured) return false
      if (filter === 'annullati' && ex.status !== 'annullato') return false
      if (filter === 'passati' && !isOver(e)) return false
      if (q && !`${e.title} ${e.location}`.toLowerCase().includes(q)) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, query, filter, local])

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

      <div className="rule-double mt-5 mb-5" />

      {/* ------------------------------------------------------- cruscotto -- */}
      <dl className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Eventi" value={loading ? '—' : stats.total} />
        <Metric
          label="Con locandina"
          value={extrasLoading ? '—' : `${stats.withPoster}`}
          hint={!loading && stats.total > 0 ? `${stats.total - stats.withPoster} da fare` : undefined}
        />
        <Metric label="In evidenza" value={extrasLoading ? '—' : stats.featured} />
        <Metric label="Annullati" value={extrasLoading ? '—' : stats.cancelled} alert={stats.cancelled > 0} />
      </dl>

      {error && (
        <div className="mb-5 flex items-start gap-2.5 border-2 border-vermiglio bg-vermiglio/10 p-4 text-sm text-ink">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-vermiglio" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-[16rem_1fr]">
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

          <div className="mb-2 flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`border px-1.5 py-0.5 text-[0.55rem] font-bold tracking-[0.1em] uppercase transition-colors ${
                  filter === f.key
                    ? 'border-ink bg-ink text-paper-hi'
                    : 'border-ink/25 text-ink-soft hover:border-ink hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="ink-box-sm max-h-[60vh] overflow-y-auto p-1.5">
            {loading && <p className="p-2 text-xs text-ink-faint">Caricamento eventi…</p>}
            {!loading && filtered.length === 0 && (
              <p className="p-2 text-xs text-ink-faint">Nessun evento con questi filtri.</p>
            )}
            {filtered.map((e) => {
              const active = selectedId === e.id
              const ex = extrasOf(e.id)
              return (
                <button
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className={`flex w-full items-center gap-2 border-b border-ink/15 px-2 py-2 text-left transition-colors last:border-b-0 ${
                    active ? 'bg-ink text-paper-hi' : 'text-ink hover:bg-paper-2'
                  }`}
                >
                  {ex.thumb ? (
                    <img src={ex.thumb} alt="" className="h-8 w-8 shrink-0 border border-ink/30 object-cover" />
                  ) : (
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center border border-dashed ${
                        active ? 'border-paper-hi/40 text-paper-hi/50' : 'border-ink/25 text-ink-faint'
                      }`}
                    >
                      <ImageIcon size={12} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{e.title}</span>
                    <span
                      className={`mt-0.5 flex items-center gap-1.5 text-[0.62rem] tracking-wide ${
                        active ? 'text-paper-hi/70' : 'text-ink-faint'
                      }`}
                    >
                      {shortRange(e)}
                      {ex.featured && <Star size={9} fill="currentColor" />}
                      {ex.status !== 'confermato' && (
                        <span className="font-bold uppercase">{ex.status.slice(0, 3)}</span>
                      )}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="ink-box p-4 sm:p-5">
          {selected ? (
            <EventEditor
              key={selected.id}
              event={selected}
              userEmail={userEmail}
              onExtrasChange={(next) => patchLocal(selected.id, next)}
            />
          ) : (
            <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-center">
              <ImageOff size={28} className="text-ink-faint" />
              <p className="max-w-xs text-sm text-ink-soft">
                Scegli un evento dall'elenco per curarne la scheda: locandine, note, categoria, stato.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  hint,
  alert,
}: {
  label: string
  value: string | number
  hint?: string
  alert?: boolean
}) {
  return (
    <div className={`ink-box-sm px-3 py-2 ${alert ? 'border-vermiglio' : ''}`}>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 font-display text-2xl leading-none font-black text-ink">{value}</dd>
      {hint && <p className="mt-1 text-[0.6rem] text-ink-faint">{hint}</p>}
    </div>
  )
}

/* -------------------------------------------------------------- editor -- */

const EMPTY_MEDIA: EventMedia = { ...EMPTY_EXTRAS, cover: null, photos: [] }

function EventEditor({
  event,
  userEmail,
  onExtrasChange,
}: {
  event: CalendarEvent
  userEmail: string
  onExtrasChange: (extras: EventExtras) => void
}) {
  const [media, setMedia] = useState<EventMedia>(EMPTY_MEDIA)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  /* La copertina è sempre la prima foto: un unico ordine da mantenere invece
     di due posti diversi in cui una locandina può stare. */
  const cover = media.photos[0]?.dataUrl ?? media.cover ?? null

  function commit(next: EventMedia) {
    setMedia(next)
    const { cover: _cover, photos: _photos, ...extras } = next
    onExtrasChange(extras)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessage(null)
    getEventMedia(event.id)
      .then(async (loaded) => {
        /* Vecchio schema: copertina a piena risoluzione nel documento padre e
           nessuna foto. Si sposta nella sottocollezione alla prima apertura. */
        if (loaded.cover && loaded.photos.length === 0) {
          return migrateLegacyCover(event.id, loaded, loaded.cover, userEmail)
        }
        return loaded
      })
      .then((loaded) => {
        /* Anche il solo caricamento aggiorna il cruscotto: dopo la migrazione
           di una vecchia copertina l'evento ha finalmente la sua miniatura. */
        if (!cancelled) commit(loaded)
      })
      .catch(() => {
        if (!cancelled) setMedia({ ...EMPTY_MEDIA, eventId: event.id })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [event.id, userEmail])

  function fail(err: unknown, fallback: string) {
    setMessage({ kind: 'error', text: err instanceof Error ? err.message : fallback })
  }

  /** Ogni volta che cambia la prima foto va rifatta la miniatura: è quella che
   *  finisce negli elenchi, e una miniatura sbagliata è peggio di nessuna. */
  async function syncThumb(photos: typeof media.photos, previousCover: string | null) {
    const nextCover = photos[0]?.dataUrl ?? null
    if (nextCover === previousCover) return media.thumb
    const thumb = nextCover ? await makeThumb(nextCover) : null
    await saveExtras(event.id, { thumb }, userEmail)
    return thumb
  }

  async function patch(changes: ExtrasPatch, next: Partial<EventExtras>, text: string) {
    setBusy(true)
    setMessage(null)
    try {
      await saveExtras(event.id, changes, userEmail)
      commit({ ...media, ...next })
      setMessage({ kind: 'ok', text })
    } catch (err) {
      fail(err, 'Errore durante il salvataggio.')
    } finally {
      setBusy(false)
    }
  }

  async function handleFiles(files: File[]) {
    const room = MAX_PHOTOS - media.photos.length
    if (room <= 0) {
      setMessage({ kind: 'error', text: `Massimo ${MAX_PHOTOS} immagini per evento.` })
      return
    }
    const batch = files.slice(0, room)
    setBusy(true)
    setMessage(null)
    try {
      const previous = cover
      let photos = [...media.photos]
      for (const file of batch) {
        const dataUrl = await resizeImageToDataUrl(file)
        photos = [...photos, await addPhoto(event.id, dataUrl, photos.length, userEmail)]
        setMedia((m) => ({ ...m, cover: photos[0]?.dataUrl ?? null, photos }))
      }
      const thumb = await syncThumb(photos, previous)
      commit({ ...media, thumb, cover: photos[0]?.dataUrl ?? null, photos })
      const skipped = files.length - batch.length
      setMessage({
        kind: 'ok',
        text:
          skipped > 0
            ? `${batch.length} immagini caricate, ${skipped} scartate (limite raggiunto).`
            : 'Immagini caricate.',
      })
    } catch (err) {
      fail(err, 'Errore durante il caricamento.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemovePhoto(photoId: string) {
    setBusy(true)
    setMessage(null)
    try {
      const previous = cover
      await deletePhoto(event.id, photoId)
      const photos = await reorderPhotos(
        event.id,
        media.photos.filter((p) => p.id !== photoId),
        userEmail
      )
      const thumb = await syncThumb(photos, previous)
      commit({ ...media, thumb, cover: photos[0]?.dataUrl ?? null, photos })
      setMessage({ kind: 'ok', text: 'Foto rimossa.' })
    } catch (err) {
      fail(err, 'Errore durante la rimozione.')
    } finally {
      setBusy(false)
    }
  }

  /** Sposta la foto di un posto, oppure la porta in testa (copertina). */
  async function handleMove(index: number, to: number) {
    const photos = [...media.photos]
    if (to < 0 || to >= photos.length) return
    const [moved] = photos.splice(index, 1)
    photos.splice(to, 0, moved)
    setBusy(true)
    setMessage(null)
    try {
      const previous = cover
      const ordered = await reorderPhotos(event.id, photos, userEmail)
      const thumb = await syncThumb(ordered, previous)
      commit({ ...media, thumb, cover: ordered[0]?.dataUrl ?? null, photos: ordered })
      setMessage({ kind: 'ok', text: to === 0 ? 'Copertina aggiornata.' : 'Ordine aggiornato.' })
    } catch (err) {
      fail(err, 'Errore durante lo spostamento.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteAll() {
    setBusy(true)
    setMessage(null)
    try {
      await deleteAllPhotos(event.id, userEmail)
      commit({ ...media, thumb: null, cover: null, photos: [] })
      setMessage({ kind: 'ok', text: 'Tutte le immagini rimosse.' })
    } catch (err) {
      fail(err, 'Errore durante la rimozione.')
    } finally {
      setBusy(false)
    }
  }

  const auto = categorize(event.title, event.description).label

  return (
    <div>
      <p className="eyebrow">{shortRange(event)}</p>
      <h2 className="mt-1 font-display text-xl leading-tight font-black text-ink">{event.title}</h2>

      {/* ------------------------------------------------------ copertina -- */}
      <div className="relative mt-4 flex h-56 items-center justify-center overflow-hidden border-2 border-ink bg-paper-2">
        {loading ? (
          <div className="h-full w-full animate-pulse bg-paper-3" />
        ) : cover ? (
          <img src={cover} alt={event.title} className="h-full w-full object-contain" />
        ) : (
          <div className="relative flex flex-col items-center gap-2 text-ink-faint">
            <div className="halftone pointer-events-none absolute -inset-20" aria-hidden />
            <ImageOff size={22} className="relative" />
            <span className="text-xs font-semibold tracking-wide uppercase">Nessuna locandina</span>
          </div>
        )}
        {cover && (
          <span className="absolute top-2 left-2 border-2 border-ink bg-paper-hi px-2 py-0.5 text-[0.55rem] font-bold tracking-[0.14em] uppercase text-ink shadow-[2px_2px_0_var(--color-ink)]">
            Copertina
          </span>
        )}
      </div>

      {/* --------------------------------------------------- galleria -- */}
      {media.photos.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {media.photos.map((photo, i) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden border-2 border-ink">
              <img src={photo.dataUrl} alt="" className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute top-0 left-0 bg-ink px-1 text-[0.5rem] font-bold tracking-wider uppercase text-paper-hi">
                  1ª
                </span>
              )}
              <div className="absolute inset-0 flex items-center justify-center gap-0.5 bg-ink/70 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <PhotoBtn
                  onClick={() => handleMove(i, i - 1)}
                  disabled={busy || i === 0}
                  label="Sposta indietro"
                >
                  <ChevronLeft size={12} />
                </PhotoBtn>
                <PhotoBtn
                  onClick={() => handleMove(i, 0)}
                  disabled={busy || i === 0}
                  label="Usa come copertina"
                >
                  <Star size={12} />
                </PhotoBtn>
                <PhotoBtn
                  onClick={() => handleMove(i, i + 1)}
                  disabled={busy || i === media.photos.length - 1}
                  label="Sposta avanti"
                >
                  <ChevronRight size={12} />
                </PhotoBtn>
                <PhotoBtn onClick={() => handleRemovePhoto(photo.id)} disabled={busy} label="Elimina foto" danger>
                  <Trash2 size={12} />
                </PhotoBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="stamp-btn flex cursor-pointer items-center gap-2 bg-vermiglio px-4 py-2 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-paper-hi">
          <Upload size={15} />
          {busy ? 'Attendere…' : media.photos.length > 0 ? 'Aggiungi foto' : 'Carica immagini'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length) void handleFiles(files)
              e.target.value = ''
            }}
          />
        </label>
        {media.photos.length > 0 && (
          <button
            onClick={handleDeleteAll}
            disabled={busy}
            className="stamp-btn flex items-center gap-2 bg-paper-hi px-4 py-2 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-ink"
          >
            <Trash2 size={15} />
            Svuota galleria
          </button>
        )}
      </div>

      <p className="mt-3 text-[0.68rem] leading-relaxed text-ink-faint">
        La prima immagine è la copertina. Massimo {MAX_PHOTOS} per evento —
        {media.photos.length > 0 ? ` ora ne hai ${media.photos.length}.` : ' nessuna caricata.'}
      </p>

      {/* ------------------------------------------------------ scheda -- */}
      <div className="rule-double my-5" />

      <p className="eyebrow">Scheda dell'evento</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Stato">
          <select
            value={media.status}
            disabled={busy || loading}
            onChange={(e) => {
              const status = e.target.value as EventStatus
              void patch({ status }, { status }, 'Stato aggiornato.')
            }}
            className="w-full border-2 border-ink bg-paper-hi px-2.5 py-1.5 text-xs font-semibold text-ink outline-none focus:ring-2 focus:ring-vermiglio"
          >
            <option value="confermato">Confermato</option>
            <option value="rinviato">Rinviato</option>
            <option value="annullato">Annullato</option>
          </select>
        </Field>

        <Field label={`Categoria (automatica: ${auto})`}>
          <select
            value={media.category ?? ''}
            disabled={busy || loading}
            onChange={(e) => {
              const category = e.target.value || null
              void patch({ category }, { category }, 'Categoria aggiornata.')
            }}
            className="w-full border-2 border-ink bg-paper-hi px-2.5 py-1.5 text-xs font-semibold text-ink outline-none focus:ring-2 focus:ring-vermiglio"
          >
            <option value="">Automatica</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2.5 border-2 border-ink bg-paper-2 p-2.5">
        <input
          type="checkbox"
          checked={media.featured}
          disabled={busy || loading}
          onChange={(e) => {
            const featured = e.target.checked
            void patch({ featured }, { featured }, featured ? 'Messo in evidenza.' : 'Tolto dall’evidenza.')
          }}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-vermiglio)]"
        />
        <span>
          <span className="flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase text-ink">
            <Star size={12} />
            In evidenza
          </span>
          <span className="mt-0.5 block text-[0.65rem] leading-relaxed text-ink-faint">
            Va in testa alla home al posto del prossimo appuntamento e prende la stella nel calendario.
          </span>
        </span>
      </label>

      <NoteEditor
        key={`${event.id}-${loading}`}
        initial={media.note}
        busy={busy || loading}
        onSave={(note) => patch({ note }, { note }, 'Nota salvata.')}
      />

      {/* -------------------------------------------------- collegamenti -- */}
      <div className="rule-double my-5" />
      <LinksEditor
        links={media.links}
        busy={busy || loading}
        onSave={(links) => patch({ links }, { links }, 'Collegamenti salvati.')}
      />

      {message && (
        <div
          className={`mt-4 flex items-center gap-2 border-2 p-2.5 text-xs font-semibold ${
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

function PhotoBtn({
  onClick,
  disabled,
  label,
  danger,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`border border-paper-hi p-1 text-paper-hi transition-colors disabled:opacity-30 ${
        danger ? 'hover:bg-vermiglio' : 'hover:bg-paper-hi hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

/* ---------------------------------------------------------------- note -- */

function NoteEditor({
  initial,
  busy,
  onSave,
}: {
  initial: string
  busy: boolean
  onSave: (note: string) => void
}) {
  const [note, setNote] = useState(initial)
  const dirty = note !== initial

  return (
    <div className="mt-3">
      <Field label="Nota dell'organizzatore">
        <textarea
          value={note}
          rows={3}
          maxLength={MAX_NOTE}
          disabled={busy}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Menù, prezzi, parcheggio, in caso di pioggia…"
          className="w-full resize-y border-2 border-ink bg-paper-hi px-2.5 py-2 text-xs leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-vermiglio"
        />
      </Field>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <span className="text-[0.6rem] text-ink-faint">
          {note.length}/{MAX_NOTE} · compare nella scheda dell'evento
        </span>
        <button
          onClick={() => onSave(note)}
          disabled={busy || !dirty}
          className="stamp-btn flex items-center gap-1.5 bg-ink px-3 py-1.5 text-[0.62rem] font-bold tracking-[0.12em] uppercase text-paper-hi"
        >
          <Save size={12} />
          {dirty ? 'Salva nota' : 'Salvata'}
        </button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------- collegamenti -- */

function LinksEditor({
  links,
  busy,
  onSave,
}: {
  links: EventLink[]
  busy: boolean
  onSave: (links: EventLink[]) => void
}) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (links.length >= MAX_LINKS) {
      setError(`Massimo ${MAX_LINKS} collegamenti.`)
      return
    }
    if (!isValidUrl(url)) {
      setError('Indirizzo non valido.')
      return
    }
    const normalized = normalizeUrl(url)
    if (links.some((l) => l.url === normalized)) {
      setError('Collegamento già presente.')
      return
    }
    const next = [...links, { url: normalized, label: label.trim() || suggestLinkLabel(normalized) }]
    setUrl('')
    setLabel('')
    onSave(next)
  }

  return (
    <div>
      <p className="eyebrow">Social e articoli</p>
      <p className="mt-1 text-[0.68rem] leading-relaxed text-ink-faint">
        Instagram, Facebook, YouTube, TikTok, il sito della pro loco o l'articolo del giornale locale.
        L'etichetta si compila da sola se la lasci vuota.
      </p>

      {links.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {links.map((link) => (
            <li key={link.url} className="flex items-center gap-2 border-2 border-ink bg-paper-2 px-2.5 py-1.5">
              <Link2 size={13} className="shrink-0 text-ink-faint" />
              <span className="shrink-0 text-[0.68rem] font-bold tracking-wide uppercase text-ink">
                {link.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.65rem] text-ink-faint">{link.url}</span>
              <button
                onClick={() => onSave(links.filter((l) => l.url !== link.url))}
                disabled={busy}
                aria-label={`Rimuovi ${link.label}`}
                className="shrink-0 border border-ink p-0.5 text-ink transition-colors hover:bg-vermiglio hover:text-paper-hi"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-3 flex flex-wrap gap-2">
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="instagram.com/proloco..."
          className="min-w-0 flex-[2] border-2 border-ink bg-paper-hi px-2.5 py-1.5 text-xs text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-vermiglio"
        />
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Etichetta"
          className="min-w-0 flex-1 border-2 border-ink bg-paper-hi px-2.5 py-1.5 text-xs text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-vermiglio"
        />
        <button
          type="submit"
          disabled={busy}
          className="stamp-btn flex items-center gap-1.5 bg-ink px-3 py-1.5 text-[0.65rem] font-bold tracking-[0.12em] uppercase text-paper-hi"
        >
          <Plus size={13} />
          Aggiungi
        </button>
      </form>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-[0.68rem] font-semibold text-vermiglio">
          <AlertTriangle size={12} />
          {error}
        </p>
      )}
    </div>
  )
}
