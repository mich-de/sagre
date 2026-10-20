package com.sagreai.di

import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.generationConfig
import com.sagreai.BuildConfig
import com.sagreai.data.local.DataStoreManager
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import timber.log.Timber
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AiModule {

    /**
     * Fornisce il GenerativeModel di Gemini 2.5 Flash.
     *
     * La chiave API viene letta in questo ordine di priorità:
     * 1. DataStore (inserita dall'utente nella Settings screen)
     * 2. BuildConfig (compilata da local.properties)
     *
     * NOTA: Il modello è lazy-singleton. Se l'utente aggiorna la chiave
     * in-app, la app si riavvia o la DI viene gestita dinamicamente.
     */
    @Provides
    @Singleton
    fun provideGenerativeModel(
        dataStoreManager: DataStoreManager
    ): GenerativeModel {
        // Legge la API key dal DataStore (sincrono solo all'init)
        val savedKey = runBlocking {
            runCatching { dataStoreManager.geminiApiKey.first() }.getOrNull() ?: ""
        }

        val apiKey = savedKey.ifBlank { BuildConfig.GEMINI_API_KEY }

        if (apiKey.isBlank()) {
            Timber.w("⚠️ Gemini API key non configurata. Imposta la chiave in Settings.")
        }

        return GenerativeModel(
            // gemini-3.6-flash: ultimo modello Flash (21 lug 2026) — FREE TIER su AI Studio
            // Più veloce e più intelligente di 2.5-flash, stesso piano gratuito
            modelName = "gemini-3.6-flash",
            apiKey = apiKey,
            generationConfig = generationConfig {
                temperature = 0.1f         // Bassa creatività → output più deterministico
                topK = 1
                topP = 0.95f
                maxOutputTokens = 2048
                responseMimeType = "application/json"
            }
        )
    }
}
