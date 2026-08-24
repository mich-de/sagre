# Registro della Codebase — sagre_app

Aggiornato: 2026-08-24. Il progetto ha due metà indipendenti:

- **`app/`** — applicazione Android nativa (Kotlin, Jetpack Compose), pacchetto `com.sagreai`.
- **`web/`** — cartellone pubblico e ufficio manifesti (React 19 + Vite + Tailwind 4, TypeScript).

Tutto quello che segue riguarda `web/`, dove si è svolto il lavoro recente.

## Come si verifica

Non c'è nessun test runner. Dalla cartella `web/`:

```
npx tsc -b        # tipi
npm run lint      # oxlint
npm run build     # tsc -b && vite build
npm run dev       # http://localhost:5173/sagre/  e  /sagre/admin
```

`base: '/sagre/'` in `vite.config.ts`: qualunque URL costruito a mano deve passare per
`import.meta.env.BASE_URL`, non per il solo `window.location.origin`.

## Pattern architetturali in vigore

- **I filtri stanno nell'indirizzo, non nello stato.** `hooks/useHomeFilters.ts` è l'unica verità:
  `q, cat, quando, da, a, luogo, ordine, vista, e`. Si scrive solo quel che si discosta dal valore
  normale. Anche la scheda aperta è un parametro (`e`), così il link è condivisibile.
- **Le date sono stringhe di due formati diversi.** `CalendarEvent.start`/`.end` mescolano
  `'2026-08-14'` e `'2026-08-14T18:00:00+02:00'`: **non si confrontano mai come stringhe**. Si passa
  sempre per `eventStart()` / `parseEventDate()` di `lib/dates.ts`.
- **La fine degli eventi tutto il giorno è esclusiva** (convenzione di Google Calendar). `toBody`
  aggiunge un giorno in scrittura; per mostrarla si usa `eventEndInclusive()`.
- **Nel testo incollato le date si leggono prima degli orari.** `19.30` e `12.08` si scrivono allo
  stesso modo: cercando l'ora per prima, «dalle 12 alle 14 agosto» perde le date **in silenzio**.
  `findDates` si prende il suo pezzo, `findTime` cerca in quel che resta — e se la data non c'è lo
  dice. L'orario non si cerca mai dentro il **nome** della sagra, che è testo scritto a mano.
- **La logica non sta nei componenti.** Filtri, date, categorie, luoghi, ICS, meteo e locandine
  vivono in `lib/`, così barra dei filtri, home e stampa condividono lo stesso comportamento.
- **Firestore soltanto** per le schede: `posters/{eventId}` tiene la miniatura, le immagini piene
  stanno una per documento nella sottoraccolta `photos` (`order` più basso = copertina). Tetto di
  1 MiB per documento; `MAX_PHOTOS = 12`, `MAX_LINKS = 8`, `MAX_NOTE = 2000`.
- **Le scritture in massa sono sequenziali** (`createMany`, `runBulk`): una raffica in parallelo si
  prende un errore di quota e lascia il cartellone scritto a metà.
- **Niente React dentro Leaflet.** I popup sono nodi che Leaflet crea e distrugge quando vuole: il
  tocco su un pallino accende un paese e l'elenco delle sue sagre compare *sotto* la mappa.
- **Fogli di stile di terze parti in `index.css`**, accanto ai colori di stampa: prima FullCalendar
  (`.fc …`), ora Leaflet (`.leaflet-…`, `.sagra-pin`). Negli attributi SVG le variabili CSS non si
  possono usare, quindi i pallini si colorano da lì.

## Moduli — `web/src/lib/`

