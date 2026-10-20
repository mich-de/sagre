package com.sagreai.data.remote

import android.graphics.Bitmap
import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.content
import com.sagreai.domain.model.SagraInfo
import kotlinx.serialization.json.Json
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository Gemini AI per estrazione strutturata dei dati della sagra,
 * Chatbot "L'Oste AI", Traduzione e Generazione Spot Radio.
 */
@Singleton
class GeminiExtractionRepository @Inject constructor(
    private val model: GenerativeModel
) {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
    }

    /**
     * Estrae info da solo testo (es. trascrizione vocale).
     */
    suspend fun extractFromText(spokenText: String): Result<SagraInfo> = runCatching {
        val prompt = """
            Sei un assistente che analizza descrizioni vocali di eventi italiani.
            Estrai le informazioni da questo testo parlato e restituisci solo JSON valido.

            {
              "nomeSagra": "nome evento",
              "date": ["date in formato leggibile"],
              "orari": ["orari trovati"],
              "location": { "luogo": null, "indirizzo": null, "citta": null, "provincia": null },
              "descrizione": "riepilogo",
              "prezzi": [],
              "contatti": [],
              "piattiTipici": [],
              "tagDietetici": [],
              "categoria": "Gastronomia",
              "consigliBorgo": [],
              "spotRadio": null,
              "rawText": "$spokenText",
              "confidenceScore": 0.8
            }

            TESTO VOCALE: $spokenText
        """.trimIndent()
        val response = model.generateContent(prompt)
        val jsonString = extractJsonFromResponse(response.text ?: "")
        json.decodeFromString<SagraInfo>(jsonString)
    }.onFailure { Timber.e(it, "Text extraction error") }

    /**
     * Estrae le informazioni strutturate dall'immagine di una sagra.
     */
    suspend fun extractSagraInfo(
        bitmap: Bitmap,
        rawOcrText: String
    ): Result<SagraInfo> = runCatching {

        val prompt = buildPrompt(rawOcrText)

        val response = model.generateContent(
            content(role = "user") {
                image(bitmap)
                text(prompt)
            }
        )

        val responseText = response.text
            ?: throw IllegalStateException("Gemini ha restituito una risposta vuota")

        Timber.d("Gemini raw response: $responseText")

        val jsonString = extractJsonFromResponse(responseText)
        json.decodeFromString<SagraInfo>(jsonString)

    }.onFailure { e ->
        Timber.e(e, "Gemini extraction error")
    }

    /**
     * Chatbot "L'Oste AI": risponde alle domande dell'utente sulla sagra.
     */
    suspend fun chatWithOste(
        sagra: SagraInfo,
        history: List<Pair<String, String>>,
        userMessage: String
    ): Result<String> = runCatching {
        val prompt = buildString {
            appendLine("Sei 'L'Oste della Sagra', un oste simpatico, accogliente e informatissimo sulla seguente sagra:")
            appendLine("NOME: ${sagra.nomeSagra ?: "Sagra"}")
            appendLine("DATE: ${sagra.date.joinToString()}")
            appendLine("LUOGO: ${sagra.location?.fullAddress}")
            appendLine("ORARI: ${sagra.orari.joinToString()}")
            appendLine("PREZZI: ${sagra.prezzi.joinToString()}")
            appendLine("PIATTI TIPICI: ${sagra.piattiTipici.joinToString()}")
            appendLine("TAG DIETETICI: ${sagra.tagDietetici.joinToString()}")
            appendLine("DESCRIZIONE: ${sagra.descrizione}")
            appendLine("TESTO VOLANTINO: ${sagra.rawText}")
            appendLine("\nRispondi in modo cordiale, chiaro e con tono tipico da oste/accogliente in 2-4 frasi.")
            if (history.isNotEmpty()) {
                appendLine("\nSTORICO CONVERSAZIONE:")
                history.forEach { (u, a) ->
                    appendLine("Utente: $u")
                    appendLine("Oste: $a")
                }
            }
            appendLine("\nUtente: $userMessage")
            appendLine("Oste:")
        }

        val response = model.generateContent(prompt)
        response.text?.trim() ?: "Ostregheta! Non ho capito la domanda, rifammela!"
    }

    /**
     * Traduce l'intera scheda sagra nella lingua di destinazione.
     */
    suspend fun translateSagra(
        sagra: SagraInfo,
        targetLanguage: String
    ): Result<SagraInfo> = runCatching {
        val prompt = """
            Traduci le seguenti informazioni della sagra nella lingua '$targetLanguage'.
            Mantieni la struttura JSON identica a quella ricevuta. Non tradurre nomi propri di luoghi o città se non necessario.
            
            JSON SORGENTE:
            ${json.encodeToString(SagraInfo.serializer(), sagra)}
            
            Rispondi ESCLUSIVAMENTE con il JSON tradotto.
        """.trimIndent()

        val response = model.generateContent(prompt)
        val jsonString = extractJsonFromResponse(response.text ?: "")
        json.decodeFromString<SagraInfo>(jsonString)
    }

    private fun buildPrompt(rawOcrText: String): String = """
        Sei un assistente esperto nell'analisi di locandine, volantini e manifesti di sagre,
        feste paesane ed eventi enogastronomici italiani.
        
        Analizza l'immagine fornita ed estrai TUTTE le informazioni presenti.
        Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo aggiuntivo.
        
        Il JSON deve seguire esattamente questo schema:
        {
          "nomeSagra": "nome completo dell'evento (null se non presente)",
          "date": ["array di date SEPARATE. Ogni data è un elemento individuale es: '15 agosto 2025', '16 agosto 2025'"],
          "orari": ["array di orari es: 'dalle 19:00', 'apertura cancelli ore 17:30'"],
          "location": {
            "luogo": "nome del luogo es: 'Piazza del Comune', 'Campo Sportivo'",
            "indirizzo": "via/piazza e numero civico se presente",
            "citta": "nome della città o paese",
            "provincia": "sigla provincia es: 'MI', 'RM' (null se non presente)"
          },
          "descrizione": "breve descrizione dell'evento (cosa si mangia, spettacoli, attività)",
          "prezzi": ["array di info su prezzi es: 'Ingresso libero', 'Menu adulti €15'"],
          "contatti": ["array di contatti es: 'Tel: 0123 456789', 'info@sagra.it'"],
          "piattiTipici": ["array di cibi o specialità gastronomiche citate es: 'Porchetta', 'Polenta', 'Funghi Porcini', 'Frittelle'"],
          "tagDietetici": ["array di tag trovati es: 'Gluten Free', 'Vegetariano', 'Senza Lattosio', 'KM 0'"],
          "categoria": "scegli una sola tra: 'Gastronomia', 'Vino', 'Musica', 'Rievocazione', 'Cultura'",
          "consigliBorgo": ["2 o 3 consigli turistici su cosa visitare nel paese/comune dell'evento prima della sagra"],
          "spotRadio": "crea uno spot simpatico da 20 secondi stile annuncio radiofonic per invitare la gente a questa sagra",
          "rawText": "tutto il testo leggibile nell'immagine",
          "confidenceScore": 0.0
        }
        
        REGOLE IMPORTANTI:
        - Usa null per campi non trovati (non stringhe vuote)
        - Le date devono essere in italiano come appaiono nell'immagine
        - confidenceScore: 1.0 = tutti i campi trovati, 0.5 = solo alcuni, 0.2 = molto incerto
        - Se l'immagine NON è una locandina di sagra/evento, imposta confidenceScore a 0.1
        - Non inventare informazioni: estrai solo ciò che è effettivamente visibile
        
        TESTO OCR GIÀ ESTRATTO (usa come riferimento aggiuntivo):
        ---
        $rawOcrText
        ---
    """.trimIndent()

    private fun extractJsonFromResponse(response: String): String {
        val trimmed = response.trim()
        if (trimmed.startsWith("{")) return trimmed

        val jsonBlockRegex = Regex("```(?:json)?\\s*([\\s\\S]*?)```")
        val match = jsonBlockRegex.find(trimmed)
        if (match != null) return match.groupValues[1].trim()

        val start = trimmed.indexOf('{')
        val end = trimmed.lastIndexOf('}')
        if (start != -1 && end != -1 && end > start) {
            return trimmed.substring(start, end + 1)
        }

        throw IllegalArgumentException("Nessun JSON valido trovato nella risposta: $response")
    }
}
