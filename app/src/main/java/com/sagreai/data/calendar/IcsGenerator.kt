package com.sagreai.data.calendar

import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import com.sagreai.domain.model.SagraInfo
import java.io.File
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID

object IcsGenerator {

    private val UTC_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'", Locale.US)
    private val ROME_ZONE = ZoneId.of("Europe/Rome")
    private val UTC_ZONE = ZoneId.of("UTC")

    fun generateIcsFile(context: Context, sagra: SagraInfo, dateList: List<LocalDate>, startTime: LocalTime?, endTime: LocalTime?): Uri {
        val csDir = File(context.cacheDir, "ics_events")
        if (!csDir.exists()) csDir.mkdirs()

        val safeName = (sagra.nomeSagra ?: "sagra")
            .lowercase(Locale.ROOT)
            .replace(Regex("[^a-z0-9]"), "_")
            .take(20)
        val file = File(csDir, "${safeName}_${System.currentTimeMillis()}.ics")

        val content = buildString {
            appendLine("BEGIN:VCALENDAR")
            appendLine("VERSION:2.0")
            appendLine("PRODID:-//SagreAI//Android App//IT")
            appendLine("CALSCALE:GREGORIAN")
            appendLine("METHOD:PUBLISH")

            val startT = startTime ?: LocalTime.of(19, 0)
            val endT = endTime ?: LocalTime.of(23, 59)

            for (date in dateList) {
                val startLdt = LocalDateTime.of(date, startT)
                val endLdt = LocalDateTime.of(date, endT)

                val startUtc = startLdt.atZone(ROME_ZONE).withZoneSameInstant(UTC_ZONE)
                val endUtc = endLdt.atZone(ROME_ZONE).withZoneSameInstant(UTC_ZONE)
                val dtStamp = LocalDateTime.now().atZone(ROME_ZONE).withZoneSameInstant(UTC_ZONE)

                appendLine("BEGIN:VEVENT")
                appendLine("UID:${UUID.randomUUID()}@sagreai.app")
                appendLine("DTSTAMP:${dtStamp.format(UTC_FORMATTER)}")
                appendLine("DTSTART:${startUtc.format(UTC_FORMATTER)}")
                appendLine("DTEND:${endUtc.format(UTC_FORMATTER)}")
                appendLine("SUMMARY:${escapeIcsText(sagra.nomeSagra ?: "Evento Sagra")}")

                val desc = buildDescription(sagra)
                if (desc.isNotBlank()) {
                    appendLine("DESCRIPTION:${escapeIcsText(desc)}")
                }

                sagra.location?.fullAddress?.takeIf { it.isNotBlank() }?.let { loc ->
                    appendLine("LOCATION:${escapeIcsText(loc)}")
                }

                appendLine("STATUS:CONFIRMED")
                appendLine("BEGIN:VALARM")
                appendLine("TRIGGER:-PT2H")
                appendLine("ACTION:DISPLAY")
                appendLine("DESCRIPTION:Promemoria Sagra")
                appendLine("END:VALARM")
                appendLine("END:VEVENT")
            }

            appendLine("END:VCALENDAR")
        }

        file.writeText(content, kotlin.text.Charsets.UTF_8)

        val authority = "${context.packageName}.fileprovider"
        return FileProvider.getUriForFile(context, authority, file)
    }

    private fun escapeIcsText(text: String): String {
        return text
            .replace("\\", "\\\\")
            .replace(";", "\\;")
            .replace(",", "\\,")
            .replace("\n", "\\n")
    }

    private fun buildDescription(sagra: SagraInfo): String = buildString {
        sagra.descrizione?.let { appendLine(it) }
        if (sagra.orari.isNotEmpty()) appendLine("Orari: ${sagra.orari.joinToString(", ")}")
        if (sagra.prezzi.isNotEmpty()) appendLine("Prezzi: ${sagra.prezzi.joinToString(", ")}")
        if (sagra.contatti.isNotEmpty()) appendLine("Contatti: ${sagra.contatti.joinToString(" | ")}")
        append("Estratto con SagreAI")
    }
}
