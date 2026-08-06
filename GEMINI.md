# GEMINI.md — Decision Log SagreAI

## Sessione 1 — 2026-07-27

### Decisioni Architetturali

**Architettura ibrida ML Kit + Gemini**
- _Problema_: Solo OCR non è sufficiente per estrarre dati strutturati (date, location) in modo affidabile
- _Soluzione_: ML Kit per OCR veloce on-device → Gemini 2.5 Flash per structured extraction
- _Razionale_: ML Kit è offline e istantaneo, Gemini ha la comprensione semantica per dati complessi

**Fallback offline (PartialResult state)**
- _Problema_: Se Gemini non è disponibile (no internet), l'utente vede solo un errore
- _Soluzione_: Stato `PartialResult` che mostra il testo OCR grezzo
- _Razionale_: Degradazione graceful — l'utente ottiene comunque il testo dall'immagine

**Room 3.0 con JSON encoding per campi complessi**
- _Problema_: List<String> e LocationInfo non sono tipi Room nativi
- _Soluzione_: Serializzazione Kotlinx JSON per i campi complessi nell'entità
- _Alternativa scartata_: TypeConverter Room — più boilerplate, stesso risultato

**DataStore per API key (non EncryptedSharedPreferences)**
- _Problema_: Le chiavi API devono essere persistite in modo sicuro
- _Soluzione adottata_: DataStore Preferences 1.2.1 (più moderno di SharedPrefs)
- _Nota futura_: Migrare a datastore-tink (alpha) per encryption nativa quando sarà stabile

**Photo Picker API (ActivityResultContracts.PickVisualMedia)**
- _Razionale_: Nessun permesso richiesto su Android 13+, esperienza utente migliore, sicurezza per design
- _Alternativa scartata_: ACTION_GET_CONTENT con READ_EXTERNAL_STORAGE — deprecato e richiede permessi

### Pattern stabiliti

- **Use cases**: operator fun invoke per sintassi pulita `useCase(param)`
- **Repository**: interfaces nel dominio, implementazioni nel data layer
- **State**: sealed class `ExtractionState` come unica fonte di verità
- **ViewModel → UI**: StateFlow con `collectAsStateWithLifecycle()`

### Versioni bloccate (build 2026-07-27)

| Lib | Versione | Note |
|---|---|---|
| compileSdk | 35 | Android 15 |
| minSdk | 26 | Android 8.0 (buona copertura) |
| Kotlin | 2.0.21 | Stabile, K2 compiler |
| AGP | 8.7.3 | Compat Gradle 9.6.1 |
| Compose BOM | 2024.12.01 | Stable |
| Room | 2.6.1 | Stable (Room 3.0 non ancora disponibile) |
| Hilt | 2.51.1 | Iniezione dipendenze |

### TODO prossima sessione

- [ ] Aggiungere test unitari (ExtractSagraUseCaseTest, GeminiRepositoryTest)
- [ ] CameraX screen con viewfinder live (attualmente usa TakePicturePreview)
- [x] Aggiungere Calendar Intent per "Aggiungi a Calendario"
- [ ] Valutare aggiornamento a Gemini 3.x quando sarà stabile
- [ ] Generare icone mipmap PNG reali (attualmente solo adaptive XML)

---

## Sessione 2 — 2026-07-29

### Decisioni Architetturali

**Dual-Flow Google Calendar (Intent Nativo + Esportazione .ics)**
- _Problema_: `ContentResolver.insert` richiedeva permessi invasivi sul calendario e non permetteva all'utente di scegliere su quale il suo account Google personale o di lavoro aggiungere l'evento.
- _Soluzione_: 
  1. Uso prioritario dell'intent nativo `Intent.ACTION_INSERT` per Google Calendar.
  2. Implementato `IcsGenerator` per esportazione e condivisione file `.ics` (iCalendar) tramite FileProvider per WhatsApp, Apple Calendar e Outlook.
- _Razionale_: Massima flessibilità d'uso per l'utente, zero permessi invasivi richiesti.

**Migrazione Gestione Date a `java.time`**
- _Problema_: `java.util.Calendar` e `SimpleDateFormat` avevano problemi con fusi orari, date senza anno e anni bisestili.
- _Soluzione_: Refactoring completo di `CalendarIntegration.kt` con `java.time.LocalDate`, `LocalDateTime`, `LocalTime` e `ZoneId.of("Europe/Rome")`.

**Integrazione Mappe (Google Maps + Waze)**
- _Problema_: L'utente doveva copiare l'indirizzo a mano per avviare il navigatore.
- _Soluzione_: Pulsanti d'azione rapida su `LocationCard` con Intent nativi per `Google Maps` (`geo:0,0?q=...`) e `Waze` (`https://waze.com/ul?q=...`).

