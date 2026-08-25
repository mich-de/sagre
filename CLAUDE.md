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
- **Il router è un `HashRouter`, e la query sta *dentro* il cancelletto.** `useHomeFilters` legge da
  `useSearchParams`, che sotto `HashRouter` guarda `#/?…`. Ogni indirizzo costruito a mano va scritto
  `${BASE_URL}#/?e=…`: la query messa prima del `#` non arriva a nessuno, in silenzio.
- **Nel campo luogo la parentesi è una virgola, e la sigla non è un paese.** «Gragnano (NA)» non lo
  trova nessun geocoder, e «Sorrento, NA, Italia» si riduce al paese «NA», che senza filtro di
  nazione è **Ban Na in Thailandia**: un pallino a novemila chilometri e, di conseguenza, nessuna
  previsione. `placeSegments` tratta `()` da virgola, butta nazione e sigle di provincia, e
  restituisce i pezzi **dal più promettente al meno** — il primo è il paese, gli altri servono a chi
  può riprovare (le previsioni). Sulla richiesta va sempre `countryCode=IT`: fuori dall'Italia non
  c'è niente in cartellone, e un «non lo so» si vede subito, un pallino in Thailandia no.
- **Le coordinate stanno in `localStorage` per sempre, quindi la chiave ha una versione.**
  `sagre.geo.v2.`, e `geocode` alla prima domanda spazza via il prefisso vecchio. Correggere il
  codice non basta: chi ha già aperto il cartellone si ricorda l'errore e non richiede più niente.
  Se cambia il modo di ricavare il paese, **cambia anche la versione**.
- **Il meteo lo chiede chi costruisce la riga, non la riga.** `EventCard` ha una fessura
  `weather?: ReactNode`; nei pannelli Oggi e Domani ci si infila `DayWeatherTag`. Agganciarlo dentro
  la riga vorrebbe dire una domanda a Open-Meteo per ognuna delle cento sagre della griglia.
  Le icone del cielo stanno in **una** tabella (`components/SkyIcon.tsx`), non una per posto che
  mostra il tempo.
- **Nel bollettino di adesso una casella è una scheda, e la scheda dice quali paesi copre.**
  Prima i doppioni si **scartavano**, e Vico Equense stava fuori da `NOW_SPOTS` di proposito: due
  schede coi numeri identici si leggono come un guasto. Sbagliato — così Meta, Piano di Sorrento e
  Sant'Agnello non comparivano affatto, e chi ci abita non trovava il suo paese, che è il difetto
  peggiore dei due. Ora `NOW_SPOTS` ha i quattordici comuni della penisola e della costiera, e
  `groupByCell` mette gli altri nomi della stessa maglia in `NowWeather.also`, che la scheda scrive
  sotto il titolo: la misura resta **una**, ma si sa per chi vale. Niente numeri finti per far
  quadrare i nomi, nessun nome sparito per far quadrare i numeri.
  **L'ordine di `NOW_SPOTS` conta**: dentro una casella vince il primo, quindi il nome più conosciuto
  va prima — Sorrento apre l'elenco invece di stare al suo posto geografico proprio per questo.
- **Il modello del bollettino di adesso è `dmi_seamless`, non il predefinito**, e la scelta è
  misurata (25 agosto 2026, ventidue paesi, confrontando **i numeri** e non le coordinate):
  `best_match` dà 10 caselle su 22 e mette insieme Gragnano e Positano, che stanno ai due lati della
  montagna; `dmi_seamless` dà 12 letture su 12 distinte con tutti i campi. **`meteofrance_seamless`
  è una trappola da non riprovare**: restituisce 20 coordinate su 20 tutte diverse — sono quelle
  *chieste*, non quelle agganciate — e dietro ha nove letture su dodici, quindi il controllo dei
  doppioni smette di funzionare senza dirlo. `nowAround` prova il modello fine e poi **ripiega senza
  modello**: legare la sezione a un fornitore nazionale solo vorrebbe dire farla svanire il giorno
  che è fuori servizio, e un bollettino grossolano batte un buco. Vale solo per l'adesso: `forecast`
  resta sul predefinito, perché ai sette giorni i modelli ad area limitata non arrivano.
  Le quattordici coordinate stanno in **una** richiesta: l'endpoint le accetta in fila e risponde
  con un elenco nello stesso ordine.
- **Il nome del sito si scrive in un posto solo**, `lib/site.ts`: era a mano in cinque (testata,
  testata di stampa, titolo della home, firma dei file .ics, `index.html`) e cambiarlo voleva dire
  trovarli tutti. `SITE_WHERE_SHORT`/`_REST` esistono perché sul telefono «e dintorni» non ci sta e
  tre puntini non dicono niente. L'**unica** copia scritta a mano che resta è `index.html`, dove non
  si può importare niente da `src/`: c'è un commento che lo dice, e se cambia il nome cambia
  anche lì. Nella firma .ics le barre sono separatori del formato: un nome che ne guadagnasse una
  va ripulito in `ics.ts` (la «&» invece non dà problemi).
- **La logica non sta nei componenti.** Filtri, date, categorie, luoghi, ICS, meteo e locandine
  vivono in `lib/`, così barra dei filtri, home e stampa condividono lo stesso comportamento.
