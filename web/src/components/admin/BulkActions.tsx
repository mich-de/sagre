import { useState } from 'react'
import { AlertTriangle, Ban, CheckCircle2, Star, Trash2, X } from 'lucide-react'
import { bulkDeletePhotos, bulkSaveExtras, type BulkReport, type ExtrasPatch } from '../../lib/posters'

interface BulkActionsProps {
  ids: string[]
  userEmail: string
  /** Ricaricare la collezione dopo: le schede toccate sono tante e la copia
   *  locale non saprebbe da sola cosa è andato a buon fine. */
  onDone: () => void
  onClear: () => void
}

type Pending = 'svuota' | null

/** Barra delle azioni in blocco. Con settanta eventi e cinquanta da fare,
 *  aprirli uno alla volta per mettere la stessa spunta è mezz'ora buttata.
 *  Sul telefono resta incollata in fondo allo schermo, dove arriva il pollice. */
export function BulkActions({ ids, userEmail, onDone, onClear }: BulkActionsProps) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [report, setReport] = useState<BulkReport | null>(null)
  const [pending, setPending] = useState<Pending>(null)

  async function run(action: () => Promise<BulkReport>) {
    setBusy(true)
    setReport(null)
    setPending(null)
    try {
      setReport(await action())
    } catch {
      setReport({ fatti: 0, errori: ids.length })
    } finally {
      setBusy(false)
      setProgress({ done: 0, total: 0 })
      onDone()
    }
  }

  const patch = (changes: ExtrasPatch) =>
    run(() => bulkSaveExtras(ids, changes, userEmail, (done, total) => setProgress({ done, total })))

  return (
    <div className="safe-b fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-senape/95 p-3 shadow-[0_-3px_0_var(--color-ink)] backdrop-blur-sm sm:static sm:mb-4 sm:border-2 sm:p-3 sm:shadow-[3px_3px_0_var(--color-ink)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
        <p className="flex-1 basis-full text-xs font-bold tracking-wide uppercase text-ink sm:basis-auto">
          {busy
            ? `In corso ${progress.done}/${progress.total || ids.length}…`
            : `${ids.length} ${ids.length === 1 ? 'evento scelto' : 'eventi scelti'}`}
        </p>

        {pending === 'svuota' ? (
          <>
            <p className="flex flex-1 basis-full items-center gap-1.5 text-xs font-semibold text-ink sm:basis-auto">
              <AlertTriangle size={14} className="shrink-0 text-vermiglio" />
              Le locandine di {ids.length} {ids.length === 1 ? 'evento' : 'eventi'} verranno cancellate. Non
              si torna indietro.
            </p>
            <BulkBtn onClick={() => void run(() => bulkDeletePhotos(ids, userEmail, (done, total) => setProgress({ done, total })))} busy={busy} danger>
              <Trash2 size={13} />
              Sì, svuota
            </BulkBtn>
            <BulkBtn onClick={() => setPending(null)} busy={busy}>
              Annulla
            </BulkBtn>
          </>
        ) : (
          <>
            <BulkBtn onClick={() => void patch({ featured: true })} busy={busy}>
              <Star size={13} />
              In evidenza
            </BulkBtn>
            <BulkBtn onClick={() => void patch({ featured: false })} busy={busy}>
              <Star size={13} />
              Togli
            </BulkBtn>
            <BulkBtn onClick={() => void patch({ status: 'annullato' })} busy={busy}>
              <Ban size={13} />
              Annulla festa
            </BulkBtn>
            <BulkBtn onClick={() => void patch({ status: 'confermato' })} busy={busy}>
              <CheckCircle2 size={13} />
              Conferma
            </BulkBtn>
            <BulkBtn onClick={() => setPending('svuota')} busy={busy} danger>
              <Trash2 size={13} />
              Svuota locandine
            </BulkBtn>
            <button
              onClick={onClear}
              disabled={busy}
              className="tap tap-grow ml-auto flex items-center gap-1 px-2 text-[0.6rem] font-bold tracking-[0.12em] uppercase text-ink hover:underline"
            >
              <X size={12} />
              Deseleziona
            </button>
          </>
        )}

        {report && (
          <p className="basis-full text-[0.65rem] font-semibold text-ink">
            Fatti {report.fatti}
            {report.errori > 0 ? `, ${report.errori} non riusciti` : ''}.
          </p>
        )}
      </div>
    </div>
  )
}

function BulkBtn({
  onClick,
  busy,
  danger,
  children,
}: {
  onClick: () => void
  busy: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`stamp-btn tap tap-grow flex items-center gap-1.5 px-2.5 py-2 text-[0.62rem] font-bold tracking-[0.1em] uppercase disabled:opacity-50 sm:py-1.5 ${
        danger ? 'bg-vermiglio text-paper-hi' : 'bg-paper-hi text-ink'
      }`}
    >
      {children}
    </button>
  )
}
