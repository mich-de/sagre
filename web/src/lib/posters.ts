import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type { EventLink } from './links'

/* ---------------------------------------------------------------------------
 * Un evento ha: una locandina di copertina, altre foto e qualche collegamento
 * (social, articolo di giornale, sito della pro loco).
 *
 * Le immagini viaggiano come data URL dentro Firestore, che ha un tetto di
 * 1 MiB per documento: la copertina sta nel documento dell'evento, le altre
 * foto vanno una per documento nella sottocollezione `photos`. Così si possono
 * caricare più immagini senza sfondare il limite e senza scomodare Cloud
 * Storage (che richiederebbe il piano a pagamento).
 * ------------------------------------------------------------------------- */

export interface PosterDoc {
  eventId: string
  dataUrl?: string
  links?: EventLink[]
  updatedAt: unknown
  updatedBy: string
}

export interface EventPhoto {
  id: string
  dataUrl: string
  order: number
}

export interface EventMedia {
  cover: string | null
  photos: EventPhoto[]
  links: EventLink[]
}

const MAX_IMAGE_BYTES = 900 * 1024 // sotto il tetto di 1 MiB per documento
export const MAX_PHOTOS = 12
export const MAX_LINKS = 8

const posterRef = (eventId: string) => doc(db, 'posters', eventId)
const photosRef = (eventId: string) => collection(db, 'posters', eventId, 'photos')

function assertImageSize(dataUrl: string) {
  if (dataUrl.length > MAX_IMAGE_BYTES) {
    throw new Error("Immagine troppo grande dopo la compressione. Riprova con un'immagine più piccola.")
  }
}

export async function getPoster(eventId: string): Promise<PosterDoc | null> {
  const snap = await getDoc(posterRef(eventId))
  return snap.exists() ? (snap.data() as PosterDoc) : null
}

export async function listPhotos(eventId: string): Promise<EventPhoto[]> {
  const snap = await getDocs(query(photosRef(eventId), orderBy('order')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EventPhoto, 'id'>) }))
}

/** Copertina, foto e collegamenti in una lettura sola. */
export async function getEventMedia(eventId: string): Promise<EventMedia> {
  const [poster, photos] = await Promise.all([getPoster(eventId), listPhotos(eventId)])
  return {
    cover: poster?.dataUrl ?? null,
    photos,
    links: poster?.links ?? [],
  }
}

/** Scrive il documento dell'evento: copertina e collegamenti insieme, perché
 *  `setDoc` sostituisce l'intero documento. */
export async function savePoster(
  eventId: string,
  data: { dataUrl?: string | null; links?: EventLink[] },
  updatedBy: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    eventId,
    updatedAt: serverTimestamp(),
    updatedBy,
  }
  if (data.dataUrl) {
    assertImageSize(data.dataUrl)
    payload.dataUrl = data.dataUrl
  }
  if (data.links?.length) {
    payload.links = data.links.slice(0, MAX_LINKS)
  }
  await setDoc(posterRef(eventId), payload)
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

/** Toglie tutto: copertina, collegamenti e ogni foto della sottocollezione. */
export async function deleteAllMedia(eventId: string): Promise<void> {
  const photos = await listPhotos(eventId)
  await Promise.all(photos.map((p) => deletePhoto(eventId, p.id)))
  await deleteDoc(posterRef(eventId))
}

/** Ridimensiona e comprime l'immagine nel browser prima di scriverla. */
export async function resizeImageToDataUrl(file: File, maxDimension = 1200, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D non disponibile in questo browser.')
  ctx.drawImage(bitmap, 0, 0, width, height)

  return canvas.toDataURL('image/jpeg', quality)
}
