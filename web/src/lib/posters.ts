import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

export interface PosterDoc {
  eventId: string
  dataUrl: string
  updatedAt: unknown
  updatedBy: string
}

const MAX_POSTER_BYTES = 900 * 1024 // stay under Firestore's 1 MiB doc cap

function postersCollectionRef(eventId: string) {
  return doc(db, 'posters', eventId)
}

export async function getPoster(eventId: string): Promise<PosterDoc | null> {
  const snap = await getDoc(postersCollectionRef(eventId))
  return snap.exists() ? (snap.data() as PosterDoc) : null
}

export async function upsertPoster(
  eventId: string,
  dataUrl: string,
  updatedBy: string
): Promise<void> {
  if (dataUrl.length > MAX_POSTER_BYTES) {
    throw new Error('Locandina troppo grande dopo la compressione. Riprova con un\'immagine più piccola.')
  }
  await setDoc(postersCollectionRef(eventId), {
    eventId,
    dataUrl,
    updatedAt: serverTimestamp(),
    updatedBy,
  })
}

export async function deletePoster(eventId: string): Promise<void> {
  await deleteDoc(postersCollectionRef(eventId))
}

/** Resizes/compresses an image file client-side before it's written to Firestore. */
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
