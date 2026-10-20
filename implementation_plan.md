# 🎪 SagreAI — App Android per Identificazione Dati da Immagini di Sagre

Analisi di immagini (locandine, volantini, manifesti di sagre/eventi locali) per estrarre in modo strutturato **date**, **orari**, **location** e **testo dell'evento**, sfruttando un'architettura ibrida on-device + cloud AI.

---

## User Review Required

> [!IMPORTANT]
> **API Key Gemini**: Devi avere una chiave API Google AI Studio (gratuita su ai.google.dev). Il piano usa il modello **Gemini 2.5 Flash** che offre il miglior rapporto qualità/latenza per l'estrazione strutturata da immagini.

> [!WARNING]
> **Room 3.0** ha cambiato i package da `androidx.room` → `androidx.room3`. Questa versione richiede **KSP** obbligatorio (no KAPT). Se il progetto preesiste, verificare la migrazione.

> [!NOTE]
> **Offline first**: ML Kit gira completamente on-device. Gemini richiede connessione. La app funzionerà in modalità degradata (solo OCR grezzo) senza internet.

---

## Open Questions

> [!IMPORTANT]
> 1. **Archiviazione risultati**: Vuoi salvare le sagre estratte in una lista/cronologia navigabile? (consigliato: Room DB)
> 2. **Share**: Vuoi condividere il risultato estratto (es. aggiungi a Calendario, condividi via WhatsApp)?
> 3. **Modalità input**: Solo gallery (foto esistente) o anche camera live? Entrambe?
> 4. **API Key storage**: Preferisci inserire la chiave manualmente in-app (setting screen) o compilarla a build time via `local.properties`?
> 5. **Lingua target**: L'estrazione va ottimizzata solo per italiano o anche inglese?

---

## Architettura

```
┌─────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                │
│  Jetpack Compose UI  ←→  ViewModel (Hilt)           │
│  • HomeScreen (scan CTA)                            │
│  • ResultScreen (dati estratti)                     │
│  • HistoryScreen (sagre salvate)                    │
│  • SettingsScreen (API key, preferenze)             │
└──────────────┬──────────────────────────────────────┘
               │ StateFlow / sealed State
┌──────────────▼──────────────────────────────────────┐
│                   DOMAIN LAYER                      │
│  • ExtractSagraUseCase                              │
│  • SaveSagraUseCase                                 │
│  • GetHistoryUseCase                                │
└──────────┬───────────────────┬──────────────────────┘
           │                   │
┌──────────▼──────┐   ┌────────▼────────────────────┐
│  DATA/LOCAL     │   │  DATA/REMOTE                │
│  Room 3.0       │   │  ML Kit (on-device OCR)     │
│  DataStore 1.2  │   │  Gemini 2.5 Flash SDK       │
└─────────────────┘   └─────────────────────────────┘
```

---

## Stack Tecnologico (Luglio 2026)

| Categoria | Libreria | Versione |
|---|---|---|
| **Language** | Kotlin | 2.1.21 |
| **Compile SDK** | Android | 36 |
| **Min SDK** | Android 8.0 | API 26 |
| **Build System** | Gradle + KSP | 2.1.21-1.0.32 |
| **UI** | Jetpack Compose | 1.11.4 |
| **Material** | Material3 | 1.4.0 |
| **Navigation** | Navigation Compose | 2.9.0 |
| **DI** | Hilt | 2.60.1 |
| **Camera** | CameraX | 1.6.1 |
| **OCR** | ML Kit Text Recognition v2 | 16.0.1 |
| **AI** | Google Generative AI (Gemini 2.5 Flash) | 0.9.0 |
| **Local DB** | Room 3.0 | 3.0.0 |
| **Preferences** | DataStore Preferences | 1.2.1 |
| **Image Loading** | Coil 3 | 3.2.0 |
| **JSON** | Kotlinx Serialization | 1.8.1 |
| **Async** | Coroutines + Flow | 1.10.2 |
| **Logging** | Timber | 5.0.1 |

---

## Proposed Changes

### Phase 0 — Struttura Progetto

#### [NEW] `d:\sagre_app\` (root Android project)

