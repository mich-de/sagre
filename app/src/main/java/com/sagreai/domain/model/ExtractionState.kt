package com.sagreai.domain.model

/**
 * Stati del processo di estrazione, emessi come Flow<ExtractionState>
 * dalla use case verso il ViewModel → UI.
 */
sealed class ExtractionState {
    /** Nessuna operazione in corso */
    object Idle : ExtractionState()

    /** ML Kit sta eseguendo l'OCR on-device (veloce, ~500ms) */
    data class LoadingOcr(val progress: Float = 0f) : ExtractionState()

    /** Gemini AI sta analizzando (richiede connessione, ~2-5s) */
    data class LoadingAi(val rawText: String = "") : ExtractionState()

    /** Estrazione completata con successo */
    data class Success(val sagra: SagraInfo) : ExtractionState()

    /**
     * Solo OCR disponibile (nessuna connessione o Gemini ha fallito).
     * L'app mostra il testo grezzo estratto.
     */
    data class PartialResult(
        val rawText: String,
        val reason: String = "Nessuna connessione internet"
    ) : ExtractionState()

    /** Errore fatale */
    data class Error(
        val message: String,
        val throwable: Throwable? = null
    ) : ExtractionState()
}
