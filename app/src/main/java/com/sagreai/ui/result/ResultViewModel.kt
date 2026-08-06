package com.sagreai.ui.result

import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sagreai.data.audio.RadioSagraPlayer
import com.sagreai.data.calendar.CalendarIntegration
import com.sagreai.data.remote.GeminiExtractionRepository
import com.sagreai.domain.model.SagraInfo
import com.sagreai.domain.usecase.DeleteSagraUseCase
import com.sagreai.domain.usecase.GetSagraByIdUseCase
import com.sagreai.domain.usecase.SaveSagraUseCase
import com.sagreai.ui.components.ChatMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

sealed class ResultUiState {
    object Loading : ResultUiState()
    data class Success(val sagra: SagraInfo) : ResultUiState()
    data class Error(val message: String) : ResultUiState()
}

@HiltViewModel
class ResultViewModel @Inject constructor(
    private val getSagraByIdUseCase: GetSagraByIdUseCase,
    private val deleteSagraUseCase: DeleteSagraUseCase,
    private val saveSagraUseCase: SaveSagraUseCase,
    private val calendarIntegration: CalendarIntegration,
    private val geminiExtractionRepository: GeminiExtractionRepository,
    private val radioSagraPlayer: RadioSagraPlayer
) : ViewModel() {

    private val _uiState = MutableStateFlow<ResultUiState>(ResultUiState.Loading)
    val uiState: StateFlow<ResultUiState> = _uiState.asStateFlow()

    private val _chatMessages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val chatMessages: StateFlow<List<ChatMessage>> = _chatMessages.asStateFlow()

    private val _isChatSending = MutableStateFlow(false)
    val isChatSending: StateFlow<Boolean> = _isChatSending.asStateFlow()

    private val _isTranslating = MutableStateFlow(false)
    val isTranslating: StateFlow<Boolean> = _isTranslating.asStateFlow()

    val isAudioPlaying: StateFlow<Boolean> = radioSagraPlayer.isPlaying

    fun loadSagra(sagraId: String) {
        viewModelScope.launch {
            val sagra = getSagraByIdUseCase(sagraId)
            _uiState.value = if (sagra != null) {
                ResultUiState.Success(sagra)
            } else {
                ResultUiState.Error("Sagra non trovata")
            }
        }
    }

    fun deleteSagra(sagraId: String, onDeleted: () -> Unit) {
        viewModelScope.launch {
            radioSagraPlayer.stop()
            deleteSagraUseCase(sagraId)
            onDeleted()
        }
    }

    fun playRadioSpot(text: String) {
        radioSagraPlayer.speak(text)
    }

    fun stopRadioSpot() {
        radioSagraPlayer.stop()
    }

    fun sendChatMessage(sagra: SagraInfo, userText: String) {
        if (userText.isBlank()) return
        val currentList = _chatMessages.value.toMutableList()
        currentList.add(ChatMessage("user", userText))
        _chatMessages.value = currentList

        _isChatSending.value = true
        viewModelScope.launch {
            val history = currentList.map { Pair(it.sender, it.text) }
            val result = geminiExtractionRepository.chatWithOste(sagra, history, userText)
            _isChatSending.value = false
            result.fold(
                onSuccess = { reply ->
                    val newList = _chatMessages.value.toMutableList()
                    newList.add(ChatMessage("oste", reply))
                    _chatMessages.value = newList
                },
                onFailure = {
                    val newList = _chatMessages.value.toMutableList()
                    newList.add(ChatMessage("oste", "Ostregheta! Ho un piccolo problema di connessione."))
                    _chatMessages.value = newList
                }
            )
        }
    }

    fun translateSagra(sagra: SagraInfo, targetLang: String) {
        _isTranslating.value = true
        viewModelScope.launch {
            val res = geminiExtractionRepository.translateSagra(sagra, targetLang)
            _isTranslating.value = false
            res.onSuccess { translated ->
                _uiState.value = ResultUiState.Success(translated)
            }
        }
    }

    fun createCalendarIntent(sagra: SagraInfo): Intent =
        calendarIntegration.createAddIntent(sagra)

    fun createSingleDayIntents(sagra: SagraInfo): List<Pair<String, Intent>> =
        calendarIntegration.createSingleDayIntents(sagra)

    fun generateIcsFile(sagra: SagraInfo): Uri =
        calendarIntegration.generateIcsFile(sagra)

    fun getCalendarViewUrl(): String =
        calendarIntegration.createCalendarViewUrl()

    fun getWebAddUrl(sagra: SagraInfo): String =
        calendarIntegration.createWebAddUrl(sagra)

    override fun onCleared() {
        super.onCleared()
        radioSagraPlayer.stop()
    }
}
