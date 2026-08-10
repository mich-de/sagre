import { useState, type FormEvent } from 'react'
import { AlertTriangle, CalendarPlus, Repeat, Save, Trash2, X } from 'lucide-react'
import {
  createEvent,
  deleteEvent,
  draftFrom,
  emptyDraft,
  isRecurringInstance,
  updateEvent,
  validateDraft,
  type EventDraft,
} from '../../lib/calendarWrite'
import { deleteEverything } from '../../lib/posters'
import type { CalendarEvent } from '../../lib/googleCalendar'

interface EventFormProps {
  /** `null` = evento nuovo. */
  event: CalendarEvent | null
  onClose: () => void
  /** Il calendario va riletto: Google assegna lui l'id e normalizza le date. */
  onSaved: (eventId: string) => void
  onDeleted: (eventId: string) => void
}

/** Modulo per scrivere sul calendario vero. Le locandine restano attaccate
 *  all'id dell'evento, perciò cancellarlo porta via anche la sua scheda: la
 *  conferma lo dice chiaro prima di procedere. */
export function EventForm({ event, onClose, onSaved, onDeleted }: EventFormProps) {
  const [draft, setDraft] = useState<EventDraft>(() => (event ? draftFrom(event) : emptyDraft()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = (patch: Partial<EventDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const ripetuto = event ? isRecurringInstance(event.id) : false

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const problem = validateDraft(draft)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (event) {
        await updateEvent(event.id, draft)
        onSaved(event.id)
      } else {
        onSaved(await createEvent(draft))
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.')
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!event) return
    setBusy(true)
    setError(null)
    try {
      await deleteEvent(event.id)
      /* Senza l'evento la scheda non ha più a chi attaccarsi: resterebbe in
         archivio a occupare posto e a comparire nei conteggi. */
      await deleteEverything(event.id).catch(() => undefined)
      onDeleted(event.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancellazione non riuscita.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-ink/60 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={event ? 'Modifica evento' : 'Nuovo evento'}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="ink-box flex max-h-[92dvh] w-full max-w-lg animate-sheet-up flex-col overflow-hidden bg-paper-hi sm:animate-stamp-in"
      >
        <div className="flex items-start justify-between gap-3 border-b-2 border-ink p-4">
          <div className="min-w-0">
            <p className="eyebrow">{event ? 'Modifica sul calendario' : 'Nuovo evento'}</p>
            <h2 className="mt-1 truncate font-display text-lg leading-tight font-black text-ink">
              {event ? event.title : 'Aggiungi una sagra'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="tap shrink-0 border-2 border-ink bg-paper-hi p-2.5 text-ink transition-colors hover:bg-vermiglio hover:text-paper-hi sm:p-1.5"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
          {ripetuto && (
            <p className="flex items-start gap-2 border-2 border-ink bg-senape/20 p-2.5 text-[0.68rem] leading-relaxed font-semibold text-ink">
              <Repeat size={14} className="mt-0.5 shrink-0" />
              Questo appuntamento fa parte di una serie che si ripete: la modifica vale solo per questa
              data, le altre restano come sono.
            </p>
          )}

          <label className="block">
            <span className="eyebrow mb-1 block">Titolo</span>
            <input
              type="text"
              required
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Sagra della porchetta"
              className="w-full border-2 border-ink bg-paper px-3 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio sm:py-2 sm:text-sm"
            />
          </label>

          <label className="block">
            <span className="eyebrow mb-1 block">Luogo</span>
            <input
              type="text"
              value={draft.location}
              onChange={(e) => set({ location: e.target.value })}
              placeholder="Piazza Umberto I, Positano"
              className="w-full border-2 border-ink bg-paper px-3 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio sm:py-2 sm:text-sm"
            />
            <span className="mt-1 block text-[0.62rem] text-ink-faint">
              Il paese scritto qui è quello che finisce nel filtro "tutti i paesi".
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-2.5 border-2 border-ink bg-paper-2 p-2.5">
            <input
              type="checkbox"
              checked={draft.allDay}
              onChange={(e) => set({ allDay: e.target.checked })}
              className="h-4 w-4 shrink-0 accent-[var(--color-vermiglio)]"
            />
            <span className="text-xs font-bold tracking-wide uppercase text-ink">Tutto il giorno</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow mb-1 block">Inizio</span>
              <input
                type="date"
                required
                value={draft.startDate}
                onChange={(e) => {
                  /* La fine segue l'inizio quando resterebbe indietro: nessuno
                     scrive apposta una sagra che finisce prima di cominciare. */
                  const startDate = e.target.value
                  set({ startDate, endDate: draft.endDate < startDate ? startDate : draft.endDate })
                }}
                className="w-full border-2 border-ink bg-paper px-3 py-2.5 text-base text-ink outline-none focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio sm:py-2 sm:text-sm"
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-1 block">
                {draft.allDay ? 'Ultimo giorno' : 'Fine'}
              </span>
              <input
                type="date"
                required
                min={draft.startDate}
                value={draft.endDate}
                onChange={(e) => set({ endDate: e.target.value })}
                className="w-full border-2 border-ink bg-paper px-3 py-2.5 text-base text-ink outline-none focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio sm:py-2 sm:text-sm"
              />
            </label>
          </div>

          {!draft.allDay && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="eyebrow mb-1 block">Ora d’inizio</span>
                <input
                  type="time"
                  required
                  value={draft.startTime}
                  onChange={(e) => set({ startTime: e.target.value })}
                  className="w-full border-2 border-ink bg-paper px-3 py-2.5 text-base text-ink outline-none focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio sm:py-2 sm:text-sm"
                />
              </label>
              <label className="block">
                <span className="eyebrow mb-1 block">Ora di fine</span>
                <input
                  type="time"
                  required
                  value={draft.endTime}
                  onChange={(e) => set({ endTime: e.target.value })}
                  className="w-full border-2 border-ink bg-paper px-3 py-2.5 text-base text-ink outline-none focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio sm:py-2 sm:text-sm"
                />
              </label>
            </div>
          )}

          <label className="block">
            <span className="eyebrow mb-1 block">Descrizione</span>
            <textarea
              rows={4}
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Programma, stand, musica dal vivo…"
              className="w-full resize-y border-2 border-ink bg-paper px-3 py-2 text-base leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio sm:text-sm"
            />
          </label>

          {error && (
            <p className="flex items-start gap-1.5 border-2 border-vermiglio bg-vermiglio/10 p-2.5 text-[0.7rem] font-semibold text-ink">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-vermiglio" />
              {error}
            </p>
          )}
        </div>

        <div className="border-t-2 border-ink p-3">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="flex items-start gap-1.5 text-[0.7rem] font-semibold text-ink">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-vermiglio" />
                L’evento sparisce dal calendario Google, e con lui la sua locandina, la nota e i
                collegamenti. Non si torna indietro.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="stamp-btn tap flex flex-1 items-center justify-center gap-2 bg-vermiglio px-3 py-3 text-[0.65rem] font-bold tracking-[0.12em] uppercase text-paper-hi disabled:opacity-50 sm:py-2"
                >
                  <Trash2 size={13} />
                  {busy ? 'Cancello…' : 'Sì, cancella'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy}
                  className="stamp-btn tap flex flex-1 items-center justify-center bg-paper-hi px-3 py-3 text-[0.65rem] font-bold tracking-[0.12em] uppercase text-ink sm:py-2"
                >
                  Lascia stare
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="stamp-btn tap flex flex-1 items-center justify-center gap-2 bg-vermiglio px-4 py-3 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-paper-hi disabled:opacity-50 sm:py-2.5"
              >
                {event ? <Save size={14} /> : <CalendarPlus size={14} />}
                {busy ? 'Salvo…' : event ? 'Salva sul calendario' : 'Crea evento'}
              </button>
              {event && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                  aria-label="Cancella evento"
                  className="stamp-btn tap flex items-center justify-center gap-2 bg-paper-hi px-3 py-3 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-ink disabled:opacity-50 sm:py-2.5"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