Struttura cartelle:
```
sagre_app/
├── app/
│   ├── src/main/
│   │   ├── java/com/sagreai/
│   │   │   ├── di/               # Hilt modules
│   │   │   ├── data/
│   │   │   │   ├── local/        # Room entities, DAO, Database
│   │   │   │   ├── remote/       # ML Kit repository, Gemini repository
│   │   │   │   └── repository/   # Implementazioni repository
│   │   │   ├── domain/
│   │   │   │   ├── model/        # SagraInfo data class
│   │   │   │   └── usecase/      # Use cases
│   │   │   └── ui/
│   │   │       ├── home/         # HomeScreen + ViewModel
│   │   │       ├── result/       # ResultScreen + ViewModel
│   │   │       ├── history/      # HistoryScreen + ViewModel
│   │   │       ├── settings/     # SettingsScreen + ViewModel
│   │   │       ├── components/   # Shared composable components
│   │   │       └── theme/        # Color, Type, Shape
│   │   └── res/
│   ├── build.gradle.kts
│   └── proguard-rules.pro
├── gradle/
│   └── libs.versions.toml        # Version catalog centrale
├── build.gradle.kts
├── settings.gradle.kts
├── local.properties              # GEMINI_API_KEY (non tracciato in git)
├── IMPLEMENTATION_PLAN.md
├── TASKS.md
├── GEMINI.md
└── README.md
```

---

### Phase 1 — Configurazione Build

#### [NEW] `gradle/libs.versions.toml`
```toml
[versions]
kotlin = "2.1.21"
agp = "8.10.3"
ksp = "2.1.21-1.0.32"
compose-bom = "2026.07.01"
hilt = "2.60.1"
camerax = "1.6.1"
mlkit-text = "16.0.1"
generativeai = "0.9.0"
room = "3.0.0"
datastore = "1.2.1"
coil = "3.2.0"
serialization = "1.8.1"
coroutines = "1.10.2"
timber = "5.0.1"
navigation = "2.9.0"

[libraries]
# Compose BOM
compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "compose-bom" }
compose-ui = { group = "androidx.compose.ui", name = "ui" }
compose-material3 = { group = "androidx.compose.material3", name = "material3" }
compose-ui-tooling = { group = "androidx.compose.ui", name = "ui-tooling" }
compose-ui-preview = { group = "androidx.compose.ui", name = "ui-tooling-preview" }

# Navigation
navigation-compose = { group = "androidx.navigation", name = "navigation-compose", version.ref = "navigation" }

# Hilt
hilt-android = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }
hilt-compiler = { group = "com.google.dagger", name = "hilt-android-compiler", version.ref = "hilt" }
hilt-navigation-compose = { group = "androidx.hilt", name = "hilt-navigation-compose", version = "1.2.0" }

# CameraX
camerax-core = { group = "androidx.camera", name = "camera-core", version.ref = "camerax" }
camerax-camera2 = { group = "androidx.camera", name = "camera-camera2", version.ref = "camerax" }
camerax-lifecycle = { group = "androidx.camera", name = "camera-lifecycle", version.ref = "camerax" }
camerax-view = { group = "androidx.camera", name = "camera-view", version.ref = "camerax" }
camerax-compose = { group = "androidx.camera", name = "camera-compose", version.ref = "camerax" }

# ML Kit
mlkit-text-recognition = { group = "com.google.mlkit", name = "text-recognition", version.ref = "mlkit-text" }
mlkit-text-recognition-it = { group = "com.google.mlkit", name = "text-recognition-italian", version.ref = "mlkit-text" }

# Gemini AI
generativeai = { group = "com.google.ai.client.generativeai", name = "generativeai", version.ref = "generativeai" }

# Room 3.0
room-runtime = { group = "androidx.room3", name = "room3-runtime", version.ref = "room" }
room-compiler = { group = "androidx.room3", name = "room3-compiler", version.ref = "room" }
room-ktx = { group = "androidx.room3", name = "room3-ktx", version.ref = "room" }

# DataStore
datastore-preferences = { group = "androidx.datastore", name = "datastore-preferences", version.ref = "datastore" }

# Coil
coil-compose = { group = "io.coil-kt.coil3", name = "coil-compose", version.ref = "coil" }

# Kotlinx Serialization
serialization-json = { group = "org.jetbrains.kotlinx", name = "kotlinx-serialization-json", version.ref = "serialization" }

# Coroutines
coroutines-core = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-core", version.ref = "coroutines" }
coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "coroutines" }

# Timber
timber = { group = "com.jakewharton.timber", name = "timber", version.ref = "timber" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
kotlin-serialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
hilt = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
room = { id = "androidx.room3", version.ref = "room" }
```

---

### Phase 2 — Domain Model

