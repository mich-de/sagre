package com.sagreai.data.remote

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.tasks.await
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository ML Kit per OCR on-device.
 *
 * Utilizza Text Recognition v2 con il modello latino (supporta italiano).
 * Completamente offline, latenza ~300-800ms su hardware moderno.
 */
@Singleton
class MlKitTextRepository @Inject constructor() {

    // TextRecognizer è threadsafe e può essere condiviso (Singleton)
    private val recognizer by lazy {
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    }

    /**
     * Riconosce il testo in un Bitmap.
     * @return Result<String> con tutto il testo estratto (blocchi uniti da newline)
     */
    suspend fun recognizeText(bitmap: Bitmap): Result<String> = runCatching {
        val image = InputImage.fromBitmap(bitmap, 0)
        val result = recognizer.process(image).await()

        // Unisce tutti i blocchi di testo mantenendo la struttura a righe
        val fullText = result.textBlocks.joinToString(separator = "\n\n") { block ->
            block.lines.joinToString(separator = "\n") { line ->
                line.text.trim()
            }
        }

        Timber.d("ML Kit OCR: ${result.textBlocks.size} blocchi, ${fullText.length} caratteri")
        fullText
    }.onFailure { e ->
        Timber.e(e, "ML Kit OCR error")
    }
}
