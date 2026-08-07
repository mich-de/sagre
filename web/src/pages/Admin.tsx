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
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import {
  getEventMedia,
  savePoster,
  addPhoto,
  deletePhoto,
  deleteAllMedia,
  resizeImageToDataUrl,
  MAX_PHOTOS,
  MAX_LINKS,
  type EventMedia,
} from '../lib/posters'
import { normalizeUrl, isValidUrl, suggestLinkLabel, type EventLink } from '../lib/links'
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
            <EventEditor key={selected.id} event={selected} userEmail={userEmail} />
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

/* -------------------------------------------------------------- editor -- */

const EMPTY_MEDIA: EventMedia = { cover: null, photos: [], links: [] }

function EventEditor({ event, userEmail }: { event: CalendarEvent; userEmail: string }) {
  const [media, setMedia] = useState<EventMedia>(EMPTY_MEDIA)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessage(null)
    getEventMedia(event.id)
      .then((m) => {
        if (!cancelled) setMedia(m)
      })
      .catch(() => {
        if (!cancelled) setMedia(EMPTY_MEDIA)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [event.id])

  const total = (media.cover ? 1 : 0) + media.photos.length

  function fail(err: unknown, fallback: string) {
    setMessage({ kind: 'error', text: err instanceof Error ? err.message : fallback })
  }

  /** Carica in fila: la prima immagine diventa copertina se non ce n'è già una,
   *  le altre finiscono nella sottocollezione. */
  async function handleFiles(files: File[]) {
    const room = MAX_PHOTOS - total
    if (room <= 0) {
      setMessage({ kind: 'error', text: `Massimo ${MAX_PHOTOS} immagini per evento.` })
      return
    }
    const batch = files.slice(0, room)
    setBusy(true)
    setMessage(null)
    try {
      let cover = media.cover
      const photos = [...media.photos]
      for (const file of batch) {
        const dataUrl = await resizeImageToDataUrl(file)
        if (!cover) {
          await savePoster(event.id, { dataUrl, links: media.links }, userEmail)
          cover = dataUrl
        } else {
          const order = photos.length ? photos[photos.length - 1].order + 1 : 0
          photos.push(await addPhoto(event.id, dataUrl, order, userEmail))
        }
        setMedia({ cover, photos: [...photos], links: media.links })
      }
      const skipped = files.length - batch.length
      setMessage({
        kind: 'ok',
        text: skipped > 0 ? `${batch.length} immagini caricate, ${skipped} scartate (limite raggiunto).` : 'Immagini caricate.',
      })
    } catch (err) {
      fail(err, 'Errore durante il caricamento.')
    } finally {
      setBusy(false)
    }
  }

  /** Togliendo la copertina la prima delle altre foto sale al suo posto: così
   *  un evento con immagini non resta mai senza locandina in vetrina. */
  async function handleRemoveCover() {
    setBusy(true)
    setMessage(null)
    try {
      const [promoted, ...rest] = media.photos
      await savePoster(event.id, { dataUrl: promoted?.dataUrl ?? null, links: media.links }, userEmail)
      if (promoted) await deletePhoto(event.id, promoted.id)
      setMedia({ cover: promoted?.dataUrl ?? null, photos: rest, links: media.links })
      setMessage({ kind: 'ok', text: 'Copertina rimossa.' })
    } catch (err) {
      fail(err, 'Errore durante la rimozione.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemovePhoto(photoId: string) {
    setBusy(true)
    setMessage(null)
    try {
      await deletePhoto(event.id, photoId)
      setMedia({ ...media, photos: media.photos.filter((p) => p.id !== photoId) })
      setMessage({ kind: 'ok', text: 'Foto rimossa.' })
    } catch (err) {
      fail(err, 'Errore durante la rimozione.')
    } finally {
      setBusy(false)
    }
  }

  /** Promuove una foto a copertina scambiandola con quella attuale. */
  async function handleMakeCover(photoId: string) {
    const photo = media.photos.find((p) => p.id === photoId)
    if (!photo) return
    setBusy(true)
    setMessage(null)
    try {
      const previous = media.cover
      await savePoster(event.id, { dataUrl: photo.dataUrl, links: media.links }, userEmail)
      await deletePhoto(event.id, photo.id)
      const rest = media.photos.filter((p) => p.id !== photo.id)
      const photos = previous ? [...rest, await addPhoto(event.id, previous, photo.order, userEmail)] : rest
      setMedia({ cover: photo.dataUrl, photos, links: media.links })
      setMessage({ kind: 'ok', text: 'Copertina aggiornata.' })
    } catch (err) {
      fail(err, 'Errore durante lo spostamento.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveLinks(links: EventLink[]) {
    setBusy(true)
    setMessage(null)
    try {
      await savePoster(event.id, { dataUrl: media.cover, links }, userEmail)
      setMedia({ ...media, links })
      setMessage({ kind: 'ok', text: 'Collegamenti salvati.' })
    } catch (err) {
      fail(err, 'Errore durante il salvataggio.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteAll() {
    setBusy(true)
    setMessage(null)
    try {
      await deleteAllMedia(event.id)
      setMedia(EMPTY_MEDIA)
      setMessage({ kind: 'ok', text: 'Tutto rimosso.' })
    } catch (err) {
      fail(err, 'Errore durante la rimozione.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="eyebrow">{shortRange(event)}</p>
      <h2 className="mt-1 font-display text-xl leading-tight font-black text-ink">{event.title}</h2>

      {/* ------------------------------------------------------ copertina -- */}
      <div className="relative mt-4 flex h-56 items-center justify-center overflow-hidden border-2 border-ink bg-paper-2">
        {loading ? (
          <div className="h-full w-full animate-pulse bg-paper-3" />
        ) : media.cover ? (
          <img src={media.cover} alt={event.title} className="h-full w-full object-contain" />
        ) : (
          <div className="relative flex flex-col items-center gap-2 text-ink-faint">
            <div className="halftone pointer-events-none absolute -inset-20" aria-hidden />
            <ImageOff size={22} className="relative" />
            <span className="text-xs font-semibold tracking-wide uppercase">Nessuna locandina</span>
          </div>
        )}
        {media.cover && (
          <span className="absolute top-2 left-2 border-2 border-ink bg-paper-hi px-2 py-0.5 text-[0.55rem] font-bold tracking-[0.14em] uppercase text-ink shadow-[2px_2px_0_var(--color-ink)]">
            Copertina
          </span>
        )}
      </div>

      {/* ---------------------------------------------------- altre foto -- */}
      {media.photos.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {media.photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden border-2 border-ink">
              <img src={photo.dataUrl} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-ink/70 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button
                  onClick={() => handleMakeCover(photo.id)}
                  disabled={busy}
                  title="Usa come copertina"
                  aria-label="Usa come copertina"
                  className="border border-paper-hi p-1 text-paper-hi transition-colors hover:bg-paper-hi hover:text-ink"
                >
                  <Star size={12} />
                </button>
                <button
                  onClick={() => handleRemovePhoto(photo.id)}
                  disabled={busy}
                  title="Elimina foto"
                  aria-label="Elimina foto"
                  className="border border-paper-hi p-1 text-paper-hi transition-colors hover:bg-vermiglio"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="stamp-btn flex cursor-pointer items-center gap-2 bg-vermiglio px-4 py-2 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-paper-hi">
          <Upload size={15} />
          {busy ? 'Attendere…' : total > 0 ? 'Aggiungi foto' : 'Carica immagini'}
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
        {media.cover && (
          <button
            onClick={handleRemoveCover}
            disabled={busy}
            className="stamp-btn flex items-center gap-2 bg-paper-hi px-4 py-2 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-ink"
          >
            <Trash2 size={15} />
            Rimuovi copertina
          </button>
        )}
        {total > 1 && (
          <button
            onClick={handleDeleteAll}
            disabled={busy}
            className="stamp-btn flex items-center gap-2 bg-paper-hi px-4 py-2 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-ink"
          >
            <Trash2 size={15} />
            Svuota tutto
          </button>
        )}
      </div>

      <p className="mt-3 text-[0.68rem] leading-relaxed text-ink-faint">
        Le immagini vengono ridimensionate e compresse nel browser. Massimo {MAX_PHOTOS} per evento —
        {total > 0 ? ` ora ne hai ${total}.` : ' nessuna caricata.'}
      </p>

      {/* -------------------------------------------------- collegamenti -- */}
      <div className="rule-double my-5" />
      <LinksEditor links={media.links} busy={busy || loading} onSave={handleSaveLinks} />

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

/* -------------------------------------------------------- collegamenti -- */

function LinksEditor({
  links,
  busy,
  onSave,
}: {
  links: EventLink[]
  busy: boolean
  onSave: (links: EventLink[]) => Promise<void>
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
    void onSave(next)
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
