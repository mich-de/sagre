import { daysBetween, isoDay, startOfDay } from './dates'

/* ---------------------------------------------------------------------------
 * Le sagre arrivano in blocco, e non in forma di modulo: un elenco copiato da
 * un volantino, da un messaggio, dal foglio del comune. Una riga per festa, le
 * date scritte come le scrive la gente — "dal 12 al 14 agosto", "12-14 ago",
 * "30 luglio - 2 agosto", "12/08/2026".
 *
 * Questo modulo non scrive niente e non indovina niente in silenzio: traduce
 * ogni riga in una proposta, e quando non ci riesce lo dice riga per riga. La
 * conferma è sempre di chi guarda l'anteprima.
 * ------------------------------------------------------------------------- */

export interface ParsedSagra {
  /** La riga come è arrivata: nell'anteprima si mostra accanto alla proposta. */
  raw: string
  title: string
  location: string
  /** 'AAAA-MM-GG'. Vuote quando la data non si è capita. */
  startDate: string
  /** Ultimo giorno di festa, come in `EventDraft`: non il giorno dopo. */
  endDate: string
  /** Che cosa non torna in questa riga, in italiano. `null` se è a posto. */
  problem: string | null
  /** La festa è già passata. Non è un errore — si può star sistemando un
   *  cartellone vecchio — ma va detto prima di scrivere sul calendario. */
  past: boolean
}

const MONTHS: Record<string, number> = {
  gennaio: 1,
  gen: 1,
  febbraio: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  aprile: 4,
  apr: 4,
  maggio: 5,
  mag: 5,
  giugno: 6,
  giu: 6,
  luglio: 7,
  lug: 7,
  agosto: 8,
  ago: 8,
  settembre: 9,
  sett: 9,
  set: 9,
  ottobre: 10,
  ott: 10,
  novembre: 11,
  nov: 11,
  dicembre: 12,
  dic: 12,
}

/* I nomi lunghi davanti a quelli corti, altrimenti "gen" mangerebbe l'inizio
   di "gennaio" e il resto della riga andrebbe a rimorchio. */
const MONTH_RE = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|')

/** "al", "-", "e", "/": i modi in cui si scrive "fino a". Il punto va incluso
 *  perché le abbreviazioni arrivano spesso col punto ("12 ago. - 14 ago."). */
const TO = '(?:\\s*(?:-|al|alla|a|e|ed|\\/)\\s*)'
const DAY = '(\\d{1,2})'
const YEAR = '(?:\\s*(\\d{4}))?'
const SEP = /[|\t;]/

