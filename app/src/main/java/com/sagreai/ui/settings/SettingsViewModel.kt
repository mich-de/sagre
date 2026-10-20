package com.sagreai.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sagreai.data.local.DataStoreManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val dataStoreManager: DataStoreManager
) : ViewModel() {

    private val _apiKey = MutableStateFlow("")
    val apiKey: StateFlow<String> = _apiKey.asStateFlow()

    private val _saved = MutableStateFlow(false)
    val saved: StateFlow<Boolean> = _saved.asStateFlow()

    init {
        viewModelScope.launch {
            dataStoreManager.geminiApiKey.collect { key ->
                _apiKey.value = key
            }
        }
    }

    fun updateApiKey(newKey: String) {
        _apiKey.value = newKey
    }

    fun saveApiKey() {
        viewModelScope.launch {
            dataStoreManager.saveGeminiApiKey(_apiKey.value)
            _saved.value = true
            kotlinx.coroutines.delay(2000)
            _saved.value = false
        }
    }
}
