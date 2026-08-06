# 📚 SagreAI — README

## Cos'è SagreAI?

App Android che analizza immagini di locandine/volantini di **sagre e feste italiane** e ne estrae automaticamente:
- 📅 **Date** dell'evento
- 🕐 **Orari** di apertura
- 📍 **Location** con link diretto a Google Maps
- 🎪 **Nome e descrizione** della sagra
- 🎫 **Prezzi** e info biglietti
- 📞 **Contatti** (tel, email, sito)

## Come Funziona

```
Immagine → ML Kit OCR (on-device, offline) → Gemini 2.5 Flash (AI strutturata) → Risultato JSON
```

1. **ML Kit** legge tutto il testo dall'immagine direttamente sul dispositivo (veloce, nessun dato inviato)
2. **Gemini 2.5 Flash** analizza immagine + testo OCR e restituisce dati strutturati
3. I risultati vengono salvati in **Room DB** per la cronologia

## Come Installare

### Prerequisiti
- Android Studio Koala (o superiore)
- Android SDK API 35 + API 26 (minSdk)
- JDK 17
- Account Google AI Studio (gratuito)

### Setup

1. **Clona il repository:**
   ```bash
   git clone https://github.com/mich-de/sagreai.git
   cd sagreai
   ```

2. **Ottieni una API key Gemini:**
   - Vai su [aistudio.google.com](https://aistudio.google.com)
   - Crea una API key gratuita

3. **Configura la API key** (scegli uno dei due metodi):
   
   **Metodo A — Build time** (sconsigliato per repository pubblici):
   ```properties
   # local.properties
   GEMINI_API_KEY=AIza...
   ```
   
   **Metodo B — Runtime** (consigliato):
   - Installa l'app → Apri **Impostazioni** → incolla la chiave API

4. **Build e installa:**
   ```bash
   ./gradlew installDebug
   ```

## Come Usare

1. Apri l'app
2. Tocca **"Scegli dalla Galleria"** o **"Scatta una foto"**
3. Seleziona/scatta una locandina di sagra
4. Attendi l'elaborazione (OCR ~1s, AI ~3-5s)
5. Visualizza i dati estratti
6. Tocca **"📍 Apri in Google Maps"** per la navigazione
7. Condividi via WhatsApp, Telegram, etc. con il tasto Share

## Stack Tecnologico

| Componente | Tecnologia |
|---|---|---|
| Language | Kotlin 2.0.21 |
| UI | Jetpack Compose + Material3 |
| OCR | ML Kit Text Recognition v2 |
| AI | Gemini 2.5 Flash (SDK 0.7.0) |
| Database | Room 2.6.1 |
| DI | Hilt 2.51.1 |
| Async | Coroutines + Flow |

## Privacy

- Le immagini vengono inviate alle API Gemini **solo in-memory** per l'analisi, non vengono archiviate
- La cronologia è salvata **solo sul dispositivo** (nessun sync cloud)
- La API key è salvata in DataStore locale, mai in chiaro su cloud

## Licenza

MIT © 2026 mich-de
