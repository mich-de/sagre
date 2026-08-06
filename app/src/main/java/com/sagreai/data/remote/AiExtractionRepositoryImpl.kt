package com.sagreai.data.remote

import android.graphics.Bitmap
import com.sagreai.domain.model.SagraInfo
import com.sagreai.domain.repository.AiExtractionRepository
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Implementazione concreta di [AiExtractionRepository].
 * Combina ML Kit (OCR) e Gemini (structured extraction).
 */
@Singleton
class AiExtractionRepositoryImpl @Inject constructor(
    private val mlKitRepo: MlKitTextRepository,
    private val geminiRepo: GeminiExtractionRepository
) : AiExtractionRepository {

    override suspend fun recognizeTextFromBitmap(bitmap: Bitmap): Result<String> =
        mlKitRepo.recognizeText(bitmap)

    override suspend fun extractStructuredData(
        bitmap: Bitmap,
        rawOcrText: String
    ): Result<SagraInfo> =
        geminiRepo.extractSagraInfo(bitmap, rawOcrText)

    override suspend fun extractFromText(spokenText: String): Result<SagraInfo> =
        geminiRepo.extractFromText(spokenText)
}
