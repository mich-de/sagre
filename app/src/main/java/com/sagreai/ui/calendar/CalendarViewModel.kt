package com.sagreai.ui.calendar

import android.graphics.Bitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sagreai.data.calendar.CalendarEventData
import com.sagreai.data.calendar.CalendarIntegration
import com.sagreai.domain.model.SagraInfo
import com.sagreai.domain.usecase.ExtractSagraUseCase
import com.sagreai.domain.usecase.GetHistoryUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import javax.inject.Inject

data class CalendarDay(val date:String,val events:List<SagraInfo>)

data class ScannedSagraData(
    val title:String,
    val date:String,
    val time:String,
    val location:String,
    val description:String
)

data class CalendarUiState(
    val calEvents:List<CalendarEventData> = emptyList(),
    val sagre:List<SagraInfo> = emptyList(),
    val scannedData:ScannedSagraData? = null,
    val isScanning:Boolean = false,
    val isLoadingEvents:Boolean = false,
    val error:String? = null
)

@HiltViewModel
class CalendarViewModel @Inject constructor(
    private val getHistoryUseCase:GetHistoryUseCase,
    private val calendarIntegration: CalendarIntegration,
    private val extractSagraUseCase: ExtractSagraUseCase
):ViewModel(){
    private val _state = MutableStateFlow(CalendarUiState())
    val state: StateFlow<CalendarUiState> = _state.asStateFlow()

    init{
        loadEvents()
        viewModelScope.launch{
            getHistoryUseCase().collect{sagre->
                _state.value = _state.value.copy(sagre=sagre)
            }
        }
    }

    fun loadEvents(){
        viewModelScope.launch{
            _state.value = _state.value.copy(isLoadingEvents = true)
            try{
                val events = calendarIntegration.getEvents()
                _state.value = _state.value.copy(calEvents=events, error=null, isLoadingEvents=false)
            }catch(e:Exception){
                _state.value = _state.value.copy(error=e.message, isLoadingEvents=false)
            }
        }
    }

    fun scanPoster(bitmap: Bitmap){
        _state.value = _state.value.copy(isScanning = true, error = null)
        viewModelScope.launch{
            extractSagraUseCase(bitmap).collect{ extraction ->
                when(extraction){
                    is com.sagreai.domain.model.ExtractionState.Success -> {
                        val s = extraction.sagra
                        val dateStr = s.date.firstOrNull()?.let {
                            calendarIntegration.expandDateString(it).firstOrNull() ?: ""
                        } ?: ""
                        val timeStr = s.orari.firstOrNull()?.let { t ->
                            val m = java.util.regex.Pattern.compile("(\\d{1,2})[:.](\\d{2})").matcher(t)
                            if(m.find()) "${m.group(1)}:${m.group(2)}" else ""
                        } ?: ""
                        val loc = s.location?.let { listOfNotNull(it.luogo, it.citta).joinToString(", ") } ?: ""
                        _state.value = _state.value.copy(
                            isScanning = false,
                            scannedData = ScannedSagraData(
                                title = s.nomeSagra ?: "",
                                date = dateStr,
                                time = timeStr,
                                location = loc,
                                description = s.descrizione ?: ""
                            )
                        )
                    }
                    is com.sagreai.domain.model.ExtractionState.LoadingOcr,
                    is com.sagreai.domain.model.ExtractionState.LoadingAi -> {
                        _state.value = _state.value.copy(isScanning = true)
                    }
                    is com.sagreai.domain.model.ExtractionState.Error -> {
                        _state.value = _state.value.copy(
                            isScanning = false,
                            error = extraction.message
                        )
                    }
                    is com.sagreai.domain.model.ExtractionState.PartialResult -> {
                        _state.value = _state.value.copy(
                            isScanning = false,
                            error = "Testo non riconosciuto: ${extraction.reason}"
                        )
                    }
                    else -> {}
                }
            }
        }
    }

    fun clearScannedData(){
        _state.value = _state.value.copy(scannedData = null)
    }

    fun addEvent(title:String,dateStr:String,timeStr:String,location:String,description:String){
        viewModelScope.launch{
            try{
                val cal = Calendar.getInstance()
                val dateFmt = SimpleDateFormat("dd/MM/yyyy", Locale.ITALY)
                cal.time = dateFmt.parse(dateStr) ?: Date()
                if(timeStr.isNotBlank()){
                    val parts = timeStr.split(":")
                    if(parts.size==2){
                        cal.set(Calendar.HOUR_OF_DAY, parts[0].toIntOrNull()?:0)
                        cal.set(Calendar.MINUTE, parts[1].toIntOrNull()?:0)
                    }
                }else{
                    cal.set(Calendar.HOUR_OF_DAY,10)
                    cal.set(Calendar.MINUTE,0)
                }
                cal.set(Calendar.SECOND,0)
                cal.set(Calendar.MILLISECOND,0)
                val start = cal.timeInMillis
                val end = start + 3*60*60*1000L
                calendarIntegration.addEventRaw(title, description, location, start, end)
                    .onSuccess {
                        loadEvents()
                        clearScannedData()
                    }
                    .onFailure { _state.value = _state.value.copy(error=it.message) }
            }catch(e:Exception){
                _state.value = _state.value.copy(error=e.message)
            }
        }
    }

    fun updateEvent(eventId:Long,title:String,dateStr:String,timeStr:String,location:String,description:String){
        viewModelScope.launch{
            try{
                val cal = Calendar.getInstance()
                val dateFmt = SimpleDateFormat("dd/MM/yyyy", Locale.ITALY)
                cal.time = dateFmt.parse(dateStr) ?: Date()
                if(timeStr.isNotBlank()){
                    val parts = timeStr.split(":")
                    if(parts.size==2){
                        cal.set(Calendar.HOUR_OF_DAY, parts[0].toIntOrNull()?:0)
                        cal.set(Calendar.MINUTE, parts[1].toIntOrNull()?:0)
                    }
                }else{
                    cal.set(Calendar.HOUR_OF_DAY,10)
                    cal.set(Calendar.MINUTE,0)
                }
                cal.set(Calendar.SECOND,0)
                cal.set(Calendar.MILLISECOND,0)
                val start = cal.timeInMillis
                val end = start + 3*60*60*1000L
                calendarIntegration.updateEventRaw(eventId, title, description, location, start, end)
                    .onSuccess { loadEvents() }
                    .onFailure { _state.value = _state.value.copy(error=it.message) }
            }catch(e:Exception){
                _state.value = _state.value.copy(error=e.message)
            }
        }
    }

    fun deleteEvent(eventId:Long){
        viewModelScope.launch{
            calendarIntegration.deleteEvent(eventId)
                .onSuccess { loadEvents() }
                .onFailure { _state.value = _state.value.copy(error=it.message) }
        }
    }

    fun getEventsForDate(dateStr:String):List<SagraInfo>{
        return _state.value.sagre.filter{ s ->
            s.date.any { d ->
                calendarIntegration.expandDateString(d).any { it == dateStr }
            }
        }
    }

    fun getCalEventsForDate(dateStr:String):List<CalendarEventData>{
        val dateFmt = SimpleDateFormat("dd/MM/yyyy", Locale.ITALY)
        return _state.value.calEvents.filter{ ev ->
            val start = dateFmt.format(Date(ev.dtStart))
            val end = dateFmt.format(Date(ev.dtEnd))
            if (start == end) {
                start == dateStr
            } else {
                val cal = java.util.Calendar.getInstance()
                cal.timeInMillis = ev.dtStart
                val fmt = SimpleDateFormat("dd/MM/yyyy", Locale.ITALY)
                while (cal.timeInMillis < ev.dtEnd) {
                    if (fmt.format(cal.time) == dateStr) return@filter true
                    cal.add(java.util.Calendar.DAY_OF_MONTH, 1)
                }
                false
            }
        }
    }

    fun getDatesWithEvents(): Set<String> {
        val dateFmt = SimpleDateFormat("dd/MM/yyyy", Locale.ITALY)
        val dates = mutableSetOf<String>()
        dates.addAll(_state.value.calEvents.map { dateFmt.format(Date(it.dtStart)) })
        for (s in _state.value.sagre) {
            for (d in s.date) {
                dates.addAll(calendarIntegration.expandDateString(d))
            }
        }
        return dates
    }

    fun clearError(){ _state.value = _state.value.copy(error=null) }
}
