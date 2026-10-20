package com.sagreai.ui.calendar

import android.Manifest
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Create
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sagreai.data.calendar.CalendarEventData
import com.sagreai.domain.model.SagraInfo
import com.sagreai.ui.components.AppTopBar
import com.sagreai.util.toDownsampledBitmap
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(
    onNavigateBack: () -> Unit,
    onNavigateToResult: (String) -> Unit,
    viewModel: CalendarViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    val cal = Calendar.getInstance()
    var currentMonth by remember { mutableStateOf(Pair(cal.get(Calendar.MONTH), cal.get(Calendar.YEAR))) }
    var selectedDate by remember { mutableStateOf<String?>(null) }
    var showChoiceDialog by remember { mutableStateOf(false) }
    var showManualDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf<CalendarEventData?>(null) }
    var editingEvent by remember { mutableStateOf<CalendarEventData?>(null) }

    val monthNames = arrayOf("Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic")
    val dayNames = arrayOf("Dom","Lun","Mar","Mer","Gio","Ven","Sab")
    val dateFmt = SimpleDateFormat("dd/MM/yyyy", Locale.ITALY)

    val hasReadPerm = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED
    val hasWritePerm = ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_CALENDAR) == PackageManager.PERMISSION_GRANTED

    val permLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()){ granted ->
        if(granted.values.all{it}){
            viewModel.loadEvents()
        }else{
            Toast.makeText(context, "Permessi calendario necessari", Toast.LENGTH_SHORT).show()
        }
    }

    LaunchedEffect(Unit){
        if(!hasReadPerm || !hasWritePerm){
            permLauncher.launch(arrayOf(Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR))
        }
    }

    LaunchedEffect(state.error){
        state.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    // Image picker for scanning
    val photoPickerLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        uri?.let {
            scope.launch {
                val bitmap = it.toDownsampledBitmap(context)
                bitmap?.let { bmp -> viewModel.scanPoster(bmp) }
            }
        }
    }

    val cameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        bitmap?.let { viewModel.scanPoster(it) }
    }

    // When scan succeeds, show manual dialog pre-filled
    LaunchedEffect(state.scannedData){
        state.scannedData?.let {
            showManualDialog = true
        }
    }

    // Choice dialog: scan or manual
    if(showChoiceDialog){
        AlertDialog(
            onDismissRequest = { showChoiceDialog = false },
            title = { Text("Nuovo evento") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { showChoiceDialog = false; cameraLauncher.launch(null) },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Outlined.CameraAlt, null, Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Scatta foto locandina")
                        }
                        OutlinedButton(
                            onClick = { showChoiceDialog = false; photoPickerLauncher.launch(PickVisualMediaRequest()) },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                        Icon(Icons.Outlined.PhotoLibrary, null, Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Scegli dalla galleria")
                    }
                    OutlinedButton(
                        onClick = { showChoiceDialog = false; viewModel.clearScannedData(); showManualDialog = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Outlined.Create, null, Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Inserisci manualmente")
                    }
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = { showChoiceDialog = false }){ Text("Annulla") } }
        )
    }

    // Manual / edit dialog
    if(showManualDialog){
        val sd = state.scannedData
        EventEditDialog(
            title = if(sd != null) "Modifica evento estratto" else "Nuovo evento",
            initialTitle = sd?.title ?: "",
            initialDate = sd?.date ?: (selectedDate ?: dateFmt.format(Date())),
            initialTime = sd?.time ?: "",
            initialLocation = sd?.location ?: "",
            initialDescription = sd?.description ?: "",
            onConfirm = { t,d,tm,l,desc ->
                viewModel.addEvent(t,d,tm,l,desc)
                showManualDialog = false
            },
            onDismiss = {
                showManualDialog = false
                viewModel.clearScannedData()
            }
        )
    }

    editingEvent?.let { ev ->
        val edCal = Calendar.getInstance().apply { timeInMillis = ev.dtStart }
        val edDate = dateFmt.format(edCal.time)
        val edTime = String.format("%02d:%02d", edCal.get(Calendar.HOUR_OF_DAY), edCal.get(Calendar.MINUTE))
        EventEditDialog(
            title = "Modifica evento",
            initialTitle = ev.title,
            initialDate = edDate,
            initialTime = edTime,
            initialLocation = ev.location ?: "",
            initialDescription = ev.description ?: "",
            onConfirm = { t,d,tm,l,desc ->
                viewModel.updateEvent(ev.eventId, t, d, tm, l, desc)
                editingEvent = null
            },
            onDismiss = { editingEvent = null }
        )
    }

    showDeleteDialog?.let { ev ->
        AlertDialog(
            onDismissRequest = { showDeleteDialog = null },
            title = { Text("Elimina evento") },
            text = { Text("Eliminare \"${ev.title}\" dal calendario?") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteEvent(ev.eventId)
                    showDeleteDialog = null
                }){ Text("Elimina", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = null }){ Text("Annulla") }
            }
        )
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "📅 Calendario",
                onNavigateBack = onNavigateBack,
                actions = {
                    if(state.isScanning){
                        CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(8.dp))
                    }
                    IconButton(onClick = { viewModel.loadEvents() }, enabled = !state.isLoadingEvents) {
                        if(state.isLoadingEvents){
                            CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.Refresh, "Aggiorna calendario", tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                    IconButton(onClick = { showChoiceDialog = true }) {
                        Icon(Icons.Default.Add, "Nuovo evento", tint = MaterialTheme.colorScheme.primary)
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(16.dp).verticalScroll(rememberScrollState())) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Column(Modifier.padding(16.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = {
                            currentMonth = if (currentMonth.first == 0) Pair(11, currentMonth.second - 1) else Pair(currentMonth.first - 1, currentMonth.second)
                            selectedDate = null
                        }) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, "Mese precedente") }
                        Text(monthNames[currentMonth.first] + " " + currentMonth.second, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                        IconButton(onClick = {
                            currentMonth = if (currentMonth.first == 11) Pair(0, currentMonth.second + 1) else Pair(currentMonth.first + 1, currentMonth.second)
                            selectedDate = null
                        }) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, "Mese successivo") }
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(Modifier.fillMaxWidth()) { dayNames.forEach { day -> Text(day, Modifier.weight(1f), textAlign = TextAlign.Center, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
                    Spacer(Modifier.height(4.dp))

                    cal.set(Calendar.DAY_OF_MONTH, 1)
                    cal.set(Calendar.MONTH, currentMonth.first)
                    cal.set(Calendar.YEAR, currentMonth.second)
                    val firstDay = cal.get(Calendar.DAY_OF_WEEK) - 1
                    val daysInMonth = cal.getActualMaximum(Calendar.DAY_OF_MONTH)
                    val datesWithEvents = viewModel.getDatesWithEvents()
                    val today = Calendar.getInstance()
                    val todayStr = String.format("%02d/%02d/%04d", today.get(Calendar.DAY_OF_MONTH), today.get(Calendar.MONTH) + 1, today.get(Calendar.YEAR))

                    Column {
                        var day = 1
                        for (row in 0..5) {
                            if (day > daysInMonth) break
                            Row(Modifier.fillMaxWidth()) {
                                for (col in 0..6) {
                                    if ((row == 0 && col < firstDay) || day > daysInMonth) {
                                        Box(Modifier.weight(1f).aspectRatio(1f))
                                    } else {
                                        val dateStr = String.format("%02d/%02d/%04d", day, currentMonth.first + 1, currentMonth.second)
                                        val hasEvent = datesWithEvents.contains(dateStr)
                                        val isSelected = selectedDate == dateStr
                                        val isToday = dateStr == todayStr
                                        Box(
                                            Modifier.weight(1f).aspectRatio(1f).clip(CircleShape)
                                                .background(if (isSelected) MaterialTheme.colorScheme.primary else Color.Transparent)
                                                .then(
                                                    if (isToday && !isSelected) Modifier.border(1.dp, MaterialTheme.colorScheme.primary, CircleShape)
                                                    else Modifier
                                                )
                                                .clickable { selectedDate = if (isSelected) null else dateStr },
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text(day.toString(), fontSize = 14.sp, color = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface)
                                                if (hasEvent) Box(Modifier.size(4.dp).clip(CircleShape).background(if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.primary))
                                            }
                                        }
                                        day++
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            if (selectedDate != null) {
                Text("Eventi del " + selectedDate!!, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                Spacer(Modifier.height(8.dp))

                val calEvents = viewModel.getCalEventsForDate(selectedDate!!)
                val sagreEvents = viewModel.getEventsForDate(selectedDate!!)

                if (calEvents.isEmpty() && sagreEvents.isEmpty()) {
                    EmptyCalendarState(
                        emoji = "🗓️",
                        title = "Nessun evento in questa data",
                        subtitle = "Aggiungi il primo evento per questo giorno"
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(onClick = { showChoiceDialog = true }, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Default.Add, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Nuovo evento")
                    }
                } else {
                    calEvents.forEach { ev ->
                        val timeCal = Calendar.getInstance().apply { timeInMillis = ev.dtStart }
                        val timeStr = String.format("%02d:%02d", timeCal.get(Calendar.HOUR_OF_DAY), timeCal.get(Calendar.MINUTE))
                        Card(
                            onClick = { editingEvent = ev },
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                        ) {
                            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Outlined.CalendarMonth, null, tint = MaterialTheme.colorScheme.primary)
                                Spacer(Modifier.width(12.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(ev.title, fontWeight = FontWeight.Bold)
                                    if (ev.location != null) Text(ev.location, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Text(timeStr, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                IconButton(onClick = { showDeleteDialog = ev }) {
                                    Icon(Icons.Default.Delete, "Elimina", tint = MaterialTheme.colorScheme.error)
                                }
                            }
                        }
                    }
                    sagreEvents.forEach { sagra ->
                        Card(
                            onClick = { onNavigateToResult(sagra.id) },
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                        ) {
                            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Outlined.CalendarMonth, null, tint = MaterialTheme.colorScheme.primary)
                                Spacer(Modifier.width(12.dp))
                                Column {
                                    Text(sagra.nomeSagra ?: "Sagra", fontWeight = FontWeight.Bold)
                                    sagra.location?.citta?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                                }
                            }
                        }
                    }
                }
            } else {
                EmptyCalendarState(
                    emoji = "📌",
                    title = "Tocca una data",
                    subtitle = "Seleziona un giorno per vedere gli eventi in programma"
                )
            }
        }
    }
}

@Composable
private fun EmptyCalendarState(emoji: String, title: String, subtitle: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(emoji, style = MaterialTheme.typography.displayMedium)
        Spacer(Modifier.height(4.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
    }
}

@Composable
fun EventEditDialog(
    title:String,
    initialTitle:String,
    initialDate:String,
    initialTime:String,
    initialLocation:String,
    initialDescription:String,
    onConfirm:(title:String,date:String,time:String,location:String,description:String)->Unit,
    onDismiss:()->Unit
){
    var eventTitle by remember { mutableStateOf(initialTitle) }
    var eventDate by remember { mutableStateOf(initialDate) }
    var eventTime by remember { mutableStateOf(initialTime) }
    var eventLocation by remember { mutableStateOf(initialLocation) }
    var eventDescription by remember { mutableStateOf(initialDescription) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = eventTitle, onValueChange = { eventTitle = it }, label = { Text("Titolo") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = eventDate, onValueChange = { eventDate = it }, label = { Text("Data (gg/mm/aaaa)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = eventTime, onValueChange = { eventTime = it }, label = { Text("Ora (hh:mm, opzionale)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = eventLocation, onValueChange = { eventLocation = it }, label = { Text("Luogo (opzionale)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = eventDescription, onValueChange = { eventDescription = it }, label = { Text("Descrizione (opzionale)") }, minLines = 2, modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {
            TextButton(onClick = {
                if(eventTitle.isNotBlank() && eventDate.isNotBlank()){
                    onConfirm(eventTitle.trim(), eventDate.trim(), eventTime.trim(), eventLocation.trim(), eventDescription.trim())
                }
            }){ Text("Salva") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss){ Text("Annulla") }
        }
    )
}
