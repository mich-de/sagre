package com.sagreai.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.TextSnippet
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.DirectionsCar
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.OpenInBrowser
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.RestaurantMenu
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Sell
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.SuggestionChipDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Card informativa con icona + titolo + contenuto flessibile.
 */
@Composable
fun InfoCard(
    icon: ImageVector,
    title: String,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable () -> Unit
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.SemiBold
                )
            }
            Spacer(modifier = Modifier.padding(top = 12.dp))
            content()
        }
    }
}

/**
 * Card per il MENU & PIATTI TIPICI + TAG DIETETICI.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CiboMenuCard(
    piatti: List<String>,
    tagDietetici: List<String>,
    modifier: Modifier = Modifier
) {
    if (piatti.isEmpty() && tagDietetici.isEmpty()) return

    InfoCard(
        icon = Icons.Outlined.RestaurantMenu,
        title = "COSA SI MANGIA & SPECIALITÀ",
        modifier = modifier
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (piatti.isNotEmpty()) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    piatti.forEach { piatto ->
                        SuggestionChip(
                            onClick = {},
                            label = { Text("🍽️ $piatto", style = MaterialTheme.typography.bodyMedium) },
                            colors = SuggestionChipDefaults.suggestionChipColors(
                                containerColor = MaterialTheme.colorScheme.secondaryContainer,
                                labelColor = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                        )
                    }
                }
            }

            if (tagDietetici.isNotEmpty()) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    tagDietetici.forEach { tag ->
                        AssistChip(
                            onClick = {},
                            label = { Text("🌱 $tag", style = MaterialTheme.typography.labelSmall) },
                            colors = AssistChipDefaults.assistChipColors(
                                containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                                labelColor = MaterialTheme.colorScheme.onTertiaryContainer
                            )
                        )
                    }
                }
            }
        }
    }
}

/**
 * Card per GUIDA AL BORGO & ATTRAZIONI.
 */
@Composable
fun GuidaBorgoCard(
    consigli: List<String>,
    modifier: Modifier = Modifier
) {
    if (consigli.isEmpty()) return

    InfoCard(
        icon = Icons.Outlined.Explore,
        title = "DA VISITARE NEL BORGO PRIMA DELLA SAGRA",
        modifier = modifier
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            consigli.forEach { consiglio ->
                Row(verticalAlignment = Alignment.Top) {
                    Text(
                        text = "🏰 ",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(end = 4.dp)
                    )
                    Text(
                        text = consiglio,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }
    }
}

/**
 * Card per le DATE — mostra chips per ogni data trovata.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DateCard(dates: List<String>, modifier: Modifier = Modifier) {
    if (dates.isEmpty()) return
    InfoCard(
        icon = Icons.Outlined.CalendarMonth,
        title = "DATE",
        modifier = modifier
    ) {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            dates.forEach { date ->
                SuggestionChip(
                    onClick = {},
                    label = { Text(date, style = MaterialTheme.typography.bodyMedium) },
                    colors = SuggestionChipDefaults.suggestionChipColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer,
                        labelColor = MaterialTheme.colorScheme.onPrimaryContainer
                    ),
                    border = SuggestionChipDefaults.suggestionChipBorder(
                        enabled = true,
                        borderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)
                    )
                )
            }
        }
    }
}

/**
 * Card per gli ORARI.
 */
@Composable
fun OrariCard(orari: List<String>, modifier: Modifier = Modifier) {
    if (orari.isEmpty()) return
    InfoCard(
        icon = Icons.Outlined.Schedule,
        title = "ORARI",
        modifier = modifier
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            orari.forEach { orario ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "•",
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(end = 8.dp)
                    )
                    Text(
                        text = orario,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }
    }
}

/**
 * Card per la LOCATION — tappabile per aprire la navigazione.
 */
@Composable
fun LocationCard(
    luogo: String?,
    indirizzo: String?,
    citta: String?,
    provincia: String?,
    onOpenMaps: () -> Unit,
    onOpenWaze: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val hasContent = listOf(luogo, indirizzo, citta, provincia).any { !it.isNullOrBlank() }
    if (!hasContent) return

    InfoCard(
        icon = Icons.Outlined.LocationOn,
        title = "DOVE",
        modifier = modifier
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            luogo?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.Medium
                )
            }
            indirizzo?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
            val cityText = listOfNotNull(citta, provincia?.let { "($it)" }).joinToString(" ")
            if (cityText.isNotBlank()) {
                Text(
                    text = cityText,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Row(
                modifier = Modifier.padding(top = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                AssistChip(
                    onClick = onOpenMaps,
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Outlined.LocationOn,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                    },
                    label = { Text("Google Maps", style = MaterialTheme.typography.labelMedium) },
                    colors = AssistChipDefaults.assistChipColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer,
                        labelColor = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                )

                if (onOpenWaze != null) {
                    AssistChip(
                        onClick = onOpenWaze,
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Outlined.DirectionsCar,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                        },
                        label = { Text("Waze", style = MaterialTheme.typography.labelMedium) },
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                            labelColor = MaterialTheme.colorScheme.onTertiaryContainer
                        )
                    )
                }
            }
        }
    }
}

/**
 * Card per PREZZI.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PrezziCard(prezzi: List<String>, modifier: Modifier = Modifier) {
    if (prezzi.isEmpty()) return
    InfoCard(
        icon = Icons.Outlined.Sell,
        title = "PREZZI",
        modifier = modifier
    ) {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            prezzi.forEach { prezzo ->
                AssistChip(
                    onClick = {},
                    label = { Text(prezzo, style = MaterialTheme.typography.bodySmall) },
                    colors = AssistChipDefaults.assistChipColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer,
                        labelColor = MaterialTheme.colorScheme.onSecondaryContainer
                    ),
                    border = AssistChipDefaults.assistChipBorder(
                        enabled = true,
                        borderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.3f)
                    )
                )
            }
        }
    }
}

/**
 * Card per CONTATTI.
 */
@Composable
fun ContattiCard(contatti: List<String>, modifier: Modifier = Modifier) {
    if (contatti.isEmpty()) return
    InfoCard(
        icon = Icons.Outlined.Phone,
        title = "CONTATTI",
        modifier = modifier
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            contatti.forEach { contatto ->
                Text(
                    text = contatto,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

/**
 * Card testo grezzo OCR (fallback offline).
 */
@Composable
fun RawTextCard(rawText: String, modifier: Modifier = Modifier) {
    if (rawText.isBlank()) return
    InfoCard(
        icon = Icons.AutoMirrored.Outlined.TextSnippet,
        title = "TESTO ESTRATTO",
        modifier = modifier
    ) {
        Text(
            text = rawText,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Card link per visualizzare il calendario Google.
 */
@Composable
fun CalendarViewCard(
    onOpenCalendar: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        onClick = onOpenCalendar,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Outlined.CalendarMonth,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
                Column {
                    Text(
                        text = "SagreAI - Calendario",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "Visualizza tutti gli eventi",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Icon(
                imageVector = Icons.Outlined.OpenInBrowser,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}
