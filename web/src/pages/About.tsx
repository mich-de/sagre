import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarArrowDown,
  CalendarCheck,
  CloudSun,
  Database,
  Images,
  LayoutGrid,
  Link2,
  List,
  ListChecks,
  Map,
  Megaphone,
  Printer,
} from 'lucide-react'
import { CATEGORIES } from '../lib/categorize'
import { subscriptionUrl, webcalUrl } from '../lib/ics'

/** La pagina che spiega il sito: cos'è, come si usa, come far mettere la
 *  propria festa e da dove arrivano i dati.
 *
 *  Non ha bottoni suoi tranne l'abbonamento, che è un collegamento e basta:
 *  stampa e .ics vivono in fondo al cartellone, dove c'è da sapere *cosa* si
 *  sta portando via. Qui si dice che esistono e a cosa servono. */
export function About() {
  const feed = subscriptionUrl()
  const webcal = webcalUrl()

  return (
    <main className="page-x mx-auto max-w-3xl pb-[max(4rem,env(safe-area-inset-bottom))]">
      {/* ------------------------------------------------------ manifesto -- */}
      <section className="relative animate-ink-rise pt-10 pb-8">
        <div className="halftone pointer-events-none absolute -top-2 right-0 h-40 w-40 sm:h-56 sm:w-56" aria-hidden />

        <p className="eyebrow">Le istruzioni · Edizione locale</p>

        <h1 className="mt-3 font-display text-[2.75rem] leading-[0.88] font-black tracking-[-0.03em] text-ink sm:text-[4.25rem]">
          Cos’è questo
          <br />
          <span className="font-normal italic text-vermiglio">cartellone</span>
        </h1>

        <div className="rule-double mt-6" />

        <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft">
          Un foglio appeso al muro, ma che si aggiorna da solo. Ci stanno le sagre, le feste
          patronali, i mercatini e i concerti in piazza dei paesi qui intorno: quando sono, dove
          sono e cosa c’è da mangiare. Niente iscrizione, niente applicazione da installare, niente
          pubblicità.
        </p>

        <Link
          to="/"
          className="stamp-btn tap tap-grow mt-6 inline-flex items-center gap-2 bg-vermiglio px-4 py-2.5 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-paper-hi"
        >
          Vai al cartellone
          <ArrowRight size={14} />
        </Link>
      </section>

      {/* ------------------------------------------------- a cosa serve -- */}
      <Block eyebrow="A cosa serve" title="Sapere cosa si fa stasera">
        <p>
          La domanda vera è quasi sempre una sola: <em>questo fine settimana dove si mangia?</em> Il
          cartellone risponde a quella. In cima trovi cosa c’è oggi, cosa c’è domani e cosa c’è da
          venerdì a domenica, senza toccare un filtro. Sotto c’è tutto il resto.
        </p>
        <p>
          Ogni appuntamento ha un colore, e il colore dice che tipo di festa è. Toccalo e vedi solo
          quelle.
        </p>
        <ul className="mt-1 flex flex-wrap gap-x-2 gap-y-2">
          {CATEGORIES.map((c) => (
            <li
              key={c.key}
              className="flex items-center gap-2 border-2 border-transparent px-2 py-1 text-xs font-medium text-ink-soft"
            >
              <span
                className="h-3 w-3 shrink-0 border border-ink"
                style={{ backgroundColor: c.color }}
                aria-hidden
              />
              {c.label}
            </li>
          ))}
        </ul>
      </Block>

      {/* --------------------------------------------------- come si usa -- */}
      <Block eyebrow="Come si usa" title="Tre modi di guardarlo">
        <p>
          Lo stesso elenco di feste, girato in tre modi. Il bottone per cambiare sta nella barra dei
          filtri, in alto a destra.
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <Card icon={<LayoutGrid size={15} />} title="Griglia">
            Il mese intero come un calendario da parete. Serve a vedere i buchi e i giorni pieni.
          </Card>
          <Card icon={<List size={15} />} title="Elenco">
            Una riga per festa, in ordine di data. Serve a leggere in fretta cosa arriva.
          </Card>
          <Card icon={<Map size={15} />} title="Mappa">
            Un pallino per paese, grande quanto le sue sagre. Serve a decidere quanta strada fare.
          </Card>
        </div>
        <p>
          Sopra ci puoi mettere i filtri: cerca per parola, per paese, per periodo — «questo fine
          settimana», «prossimi sette giorni», o due date scelte a mano.{' '}
          <strong className="font-semibold text-ink">
            I filtri finiscono nell’indirizzo della pagina
          </strong>
          : il collegamento che copi dalla barra del browser riapre esattamente quello che stavi
          guardando, e va bene da mandare a qualcuno.
        </p>
        <p>
          Toccando una festa si apre la sua scheda, e lì di solito c’è più di una data:
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Card icon={<Images size={15} />} title="La locandina">
            Quella vera, fotografata o scaricata dall’organizzatore, con tutte le sue pagine.
          </Card>
          <Card icon={<ListChecks size={15} />} title="Il programma">
            Cosa succede giorno per giorno, col giorno di oggi messo in evidenza.
          </Card>
          <Card icon={<CloudSun size={15} />} title="Che tempo farà">
            Le previsioni sul paese della festa, quando la festa è abbastanza vicina da saperlo.
          </Card>
          <Card icon={<Link2 size={15} />} title="I collegamenti">
            Il sito della pro loco, la pagina dell’evento, il numero per prenotare il tavolo.
          </Card>
        </div>
      </Block>

      {/* -------------------------------------------------- portalo via -- */}
      <Block eyebrow="Portalo via" title="Sul muro o nel telefono">
        <p>
          Il cartellone non serve a niente se resta qui. Tre modi per portarselo dietro, tutti in
          fondo alla pagina del calendario:
        </p>
        <div className="mt-2 space-y-3">
          <Card icon={<Printer size={15} />} title="Stampalo">
            Esce un foglio pulito, senza bottoni né colori di sfondo, fatto per essere appeso alla
            bacheca del bar. Sul foglio finisce quello che stai guardando in quel momento, filtri
            compresi: se hai scelto un paese, stampi il cartellone di quel paese.
          </Card>
          <Card icon={<CalendarArrowDown size={15} />} title="Scaricalo in agenda">
            Un file <code className="font-mono text-[0.8em]">.ics</code>, che aprono iPhone, Outlook
            e Google Calendar. È una fotografia: quello che c’era quando l’hai scaricato, e basta.
          </Card>
          <Card icon={<CalendarCheck size={15} />} title="Abbonati">
            Questo invece è vivo. L’agenda del telefono si ricollega da sola e le sagre aggiunte
            dopo compaiono senza rifare niente. Porta tutto il cartellone, non solo quello che stai
            guardando adesso.
          </Card>
        </div>
        {webcal && (
          <p className="mt-1">
            <a
              href={webcal}
              className="stamp-btn tap tap-grow inline-flex items-center gap-2 bg-senape px-3.5 py-2.5 text-[0.65rem] font-bold tracking-[0.12em] uppercase text-ink"
            >
              <CalendarCheck size={14} />
              Abbonati al cartellone
            </a>
          </p>
        )}
        {feed && (
          <p className="text-[0.7rem] text-ink-faint">
            Se il bottone non fa niente — capita su qualche computer — l’indirizzo da incollare a
            mano nel tuo calendario è questo:
            <br />
            <span className="mt-1 inline-block font-mono break-all text-ink-soft">{feed}</span>
          </p>
        )}
      </Block>

      {/* ------------------------------------------- la tua sagra qui -- */}
      <Block eyebrow="Per chi organizza" title="Far mettere la propria festa">
        <p>
          Il cartellone non si riempie da solo: lo scrive una persona, a mano, dall’ufficio
          manifesti. Vuol dire che la tua sagra ci finisce se qualcuno gliela dice — e che più roba
          gli arrivi insieme, meno rimpalli di messaggi ci vogliono.
        </p>
        <p>Quello che serve, tutto in un colpo:</p>
        <ul className="mt-1 space-y-2">
          <Need label="Le date">
            Il primo e l’ultimo giorno di festa. Se apre a un’ora precisa dillo, altrimenti finisce
            come «tutto il giorno».
          </Need>
          <Need label="Il luogo">
            Piazza e paese, scritti per esteso. Il paese è quello che poi accende il pallino sulla
            mappa e riempie il filtro «tutti i paesi»: scritto male, la festa non si trova.
          </Need>
          <Need label="La locandina">
            Come ce l’hai — foto o file. Se ha più pagine mandale tutte: sulla scheda si sfogliano.
          </Need>
          <Need label="Il programma, se c’è">
            Cosa succede ogni sera. È la cosa che la gente guarda per decidere <em>quale</em> sera
            venire.
          </Need>
          <Need label="Dove informarsi">
            Sito, pagina dell’evento, numero per prenotare. Finiscono in fondo alla scheda.
          </Need>
        </ul>
        <p className="flex items-start gap-2 border-2 border-ink bg-senape/20 p-3 text-[0.8rem] leading-relaxed font-semibold text-ink">
          <Megaphone size={15} className="mt-0.5 shrink-0" />
          Una festa che si ripete ogni anno va detta una volta sola: dall’ufficio manifesti si
          rifà con un tocco, date spostate e locandina compresa.
        </p>
      </Block>

      {/* --------------------------------------------------- da dove -- */}
      <Block eyebrow="Da dove arrivano i dati" title="Nessun segreto, nessun archivio nostro">
        <p className="flex items-start gap-2">
          <Database size={15} className="mt-1 shrink-0 text-ink-faint" />
          <span>
            Le date, i luoghi e i titoli stanno su un{' '}
            <strong className="font-semibold text-ink">calendario Google condiviso</strong>: il sito
            lo legge, non ne tiene una copia. Le locandine, le note e i programmi stanno su
            Firestore, uno per festa. Il meteo lo chiede a{' '}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-ink underline decoration-vermiglio decoration-2 underline-offset-2"
            >
              Open-Meteo
            </a>
            , che risponde senza chiedere chi sei. Le mattonelle della mappa sono di{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-ink underline decoration-vermiglio decoration-2 underline-offset-2"
            >
              OpenStreetMap
            </a>
            , disegnata da volontari e libera da usare.
          </span>
        </p>
        <p>
          Di te il sito non sa niente: nessun conto da aprire, nessuna traccia, nessuna pubblicità.
          L’unica cosa che resta sul tuo telefono sono le coordinate dei paesi già cercati, per non
          richiederle ogni volta.
        </p>
      </Block>

      <footer className="mt-12 border-t-2 border-ink pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p className="eyebrow">Stampato in proprio · Affisso al muro dal 2026</p>
          <Link
            to="/"
            className="group flex items-center gap-1.5 text-[0.65rem] font-bold tracking-[0.12em] uppercase text-ink-soft transition-colors hover:text-vermiglio"
          >
            Torna al cartellone
            <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </footer>
    </main>
  )
}

/* ------------------------------------------------------------- pezzi -- */

/** Un capitolo della pagina: occhiello, titolo, filetto e testo. Il testo va
 *  in `space-y-3`, così i paragrafi si distanziano da soli e chi scrive qui
 *  sotto non deve ricordarsi un margine ogni volta. */
function Block({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-10 animate-ink-rise">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-1 font-display text-2xl leading-tight font-black text-ink sm:text-3xl">
        {title}
      </h2>
      <div className="mt-2 border-t-2 border-ink/25 pt-4 space-y-3 text-sm leading-relaxed text-ink-soft">
        {children}
      </div>
    </section>
  )
}

/** Riquadro con l'icona: una cosa che il sito sa fare, detta in due righe. */
function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="ink-box-sm min-w-0 p-3">
      <p className="flex items-center gap-2 font-display text-base leading-none font-black text-ink">
        <span className="text-vermiglio">{icon}</span>
        {title}
      </p>
      <p className="mt-2 text-[0.8rem] leading-relaxed text-ink-soft">{children}</p>
    </div>
  )
}

/** Una voce dell'elenco delle cose da mandare, col nome in evidenza. */
function Need({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="border-l-2 border-vermiglio pl-3">
      <strong className="font-display text-[0.95rem] font-black text-ink">{label}</strong>
      <span className="mt-0.5 block text-[0.8rem] leading-relaxed">{children}</span>
    </li>
  )
}
