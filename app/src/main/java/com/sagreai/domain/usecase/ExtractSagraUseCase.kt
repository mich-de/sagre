package com.sagreai.domain.usecase

import android.graphics.Bitmap
import com.sagreai.domain.model.ExtractionState
import com.sagreai.domain.repository.AiExtractionRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import timber.log.Timber
import javax.inject.Inject

/**
 * Use case principale: coordina ML Kit OCR → Gemini AI
 * e emette stati progressivi via Flow<ExtractionState>.
 *
 * Gestisce automaticamente il fallback offline:
 * - Se Gemini fallisce → emette PartialResult con testo OCR grezzo
 * - Se anche ML Kit fallisce → emette Error
 */
class ExtractSagraUseCase @Inject constructor(
    private val aiRepo: AiExtractionRepository
) {
    operator fun invoke(bitmap: Bitmap): Flow<ExtractionState> = flow {
        emit(ExtractionState.LoadingOcr())

        // Step 1: OCR on-device con ML Kit
        val ocrResult = aiRepo.recognizeTextFromBitmap(bitmap)
        if (ocrResult.isFailure) {
            val err = ocrResult.exceptionOrNull()
            Timber.e(err, "ML Kit OCR fallito")
            emit(ExtractionState.Error(
                message = "Impossibile leggere il testo dall'immagine",
                throwable = err
            ))
            return@flow
        }

        val rawText = ocrResult.getOrThrow()
        Timber.d("OCR completato: ${rawText.length} caratteri")

        if (rawText.isBlank()) {
            emit(ExtractionState.PartialResult(
                rawText = "",
                reason = "Nessun testo trovato nell'immagine"
            ))
            return@flow
        }

        // Step 2: Estrazione strutturata con Gemini
        emit(ExtractionState.LoadingAi(rawText = rawText))

        val geminiResult = aiRepo.extractStructuredData(bitmap, rawText)

        if (geminiResult.isSuccess) {
            val sagra = geminiResult.getOrThrow()
            Timber.d("Gemini estratto: ${sagra.nomeSagra}, confidence=${sagra.confidenceScore}")
            emit(ExtractionState.Success(sagra))
        } else {
            val err = geminiResult.exceptionOrNull()
            Timber.w(err, "Gemini fallito, fallback a OCR grezzo")
            // Fallback: restituisce solo il testo grezzo OCR
            emit(ExtractionState.PartialResult(
                rawText = rawText,
                reason = err?.message ?: "Servizio AI non disponibile"
            ))
        }
    }
}