- **I tre pannelli del giorno mostrano tre righe e dicono quante ne restano.** `PANEL_MAX = 3` in
  `Home.tsx`: senza tetto la griglia si allunga sul più alto dei tre — un fine settimana di
  ferragosto ne ha quindici e Oggi ne ha una — e la colonna di Oggi diventa un riquadro vuoto alto
  mezzo schermo. Da qui tre conseguenze che vanno insieme: il piede annuncia **«altri quattro»**
  (un elenco tagliato in silenzio è una bugia), le liste dei pannelli sono **ordinate** e non solo
  filtrate (con il tetto, *quali* tre è una decisione), e il riquadro è `flex flex-col` con il piede
  su `mt-auto`, così i tre piedi si allineano in basso. Il «vedi tutto» ce l'hanno tutti e tre:
  Oggi e Domani non hanno bisogno di una finestra nuova nei filtri, `intervallo` con `da` e `a`
  uguali è già «solo quel giorno» e per sovrapposizione si porta dietro le sagre lunghe cominciate
  prima.
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
| `places.ts` | il paese ricavato dal testo libero del campo luogo | `placeSegments`, `placeOf`, `normalizePlace`, `groupByPlace`, `collectPlaces`, `inPlace` |
| `categorize.ts` | sette categorie con colore, indovinate dal titolo | `categorize`, `CATEGORIES` |
| `googleCalendar.ts` | lettura del calendario condiviso | `CalendarEvent`, `toEvent` |
| `calendarWrite.ts` | scrittura sul calendario | `createEvent`, `updateEvent`, `deleteEvent`, `createMany`, `validateDraft`, `emptyDraft`, `EventDraft` |
| `posters.ts` | schede su Firestore: locandine, collegamenti, nota, programma | `listExtras`, `saveExtras`, `copyExtras`, `runBulk`, `hasPoster`, `posterRef`, `EventExtras`, `EventMedia` |
| `programma.ts` | il programma legato ai giorni veri della festa | `programmaRows`, `orphanRows`, `cleanProgramma`, `dayLabel`, `todayRow` |
| `nextYear.ts` | la stessa sagra l'anno prossimo | `nextYearShift` (modi `'data'` e `'giorno'`), `shiftDraft` |
| `parseSagre.ts` | righe incollate a mano → bozze di evento, date **e orari** | `parseSagreLines`, `parseSagraLine`, `findDates`, `findTime`, `spanDays` |
| `ics.ts` | file .ics (RFC 5545) e abbonamento al calendario | `buildIcs`, `downloadIcs`, `icsFileName`, `eventPageUrl`, `subscriptionUrl`, `webcalUrl` |
| `weather.ts` | previsioni Open-Meteo, senza chiave | `geocode` (**cache coordinate in `localStorage`, condivisa con la mappa**), `forecast`, `nowAround`, `NOW_SPOTS`, `windFrom`, `GUSTY_KMH`, `skyOf`, `isWet`, `forecastableDays` |
| `links.ts` | i collegamenti dell'organizzatore | riconoscimento e normalizzazione |
| `site.ts` | il nome del sito, in un posto solo | `SITE_NAME`, `SITE_WHERE`, `SITE_WHERE_SHORT`, `SITE_WHERE_REST`, `SITE_TITLE` |
| `firebase.ts`, `googleAuth.ts` | accesso e credenziali | — |

Il resto del sito non ricalcola mai a mano né date né paesi: passa da `dates.ts` e `places.ts`.

## Componenti

**Pubblici** — `pages/About.tsx` (`#/cosa-e`: cos'è il sito, come si usa, come far mettere la
propria festa, da dove arrivano i dati — nessuna logica, riusa `CATEGORIES` e `webcalUrl`),
`pages/Home.tsx` (cartellone, tre pannelli Oggi/Domani/Fine settimana, legenda
cliccabile, «Portalo via»), `CalendarView` (FullCalendar), `AgendaList`, `EventCard`, `EventModal`,
`FilterBar` (tre viste: griglia, elenco, mappa), `PlacesMap` (Leaflet, caricato con `React.lazy`),
`MonthRail`, `NoResults`, `PrintMasthead`, `WeatherStrip`, `NowBoard`, `SkyIcon`, `DayWeatherTag`,
`DateRange`, `BackToTop`, `Header`.

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

- **Dominio personalizzato: rimandato**, non scartato (25 agosto 2026). Si resta su
  <https://mich-de.github.io/sagre/>. Il giorno che si compra un dominio servono tre cose e basta:
  `web/public/CNAME` con dentro il dominio (il deploy passa da Actions, il file deve stare
  nell'artefatto), i record DNS dal registrar, e `base: '/'` in `vite.config.ts` al posto di
  `'/sagre/'` — il resto si aggiusta da solo, perché gli indirizzi passano tutti da `BASE_URL`.
- **Undici luoghi da correggere a mano sul calendario**, non nel codice: il campo non contiene il
  comune, e senza comune non c'è né pallino né meteo. Misurato il 25 agosto 2026 su 63 luoghi
  distinti — gli altri 52 cadono tutti entro 16 km dalla penisola (Ischia 44, ed è giusto).
  Il caso peggiore è `Cappella di San Sebastiano a Canale (Pastena)`: **Pastena è anche un comune in
  provincia di Frosinone**, e il pallino finisce a 123 km. Basta aggiungere il comune in coda, come
  già fa `Cappella di Canale, Pastena, Massa Lubrense` che infatti è giusto. Gli altri dieci
  (`Penisola Sorrentina`, `Costiera Amalfitana` da «Gete, Tramonti (SA), Costiera Amalfitana`,
  `Marina della Lobra`, `Borgo di Schiazzano`, `Fontana del Cerriglio`, `Spiaggia di Meta`,
  `Spiaggia Grande di Positano`, `Piazza S. Agata sui Due Golfi`,
  `Monastero del SS. Rosario di Monticchio`, `Terrazza della Chiesa di Marciano`) oggi non danno un
  posto sbagliato, danno **niente**, che è meno grave ma è comunque una sagra fuori dalla mappa.
  Una tabella frazione→comune nel codice è la strada sbagliata: si scrive una volta e poi invecchia.
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
