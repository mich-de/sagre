package com.sagreai.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(
    name = "sagreai_prefs"
)

/**
 * Manager per DataStore Preferences.
 * Gestisce la chiave API Gemini e le preferenze utente.
 *
 * NOTA: In produzione, considera di cifrare la chiave API con EncryptedSharedPreferences
 * o il nuovo datastore-tink (alpha) per maggiore sicurezza.
 */
@Singleton
class DataStoreManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val dataStore = context.dataStore

    companion object {
        val GEMINI_API_KEY = stringPreferencesKey("gemini_api_key")
        val THEME_KEY = stringPreferencesKey("theme") // "dark" | "light" | "system"
    }

    // ── API Key ──────────────────────────────────────────────────────────────

    val geminiApiKey: Flow<String> = dataStore.data.map { prefs ->
        prefs[GEMINI_API_KEY] ?: ""
    }

    suspend fun saveGeminiApiKey(apiKey: String) {
        dataStore.edit { prefs ->
            prefs[GEMINI_API_KEY] = apiKey.trim()
        }
        Timber.d("Gemini API key aggiornata (${apiKey.length} chars)")
    }

    // ── Tema ─────────────────────────────────────────────────────────────────

    val theme: Flow<String> = dataStore.data.map { prefs ->
        prefs[THEME_KEY] ?: "dark"
    }

    suspend fun saveTheme(theme: String) {
        dataStore.edit { prefs ->
            prefs[THEME_KEY] = theme
        }
    }
}
