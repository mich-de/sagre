/* ---------------------------------------------------------------------------
 * Permesso di scrivere sul calendario.
 *
 * La chiave API basta per leggere un calendario pubblico, ma non scrive nulla:
 * creare o spostare un evento richiede che sia una PERSONA a dare il permesso.
 * Qui si usa Google Identity Services in modalità "token": una finestrella di
 * consenso, un gettone che vive un'ora, e nessun server da tenere acceso.
 *
 * Il gettone sta solo in memoria. Chiuso il browser sparisce; al ritorno si
 * richiede in silenzio, senza far rivedere la schermata di consenso a chi il
 * permesso l'ha già dato una volta.
 * ------------------------------------------------------------------------- */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined

/** Solo gli eventi: non serve leggere la lista dei calendari, né altro. */
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const GIS_SRC = 'https://accounts.google.com/gsi/client'

/** Ricordo che il permesso è già stato dato — non è un segreto, serve solo a
 *  sapere se si può chiedere il gettone senza disturbare. */
const FLAG = 'sagre.google'

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (response: TokenResponse) => void
            error_callback?: (error: { type?: string; message?: string }) => void
          }): TokenClient
          revoke(token: string, done?: () => void): void
        }
      }
    }
  }
}

/** L'ufficio mostra i comandi di scrittura solo se c'è un ID client: senza,
 *  ogni bottone finirebbe in un errore che l'utente non può risolvere. */
export const calendarWriteEnabled = Boolean(CLIENT_ID)

let token: { value: string; expiresAt: number } | null = null
let client: TokenClient | null = null
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null
let inFlight: Promise<string> | null = null
let script: Promise<void> | null = null

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Il permesso è già stato dato in passato (anche in una sessione precedente). */
export function isLinked(): boolean {
  return calendarWriteEnabled && localStorage.getItem(FLAG) === '1'
}

function loadScript(): Promise<void> {
  if (script) return script
  script = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const tag = document.createElement('script')
    tag.src = GIS_SRC
    tag.async = true
    tag.defer = true
    tag.onload = () => resolve()
    tag.onerror = () => reject(new Error('Non riesco a caricare il collegamento a Google. Sei online?'))
    document.head.appendChild(tag)
  }).catch((err) => {
    script = null
    throw err
  })
  return script
}

async function getClient(): Promise<TokenClient> {
  await loadScript()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new Error('Collegamento a Google non disponibile.')
  if (!client) {
    client = oauth2.initTokenClient({
      client_id: CLIENT_ID as string,
      scope: SCOPE,
      callback: (res) => {
        if (res.access_token) {
          token = { value: res.access_token, expiresAt: Date.now() + (res.expires_in ?? 3600) * 1000 }
          pending?.resolve(res.access_token)
        } else {
          pending?.reject(new Error(res.error_description ?? res.error ?? 'Permesso negato.'))
        }
        pending = null
        notify()
      },
      /* Finestra chiusa a mano o bloccata dal browser: senza questo il
         `requestAccessToken` non risponde più e l'attesa resta appesa. */
      error_callback: (err) => {
        pending?.reject(
          new Error(
            err.type === 'popup_failed_to_open'
              ? 'Il browser ha bloccato la finestra di Google. Consenti le finestre pop-up per questo sito.'
              : 'Collegamento annullato.'
          )
        )
        pending = null
      },
    })
  }
  return client
}

function requestToken(interactive: boolean): Promise<string> {
  if (!CLIENT_ID) {
    return Promise.reject(
      new Error('Scrittura sul calendario non configurata: manca VITE_GOOGLE_OAUTH_CLIENT_ID.')
    )
  }
  /* Un minuto di margine: un gettone che scade a metà salvataggio è un evento
     scritto a metà. */
  if (token && token.expiresAt > Date.now() + 60_000) return Promise.resolve(token.value)
  if (inFlight) return inFlight

  inFlight = getClient()
    .then(
      (c) =>
        new Promise<string>((resolve, reject) => {
          pending = { resolve, reject }
          /* `prompt: ''` = niente schermata se il permesso c'è già. La prima
             volta invece va chiesto per davvero. */
          c.requestAccessToken({ prompt: interactive ? 'consent' : '' })
        })
    )
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/** Collega l'account Google. Va chiamato da un click: la finestra di Google
 *  si apre solo dentro un gesto dell'utente. */
export async function connect(): Promise<void> {
  await requestToken(!isLinked())
  localStorage.setItem(FLAG, '1')
  notify()
}

export function disconnect(): void {
  if (token) window.google?.accounts?.oauth2.revoke(token.value)
  token = null
  localStorage.removeItem(FLAG)
  notify()
}

/** Gettone valido per una chiamata di scrittura, richiesto in silenzio.
 *  Se il permesso è scaduto o revocato il ricordo viene cancellato, così
 *  l'ufficio torna a mostrare il bottone "Collega Google". */
export async function accessToken(): Promise<string> {
  if (!isLinked()) throw new Error('Collega l’account Google per modificare il calendario.')
  try {
    return await requestToken(false)
  } catch (err) {
    localStorage.removeItem(FLAG)
    notify()
    throw new Error(
      err instanceof Error && err.message.includes('pop-up')
        ? err.message
        : 'Il collegamento a Google è scaduto. Ricollegalo e riprova.'
    )
  }
}
