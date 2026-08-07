import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import type { EventLink } from './links'

/* ---------------------------------------------------------------------------
 * Google Calendar sa solo titolo, data e luogo. Tutto il resto — locandine,
 * foto, collegamenti, note dell'organizzatore, categoria forzata, stato della
 * festa — vive qui, in `posters/{eventId}`.
 *
 * Le immagini sono data URL dentro Firestore, che ha un tetto di 1 MiB per
 * documento. Perciò il documento dell'evento resta leggero (solo `thumb`, la
 * miniatura da elenco) e le foto a piena risoluzione stanno una per documento
 * nella sottocollezione `photos`: la prima, `order` più basso, è la copertina.
 * Così la home può leggere in un colpo solo i dati di *tutti* gli eventi senza
 * scaricare megabyte di locandine.
 * ------------------------------------------------------------------------- */

export type EventStatus = 'confermato' | 'annullato' | 'rinviato'

export interface PosterDoc {
  eventId: string
  thumb?: string
  /** Vecchio schema: copertina a piena risoluzione nel documento padre. */
  dataUrl?: string
  links?: EventLink[]
  note?: string
  category?: string
  featured?: boolean
  status?: EventStatus
  updatedAt: unknown
  updatedBy: string
}

export interface EventPhoto {
  id: string
  dataUrl: string
  order: number
}

/** Quel che serve agli elenchi: leggero, si legge per tutti gli eventi. */
export interface EventExtras {
  eventId: string
  thumb: string | null
  links: EventLink[]
  note: string
  category: string | null
  featured: boolean
  status: EventStatus
  /** Copertina ancora nel vecchio schema, in attesa di migrazione. */
  hasLegacyCover: boolean
}

/** Quel che serve alla scheda del singolo evento: pesante. */
export interface EventMedia extends EventExtras {
  cover: string | null
  photos: EventPhoto[]
}

export const MAX_PHOTOS = 12
export const MAX_LINKS = 8
export const MAX_NOTE = 2000
const MAX_IMAGE_BYTES = 900 * 1024
const MAX_THUMB_BYTES = 190 * 1024

export const EMPTY_EXTRAS: EventExtras = {
  eventId: '',
  thumb: null,
  links: [],
  note: '',
  category: null,
  featured: false,
  status: 'confermato',
  hasLegacyCover: false,
}

const posterRef = (eventId: string) => doc(db, 'posters', eventId)
const photosRef = (eventId: string) => collection(db, 'posters', eventId, 'photos')

function toExtras(eventId: string, data: PosterDoc | null): EventExtras {
  return {
    eventId,
    thumb: data?.thumb ?? null,
    links: data?.links ?? [],
    note: data?.note ?? '',
    category: data?.category ?? null,
    featured: data?.featured ?? false,
    status: data?.status ?? 'confermato',
    hasLegacyCover: Boolean(data?.dataUrl),
  }
}

function assertImageSize(dataUrl: string) {
  if (dataUrl.length > MAX_IMAGE_BYTES) {
    throw new Error("Immagine troppo grande dopo la compressione. Riprova con un'immagine più piccola.")
  }
}

/* --------------------------------------------------------------- lettura -- */

export async function getPoster(eventId: string): Promise<PosterDoc | null> {
  const snap = await getDoc(posterRef(eventId))
  return snap.exists() ? (snap.data() as PosterDoc) : null
}

export async function listPhotos(eventId: string): Promise<EventPhoto[]> {
  const snap = await getDocs(query(photosRef(eventId), orderBy('order')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EventPhoto, 'id'>) }))
}

/** Una lettura sola per l'intera collezione: la usano home, calendario ed
 *  elenco per sapere chi ha la locandina, chi è in evidenza, chi è annullato. */
export async function listExtras(): Promise<Record<string, EventExtras>> {
  const snap = await getDocs(collection(db, 'posters'))
  const out: Record<string, EventExtras> = {}
  for (const d of snap.docs) out[d.id] = toExtras(d.id, d.data() as PosterDoc)
  return out
}

export async function getEventMedia(eventId: string): Promise<EventMedia> {
  const [poster, photos] = await Promise.all([getPoster(eventId), listPhotos(eventId)])
  return {
    ...toExtras(eventId, poster),
    /* `dataUrl` è il vecchio schema: resta leggibile finché l'evento non passa
       dall'ufficio manifesti, dove viene migrato nella sottocollezione. */
    cover: photos[0]?.dataUrl ?? poster?.dataUrl ?? null,
    photos,
  }
}

/* -------------------------------------------------------------- scrittura -- */

export interface ExtrasPatch {
  thumb?: string | null
  dataUrl?: null
  links?: EventLink[]
  note?: string
  category?: string | null
  featured?: boolean
  status?: EventStatus
}

/** Scrittura parziale: `null` cancella il campo, i campi assenti restano. */
export async function saveExtras(eventId: string, patch: ExtrasPatch, updatedBy: string): Promise<void> {
  const payload: Record<string, unknown> = {
    eventId,
    updatedAt: serverTimestamp(),
    updatedBy,
  }
  const put = (key: string, value: unknown) => {
    payload[key] = value === null || value === '' ? deleteField() : value
  }
  if (patch.thumb !== undefined) put('thumb', patch.thumb)
  if (patch.dataUrl !== undefined) put('dataUrl', patch.dataUrl)
  if (patch.note !== undefined) put('note', patch.note.slice(0, MAX_NOTE))
  if (patch.category !== undefined) put('category', patch.category)
  if (patch.status !== undefined) put('status', patch.status === 'confermato' ? null : patch.status)
  if (patch.featured !== undefined) put('featured', patch.featured ? true : null)
  if (patch.links !== undefined) {
    payload.links = patch.links.length ? patch.links.slice(0, MAX_LINKS) : deleteField()
  }
  await setDoc(posterRef(eventId), payload, { merge: true })
}

