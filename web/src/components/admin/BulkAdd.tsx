import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarPlus, CheckCircle2, ClipboardList, Clock, Trash2, X } from 'lucide-react'
import type { CalendarEvent } from '../../lib/googleCalendar'
import { createMany, emptyDraft, validateDraft, type EventDraft } from '../../lib/calendarWrite'
import { parseSagreLines, spanDays, type ParsedSagra } from '../../lib/parseSagre'

interface BulkAddProps {
  onClose: () => void
  /** Le sagre scritte davvero: l'elenco dell'ufficio manifesti se le prende
   *  subito, senza aspettare la rilettura pubblica. */
  onDone: (saved: CalendarEvent[]) => void
}

interface Row extends ParsedSagra {
  on: boolean
}

const ESEMPIO = `Sagra della salsiccia | dal 12 al 14 agosto | Positano | dalle 19 alle 24
Festa di San Rocco | 16 agosto ore 20:30 | Sorrento
Sagra dei fichi | 12-13 settembre | Massa Lubrense`

/** Venti sagre incollate da un volantino, invece di venti volte lo stesso
 *  modulo. Si legge, si mostra quel che si è capito, e si scrive solo dopo
 *  che qualcuno ha guardato: le date lette a naso sbagliano, e una data
 *  sbagliata sul cartellone la vede tutto il paese. */
