import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
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
  Wrench,
  Eye,
  Copy,
  ListChecks,
  ClipboardList,
  ArrowDownWideNarrow,
  MapPin,
  CalendarPlus,
  CalendarCog,
  CalendarSync,
  Pencil,
  Unlink,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import { useEventExtras } from '../hooks/useEventExtras'
import { useGoogleLink, type GoogleLink } from '../hooks/useGoogleLink'
import { useIsPhone } from '../hooks/useMediaQuery'
import { EventModal } from '../components/EventModal'
import { BulkActions } from '../components/admin/BulkActions'
import { CopyFromDialog } from '../components/admin/CopyFromDialog'
import { ProgrammaEditor } from '../components/admin/ProgrammaEditor'
import { RepeatNextYear } from '../components/admin/RepeatNextYear'
import { TodoPanel } from '../components/admin/TodoPanel'
import { BulkAdd } from '../components/admin/BulkAdd'
import { EventForm } from '../components/admin/EventForm'
import {
  getEventMedia,
  getPoster,
  saveExtras,
  addPhoto,
  deletePhoto,
  reorderPhotos,
  deleteAllPhotos,
  copyExtras,
  makeThumb,
  migrateLegacyCover,
  repairAllPosters,
  resizeImageToDataUrl,
  hasPoster,
  EMPTY_EXTRAS,
  MAX_PHOTOS,
  MAX_LINKS,
  MAX_NOTE,
  type CopyParts,
  type EventMedia,
  type EventExtras,
  type EventStatus,
  type ExtrasPatch,
  type RepairReport,
} from '../lib/posters'
import { normalizeUrl, isValidUrl, suggestLinkLabel, type EventLink } from '../lib/links'
import { CATEGORIES, categorize } from '../lib/categorize'
import { shortRange, eventStart, isOver, relativeDay } from '../lib/dates'
import { collectPlaces, inPlace } from '../lib/places'
import { createEvent, type EventDraft } from '../lib/calendarWrite'
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
    <main className="page-x mx-auto max-w-5xl pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
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
            /* 16px sul telefono: sotto quella misura iOS ingrandisce la pagina
               al primo tocco sul campo e non la rimette più a posto. */
            className="w-full border-2 border-ink bg-paper px-3 py-2.5 text-base text-ink outline-none focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio focus:ring-offset-2 focus:ring-offset-paper-hi sm:py-2 sm:text-sm"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border-2 border-ink bg-paper px-3 py-2.5 text-base text-ink outline-none focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio focus:ring-offset-2 focus:ring-offset-paper-hi sm:py-2 sm:text-sm"
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
          className="stamp-btn tap flex w-full items-center justify-center gap-2 bg-vermiglio px-4 py-3 text-[0.7rem] font-bold tracking-[0.14em] uppercase text-paper-hi sm:py-2.5"
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
type AdminSort = 'data' | 'titolo' | 'modifica' | 'senza'

const FILTERS: Array<{ key: AdminFilter; label: string }> = [
  { key: 'tutti', label: 'Tutti' },
  { key: 'senza', label: 'Senza locandina' },
  { key: 'con', label: 'Con locandina' },
  { key: 'evidenza', label: 'In evidenza' },
  { key: 'annullati', label: 'Annullati' },
  { key: 'passati', label: 'Passati' },
]

const SORTS: Array<{ key: AdminSort; label: string }> = [
  { key: 'data', label: 'Data, dai più recenti' },
  { key: 'senza', label: 'Senza locandina prima' },
  { key: 'modifica', label: 'Ultima modifica' },
  { key: 'titolo', label: 'Titolo A-Z' },
]

/** "mic.deangelis" invece dell'email intera: nella colonna dell'elenco non ci
 *  sta, e chi cura le locandine si riconosce lo stesso. */
const shortUser = (email: string) => email.split('@')[0]

