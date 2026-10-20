# SagreAI — Task Board

## ✅ Completi

### Setup Progetto
- [x] Struttura cartelle Android project
- [x] Version catalog (`gradle/libs.versions.toml`)
- [x] Configurazione Gradle (AGP 8.7.3, Kotlin 2.0.21)
- [x] Gestione API key via `local.properties` + DataStore

### Domain Layer
- [x] `SagraInfo` — modello dati principale con `@Serializable`
- [x] `LocationInfo` — modello location con `mapsUrl` e `fullAddress`
- [x] `ExtractionState` — sealed class per stati UI (Idle, LoadingOcr, LoadingAi, Success, PartialResult, Error)
- [x] `SagraRepository` — interfaccia per CRUD locale
- [x] `AiExtractionRepository` — interfaccia per OCR + Gemini
- [x] `ExtractSagraUseCase` — coordina ML Kit → Gemini con fallback offline
- [x] `SaveSagraUseCase`, `GetHistoryUseCase`, `DeleteSagraUseCase`, `GetSagraByIdUseCase`

### Data Layer
- [x] `MlKitTextRepository` — OCR on-device con ML Kit v2
- [x] `GeminiExtractionRepository` — structured extraction con Gemini 2.5 Flash
- [x] `AiExtractionRepositoryImpl` — bridge ML Kit + Gemini
- [x] `SagraEntity` + `SagraDao` — Room entity e DAO
- [x] `SagreAiDatabase` — database Room
- [x] `SagraEntityMapper` — mapper bidirezionale Entity ↔ Domain
- [x] `DataStoreManager` — persistenza API key e preferenze
- [x] `SagraRepositoryImpl` — implementazione repository

### DI
- [x] `AiModule` — fornisce `GenerativeModel` con Gemini 3.6 Flash + API key
- [x] `DatabaseModule` — fornisce `SagreAiDatabase` + `SagraDao`
- [x] `RepositoryModule` — bind interfacce → implementazioni

### UI
- [x] `HomeScreen` — photo picker, camera, stato estrazione
- [x] `ResultScreen` — mostra dati estratti con cards animate
- [x] `HistoryScreen` — cronologia sagre con swipe-to-delete
- [x] `SettingsScreen` — input API key + info app
- [x] `Navigation.kt` — NavHost con transizioni animate
- [x] Theme — Dark/Light con palette arancio/viola
- [x] `InfoCards` — DateCard, OrariCard, LocationCard, PrezziCard, ContattiCard, RawTextCard

### Build
- [x] Build `assembleDebug` riuscita (APK 64MB debug)
- [x] Zero warnings di compilazione

## 🔄 In Progress / Da Fare

### Testing
- [ ] `ExtractSagraUseCaseTest` — mock ML Kit + Gemini
- [ ] `GeminiRepositoryTest` — mock GenerativeModel, verifica parsing JSON
- [ ] `SagraDaoTest` — Room in-memory database test

### Miglioramenti
- [ ] CameraX screen con viewfinder live
- [x] Calendar Intent per "Aggiungi a Calendario" (Google Calendar Nativo + .ics export + Multi-giorno)
- [x] Modernizzazione Date con `java.time` (ZoneId Europe/Rome)
- [x] Integrazione Navigazione Mappe (Google Maps + Waze)
- [ ] Icone mipmap PNG reali (attualmente solo adaptive XML)
- [ ] Datastore-tink per encryption API key