#### [NEW] `SagraInfo.kt`
```kotlin
@Serializable
data class SagraInfo(
    val id: String = UUID.randomUUID().toString(),
    val nomeSagra: String?,
    val date: List<String>,      // es. ["15 agosto 2025", "16 agosto 2025"]
    val orari: List<String>,     // es. ["dalle 18:00 alle 24:00"]
    val location: LocationInfo?,
    val descrizione: String?,
    val prezzi: List<String>,    // es. ["Ingresso libero", "Menu €15"]
    val contatti: List<String>,  // es. ["Tel: 0123 456789"]
    val rawText: String,
    val confidenceScore: Float,
    val extractedAt: Long = System.currentTimeMillis()
)

@Serializable
data class LocationInfo(
    val luogo: String?,    // nome del luogo
    val indirizzo: String?,
    val citta: String?,
    val provincia: String?
)
```

---

### Phase 3 — Data Layer

#### [NEW] `GeminiRepository.kt` — Estrazione strutturata con Gemini 2.5 Flash

```kotlin
class GeminiRepository @Inject constructor(
    private val model: GenerativeModel
) {
    suspend fun extractSagraInfo(bitmap: Bitmap, rawOcrText: String): Result<SagraInfo> {
        val prompt = """
            Sei un assistente specializzato nell'analisi di locandine di sagre e feste italiane.
            Analizza questa immagine ed estrai SOLO le informazioni presenti.
            
            Rispondi ESCLUSIVAMENTE in questo formato JSON:
            {
              "nomeSagra": "nome della sagra o evento",
              "date": ["lista di date trovate in formato leggibile"],
              "orari": ["lista di orari trovati"],
              "location": {
                "luogo": "nome del luogo/piazza/campo",
                "indirizzo": "via e numero civico se presenti",
                "citta": "città",
                "provincia": "sigla provincia"
              },
              "descrizione": "breve descrizione dell'evento",
              "prezzi": ["eventuali prezzi o info biglietti"],
              "contatti": ["telefono, email, sito web se presenti"],
              "confidenceScore": 0.0-1.0
            }
            
            Testo OCR già estratto (usalo come riferimento aggiuntivo):
            $rawOcrText
        """.trimIndent()
        
        return runCatching {
            val response = model.generateContent(
                content(role = "user") {
                    image(bitmap)
                    text(prompt)
                }
            )
            val json = response.text ?: throw Exception("Risposta vuota da Gemini")
            Json.decodeFromString<SagraInfo>(json.extractJsonBlock())
        }
    }
}
```

#### [NEW] `MlKitRepository.kt` — OCR on-device (step 1, veloce)

```kotlin
class MlKitRepository @Inject constructor() {
    private val recognizer = TextRecognition.getClient(
        TextRecognizerOptions.Builder()
            .setLanguageHints(listOf("it", "en"))
            .build()
    )
    
    suspend fun recognizeText(bitmap: Bitmap): Result<String> = runCatching {
        val image = InputImage.fromBitmap(bitmap, 0)
        val result = recognizer.process(image).await()
        result.textBlocks.joinToString("\n") { it.text }
    }
}
```

#### [NEW] `SagraEntity.kt` + `SagraDao.kt` — Room 3.0

```kotlin
@Entity(tableName = "sagre")
data class SagraEntity(
    @PrimaryKey val id: String,
    val nomeSagra: String?,
    val dateJson: String,     // JSON encoded list
    val orariJson: String,
    val locationJson: String?,
    val descrizione: String?,
    val prezziJson: String,
    val contattiJson: String,
    val rawText: String,
    val imageUri: String?,
    val confidenceScore: Float,
    val extractedAt: Long
)

@Dao
interface SagraDao {
    @Query("SELECT * FROM sagre ORDER BY extractedAt DESC")
    fun getAllSagre(): Flow<List<SagraEntity>>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(sagra: SagraEntity)
    
    @Delete
    suspend fun delete(sagra: SagraEntity)
}
```

---

### Phase 4 — Use Cases

| Use Case | Input | Output | Descrizione |
|---|---|---|---|
| `ExtractSagraUseCase` | `Bitmap` | `Flow<ExtractionState>` | Coordina ML Kit → Gemini, emette stati progressivi |
| `SaveSagraUseCase` | `SagraInfo` | `Result<Unit>` | Salva in Room DB |
| `GetHistoryUseCase` | — | `Flow<List<SagraInfo>>` | Lista sagre salvate |
| `DeleteSagraUseCase` | `SagraInfo` | `Result<Unit>` | Elimina singola sagra |

---

### Phase 5 — UI / Screens

#### Screen Map