function PosterManager({ userEmail, onLogout }: { userEmail: string; onLogout: () => void }) {
  const {
    events,
    loading,
    error,
    reload: reloadEvents,
    applyWrite,
    applyDelete,
  } = useCalendarEvents()
  const { extras, loading: extrasLoading, reload: reloadExtras } = useEventExtras()
  const google = useGoogleLink()
  const phone = useIsPhone()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<AdminFilter>('tutti')
  const [place, setPlace] = useState('')
  const [sort, setSort] = useState<AdminSort>('data')
  const [selectMode, setSelectMode] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [preview, setPreview] = useState<CalendarEvent | null>(null)
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  /* `form.open` a parte: `null` come bersaglio vuol dire "evento nuovo", e da
     solo non basta a distinguere il modulo chiuso da quello vuoto. */
  const [form, setForm] = useState<{ open: boolean; target: CalendarEvent | null }>({
    open: false,
    target: null,
  })

  const editorRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  /* Copia locale della mappa: dopo ogni salvataggio si aggiorna la riga
     interessata, invece di riscaricare tutte le miniature della collezione. */
  const [local, setLocal] = useState<Record<string, EventExtras>>({})
  useEffect(() => setLocal(extras), [extras])

  const extrasOf = useCallback(
    (eventId: string): EventExtras => local[eventId] ?? { ...EMPTY_EXTRAS, eventId },
    [local]
  )

  function patchLocal(eventId: string, next: EventExtras) {
    setLocal((prev) => ({ ...prev, [eventId]: next }))
  }

  const selected = events.find((e) => e.id === selectedId) ?? null
  const places = useMemo(() => collectPlaces(events), [events])

  const stats = useMemo(() => {
    let withPoster = 0
    let featured = 0
    let cancelled = 0
    let legacy = 0
    for (const event of events) {
      const ex = local[event.id]
      if (!ex) continue
      if (hasPoster(ex)) withPoster++
      if (ex.hasLegacyCover) legacy++
      if (ex.featured) featured++
      if (ex.status === 'annullato') cancelled++
    }
    return { total: events.length, withPoster, featured, cancelled, legacy }
  }, [events, local])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const kept = events.filter((e) => {
      const ex = extrasOf(e.id)
      if (filter === 'senza' && hasPoster(ex)) return false
      if (filter === 'con' && !hasPoster(ex)) return false
      if (filter === 'evidenza' && !ex.featured) return false
      if (filter === 'annullati' && ex.status !== 'annullato') return false
      if (filter === 'passati' && !isOver(e)) return false
      if (place && !inPlace(e, place)) return false
      if (q && !`${e.title} ${e.location}`.toLowerCase().includes(q)) return false
      return true
    })

    const byDateDesc = (a: CalendarEvent, b: CalendarEvent) =>
      eventStart(b).getTime() - eventStart(a).getTime()

    if (sort === 'titolo') return kept.sort((a, b) => a.title.localeCompare(b.title, 'it'))
    if (sort === 'modifica') {
      /* Chi non è mai stato toccato va in fondo: l'ordine serve a riprendere
         il lavoro, non a scoprire chi non l'ha mai avuto. */
      return kept.sort((a, b) => {
        const ta = extrasOf(a.id).updatedAt?.getTime() ?? 0
        const tb = extrasOf(b.id).updatedAt?.getTime() ?? 0
        return tb - ta || byDateDesc(a, b)
      })
    }
    if (sort === 'senza') {
      /* Il lavoro da fare in cima, e tra quelli prima le feste più vicine:
         una locandina serve prima che la sagra sia passata. */
      return kept.sort((a, b) => {
        const da = hasPoster(extrasOf(a.id)) ? 1 : 0
        const db = hasPoster(extrasOf(b.id)) ? 1 : 0
        return da - db || eventStart(a).getTime() - eventStart(b).getTime()
      })
    }
    return kept.sort(byDateDesc)
  }, [events, query, filter, place, sort, extrasOf])

  const index = selectedId ? filtered.findIndex((e) => e.id === selectedId) : -1
  const goTo = useCallback(
    (next: number) => {
      const event = filtered[next]
      if (event) setSelectedId(event.id)
    },
    [filtered]
  )

  /* Frecce della tastiera per passare da un evento all'altro senza tornare
     all'elenco. Non mentre si scrive, altrimenti sposta il cursore e cambia
     evento nello stesso gesto. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (index < 0) return
      e.preventDefault()
      goTo(index + (e.key === 'ArrowRight' ? 1 : -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, goTo])

  /* Sul telefono l'editor sta sotto l'elenco: senza questo, scegliere un
     evento sembra non fare niente. */
  useEffect(() => {
    if (phone && selectedId) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [phone, selectedId])

  function togglePick(eventId: string) {
    setPicked((prev) => (prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]))
  }

  function exitSelectMode() {
    setSelectMode(false)
    setPicked([])
  }

  const allPicked = filtered.length > 0 && filtered.every((e) => picked.includes(e.id))

  /* L'evento che torna dalla scrittura entra subito nell'elenco — la rilettura
     pubblica può tardare qualche secondo, e nel frattempo la sagra appena
     salvata sembrerebbe non esistere. La rilettura parte lo stesso, e quando
     arriva prende il posto della copia locale. */
  function handleSaved(saved: CalendarEvent) {
    applyWrite(saved)
    setSelectedId(saved.id)
    reloadEvents()
  }

  function handleDeleted(eventId: string) {
    applyDelete(eventId)
    if (selectedId === eventId) setSelectedId(null)
    setPicked((prev) => prev.filter((id) => id !== eventId))
    setLocal((prev) => {
      const next = { ...prev }
      delete next[eventId]
      return next
    })
    reloadEvents()
  }

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
          className="stamp-btn tap tap-grow flex items-center gap-2 bg-paper-hi px-3 py-2 text-[0.65rem] font-bold tracking-[0.12em] uppercase text-ink sm:py-1.5"
        >
          <LogOut size={13} />
          Esci
        </button>
      </div>

      <div className="rule-double mt-5 mb-5" />

      <GoogleLinkBar
        google={google}
        onNew={() => setForm({ open: true, target: null })}
        onBulkAdd={() => setBulkAddOpen(true)}
      />

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

      <TodoPanel
        events={events}
        extrasOf={extrasOf}
        loading={loading || extrasLoading}
        onPick={setSelectedId}
      />

      {stats.legacy > 0 && <RepairBanner count={stats.legacy} userEmail={userEmail} onDone={reloadExtras} />}

      {error && (
        <div className="mb-5 flex items-start gap-2.5 border-2 border-vermiglio bg-vermiglio/10 p-4 text-sm text-ink">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-vermiglio" />
          <span>{error}</span>
        </div>
      )}

      {selectMode && picked.length > 0 && (
        <BulkActions ids={picked} userEmail={userEmail} onDone={reloadExtras} onClear={() => setPicked([])} />
      )}

      <div className="grid gap-5 sm:grid-cols-[16rem_1fr]">
        {/* `min-w-0`: la colonna non deve allargarsi fino al titolo più lungo
            dell'elenco — quelli sono troncati e non vanno a capo. Senza, la
            pagina scorre di lato sul telefono. */}
        <div className="min-w-0" ref={listRef}>
          <div className="relative mb-2">
            <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca evento…"
              className="w-full border-2 border-ink bg-paper-hi py-2 pr-2 pl-8 text-base text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-vermiglio sm:py-1.5 sm:text-xs"
            />
          </div>

          <div className="mb-2 flex flex-wrap gap-1.5">
            <label className="relative min-w-0 flex-1 basis-36">
              <span className="sr-only">Ordina l'elenco</span>
              <ArrowDownWideNarrow size={13} className="absolute top-1/2 left-2 -translate-y-1/2 text-ink-faint" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as AdminSort)}
                className="w-full appearance-none border-2 border-ink bg-paper-hi py-2 pr-2 pl-7 text-base font-semibold text-ink outline-none focus:ring-2 focus:ring-vermiglio sm:py-1 sm:text-[0.68rem]"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            {places.length > 1 && (
              <label className="relative min-w-0 flex-1 basis-32">
                <span className="sr-only">Paese</span>
                <MapPin size={13} className="absolute top-1/2 left-2 -translate-y-1/2 text-ink-faint" />
                <select
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  className="w-full appearance-none border-2 border-ink bg-paper-hi py-2 pr-2 pl-7 text-base font-semibold text-ink outline-none focus:ring-2 focus:ring-vermiglio sm:py-1 sm:text-[0.68rem]"
                >
                  <option value="">Tutti i paesi</option>
                  {places.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="mb-2 flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`tap-grow flex items-center border px-2.5 py-1.5 text-[0.6rem] font-bold tracking-[0.1em] uppercase transition-colors sm:px-1.5 sm:py-0.5 sm:text-[0.55rem] ${
                  filter === f.key
                    ? 'border-ink bg-ink text-paper-hi'
                    : 'border-ink/25 text-ink-soft hover:border-ink hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* --------------------------------------------- selezione multipla -- */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              aria-pressed={selectMode}
              className={`tap-grow flex items-center gap-1.5 border-2 px-2.5 py-1.5 text-[0.6rem] font-bold tracking-[0.1em] uppercase transition-colors ${
                selectMode ? 'border-ink bg-ink text-paper-hi' : 'border-ink/25 text-ink-soft hover:border-ink hover:text-ink'
              }`}
            >
              <ListChecks size={12} />
              {selectMode ? 'Fine' : 'Seleziona'}
            </button>
            {selectMode && (
              <button
                onClick={() => setPicked(allPicked ? [] : filtered.map((e) => e.id))}
                className="tap-grow flex items-center border-2 border-ink/25 px-2.5 py-1.5 text-[0.6rem] font-bold tracking-[0.1em] uppercase text-ink-soft transition-colors hover:border-ink hover:text-ink"
              >
                {allPicked ? 'Nessuno' : `Tutti (${filtered.length})`}
              </button>
            )}
          </div>

          <div className="ink-box-sm max-h-[50dvh] overflow-y-auto overscroll-contain p-1.5 sm:max-h-[60vh]">
            {loading && <p className="p-2 text-xs text-ink-faint">Caricamento eventi…</p>}
            {!loading && filtered.length === 0 && (
              <p className="p-2 text-xs text-ink-faint">Nessun evento con questi filtri.</p>
            )}
            {filtered.map((e) => {
              const active = selectedId === e.id
              const ex = extrasOf(e.id)
              return (
                <div
                  key={e.id}
                  className={`flex items-stretch border-b border-ink/15 transition-colors last:border-b-0 ${
                    active ? 'bg-ink text-paper-hi' : 'text-ink hover:bg-paper-2'
                  }`}
                >
                  {selectMode && (
                    /* Casella fuori dal bottone: un controllo dentro un altro
                       controllo non è cliccabile in modo prevedibile. */
                    <label className="flex w-9 shrink-0 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        checked={picked.includes(e.id)}
                        onChange={() => togglePick(e.id)}
                        className="h-4 w-4 accent-[var(--color-vermiglio)]"
                      />
                      <span className="sr-only">Scegli {e.title}</span>
                    </label>
                  )}
                  <button
                    onClick={() => setSelectedId(e.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left"
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
                      {ex.updatedAt && (
                        <span
                          className={`block truncate text-[0.58rem] ${
                            active ? 'text-paper-hi/55' : 'text-ink-faint/80'
                          }`}
                        >
                          agg. {relativeDay(ex.updatedAt)}
                          {ex.updatedBy && ` · ${shortUser(ex.updatedBy)}`}
                        </span>
                      )}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="ink-box min-w-0 p-4 sm:p-5" ref={editorRef}>
          {selected ? (
            <EventEditor
              key={selected.id}
              event={selected}
              userEmail={userEmail}
              events={events}
              extrasOf={extrasOf}
              onExtrasChange={(next) => patchLocal(selected.id, next)}
              onPrev={() => goTo(index - 1)}
              onNext={() => goTo(index + 1)}
              hasPrev={index > 0}
              hasNext={index >= 0 && index < filtered.length - 1}
              onPreview={() => setPreview(selected)}
              onEdit={google.linked ? () => setForm({ open: true, target: selected }) : null}
              onCreated={google.linked ? handleSaved : null}
              onBackToList={() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
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

      {/* La scheda com'è sul sito pubblico, senza uscire dall'ufficio. */}
      {preview && <EventModal event={preview} onClose={() => setPreview(null)} />}

      {form.open && (
        <EventForm
          event={form.target}
          onClose={() => setForm({ open: false, target: null })}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {bulkAddOpen && (
        <BulkAdd
          onClose={() => setBulkAddOpen(false)}
          onDone={(saved) => {
            /* Entrano subito nell'elenco, come per il salvataggio singolo: la
               rilettura pubblica può tardare, e venti sagre appena scritte che
               non si vedono sembrano venti sagre perse. */
            saved.forEach(applyWrite)
            reloadEvents()
          }}
        />
      )}
    </div>
  )
}

/** Il permesso di scrivere sul calendario. Sta in cima all'ufficio perché
 *  senza di quello metà dei comandi non compare, e chi apre la pagina deve
 *  capire subito perché. */
function GoogleLinkBar({
  google,
  onNew,
  onBulkAdd,
}: {
  google: GoogleLink
  onNew: () => void
  onBulkAdd: () => void
}) {
  if (!google.available) return null

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 border-2 border-ink bg-paper-2 p-3">
      <CalendarCog size={18} className="shrink-0 text-ink" />
      <p className="min-w-44 flex-1 text-xs leading-relaxed text-ink-soft">
        {google.linked ? (
          <>
            <strong className="font-semibold text-ink">Calendario collegato.</strong> Puoi aggiungere
            eventi, spostare le date e cancellarli.
          </>
        ) : (
          <>
            <strong className="font-semibold text-ink">Calendario in sola lettura.</strong> Collega il
            tuo account Google per creare e modificare gli eventi.
          </>
        )}
      </p>

      {google.linked ? (
        <>
          <button
            onClick={onNew}
            className="stamp-btn tap tap-grow flex items-center gap-1.5 bg-vermiglio px-3 py-2 text-[0.65rem] font-bold tracking-[0.12em] uppercase text-paper-hi sm:py-1.5"
          >
            <CalendarPlus size={13} />
            Nuovo evento
          </button>
          <button
            onClick={onBulkAdd}
            className="stamp-btn tap tap-grow flex items-center gap-1.5 bg-paper-hi px-3 py-2 text-[0.65rem] font-bold tracking-[0.12em] uppercase text-ink sm:py-1.5"
          >
            <ClipboardList size={13} />
            Tante insieme
          </button>
          <button
            onClick={google.unlink}
            aria-label="Scollega l'account Google"
            className="stamp-btn tap tap-grow flex items-center gap-1.5 bg-paper-hi px-3 py-2 text-[0.65rem] font-bold tracking-[0.12em] uppercase text-ink sm:py-1.5"
          >
            <Unlink size={13} />
            Scollega
          </button>
        </>
      ) : (
        <button
          onClick={() => void google.link()}
          disabled={google.busy}
          className="stamp-btn tap tap-grow flex items-center gap-1.5 bg-ink px-3 py-2 text-[0.65rem] font-bold tracking-[0.12em] uppercase text-paper-hi disabled:opacity-50 sm:py-1.5"
        >
          <Link2 size={13} />
          {google.busy ? 'Aspetto Google…' : 'Collega Google'}
        </button>
      )}

      {google.error && (
        <p className="flex basis-full items-start gap-1.5 text-[0.68rem] font-semibold text-vermiglio">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {google.error}
        </p>
      )}
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

/* ---------------------------------------------------------- riparazione -- */

/** Le locandine caricate col vecchio schema non hanno la miniatura, e senza
 *  quella spariscono da calendario ed elenco. Qui si rimettono tutte in riga
 *  in un colpo solo, invece di aprire un evento alla volta. */
function RepairBanner({
  count,
  userEmail,
  onDone,
}: {
  count: number
  userEmail: string
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [report, setReport] = useState<RepairReport | null>(null)

  async function handleRepair() {
    setBusy(true)
    setReport(null)
    try {
      const result = await repairAllPosters(userEmail, (done, total) => setProgress({ done, total }))
      setReport(result)
      onDone()
    } catch {
      setReport({ migrate: 0, thumbs: 0, errori: -1 })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 border-2 border-ink bg-senape/12 p-4">
      <Wrench size={18} className="shrink-0 text-ink" />
      <p className="min-w-48 flex-1 text-sm text-ink">
        <strong className="font-semibold">
          {count} {count === 1 ? 'locandina' : 'locandine'} in archivio vecchio.
        </strong>{' '}
        <span className="text-ink-soft">
          Ci sono, ma senza miniatura non compaiono nel calendario né nell'elenco.
        </span>
        {report && (
          <span className="mt-1 block text-xs text-ink-soft">
            {report.errori === -1
              ? 'Riparazione non riuscita. Riprova.'
              : `Sistemate ${report.migrate + report.thumbs}${report.errori > 0 ? `, ${report.errori} non riuscite` : ''}.`}
          </span>
        )}
      </p>
      <button
        onClick={handleRepair}
        disabled={busy}
        className="stamp-btn tap tap-grow flex w-full items-center justify-center gap-2 bg-ink px-3 py-2.5 text-[0.65rem] font-bold tracking-[0.12em] uppercase text-paper-hi disabled:opacity-50 sm:w-auto sm:py-1.5"
      >
        <Wrench size={13} />
        {busy ? `${progress.done}/${progress.total || count}…` : 'Sistema tutte'}
      </button>
    </div>
  )
}

/* -------------------------------------------------------------- editor -- */

const EMPTY_MEDIA: EventMedia = { ...EMPTY_EXTRAS, cover: null, photos: [] }

function EventEditor({
  event,
  userEmail,
  events,
  extrasOf,
  onExtrasChange,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onPreview,
  onEdit,
  onCreated,
  onBackToList,
}: {
  event: CalendarEvent
  userEmail: string
  events: CalendarEvent[]
  extrasOf: (eventId: string) => EventExtras
  onExtrasChange: (extras: EventExtras) => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
  onPreview: () => void
  /** `null` quando l'account Google non è collegato: senza permesso il
   *  bottone porterebbe solo a un errore. */
  onEdit: (() => void) | null
  /** L'evento nuovo nato dalla ripetizione: va mostrato e selezionato subito,
   *  senza aspettare che la lettura pubblica di Google si aggiorni. `null`
   *  quando l'account non è collegato e non si può scrivere. */
  onCreated: ((saved: CalendarEvent) => void) | null
  onBackToList: () => void
}) {
  const [media, setMedia] = useState<EventMedia>(EMPTY_MEDIA)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [copyOpen, setCopyOpen] = useState(false)
  const [repeatOpen, setRepeatOpen] = useState(false)
  const [dropping, setDropping] = useState(false)
  const dragFrom = useRef<number | null>(null)

  /* La copertina è sempre la prima foto: un unico ordine da mantenere invece
     di due posti diversi in cui una locandina può stare. */
  const cover = media.photos[0]?.dataUrl ?? media.cover ?? null

  function commit(next: EventMedia) {
    setMedia(next)
    const { cover: _cover, photos: _photos, ...extras } = next
    onExtrasChange(extras)
  }

  /** L'ora della modifica appena fatta: il server la scrive col suo orologio,
   *  ma l'elenco deve aggiornarsi subito, non al prossimo caricamento. */
  const touch = () => ({ updatedAt: new Date(), updatedBy: userEmail })

  useEffect(() => setMessage(null), [event.id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getEventMedia(event.id)
      .then(async (loaded) => {
        /* Vecchio schema: copertina a piena risoluzione nel documento padre.
           Si sposta nella sottocollezione alla prima apertura — anche quando
           l'evento ha già delle foto, altrimenti quella resta orfana. */
        if (!loaded.hasLegacyCover) return loaded
        const poster = await getPoster(event.id)
        return poster?.dataUrl ? migrateLegacyCover(event.id, loaded, poster.dataUrl, userEmail) : loaded
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, userEmail, reloadKey])

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
      commit({ ...media, ...next, ...touch() })
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
      commit({ ...media, thumb, cover: photos[0]?.dataUrl ?? null, photos, ...touch() })
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

  /* Incollare un'immagine dagli appunti: si scarica la locandina dal gruppo
     WhatsApp, Ctrl+V, e sta già sul cartellone. Il gestore va tenuto in un
     riferimento, altrimenti l'ascoltatore resta legato al primo evento
     aperto e carica le foto sulla sagra sbagliata. */
  const filesRef = useRef(handleFiles)
  useEffect(() => {
    filesRef.current = handleFiles
  })
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'))
      if (images.length === 0) return
      e.preventDefault()
      void filesRef.current(images)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

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
      commit({ ...media, thumb, cover: photos[0]?.dataUrl ?? null, photos, ...touch() })
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
    if (to < 0 || to >= photos.length || index === to) return
    const [moved] = photos.splice(index, 1)
    photos.splice(to, 0, moved)
    setBusy(true)
    setMessage(null)
    try {
      const previous = cover
      const ordered = await reorderPhotos(event.id, photos, userEmail)
      const thumb = await syncThumb(ordered, previous)
      commit({ ...media, thumb, cover: ordered[0]?.dataUrl ?? null, photos: ordered, ...touch() })
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
      commit({ ...media, thumb: null, cover: null, photos: [], ...touch() })
      setMessage({ kind: 'ok', text: 'Tutte le immagini rimosse.' })
    } catch (err) {
      fail(err, 'Errore durante la rimozione.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCopyFrom(sourceId: string, parts: CopyParts, shiftDays: number) {
    await copyExtras(sourceId, event.id, parts, userEmail, shiftDays)
    /* Si ricarica invece di indovinare: la copia tocca foto, miniatura,
       collegamenti, nota e programma tutte insieme. */
    setReloadKey((k) => k + 1)
    setMessage({ kind: 'ok', text: 'Scheda copiata.' })
  }

  /** Duplica la sagra all'anno prossimo. L'ordine conta: prima l'evento su
   *  Google, che assegna l'id a cui la scheda si aggancia, poi la scheda. Se
   *  la copia della scheda fallisce l'evento resta comunque in calendario —
   *  meglio una data senza locandina che una locandina senza data. */
  async function handleRepeat(draft: EventDraft, parts: CopyParts, shiftDays: number) {
    const saved = await createEvent(draft)
    try {
      await copyExtras(event.id, saved.id, parts, userEmail, shiftDays)
    } finally {
      onCreated?.(saved)
    }
  }

  function dropFiles(e: React.DragEvent) {
    e.preventDefault()
    setDropping(false)
    const images = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    if (images.length) void handleFiles(images)
  }

  const auto = categorize(event.title, event.description).label

  return (
    <div>
      {/* ------------------------------------------------------- comandi -- */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <NavBtn onClick={onPrev} disabled={!hasPrev} label="Evento precedente (←)">
          <ChevronLeft size={14} />
        </NavBtn>
        <NavBtn onClick={onNext} disabled={!hasNext} label="Evento successivo (→)">
          <ChevronRight size={14} />
        </NavBtn>
        <button
          onClick={onPreview}
          className="stamp-btn tap-grow flex items-center gap-1.5 bg-paper-hi px-2.5 py-2 text-[0.6rem] font-bold tracking-[0.1em] uppercase text-ink sm:py-1.5"
        >
          <Eye size={13} />
          Anteprima
        </button>
        {onEdit && (
          <button
            onClick={onEdit}
            className="stamp-btn tap-grow flex items-center gap-1.5 bg-paper-hi px-2.5 py-2 text-[0.6rem] font-bold tracking-[0.1em] uppercase text-ink sm:py-1.5"
          >
            <Pencil size={13} />
            Date e testi
          </button>
        )}
        <button
          onClick={() => setCopyOpen(true)}
          disabled={busy || loading}
          className="stamp-btn tap-grow flex items-center gap-1.5 bg-paper-hi px-2.5 py-2 text-[0.6rem] font-bold tracking-[0.1em] uppercase text-ink disabled:opacity-50 sm:py-1.5"
        >
          <Copy size={13} />
          Copia da…
        </button>
        {onCreated && (
          <button
            onClick={() => setRepeatOpen(true)}
            disabled={busy || loading}
            className="stamp-btn tap-grow flex items-center gap-1.5 bg-paper-hi px-2.5 py-2 text-[0.6rem] font-bold tracking-[0.1em] uppercase text-ink disabled:opacity-50 sm:py-1.5"
          >
            <CalendarSync size={13} />
            Ripeti l’anno prossimo
          </button>
        )}
        <button
          onClick={onBackToList}
          className="tap-grow ml-auto flex items-center gap-1 px-2 py-2 text-[0.6rem] font-bold tracking-[0.1em] uppercase text-ink-soft hover:text-ink sm:hidden"
        >
          <ChevronLeft size={12} />
          Elenco
        </button>
      </div>

      <p className="eyebrow">{shortRange(event)}</p>
      <h2 className="mt-1 font-display text-xl leading-tight font-black text-ink">{event.title}</h2>

      {/* ------------------------------------------------------ copertina -- */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDropping(true)
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={dropFiles}
        className={`relative mt-4 flex h-56 items-center justify-center overflow-hidden border-2 bg-paper-2 transition-colors ${
          dropping ? 'border-vermiglio bg-vermiglio/10' : 'border-ink'
        }`}
      >
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
        {dropping && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-paper-hi/85 text-xs font-bold tracking-[0.14em] uppercase text-vermiglio">
            Lascia qui le immagini
          </span>
        )}
      </div>

      {/* --------------------------------------------------- galleria -- */}
      {media.photos.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
          {media.photos.map((photo, i) => (
            <div
              key={photo.id}
              /* Trascinare le miniature funziona col mouse; col dito restano
                 le frecce, che sul telefono sono sempre in vista. */
              draggable
              onDragStart={() => {
                dragFrom.current = i
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const from = dragFrom.current
                dragFrom.current = null
                if (from !== null) void handleMove(from, i)
              }}
              className="group relative aspect-square overflow-hidden border-2 border-ink sm:cursor-grab sm:active:cursor-grabbing"
            >
              <img src={photo.dataUrl} alt="" className="h-full w-full object-cover" draggable={false} />
              {i === 0 && (
                <span className="absolute top-0 left-0 bg-ink px-1 text-[0.5rem] font-bold tracking-wider uppercase text-paper-hi">
                  1ª
                </span>
              )}
              {/* Col dito non esiste il passaggio del mouse: sul telefono i
                  comandi stanno sempre in vista, in una fascia in basso che
                  non copre la foto. Sul desktop restano l'antico velo. */}
              <div className="absolute inset-x-0 bottom-0 flex items-stretch justify-center gap-1 bg-ink/75 p-1 transition-opacity sm:inset-0 sm:items-center sm:gap-0.5 sm:p-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
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
        <label className="stamp-btn tap flex flex-1 cursor-pointer items-center justify-center gap-2 bg-vermiglio px-4 py-3 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-paper-hi sm:flex-none sm:justify-start sm:py-2">
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
            className="stamp-btn tap flex flex-1 items-center justify-center gap-2 bg-paper-hi px-4 py-3 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-ink sm:flex-none sm:justify-start sm:py-2"
          >
            <Trash2 size={15} />
            Svuota galleria
          </button>
        )}
      </div>

      <p className="mt-3 text-[0.68rem] leading-relaxed text-ink-faint">
        La prima immagine è la copertina. Massimo {MAX_PHOTOS} per evento —
        {media.photos.length > 0 ? ` ora ne hai ${media.photos.length}.` : ' nessuna caricata.'}
        <span className="hidden sm:inline">
          {' '}
          Puoi trascinare i file sulla copertina, incollarli con Ctrl+V e riordinare le miniature
          trascinandole.
        </span>
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
            className="w-full border-2 border-ink bg-paper-hi px-2.5 py-2.5 text-base font-semibold text-ink outline-none focus:ring-2 focus:ring-vermiglio sm:py-1.5 sm:text-xs"
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
            className="w-full border-2 border-ink bg-paper-hi px-2.5 py-2.5 text-base font-semibold text-ink outline-none focus:ring-2 focus:ring-vermiglio sm:py-1.5 sm:text-xs"
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
        key={`${event.id}-${loading}-${reloadKey}`}
        initial={media.note}
        busy={busy || loading}
        onSave={(note) => patch({ note }, { note }, 'Nota salvata.')}
      />

      {/* ------------------------------------------------------ programma -- */}
      <div className="mt-3">
        <ProgrammaEditor
          event={event}
          initial={media.programma}
          busy={busy || loading}
          onSave={(programma) => patch({ programma }, { programma }, 'Programma salvato.')}
        />
      </div>

      {/* -------------------------------------------------- collegamenti -- */}
      <div className="rule-double my-5" />
      <LinksEditor
        links={media.links}
        busy={busy || loading}
        onSave={(links) => patch({ links }, { links }, 'Collegamenti salvati.')}
      />

      {media.updatedAt && (
        <p className="mt-4 text-[0.62rem] text-ink-faint">
          Ultima modifica {relativeDay(media.updatedAt)}
          {media.updatedBy && ` da ${shortUser(media.updatedBy)}`}.
        </p>
      )}

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

      {copyOpen && (
        <CopyFromDialog
          events={events}
          extrasOf={extrasOf}
          target={event}
          targetHasPhotos={media.photos.length > 0 || Boolean(cover)}
          onClose={() => setCopyOpen(false)}
          onCopy={handleCopyFrom}
        />
      )}

      {repeatOpen && onCreated && (
        <RepeatNextYear
          event={event}
          extras={media}
          onClose={() => setRepeatOpen(false)}
          onCreate={handleRepeat}
        />
      )}

    </div>
  )
}

function NavBtn({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      /* Niente `.tap`: i due comandi sono affiancati e le aree allargate si
         accavallerebbero. Si allargano invece davvero. */
      className="stamp-btn flex min-h-10 min-w-10 items-center justify-center bg-paper-hi px-2 text-ink disabled:opacity-30 sm:min-h-8 sm:min-w-8"
    >
      {children}
    </button>
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
      /* Niente `.tap` qui: i quattro comandi sono affiancati e le aree
         allargate si accavallerebbero rubandosi il tocco. Si allargano invece
         davvero, dividendosi in parti uguali tutta la fascia. */
      className={`flex flex-1 items-center justify-center border border-paper-hi py-2.5 text-paper-hi transition-colors disabled:opacity-30 sm:flex-none sm:p-1 ${
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
          className="w-full resize-y border-2 border-ink bg-paper-hi px-2.5 py-2 text-base leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-vermiglio sm:text-xs"
        />
      </Field>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <span className="text-[0.6rem] text-ink-faint">
          {note.length}/{MAX_NOTE} · compare nella scheda dell'evento
        </span>
        <button
          onClick={() => onSave(note)}
          disabled={busy || !dirty}
          className="stamp-btn tap tap-grow flex shrink-0 items-center gap-1.5 bg-ink px-3 py-2 text-[0.62rem] font-bold tracking-[0.12em] uppercase text-paper-hi sm:py-1.5"
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
                className="tap shrink-0 border border-ink p-2 text-ink transition-colors hover:bg-vermiglio hover:text-paper-hi sm:p-0.5"
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
          className="min-w-0 basis-full border-2 border-ink bg-paper-hi px-2.5 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-vermiglio sm:basis-0 sm:flex-[2] sm:py-1.5 sm:text-xs"
        />
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Etichetta"
          className="min-w-0 flex-1 border-2 border-ink bg-paper-hi px-2.5 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-vermiglio sm:py-1.5 sm:text-xs"
        />
        <button
          type="submit"
          disabled={busy}
          className="stamp-btn tap tap-grow flex shrink-0 items-center gap-1.5 bg-ink px-3 py-2 text-[0.65rem] font-bold tracking-[0.12em] uppercase text-paper-hi sm:py-1.5"
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
