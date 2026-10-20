package com.sagreai.domain.repository

import android.graphics.Bitmap
import com.sagreai.domain.model.SagraInfo
import kotlinx.coroutines.flow.Flow

/**
 * Contratto per il repository locale (Room).
 * Il dominio dipende solo da questa interfaccia, mai dalle implementazioni.
 */
interface SagraRepository {
    /** Osserva tutte le sagre salvate, ordinate per data di estrazione (più recenti prime) */
    fun getAllSagre(): Flow<List<SagraInfo>>

    /** Salva o aggiorna una sagra */
    suspend fun saveSagra(sagra: SagraInfo): Result<Unit>

    /** Elimina una sagra per ID */
    suspend fun deleteSagra(id: String): Result<Unit>

    /** Recupera una singola sagra per ID */
    suspend fun getSagraById(id: String): SagraInfo?
}

/**
 * Contratto per il repository AI (ML Kit + Gemini).
 */
interface AiExtractionRepository {
    /**
     * Esegue OCR on-device via ML Kit.
     * @return testo grezzo estratto dall'immagine
     */
    suspend fun recognizeTextFromBitmap(bitmap: Bitmap): Result<String>

    /**
     * Estrae informazioni strutturate via Gemini 2.5 Flash.
     * @param bitmap immagine originale
     * @param rawOcrText testo già estratto via ML Kit (context aggiuntivo per il modello)
     * @return SagraInfo strutturato
     */
    suspend fun extractStructuredData(
        bitmap: Bitmap,
        rawOcrText: String
    ): Result<SagraInfo>

    /** Estrae info da solo testo (voce, note). */
    suspend fun extractFromText(spokenText: String): Result<SagraInfo>
}