```
HomeScreen
 ├── [FAB] Scansiona da Galleria  → PhotoPicker
 ├── [FAB] Scansiona da Camera    → CameraX
 └── Navigazione → HistoryScreen / SettingsScreen

ResultScreen (dopo estrazione)
 ├── Thumbnail immagine originale
 ├── Card: Nome Sagra (big title)
 ├── Card: 📅 Date (chips per ogni data)
 ├── Card: 🕐 Orari
 ├── Card: 📍 Location (con link a Google Maps)
 ├── Card: 📝 Descrizione
 ├── Card: 🎫 Prezzi
 ├── Card: 📞 Contatti
 ├── [Button] Salva in cronologia
 └── [Button] Condividi / Aggiungi a Calendario

HistoryScreen
 ├── LazyColumn sagre salvate
 └── Swipe-to-delete

SettingsScreen
 └── Input API Key Gemini (salvata in DataStore)
```

#### Stato UI (sealed class)

```kotlin
sealed class ExtractionState {
    object Idle : ExtractionState()
    object LoadingOcr : ExtractionState()     // ML Kit in corso
    object LoadingAi : ExtractionState()       // Gemini in corso
    data class Success(val sagra: SagraInfo) : ExtractionState()
    data class Error(val message: String) : ExtractionState()
    data class PartialResult(val rawText: String) : ExtractionState() // solo OCR, no internet
}
```

#### Design System
- **Theme**: Dark mode di default con accento arancio-caldo (`#FF6B35`) e viola (`#7B2D8B`)
- **Font**: Google Fonts **Outfit** (heading) + **Inter** (body)
- **Shape**: Corner radius 16dp sulle card
- **Animazioni**: `AnimatedVisibility`, shimmer loading, shared element transitions (Compose 1.11+)

---

### Phase 6 — Sicurezza & Privacy

- La chiave API Gemini viene salvata **cifrata in DataStore** (EncryptedDataStore o DataStore + tink)
- Le immagini **non vengono mai salvate sul server**: solo il Bitmap viene inviato in-memory all'API
- `local.properties` (con `GEMINI_API_KEY`) è aggiunto a `.gitignore`
- Permessi richiesti: `CAMERA`, `READ_MEDIA_IMAGES` (API 33+) / `READ_EXTERNAL_STORAGE` (API < 33)

---

### Phase 7 — Documentazione Progetto

#### [NEW] `IMPLEMENTATION_PLAN.md` → (questo file, copiato nel repo)
#### [NEW] `TASKS.md` → task board by agent
#### [NEW] `GEMINI.md` → decision log
#### [NEW] `README.md` → guida installazione e utilizzo

---

## Flusso di Estrazione (diagramma)

```
User seleziona immagine
        │
        ▼
[HomeViewModel] → avvia ExtractSagraUseCase
        │
        ▼ emit LoadingOcr
[MlKitRepository] → Text Recognition on-device
        │ rawText
        ▼ emit LoadingAi
[GeminiRepository] → Gemini 2.5 Flash (immagine + rawText)
        │ JSON risposta
        ▼
Json.decodeFromString<SagraInfo>
        │
        ▼ emit Success(sagraInfo)
[ResultScreen] → mostra dati strutturati
        │
        ▼ [Salva]
[Room DB] → persistenza locale
```

---

## Verification Plan

### Build Verification
```bash
./gradlew assembleDebug
./gradlew test
```

### Manual Verification
1. Aprire la app → selezionare una locandina di sagra dalla gallery
2. Verificare che lo stato `LoadingOcr` → `LoadingAi` sia visibile nell'UI
3. Verificare che `ResultScreen` mostri: nome, date, orari, location corretti
4. Tap **Salva** → verificare che appaia in `HistoryScreen`
5. Swipe-to-delete in HistoryScreen
6. Andare in **Settings** → inserire API key → verificare persistenza dopo riavvio

### Test unitari
- `ExtractSagraUseCaseTest` — mock ML Kit + Gemini, verifica stati emessi
- `GeminiRepositoryTest` — mock GenerativeModel, verifica parsing JSON
- `SagraDaoTest` — Room in-memory database test

---

## Stima tempi

| Phase | Stima |
|---|---|
| Phase 0-1: Setup progetto + build | ~1h |
| Phase 2-3: Domain + Data layer | ~2h |
| Phase 4: Use cases | ~1h |
| Phase 5: UI completa | ~3h |
| Phase 6: Sicurezza + polishing | ~1h |
| Phase 7: Documentazione | ~30min |
| **Totale** | **~8-9h** |