export function BulkAdd({ onClose, onDone }: BulkAddProps) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [report, setReport] = useState<{
    ok: number
    failed: Array<{ title: string; error: string }>
  } | null>(null)

  /* Il problema di lettura vale finché la riga non si tocca; da lì in poi
     comanda il controllo del modulo, lo stesso che usa «Date e testi». */
  const errorsOf = (row: Row) => row.problem ?? validateDraft(toDraft(row))

  const chosen = useMemo(() => (rows ?? []).filter((r) => r.on && !errorsOf(r)), [rows])

  /* L'orario da mettere a tutte in un colpo: venti sagre incollate da un
     volantino aprono quasi sempre alla stessa ora, e riscriverlo venti volte
     vanificherebbe il senso di questa finestra. Parte dall'orario di comodo
     del modulo, così non c'è un secondo valore predefinito da tenere a mente. */
  const [everyTime, setEveryTime] = useState(() => {
    const base = emptyDraft()
    return { start: base.startTime, end: base.endTime }
  })

  function read() {
    const parsed = parseSagreLines(text, new Date().getFullYear())
    const base = emptyDraft()
    /* Le righe non capite arrivano spente: si sistemano a mano, e nel dubbio
       restano fuori invece di finire sul calendario per distrazione. */
    setRows(
      parsed.map((p) => ({
        ...p,
        on: !p.problem,
        /* Anche le righe che l'ora non la dicevano tengono le caselle pronte:
           accendere l'interruttore basta, non c'è da scrivere le cifre. */
        startTime: p.startTime || base.startTime,
        endTime: p.endTime || base.endTime,
      }))
    )
  }

  function edit(index: number, changes: Partial<Row>) {
    setRows((prev) =>
      (prev ?? []).map((r, i) => (i === index ? { ...r, ...changes, problem: null } : r))
    )
  }

  /* A differenza di `edit` non azzera il problema di lettura: mettere l'ora a
     tutte non fa comparire la data nella riga che non ce l'aveva. */
  function editAll(changes: Partial<Row>) {
    setRows((prev) => (prev ?? []).map((r) => ({ ...r, ...changes })))
  }

  async function write() {
    setBusy(true)
    setReport(null)
    /* Fotografia delle righe scelte: mentre si scrive i campi sono bloccati,
       quindi gli oggetti restano gli stessi e si riconoscono per identità. */
    const batch = chosen
    try {
      const result = await createMany(batch.map(toDraft), (done, total) => setProgress({ done, total }))
      setReport({ ok: result.saved.length, failed: result.failed })
      onDone(result.saved)
      /* Le righe scritte spariscono dall'anteprima: quel che resta è quel che
         c'è ancora da fare, e nessuno riscrive due volte la stessa sagra. */
      const stuck = new Set(result.failed.map((f) => batch[f.index]))
      setRows((prev) => (prev ?? []).filter((r) => !batch.includes(r) || stuck.has(r)))
    } catch (err) {
      setReport({
        ok: 0,
        failed: [{ title: '', error: err instanceof Error ? err.message : 'Errore sconosciuto.' }],
      })
    } finally {
      setBusy(false)
      setProgress({ done: 0, total: 0 })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-ink/60 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={busy ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Aggiungi tante sagre insieme"
        onClick={(e) => e.stopPropagation()}
        className="ink-box flex max-h-[92dvh] w-full max-w-3xl animate-sheet-up flex-col overflow-hidden bg-paper-hi sm:animate-stamp-in"
      >
        <div className="flex items-start justify-between gap-3 border-b-2 border-ink p-4">
          <div className="min-w-0">
            <p className="eyebrow">Ufficio manifesti</p>
            <h2 className="mt-1 font-display text-lg leading-tight font-black text-ink">
              Aggiungi tante sagre insieme
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Chiudi"
            className="tap shrink-0 border-2 border-ink bg-paper-hi p-2.5 text-ink transition-colors hover:bg-vermiglio hover:text-paper-hi disabled:opacity-40 sm:p-1.5"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
          {rows === null ? (
            <>
              <p className="text-[0.72rem] leading-relaxed text-ink-soft">
                Una riga per sagra: <strong className="font-semibold text-ink">nome, date, paese</strong>,
                separati da una barra verticale. Le date si scrivono come vengono — «dal 12 al 14 agosto»,
                «12-14 ago», «30 luglio - 2 agosto», «12/09/2026». Senza l’anno si intende la prima
                edizione che viene.
              </p>
              <p className="text-[0.72rem] leading-relaxed text-ink-soft">
L’<strong className="font-semibold text-ink">orario</strong> si riconosce accanto alle
                date o in un campo tutto suo — «16 agosto ore 20:30», «… | Positano | dalle 19 alle
                24», «19:00-23:30» — ma non dentro il nome, per non storpiare le sagre che hanno un
                numero nel titolo. Dove non c’è, la festa dura tutto il giorno: l’ora si mette qui
                sotto nell’anteprima, a una riga per volta o a tutte insieme.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={9}
                autoFocus
                placeholder={ESEMPIO}
                className="w-full resize-y border-2 border-ink bg-paper px-3 py-2 font-mono text-[0.78rem] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio"
              />
              <p className="text-[0.65rem] text-ink-faint">
                Le righe vuote e quelle che cominciano con # vengono saltate: un elenco copiato ha spesso i
                titoli dei mesi in mezzo.
              </p>
            </>
          ) : rows.length === 0 ? (
            <p className="flex items-start gap-2 border-2 border-ink/25 bg-paper-2 p-3 text-[0.72rem] text-ink-soft">
              <ClipboardList size={14} className="mt-0.5 shrink-0 text-ink-faint" />
              Non è rimasta nessuna riga da scrivere.
            </p>
          ) : (
            <>
              {/* -------------------------------------- l'orario per tutte -- */}
              <div className="flex flex-wrap items-center gap-1.5 border-2 border-ink/25 bg-paper-2 p-2">
                <span className="eyebrow shrink-0">Orario per tutte</span>
                <input
                  type="time"
                  value={everyTime.start}
                  onChange={(e) => setEveryTime((t) => ({ ...t, start: e.target.value }))}
                  disabled={busy}
                  aria-label="Ora d’apertura per tutte"
                  className="w-28 shrink-0 border-2 border-ink/30 bg-paper-hi px-2 py-2 text-base text-ink outline-none focus:border-ink focus:ring-2 focus:ring-vermiglio disabled:opacity-40 sm:py-1 sm:text-[0.78rem]"
                />
                <span className="shrink-0 text-[0.7rem] text-ink-faint">→</span>
                <input
                  type="time"
                  value={everyTime.end}
                  onChange={(e) => setEveryTime((t) => ({ ...t, end: e.target.value }))}
                  disabled={busy}
                  aria-label="Ora di chiusura per tutte"
                  className="w-28 shrink-0 border-2 border-ink/30 bg-paper-hi px-2 py-2 text-base text-ink outline-none focus:border-ink focus:ring-2 focus:ring-vermiglio disabled:opacity-40 sm:py-1 sm:text-[0.78rem]"
                />
                <button
                  onClick={() =>
                    editAll({ allDay: false, startTime: everyTime.start, endTime: everyTime.end })
                  }
                  disabled={busy || !everyTime.start || !everyTime.end}
                  className="stamp-btn tap flex shrink-0 items-center gap-1.5 bg-ink px-2.5 py-2 text-[0.6rem] font-bold tracking-[0.1em] uppercase text-paper-hi disabled:opacity-40 sm:py-1.5"
                >
                  <Clock size={11} />
                  Applica a tutte
                </button>
                <button
                  onClick={() => editAll({ allDay: true })}
                  disabled={busy}
                  className="stamp-btn tap shrink-0 bg-paper-hi px-2.5 py-2 text-[0.6rem] font-bold tracking-[0.1em] uppercase text-ink disabled:opacity-40 sm:py-1.5"
                >
                  Tutte tutto il giorno
                </button>
              </div>

              {rows.map((row, i) => {
                const problem = errorsOf(row)
                const days = spanDays(row)
                return (
                  <div
                    key={`${row.raw}-${i}`}
                    className={`border-2 p-2.5 ${problem ? 'border-vermiglio bg-vermiglio/5' : row.on ? 'border-ink bg-paper-2' : 'border-ink/25 bg-paper'}`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => edit(i, { on: !row.on })}
                        role="switch"
                        aria-checked={row.on}
                        aria-label={row.on ? 'Non scrivere questa' : 'Scrivi questa'}
                        disabled={busy}
                        className={`tap mt-0.5 flex size-6 shrink-0 items-center justify-center border-2 border-ink transition-colors disabled:opacity-40 ${
                          row.on ? 'bg-ink text-paper-hi' : 'bg-paper-hi text-transparent'
                        }`}
                      >
                        <CheckCircle2 size={13} />
                      </button>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <input
                          value={row.title}
                          onChange={(e) => edit(i, { title: e.target.value })}
                          placeholder="Nome della sagra"
                          disabled={busy}
                          className="w-full border-2 border-ink/30 bg-paper-hi px-2 py-2 text-base font-semibold text-ink outline-none focus:border-ink focus:ring-2 focus:ring-vermiglio sm:py-1 sm:text-[0.8rem]"
                        />
                        <div className="grid gap-1.5 sm:grid-cols-[1fr_1fr_1.2fr]">
                          <input
                            type="date"
                            value={row.startDate}
                            onChange={(e) => edit(i, { startDate: e.target.value })}
                            disabled={busy}
                            aria-label="Primo giorno"
                            className="w-full border-2 border-ink/30 bg-paper-hi px-2 py-2 text-base text-ink outline-none focus:border-ink focus:ring-2 focus:ring-vermiglio sm:py-1 sm:text-[0.78rem]"
                          />
                          <input
                            type="date"
                            value={row.endDate}
                            min={row.startDate || undefined}
                            onChange={(e) => edit(i, { endDate: e.target.value })}
                            disabled={busy}
                            aria-label="Ultimo giorno"
                            className="w-full border-2 border-ink/30 bg-paper-hi px-2 py-2 text-base text-ink outline-none focus:border-ink focus:ring-2 focus:ring-vermiglio sm:py-1 sm:text-[0.78rem]"
                          />
                          <input
                            value={row.location}
                            onChange={(e) => edit(i, { location: e.target.value })}
                            placeholder="Paese"
                            disabled={busy}
                            className="w-full border-2 border-ink/30 bg-paper-hi px-2 py-2 text-base text-ink outline-none focus:border-ink focus:ring-2 focus:ring-vermiglio sm:py-1 sm:text-[0.78rem]"
                          />
                        </div>

                        {/* ------------------------------------- l'orario -- */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => edit(i, { allDay: !row.allDay })}
                            role="switch"
                            aria-checked={!row.allDay}
                            disabled={busy}
                            className={`tap flex shrink-0 items-center gap-1.5 border-2 px-2 py-2 text-[0.6rem] font-bold tracking-[0.1em] uppercase transition-colors disabled:opacity-40 sm:py-1 ${
                              row.allDay
                                ? 'border-ink/30 bg-paper-hi text-ink-soft'
                                : 'border-ink bg-ink text-paper-hi'
                            }`}
                          >
                            <Clock size={11} />
                            {row.allDay ? 'Tutto il giorno' : 'Con orario'}
                          </button>
                          {!row.allDay && (
                            <>
                              <input
                                type="time"
                                value={row.startTime}
                                onChange={(e) => edit(i, { startTime: e.target.value })}
                                disabled={busy}
                                aria-label="Ora d’apertura"
                                className="w-28 shrink-0 border-2 border-ink/30 bg-paper-hi px-2 py-2 text-base text-ink outline-none focus:border-ink focus:ring-2 focus:ring-vermiglio sm:py-1 sm:text-[0.78rem]"
                              />
                              <span className="shrink-0 text-[0.7rem] text-ink-faint">→</span>
                              <input
                                type="time"
                                value={row.endTime}
                                onChange={(e) => edit(i, { endTime: e.target.value })}
                                disabled={busy}
                                aria-label="Ora di chiusura"
                                className="w-28 shrink-0 border-2 border-ink/30 bg-paper-hi px-2 py-2 text-base text-ink outline-none focus:border-ink focus:ring-2 focus:ring-vermiglio sm:py-1 sm:text-[0.78rem]"
                              />
                            </>
                          )}
                        </div>

                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.62rem] text-ink-faint">
                          {problem ? (
                            <span className="flex items-center gap-1 font-semibold text-vermiglio">
                              <AlertTriangle size={11} />
                              {problem}
                            </span>
                          ) : (
                            <>
                              <span>{whenLabel(row, days)}</span>
                              {row.past && (
                                <span className="font-semibold text-vermiglio">Già passata.</span>
                              )}
                            </>
                          )}
                          <span className="min-w-0 truncate opacity-70" title={row.raw}>
                            {row.raw}
                          </span>
                        </p>

                        {/* Un orario su una sagra di più giorni su Google è un
                            blocco unico, non l'orario di ogni sera: chi compila
                            deve saperlo prima di scrivere, non dopo. */}
                        {!problem && !row.allDay && days > 1 && (
                          <p className="text-[0.62rem] leading-relaxed text-ink-soft">
                            Un blocco unico da un capo all’altro della festa, non l’orario di ogni sera:
                            per quello c’è il programma della sagra, sulla sua scheda.
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => setRows((prev) => (prev ?? []).filter((_, j) => j !== i))}
                        aria-label="Togli questa riga"
                        disabled={busy}
                        className="tap mt-0.5 shrink-0 border-2 border-ink/25 p-1.5 text-ink-faint transition-colors hover:border-vermiglio hover:text-vermiglio disabled:opacity-40"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {report && (
            <div className="space-y-1 border-2 border-ink bg-paper-2 p-3">
              <p className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-ink">
                <CheckCircle2 size={13} className="shrink-0 text-oliva" />
                Scritte {report.ok} {report.ok === 1 ? 'sagra' : 'sagre'} sul calendario.
              </p>
              {report.failed.map((f, i) => (
                <p key={i} className="flex items-start gap-1.5 text-[0.66rem] text-vermiglio">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                  {f.title ? `${f.title}: ` : ''}
                  {f.error}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t-2 border-ink p-3">
          {rows === null ? (
            <button
              onClick={read}
              disabled={!text.trim()}
              className="stamp-btn tap flex flex-1 items-center justify-center gap-2 bg-ink px-4 py-3 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-paper-hi disabled:opacity-40 sm:py-2.5"
            >
              <ClipboardList size={14} />
              Guarda cosa ho capito
            </button>
          ) : (
            <>
              <button
                onClick={() => setRows(null)}
                disabled={busy}
                className="stamp-btn tap shrink-0 bg-paper-hi px-3 py-3 text-[0.65rem] font-bold tracking-[0.1em] uppercase text-ink disabled:opacity-40 sm:py-2.5"
              >
                Torna al testo
              </button>
              <button
                onClick={() => void write()}
                disabled={busy || chosen.length === 0}
                className="stamp-btn tap flex flex-1 items-center justify-center gap-2 bg-vermiglio px-4 py-3 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-paper-hi disabled:opacity-40 sm:py-2.5"
              >
                <CalendarPlus size={14} />
                {busy
                  ? `Scrivo ${progress.done}/${progress.total || chosen.length}…`
                  : chosen.length === 0
                    ? 'Nessuna riga pronta'
                    : `Scrivi ${chosen.length} ${chosen.length === 1 ? 'sagra' : 'sagre'}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Quel che finirà sul calendario, detto in italiano: è la riga che si legge
 *  prima di premere «Scrivi», e deve dire la verità anche quando la verità è
 *  scomoda — una festa di tre giorni con l'orario è un blocco unico. */
function whenLabel(row: Row, days: number): string {
  const quanti = days === 1 ? 'Un giorno' : `${days} giorni`
  if (row.allDay) return `${quanti}, tutto il giorno.`
  if (days === 1) return `${quanti}, dalle ${row.startTime} alle ${row.endTime}.`
  return `${quanti}, dalle ${row.startTime} del primo alle ${row.endTime} dell’ultimo.`
}

/** Una riga dell'anteprima diventa un evento. Senza orario dura tutto il
 *  giorno, come prima; con l'orario vale quello che si legge nell'anteprima —
 *  letto dalla riga incollata o messo a mano lì dentro. */
function toDraft(row: Row | ParsedSagra): EventDraft {
  const base = emptyDraft()
  return {
    ...base,
    title: row.title.trim(),
    location: row.location.trim(),
    description: '',
    allDay: row.allDay,
    startDate: row.startDate,
    endDate: row.endDate,
    /* Il ripiego serve alle righe che arrivano da `parseSagreLines` senza
       passare per l'anteprima: quelle dell'anteprima hanno già le caselle
       piene, riempite in `read` con questi stessi valori. */
    startTime: row.startTime || base.startTime,
    endTime: row.endTime || base.endTime,
  }
}