| file | responsabilità | funzioni chiave |
| --- | --- | --- |
| `dates.ts` | tutta l'aritmetica del calendario | `parseEventDate`, `eventStart`, `eventEndInclusive`, `eventEndExclusive`, `startOfDay`, `addDays`, `isoDay`, `daysBetween`, `weekendWindow`, `isOver`, `isOngoing`, `occursOn`, `isMultiDay`, `formatDuration`, `groupByMonth` |
| `filters.ts` | finestre temporali, ordinamento, categorie accese | `inTimeRange`, `sortEvents`, `toggleCategory`, `RANGES`, `SORTS`, `TimeRange`, `CalendarViewMode` |
| `places.ts` | il paese ricavato dal testo libero del campo luogo | `placeOf`, `normalizePlace`, `groupByPlace`, `collectPlaces`, `inPlace` |
| `categorize.ts` | sette categorie con colore, indovinate dal titolo | `categorize`, `CATEGORIES` |
| `googleCalendar.ts` | lettura del calendario condiviso | `CalendarEvent`, `toEvent` |
| `calendarWrite.ts` | scrittura sul calendario | `createEvent`, `updateEvent`, `deleteEvent`, `createMany`, `validateDraft`, `emptyDraft`, `EventDraft` |
| `posters.ts` | schede su Firestore: locandine, collegamenti, nota, programma | `listExtras`, `saveExtras`, `copyExtras`, `runBulk`, `hasPoster`, `posterRef`, `EventExtras`, `EventMedia` |
| `programma.ts` | il programma legato ai giorni veri della festa | `programmaRows`, `orphanRows`, `cleanProgramma`, `dayLabel`, `todayRow` |
| `nextYear.ts` | la stessa sagra l'anno prossimo | `nextYearShift` (modi `'data'` e `'giorno'`), `shiftDraft` |
| `parseSagre.ts` | righe incollate a mano → bozze di evento, date **e orari** | `parseSagreLines`, `parseSagraLine`, `findDates`, `findTime`, `spanDays` |
| `ics.ts` | file .ics (RFC 5545) e abbonamento al calendario | `buildIcs`, `downloadIcs`, `icsFileName`, `eventPageUrl`, `subscriptionUrl`, `webcalUrl` |
| `weather.ts` | previsioni Open-Meteo, senza chiave | `geocode` (**cache coordinate in `localStorage`, condivisa con la mappa**), `forecast`, `skyOf`, `isWet`, `forecastableDays` |
| `links.ts` | i collegamenti dell'organizzatore | riconoscimento e normalizzazione |
| `firebase.ts`, `googleAuth.ts` | accesso e credenziali | — |

Il resto del sito non ricalcola mai a mano né date né paesi: passa da `dates.ts` e `places.ts`.

## Componenti

**Pubblici** — `pages/Home.tsx` (cartellone, tre pannelli Oggi/Domani/Fine settimana, legenda
cliccabile, «Portalo via»), `CalendarView` (FullCalendar), `AgendaList`, `EventCard`, `EventModal`,
`FilterBar` (tre viste: griglia, elenco, mappa), `PlacesMap` (Leaflet, caricato con `React.lazy`),
`MonthRail`, `NoResults`, `PrintMasthead`, `WeatherStrip`, `DateRange`, `BackToTop`, `Header`.

**Ufficio manifesti** — `pages/Admin.tsx` più `admin/`: `EventForm`, `BulkActions`, `BulkAdd`,
`CopyFromDialog`, `RepeatNextYear`, `ProgrammaEditor`, `TodoPanel`, `PartToggle`.

## Dipendenze esterne

`react` 19, `react-router-dom` 7, `firebase` 12, `@fullcalendar/*` 6, `lucide-react` 1 (**nessuna
icona di marchi**), `leaflet` 1.9 + `@types/leaflet`. Servizi: Google Calendar API, Firestore,
Open-Meteo (geocoding e previsioni, senza chiave), mattonelle OpenStreetMap (**l'attribuzione ODbL
va lasciata visibile**).

I valori d'ambiente stanno in `web/.env`, mai nel repo, e nei secret di GitHub Actions.

## Decisioni prese, da non riaprire

- **Import da Instagram: scartato.** Costruito, funzionante e rimosso su richiesta dell'utente il
  24 agosto 2026 — decisione di prodotto, non tecnica. Nessuna variante (oEmbed, embed, proxy) va
  riproposta.

## Da fare / criticità

- Il bundle principale supera i 500 kB: FullCalendar e Firebase sono i due grossi, e potrebbero
  seguire la strada di Leaflet (`React.lazy`).
- Vulnerabilità: nessuna. `npm audit` è pulito dal 24 agosto 2026 (`nanoid` risolta con
  `npm audit fix`, senza effetti sul bundle prodotto).
- Verifica a mano da fare in «Aggiungi tante sagre insieme»: righe vere con l'ora incollate dentro,
  l'anteprima, la barra «Applica a tutte» e quel che poi finisce davvero su Google Calendar.
- Verifiche a mano ancora da fare sul dispositivo: abbonamento al cartellone aperto da telefono,
  mappa che centra i paesi veri e filtra al tocco. Da fare ora su
  <https://mich-de.github.io/sagre/>, non più su `npm run dev`: dal 24 agosto 2026 la mappa e
  l'abbonamento sono in linea (`main` → `deploy-web.yml` → GitHub Pages).