export async function addPhoto(
  eventId: string,
  dataUrl: string,
  order: number,
  updatedBy: string
): Promise<EventPhoto> {
  assertImageSize(dataUrl)
  const ref = doc(photosRef(eventId))
  await setDoc(ref, { dataUrl, order, updatedAt: serverTimestamp(), updatedBy })
  return { id: ref.id, dataUrl, order }
}

export async function deletePhoto(eventId: string, photoId: string): Promise<void> {
  await deleteDoc(doc(photosRef(eventId), photoId))
}

/** Riscrive solo il campo `order`: rimandare su e giù un data URL da mezzo
 *  megabyte per cambiare posizione sarebbe uno spreco. */
export async function reorderPhotos(
  eventId: string,
  photos: EventPhoto[],
  updatedBy: string
): Promise<EventPhoto[]> {
  const next = photos.map((p, i) => ({ ...p, order: i }))
  await Promise.all(
    next
      .filter((p, i) => photos[i].order !== p.order)
      .map((p) => updateDoc(doc(photosRef(eventId), p.id), { order: p.order, updatedAt: serverTimestamp(), updatedBy }))
  )
  return next
}

/** Toglie foto e collegamenti; le note, la categoria e lo stato restano. */
export async function deleteAllPhotos(eventId: string, updatedBy: string): Promise<void> {
  const photos = await listPhotos(eventId)
  await Promise.all(photos.map((p) => deletePhoto(eventId, p.id)))
  await saveExtras(eventId, { thumb: null, dataUrl: null }, updatedBy)
}

export async function deleteEverything(eventId: string): Promise<void> {
  const photos = await listPhotos(eventId)
  await Promise.all(photos.map((p) => deletePhoto(eventId, p.id)))
  await deleteDoc(posterRef(eventId))
}

/** Porta una copertina del vecchio schema nella sottocollezione e genera la
 *  miniatura. Gira una volta sola, quando l'organizzatore apre l'evento. */
export async function migrateLegacyCover(
  eventId: string,
  media: EventMedia,
  legacy: string,
  updatedBy: string
): Promise<EventMedia> {
  const moved = await addPhoto(eventId, legacy, -1, updatedBy)
  const photos = await reorderPhotos(eventId, [moved, ...media.photos], updatedBy)
  await saveExtras(eventId, { dataUrl: null, thumb: await makeThumb(legacy) }, updatedBy)
  return { ...media, cover: legacy, photos }
}

export interface RepairReport {
  migrate: number
  thumbs: number
  errori: number
}

/** Passa in rassegna tutte le locandine e rimette in riga quelle rimaste
 *  indietro: copertine del vecchio schema da spostare nella sottocollezione e
 *  foto senza miniatura. Senza, l'evento resta invisibile agli elenchi — che
 *  guardano `thumb` — finché qualcuno non lo apre a mano. */
export async function repairAllPosters(
  updatedBy: string,
  onProgress?: (done: number, total: number) => void
): Promise<RepairReport> {
  const snap = await getDocs(collection(db, 'posters'))
  const targets = snap.docs.filter((d) => {
    const data = d.data() as PosterDoc
    return Boolean(data.dataUrl) || !data.thumb
  })

  const report: RepairReport = { migrate: 0, thumbs: 0, errori: 0 }
  let done = 0

  for (const d of targets) {
    const legacy = (d.data() as PosterDoc).dataUrl
    try {
      if (legacy) {
        const media = await getEventMedia(d.id)
        await migrateLegacyCover(d.id, media, legacy, updatedBy)
        report.migrate += 1
      } else {
        const photos = await listPhotos(d.id)
        if (photos.length > 0) {
          await saveExtras(d.id, { thumb: await makeThumb(photos[0].dataUrl) }, updatedBy)
          report.thumbs += 1
        }
      }
    } catch {
      report.errori += 1
    }
    onProgress?.((done += 1), targets.length)
  }

  return report
}

/* --------------------------------------------------------------- immagini -- */

async function drawToDataUrl(source: ImageBitmapSource, maxDimension: number, quality: number): Promise<string> {
  const bitmap = await createImageBitmap(source as ImageBitmapSource)
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D non disponibile in questo browser.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return canvas.toDataURL('image/jpeg', quality)
}

/** Ridimensiona e comprime l'immagine nel browser prima di scriverla. */
export function resizeImageToDataUrl(file: File, maxDimension = 1200, quality = 0.8): Promise<string> {
  return drawToDataUrl(file, maxDimension, quality)
}

/** Miniatura da elenco: piccola abbastanza da poterne scaricare cinquanta. */
export async function makeThumb(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob()
  const thumb = await drawToDataUrl(blob, 320, 0.62)
  return thumb.length > MAX_THUMB_BYTES ? await drawToDataUrl(blob, 200, 0.5) : thumb
}
