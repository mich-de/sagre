package com.sagreai.ui.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sagreai.domain.model.SagraInfo
import com.sagreai.domain.usecase.DeleteSagraUseCase
import com.sagreai.domain.usecase.GetHistoryUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HistoryViewModel @Inject constructor(
    getHistoryUseCase: GetHistoryUseCase,
    private val deleteSagraUseCase: DeleteSagraUseCase
) : ViewModel() {

    private val _selectedCategory = MutableStateFlow("Tutte")
    val selectedCategory: StateFlow<String> = _selectedCategory

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery

    val sagre: StateFlow<List<SagraInfo>> = combine(
        getHistoryUseCase(),
        _selectedCategory,
        _searchQuery
    ) { list, cat, query ->
        list.filter { sagra ->
            val matchesCategory = if (cat == "Tutte") true else sagra.categoria?.contains(cat, ignoreCase = true) == true
            val matchesQuery = if (query.isBlank()) true else {
                (sagra.nomeSagra?.contains(query, ignoreCase = true) == true) ||
                        (sagra.location?.citta?.contains(query, ignoreCase = true) == true) ||
                        (sagra.piattiTipici.any { it.contains(query, ignoreCase = true) })
            }
            matchesCategory && matchesQuery
        }
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = emptyList()
    )

    fun selectCategory(cat: String) {
        _selectedCategory.value = cat
    }

    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun deleteSagra(id: String) {
        viewModelScope.launch {
            deleteSagraUseCase(id)
        }
    }
}