/** Due date scritte per intero: "dal 30 luglio al 2 agosto". */
const FULL_RANGE = new RegExp(`${DAY}\\s*°?\\s*(${MONTH_RE})\\.?${YEAR}${TO}${DAY}\\s*°?\\s*(${MONTH_RE})\\.?${YEAR}`, 'i')
/** Due giorni e un mese solo: "12-14 agosto", "12 e 13 agosto". */
const SHORT_RANGE = new RegExp(`${DAY}${TO}${DAY}\\s*°?\\s*(${MONTH_RE})\\.?${YEAR}`, 'i')
/** Un giorno solo: "16 agosto 2026". */
const SINGLE = new RegExp(`${DAY}\\s*°?\\s*(${MONTH_RE})\\.?${YEAR}`, 'i')
/** "12/08/2026 - 14/08/2026" */
const NUM_RANGE = /(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\s*(?:-|al)\s*(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?/
/** "12/08/2026", "12/8" */
const NUM_SINGLE = /(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?/

interface Found {
  start: Date
  end: Date
  /** Dove stava la data nella riga: serve a ritagliare titolo e paese quando
   *  chi incolla non ha messo separatori. */
  from: number
  to: number
  /** L'anno era scritto? Se no si può spostare la festa avanti di un anno. */
  hadYear: boolean
}

/** Una data vera, o `null` se il giorno non esiste in quel mese (31 febbraio). */
function makeDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(year, month - 1, day)
  return d.getMonth() === month - 1 && d.getDate() === day ? d : null
}

/** "26" è il 2026, non l'anno di Nerone. */
function fullYear(raw: string | undefined, fallback: number): { year: number; had: boolean } {
  if (!raw) return { year: fallback, had: false }
  const n = Number(raw)
  return { year: n < 100 ? 2000 + n : n, had: true }
}

const monthNum = (name: string) => MONTHS[name.toLowerCase()]

/** Cerca una data dentro un pezzo di testo. Si provano prima le forme più
 *  ricche: "dal 30 luglio al 2 agosto" contiene anche "30 luglio", e a
 *  cominciare dalla forma corta si perderebbe metà della festa. */
export function findDates(text: string, year: number): Found | null {
  const full = FULL_RANGE.exec(text)
  if (full) {
    const y1 = fullYear(full[3], year)
    const m1 = monthNum(full[2])
    const m2 = monthNum(full[5])
    /* "dal 30 dicembre al 2 gennaio": la fine è dell'anno dopo. */
    const y2 = fullYear(full[6], m2 < m1 ? y1.year + 1 : y1.year)
    const start = makeDate(y1.year, m1, Number(full[1]))
    const end = makeDate(y2.year, m2, Number(full[4]))
    if (start && end) {
      return { start, end, from: full.index, to: full.index + full[0].length, hadYear: y1.had || y2.had }
    }
  }

  const short = SHORT_RANGE.exec(text)
  if (short) {
    const { year: y, had } = fullYear(short[4], year)
    const month = monthNum(short[3])
    const start = makeDate(y, month, Number(short[1]))
    const end = makeDate(y, month, Number(short[2]))
    if (start && end) {
      return { start, end, from: short.index, to: short.index + short[0].length, hadYear: had }
    }
  }

  const numRange = NUM_RANGE.exec(text)
  if (numRange) {
    const y1 = fullYear(numRange[3], year)
    const y2 = fullYear(numRange[6], y1.year)
    const start = makeDate(y1.year, Number(numRange[2]), Number(numRange[1]))
    const end = makeDate(y2.year, Number(numRange[5]), Number(numRange[4]))
    if (start && end) {
      return {
        start,
        end,
        from: numRange.index,
        to: numRange.index + numRange[0].length,
        hadYear: y1.had || y2.had,
      }
    }
  }

  const one = SINGLE.exec(text)
  if (one) {
    const { year: y, had } = fullYear(one[3], year)
    const day = makeDate(y, monthNum(one[2]), Number(one[1]))
    if (day) return { start: day, end: day, from: one.index, to: one.index + one[0].length, hadYear: had }
  }

  const num = NUM_SINGLE.exec(text)
  if (num) {
    const { year: y, had } = fullYear(num[3], year)
    const day = makeDate(y, Number(num[2]), Number(num[1]))
    if (day) return { start: day, end: day, from: num.index, to: num.index + num[0].length, hadYear: had }
  }

  return null
}

/** Toglie le parole di servizio rimaste attaccate al titolo o al paese dopo
 *  aver ritagliato la data: "Sagra del cinghiale, dal" non è un titolo. */
function tidy(value: string): string {
  return value
    .replace(/^[\s,;:\-–—]+|[\s,;:\-–—]+$/g, '')
    .replace(/\s+/g, ' ')
    /* Solo le parole di collegamento alla data: un "il" o un "lo" di troppo
       tolti dal nome storpierebbero "Il palio dei somari". */
    .replace(/^(?:dal|dall'|da|nei giorni|giorni|a|ad|in)\s+/i, '')
    .replace(/\s+(?:dal|dall'|da|il|nei giorni|dalle)$/i, '')
    .trim()
}

/** Una riga sola. `year` è l'anno da usare quando la riga non lo dice. */
export function parseSagraLine(raw: string, year: number, now: Date = new Date()): ParsedSagra | null {
  const line = raw.trim()
  /* Righe vuote e commenti: chi incolla un elenco ci lascia dentro i titoli
     delle sezioni ("### Agosto"), e non sono sagre. */
  if (!line || line.startsWith('#')) return null

  const empty = { raw: line, title: '', location: '', startDate: '', endDate: '', past: false }
  const fields = line.split(SEP).map((f) => f.trim())

  let title: string
  let dateText: string
  let location: string

  if (fields.length >= 2) {
    title = fields[0]
    dateText = fields[1]
    location = fields.slice(2).join(', ').trim()
  } else {
    /* Nessun separatore: la data si cerca dentro la riga, e quel che sta prima
       è il nome, quel che sta dopo il paese. Meglio di un rifiuto secco. */
    const found = findDates(line, year)
    if (!found) return { ...empty, problem: 'Non ho trovato la data.' }
    title = tidy(line.slice(0, found.from))
    location = tidy(line.slice(found.to))
    return finish({ raw: line, title, location, found, now })
  }

  if (!title) return { ...empty, problem: 'Manca il nome della sagra.' }
  const found = findDates(dateText, year)
  if (!found) return { ...empty, title, location, problem: `Non ho capito la data «${dateText}».` }
  return finish({ raw: line, title, location, found, now })
}

function finish({
  raw,
  title,
  location,
  found,
  now,
}: {
  raw: string
  title: string
  location: string
  found: Found
  now: Date
}): ParsedSagra {
  let { start, end } = found
  const today = startOfDay(now)
  /* Anno non scritto e festa già passata: si intende l'edizione che viene, non
     quella dell'anno scorso. Il confronto è con la mezzanotte di oggi, non con
     adesso: una sagra che finisce stasera è ancora la sagra di quest'anno.
     Con l'anno scritto a mano non si tocca niente: magari si sta sistemando un
     cartellone vecchio. */
  if (!found.hadYear && end < today) {
    start = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate())
    end = new Date(end.getFullYear() + 1, end.getMonth(), end.getDate())
  }
  const startDate = isoDay(start)
  const endDate = isoDay(end)
  return {
    raw,
    title: tidy(title),
    location,
    startDate,
    endDate,
    past: end < today,
    problem: !title.trim()
      ? 'Manca il nome della sagra.'
      : endDate < startDate
        ? 'La fine viene prima dell’inizio.'
        : null,
  }
}

/** L'elenco intero. Le righe non capite restano nell'elenco col loro perché:
 *  sparire in silenzio è il modo migliore per far scrivere metà cartellone
 *  senza che nessuno se ne accorga. */
export function parseSagreLines(text: string, year: number, now: Date = new Date()): ParsedSagra[] {
  return text
    .split(/\r?\n/)
    .map((line) => parseSagraLine(line, year, now))
    .filter((row): row is ParsedSagra => row !== null)
}

/** Quanti giorni dura la festa: serve all'anteprima per dire "3 giorni". */
export function spanDays(row: ParsedSagra): number {
  if (!row.startDate || !row.endDate) return 0
  return daysBetween(row.startDate, row.endDate) + 1
}
