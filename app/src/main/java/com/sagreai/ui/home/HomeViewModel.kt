package com.sagreai.ui.home

import android.graphics.Bitmap
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sagreai.data.ImageStorageUtil
import com.sagreai.domain.model.ExtractionState
import com.sagreai.domain.model.SagraInfo
import com.sagreai.domain.repository.AiExtractionRepository
import com.sagreai.domain.usecase.ExtractSagraUseCase
import com.sagreai.domain.usecase.SaveSagraUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val extractSagraUseCase: ExtractSagraUseCase,
    private val saveSagraUseCase: SaveSagraUseCase,
    private val aiRepo: AiExtractionRepository,
    private val imageStorageUtil: ImageStorageUtil
) : ViewModel() {

    private val _extractionState = MutableStateFlow<ExtractionState>(ExtractionState.Idle)
    val extractionState: StateFlow<ExtractionState> = _extractionState.asStateFlow()

    private val _lastExtractedSagraId = MutableStateFlow<String?>(null)
    val lastExtractedSagraId: StateFlow<String?> = _lastExtractedSagraId.asStateFlow()

    fun extractFromBitmap(bitmap: Bitmap, sourceUri: Uri? = null) {
        viewModelScope.launch {
            extractSagraUseCase(bitmap).collect { state ->
                _extractionState.value = state
                if (state is ExtractionState.Success) {
                    val persistentUri = sourceUri?.let { imageStorageUtil.copyToInternal(it) }
                        ?: imageStorageUtil.saveBitmap(bitmap)
                    val sagraWithUri = state.sagra.copy(
                        imageUri = persistentUri
                    )
                    saveSagraUseCase(sagraWithUri)
                    _lastExtractedSagraId.value = sagraWithUri.id
                    Timber.d("Sagra salvata: ${sagraWithUri.id}")
                }
            }
        }
    }

    fun extractFromVoice(spokenText: String) {
        viewModelScope.launch {
            _extractionState.value = ExtractionState.LoadingAi(rawText = spokenText)
            val result = aiRepo.extractFromText(spokenText)
            result.onSuccess { sagra ->
                saveSagraUseCase(sagra)
                _extractionState.value = ExtractionState.Success(sagra)
                _lastExtractedSagraId.value = sagra.id
                Timber.d("Sagra da voce: ${sagra.nomeSagra}")
            }.onFailure { e ->
                _extractionState.value = ExtractionState.PartialResult(
                    rawText = spokenText,
                    reason = "Analisi vocale fallita: ${e.message}"
                )
            }
        }
    }

    fun resetState() {
        _extractionState.value = ExtractionState.Idle
        _lastExtractedSagraId.value = null
    }
}
