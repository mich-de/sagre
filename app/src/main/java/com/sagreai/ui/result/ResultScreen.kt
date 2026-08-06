package com.sagreai.ui.result

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.FileDownload
import androidx.compose.material.icons.outlined.OpenInBrowser
import androidx.compose.material.icons.outlined.RadioButtonChecked
import androidx.compose.material.icons.outlined.Radio
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.sagreai.ui.components.CalendarViewCard
import com.sagreai.ui.components.CiboMenuCard
import com.sagreai.ui.components.ContattiCard
import com.sagreai.ui.components.DateCard
import com.sagreai.ui.components.GuidaBorgoCard
import com.sagreai.ui.components.LocationCard
import com.sagreai.ui.components.OrariCard
import com.sagreai.ui.components.OsteChatBottomSheet
import com.sagreai.ui.components.PrezziCard
import com.sagreai.ui.components.RawTextCard
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ResultScreen(
    sagraId: String,
    onNavigateBack: () -> Unit,
    viewModel: ResultViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val isAudioPlaying by viewModel.isAudioPlaying.collectAsStateWithLifecycle()
    val chatMessages by viewModel.chatMessages.collectAsStateWithLifecycle()
    val isChatSending by viewModel.isChatSending.collectAsStateWithLifecycle()
    val isTranslating by viewModel.isTranslating.collectAsStateWithLifecycle()

    var showContent by remember { mutableStateOf(false) }
    var showCalendarDialog by remember { mutableStateOf(false) }
    var showOsteChat by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(sagraId) {
        viewModel.loadSagra(sagraId)
        delay(300)
        showContent = true
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .systemBarsPadding()
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is ResultUiState.Loading -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    }
                }

                is ResultUiState.Error -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(state.message, color = MaterialTheme.colorScheme.error)
                    }
                }

                is ResultUiState.Success -> {
                    val sagra = state.sagra

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                    ) {
                        if (sagra.imageUri != null) {
                            Box {
                                AsyncImage(
                                    model = sagra.imageUri,
                                    contentDescription = "Locandina sagra",
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(250.dp),
                                    contentScale = ContentScale.Crop
                                )
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(120.dp)
                                        .align(Alignment.BottomCenter)
                                        .background(
                                            androidx.compose.ui.graphics.Brush.verticalGradient(
                                                listOf(
                                                    MaterialTheme.colorScheme.background.copy(alpha = 0f),
                                                    MaterialTheme.colorScheme.background
                                                )
                                            )
                                        )
                                )
                            }
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            IconButton(onClick = onNavigateBack) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Indietro")
                            }
                            Row {
                                IconButton(onClick = { showCalendarDialog = true }) {
                                    Icon(Icons.Outlined.CalendarMonth, "Aggiungi a Calendario")
                                }
                                IconButton(onClick = {
                                    val shareText = buildShareText(sagra)
                                    val intent = Intent(Intent.ACTION_SEND).apply {
                                        type = "text/plain"
                                        putExtra(Intent.EXTRA_TEXT, shareText)
                                    }
                                    context.startActivity(Intent.createChooser(intent, "Condividi sagra"))
                                }) {
                                    Icon(Icons.Outlined.Share, "Condividi")
                                }
                                IconButton(onClick = {
                                    viewModel.deleteSagra(sagraId) { onNavigateBack() }
                                }) {
                                    Icon(
                                        Icons.Outlined.Delete,
                                        "Elimina",
                                        tint = MaterialTheme.colorScheme.error
                                    )
                                }
                            }
                        }

                        // Traduzione lingue
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "Lingua:",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            if (isTranslating) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                            } else {
                                listOf("IT" to "Italiano", "EN" to "English", "DE" to "Deutsch", "FR" to "Français", "ES" to "Español").forEach { (code, name) ->
                                    AssistChip(
                                        onClick = { if (code != "IT") viewModel.translateSagra(sagra, name) else viewModel.loadSagra(sagraId) },
                                        label = { Text(code, style = MaterialTheme.typography.labelSmall) },
                                        modifier = Modifier.height(28.dp)
                                    )
                                }
                            }
                        }

                        if (sagra.confidenceScore > 0f) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "Affidabilità AI:",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                LinearProgressIndicator(
                                    progress = { sagra.confidenceScore },
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(4.dp)
                                        .clip(RoundedCornerShape(2.dp)),
                                    color = when {
                                        sagra.confidenceScore > 0.7f -> MaterialTheme.colorScheme.primary
                                        sagra.confidenceScore > 0.4f -> MaterialTheme.colorScheme.tertiary
                                        else -> MaterialTheme.colorScheme.error
                                    }
                                )
                                Text(
                                    text = "${(sagra.confidenceScore * 100).toInt()}%",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        // Pulsanti d'azione rapidi: Radio Sagra + Chat Oste AI
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            val spotText = sagra.spotRadio ?: "Vieni alla sagra ${sagra.nomeSagra ?: ""}! Stand aperti e musica dal vivo!"
                            Button(
                                onClick = {
                                    if (isAudioPlaying) viewModel.stopRadioSpot() else viewModel.playRadioSpot(spotText)
                                },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(
                                    imageVector = if (isAudioPlaying) Icons.Outlined.RadioButtonChecked else Icons.Outlined.Radio,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.size(6.dp))
                                Text(if (isAudioPlaying) "Stop Radio" else "📻 Radio Sagra", style = MaterialTheme.typography.labelMedium)
                            }

                            OutlinedButton(
                                onClick = { showOsteChat = true },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Outlined.Chat,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.size(6.dp))
                                Text("💬 L'Oste AI", style = MaterialTheme.typography.labelMedium)
                            }
                        }

                        AnimatedVisibility(
                            visible = showContent,
                            enter = fadeIn(tween(400)) + slideInVertically(
                                initialOffsetY = { it / 4 },
                                animationSpec = tween(400)
                            )
                        ) {
                            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                                sagra.nomeSagra?.let { nome ->
                                    Text(
                                        text = nome,
                                        style = MaterialTheme.typography.headlineMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onBackground
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                }
                                sagra.descrizione?.let { desc ->
                                    Text(
                                        text = desc,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        val cards: List<@Composable () -> Unit> = listOf(
                            { CiboMenuCard(sagra.piattiTipici, sagra.tagDietetici, modifier = Modifier.padding(horizontal = 16.dp)) },
                            { GuidaBorgoCard(sagra.consigliBorgo, modifier = Modifier.padding(horizontal = 16.dp)) },
                            { DateCard(sagra.date, modifier = Modifier.padding(horizontal = 16.dp)) },
                            { OrariCard(sagra.orari, modifier = Modifier.padding(horizontal = 16.dp)) },
                            {
                                sagra.location?.let { loc ->
                                    LocationCard(
                                        luogo = loc.luogo,
                                        indirizzo = loc.indirizzo,
                                        citta = loc.citta,
                                        provincia = loc.provincia,
                                        onOpenMaps = {
                                            val query = Uri.encode(loc.fullAddress.ifBlank { loc.luogo ?: "" })
                                            val uri = Uri.parse("geo:0,0?q=$query")
                                            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                                                setPackage("com.google.android.apps.maps")
                                            }
                                            if (intent.resolveActivity(context.packageManager) != null) {
                                                context.startActivity(intent)
                                            } else {
                                                loc.mapsUrl?.let { url ->
                                                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                                }
                                            }
                                        },
                                        onOpenWaze = {
                                            val query = Uri.encode(loc.fullAddress.ifBlank { loc.luogo ?: "" })
                                            val uri = Uri.parse("https://waze.com/ul?q=$query&navigate=yes")
                                            context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                                        },
                                        modifier = Modifier.padding(horizontal = 16.dp)
                                    )
                                }
                            },
                            { PrezziCard(sagra.prezzi, modifier = Modifier.padding(horizontal = 16.dp)) },
                            { ContattiCard(sagra.contatti, modifier = Modifier.padding(horizontal = 16.dp)) },
                            { if (!sagra.hasContent) RawTextCard(sagra.rawText, modifier = Modifier.padding(horizontal = 16.dp)) }
                        )

                        cards.forEachIndexed { index, card ->
                            AnimatedVisibility(
                                visible = showContent,
                                enter = fadeIn(tween(300, delayMillis = 100 + index * 80)) +
                                        slideInVertically(
                                            initialOffsetY = { it / 3 },
                                            animationSpec = tween(300, delayMillis = 100 + index * 80)
                                        )
                            ) {
                                Column {
                                    card()
                                    Spacer(modifier = Modifier.height(8.dp))
                                }
                            }
                        }

                        AnimatedVisibility(
                            visible = showContent,
                            enter = fadeIn(tween(300)) + slideInVertically(initialOffsetY = { it / 3 })
                        ) {
                            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                                CalendarViewCard(
                                    onOpenCalendar = {
                                        context.startActivity(
                                            Intent(Intent.ACTION_VIEW, Uri.parse(viewModel.getCalendarViewUrl()))
                                        )
                                    }
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(48.dp))
                    }

                    if (showOsteChat) {
                        OsteChatBottomSheet(
                            sagraName = sagra.nomeSagra ?: "Sagra",
                            chatMessages = chatMessages,
                            isSending = isChatSending,
                            onSendMessage = { text -> viewModel.sendChatMessage(sagra, text) },
                            onDismiss = { showOsteChat = false },
                            sheetState = sheetState
                        )
                    }
                }
            }
        }
    }

    if (showCalendarDialog) {
        val sagra = (uiState as? ResultUiState.Success)?.sagra ?: return
        AlertDialog(
            onDismissRequest = { showCalendarDialog = false },
            title = {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Outlined.CalendarMonth, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Text("Aggiungi a Calendario")
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = sagra.nomeSagra ?: "Evento Sagra",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )

                    Text(
                        text = "Scegli la modalità di inserimento nel tuo calendario:",
                        style = MaterialTheme.typography.bodyMedium
                    )

                    HorizontalDivider()

                    Button(
                        onClick = {
                            showCalendarDialog = false
                            val intent = viewModel.createCalendarIntent(sagra)
                            context.startActivity(intent)
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Outlined.CalendarMonth, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
                        Text("Google Calendar (App Nativa)")
                    }

                    val singleIntents = remember(sagra) { viewModel.createSingleDayIntents(sagra) }
                    if (singleIntents.size > 1) {
                        Text(
                            text = "Oppure aggiungi un giorno specifico:",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        singleIntents.forEach { (dayLabel, intent) ->
                            OutlinedButton(
                                onClick = {
                                    showCalendarDialog = false
                                    context.startActivity(intent)
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("📍 $dayLabel")
                            }
                        }
                    }

                    OutlinedButton(
                        onClick = {
                            showCalendarDialog = false
                            val csUri = viewModel.generateIcsFile(sagra)
                            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/calendar"
                                putExtra(Intent.EXTRA_STREAM, csUri)
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }
                            context.startActivity(Intent.createChooser(shareIntent, "Condividi File Calendario (.ics)"))
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Outlined.FileDownload, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
                        Text("Esporta / Invia File .ics")
                    }

                    TextButton(
                        onClick = {
                            showCalendarDialog = false
                            context.startActivity(
                                Intent(Intent.ACTION_VIEW, Uri.parse(viewModel.getWebAddUrl(sagra)))
                            )
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Outlined.OpenInBrowser, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
                        Text("Google Calendar (Web)")
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showCalendarDialog = false }) {
                    Text("Annulla")
                }
            }
        )
    }
}

private fun buildShareText(sagra: com.sagreai.domain.model.SagraInfo): String = buildString {
    sagra.nomeSagra?.let { appendLine("🎪 $it") }
    if (sagra.date.isNotEmpty()) appendLine("📅 ${sagra.date.joinToString(", ")}")
    if (sagra.orari.isNotEmpty()) appendLine("🕐 ${sagra.orari.joinToString(", ")}")
    sagra.location?.let { loc ->
        if (loc.fullAddress.isNotBlank()) appendLine("📍 ${loc.fullAddress}")
    }
    if (sagra.piattiTipici.isNotEmpty()) appendLine("🍽️ ${sagra.piattiTipici.joinToString(", ")}")
    if (sagra.prezzi.isNotEmpty()) appendLine("🎫 ${sagra.prezzi.joinToString(", ")}")
    if (sagra.contatti.isNotEmpty()) appendLine("📞 ${sagra.contatti.joinToString(" | ")}")
    appendLine("\nEstratto con SagreAI 🤖")
}
