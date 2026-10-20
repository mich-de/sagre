package com.sagreai.data.calendar

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.CalendarContract
import com.sagreai.domain.model.SagraInfo
import dagger.hilt.android.qualifiers.ApplicationContext
import java.net.URLEncoder
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.TimeZone
import java.util.regex.Pattern
import javax.inject.Inject
import javax.inject.Singleton

data class CalendarEventData(
    val eventId: Long,
    val title: String,
    val description: String?,
    val location: String?,
    val dtStart: Long,
    val dtEnd: Long
)

@Singleton
class CalendarIntegration @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        const val TARGET_CALENDAR_ID = "9232185f0f5eae2ebb71abf4b7713de7e540ffdc674c0295be6c9bae615a8f45@group.calendar.google.com"
        val ROME_ZONE: ZoneId = ZoneId.of("Europe/Rome")
    }

    fun addEventRaw(title: String, description: String?, location: String?, dtStart: Long, dtEnd: Long): Result<Long> = runCatching {
        val calId = findLocalCalendarId() ?: throw Exception("Calendario non trovato")
        val values = ContentValues().apply {
            put(CalendarContract.Events.CALENDAR_ID, calId)
            put(CalendarContract.Events.TITLE, title)
            put(CalendarContract.Events.DESCRIPTION, description ?: "")
            put(CalendarContract.Events.EVENT_LOCATION, location ?: "")
            put(CalendarContract.Events.DTSTART, dtStart)
            put(CalendarContract.Events.DTEND, dtEnd)
            put(CalendarContract.Events.ALL_DAY, 0)
            put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
        }
        val uri = context.contentResolver.insert(CalendarContract.Events.CONTENT_URI, values)
            ?: throw Exception("Inserimento fallito")
        ContentUris.parseId(uri)
    }

    fun updateEventRaw(eventId: Long, title: String, description: String?, location: String?, dtStart: Long, dtEnd: Long): Result<Unit> = runCatching {
        val values = ContentValues().apply {
            put(CalendarContract.Events.TITLE, title)
            put(CalendarContract.Events.DESCRIPTION, description ?: "")
            put(CalendarContract.Events.EVENT_LOCATION, location ?: "")
            put(CalendarContract.Events.DTSTART, dtStart)
            put(CalendarContract.Events.DTEND, dtEnd)
            put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
        }
        val uri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId)
        context.contentResolver.update(uri, values, null, null)
    }

    private var cachedCalendarId: Long? = null

    fun findLocalCalendarId(): Long? {
        cachedCalendarId?.let { return it }

        val projection = arrayOf(
            CalendarContract.Calendars._ID,
            CalendarContract.Calendars.OWNER_ACCOUNT,
            CalendarContract.Calendars.ACCOUNT_NAME,
            CalendarContract.Calendars.NAME,
            CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
            CalendarContract.Calendars._SYNC_ID
        )

        val sel = listOf(
            CalendarContract.Calendars.OWNER_ACCOUNT,
            CalendarContract.Calendars.ACCOUNT_NAME,
            CalendarContract.Calendars.NAME,
            CalendarContract.Calendars.CALENDAR_DISPLAY_NAME
        ).joinToString(" OR ") { "$it = ?" }
        val args = arrayOf(TARGET_CALENDAR_ID, TARGET_CALENDAR_ID, TARGET_CALENDAR_ID, TARGET_CALENDAR_ID)

        context.contentResolver.query(
            CalendarContract.Calendars.CONTENT_URI, projection, sel, args, null
        )?.use { cur ->
            if (cur.moveToFirst()) {
                cachedCalendarId = cur.getLong(0)
                return cachedCalendarId
            }
        }

        val allCur = context.contentResolver.query(
            CalendarContract.Calendars.CONTENT_URI, projection, null, null, null
        )
        allCur?.use { cur ->
            while (cur.moveToNext()) {
                val id = cur.getLong(0)
                val name = cur.getString(3) ?: ""
                val display = cur.getString(4) ?: ""
                val syncId = cur.getString(5) ?: ""
                if (syncId.contains(TARGET_CALENDAR_ID) || name.contains("Sagre") || display.contains("Sagre")) {
                    cachedCalendarId = id
                    return cachedCalendarId
                }
            }
        }
        return null
    }

    fun addEventDirect(sagra: SagraInfo): Result<String> = runCatching {
        val calId = findLocalCalendarId()
            ?: throw Exception("Calendario non trovato sul telefono. Aggiungilo prima dalle impostazioni.")
        val title = sagra.nomeSagra ?: "Evento Sagra"
        val beginTime = parseEventStart(sagra)
        val endTime = parseEventEnd(sagra, beginTime)
        val allDay = beginTime == endTime - 86400000L

        val values = ContentValues().apply {
            put(CalendarContract.Events.CALENDAR_ID, calId)
            put(CalendarContract.Events.TITLE, title)
            put(CalendarContract.Events.DESCRIPTION, buildDescription(sagra))
            put(CalendarContract.Events.EVENT_LOCATION, sagra.location?.fullAddress ?: "")
            put(CalendarContract.Events.DTSTART, beginTime)
            put(CalendarContract.Events.DTEND, endTime)
            put(CalendarContract.Events.ALL_DAY, if (allDay) 1 else 0)
            put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
        }
        val uri = context.contentResolver.insert(CalendarContract.Events.CONTENT_URI, values)
            ?: throw Exception("Inserimento fallito")
        uri.toString()
    }

    fun createAddIntent(sagra: SagraInfo): Intent {
        val title = sagra.nomeSagra ?: "Evento Sagra"
        val beginTime = parseEventStart(sagra)
        val endTime = parseEventEnd(sagra, beginTime)
        return Intent(Intent.ACTION_INSERT).apply {
            data = CalendarContract.Events.CONTENT_URI
            putExtra(CalendarContract.Events.TITLE, title)
            putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, beginTime)
            putExtra(CalendarContract.EXTRA_EVENT_END_TIME, endTime)
            putExtra(CalendarContract.Events.EVENT_LOCATION, sagra.location?.fullAddress ?: "")
            putExtra(CalendarContract.Events.DESCRIPTION, buildDescription(sagra))
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    }

    fun createSingleDayIntents(sagra: SagraInfo): List<Pair<String, Intent>> {
        val dates = parseAllLocalDates(sagra)
        val timeRange = parseFirstTime(sagra.orari)
        val startT = timeRange?.let { LocalTime.of(it.first, it.second) } ?: LocalTime.of(19, 0)
        val endT = timeRange?.third?.let { LocalTime.of(it.first, it.second) } ?: startT.plusHours(4)

        val title = sagra.nomeSagra ?: "Evento Sagra"
        val desc = buildDescription(sagra)
        val locationStr = sagra.location?.fullAddress ?: ""
        val fmtDay = DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", Locale.ITALY)

        return dates.map { date ->
            val startMs = LocalDateTime.of(date, startT).atZone(ROME_ZONE).toInstant().toEpochMilli()
            val endMs = LocalDateTime.of(date, endT).atZone(ROME_ZONE).toInstant().toEpochMilli()

            val dayLabel = date.format(fmtDay).replaceFirstChar { it.uppercase() }

            val intent = Intent(Intent.ACTION_INSERT).apply {
                data = CalendarContract.Events.CONTENT_URI
                putExtra(CalendarContract.Events.TITLE, "$title ($dayLabel)")
                putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, startMs)
                putExtra(CalendarContract.EXTRA_EVENT_END_TIME, endMs)
                putExtra(CalendarContract.Events.EVENT_LOCATION, locationStr)
                putExtra(CalendarContract.Events.DESCRIPTION, desc)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            Pair(dayLabel, intent)
        }
    }

    fun generateIcsFile(sagra: SagraInfo): Uri {
        val dates = parseAllLocalDates(sagra)
        val timeRange = parseFirstTime(sagra.orari)
        val startT = timeRange?.let { LocalTime.of(it.first, it.second) }
        val endT = timeRange?.third?.let { LocalTime.of(it.first, it.second) }
        return IcsGenerator.generateIcsFile(context, sagra, dates, startT, endT)
    }

    fun createWebAddUrl(sagra: SagraInfo): String {
        val params = buildMap {
            put("action", "TEMPLATE")
            put("text", sagra.nomeSagra ?: "Evento Sagra")
            put("details", buildDescription(sagra))
            sagra.location?.fullAddress?.takeIf { it.isNotBlank() }?.let { put("location", it) }
            val beginTime = parseFirstDate(sagra.date.firstOrNull())
            if (beginTime != null) {
                val dates = parseAllLocalDates(sagra)
                val firstDate = dates.firstOrNull() ?: LocalDate.now()
                val lastDate = dates.lastOrNull() ?: firstDate

                val timeRange = parseFirstTime(sagra.orari)
                val startT = timeRange?.let { LocalTime.of(it.first, it.second) } ?: LocalTime.of(19, 0)
                val endT = timeRange?.third?.let { LocalTime.of(it.first, it.second) } ?: startT.plusHours(4)

                val startLdt = LocalDateTime.of(firstDate, startT)
                val endLdt = LocalDateTime.of(lastDate, endT)

                val fmt = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'", Locale.US)
                val startUtc = startLdt.atZone(ROME_ZONE).withZoneSameInstant(ZoneId.of("UTC")).format(fmt)
                val endUtc = endLdt.atZone(ROME_ZONE).withZoneSameInstant(ZoneId.of("UTC")).format(fmt)

                put("dates", "$startUtc/$endUtc")
            }
        }
        return "https://calendar.google.com/calendar/render?" + params.entries.joinToString("&") { (k, v) ->
            "$k=${URLEncoder.encode(v, "UTF-8")}"
        }
    }

    fun createCalendarViewUrl(): String =
        "https://calendar.google.com/calendar/u/0?cid=$TARGET_CALENDAR_ID"

    fun deleteEvent(eventId: Long): Result<Unit> = runCatching {
        val uri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId)
        context.contentResolver.delete(uri, null, null)
    }

    fun getEvents(): List<CalendarEventData> {
        val calId = findLocalCalendarId() ?: return emptyList()
        val cur = context.contentResolver.query(
            CalendarContract.Events.CONTENT_URI,
            arrayOf(
                CalendarContract.Events._ID,
                CalendarContract.Events.TITLE,
                CalendarContract.Events.DESCRIPTION,
                CalendarContract.Events.EVENT_LOCATION,
                CalendarContract.Events.DTSTART,
                CalendarContract.Events.DTEND
            ),
            "${CalendarContract.Events.CALENDAR_ID}=?",
            arrayOf(calId.toString()),
            "${CalendarContract.Events.DTSTART} ASC"
        )
        return cur?.use {
            val list = mutableListOf<CalendarEventData>()
            while (it.moveToNext()) {
                list.add(
                    CalendarEventData(
                        eventId = it.getLong(0),
                        title = it.getString(1) ?: "",
                        description = it.getString(2),
                        location = it.getString(3),
                        dtStart = it.getLong(4),
                        dtEnd = it.getLong(5)
                    )
                )
            }
            list
        } ?: emptyList()
    }

    fun isCalendarOnDevice(): Boolean = findLocalCalendarId() != null

    fun expandDateString(dateStr: String): List<String> = expandDateStringInternal(dateStr)

    private val monthNames = mapOf(
        "gennaio" to 1, "febbraio" to 2, "marzo" to 3, "aprile" to 4,
        "maggio" to 5, "giugno" to 6, "luglio" to 7, "agosto" to 8,
        "settembre" to 9, "ottobre" to 10, "novembre" to 11, "dicembre" to 12
    )

    private fun expandDateStringInternal(dateStr: String): List<String> {
        val clean = dateStr.replace(Regex("\\d+[°]"), "").trim().lowercase(Locale.ITALY)
        val yearPat = Regex("(20\\d{2})").find(clean)
        val year = yearPat?.groupValues?.get(1)
        val baseYear = year ?: LocalDate.now().year.toString()

        val monthEntry = monthNames.entries.firstOrNull { (name, _) -> clean.contains(name) }
        if (monthEntry == null) {
            val digits = Regex("(\\d{1,2})[/\\-](\\d{1,2})(?:[/\\-](\\d{2,4}))?").find(clean)
            if (digits != null) {
                val d = digits.groupValues[1].padStart(2, '0')
                val m = digits.groupValues[2].padStart(2, '0')
                val y = digits.groupValues[3].ifBlank { baseYear }
                return listOf("$d/$m/$y")
            }
            return listOf(dateStr)
        }
        val (monthName, monthNum) = monthEntry

        val monthStr = String.format(Locale.ROOT, "%02d", monthNum)
        val withoutMonth = clean.replace(Regex("\\b" + monthName + "\\b"), "").trim()

        val allDays = mutableListOf<Int>()
        val rangeMatch = Regex("(?:dal\\s+)?(\\d{1,2})\\s*(?:al|\\-|\\s+e\\s+)\\s*(\\d{1,2})").find(withoutMonth)
        if (rangeMatch != null) {
            val from = rangeMatch.groupValues[1].toIntOrNull() ?: return listOf(dateStr)
            val to = rangeMatch.groupValues[2].toIntOrNull() ?: return listOf(dateStr)
            for (d in from..to) allDays.add(d)
        } else {
            val dayNums = Regex("(\\d{1,2})").findAll(withoutMonth).map { it.groupValues[1].toIntOrNull() }.filterNotNull().toList()
            if (dayNums.isEmpty()) return listOf(dateStr)
            allDays.addAll(dayNums.distinct())
        }

        return allDays.map { d ->
            val dayStr = String.format(Locale.ROOT, "%02d", d)
            "$dayStr/$monthStr/$baseYear"
        }
    }

    fun parseAllLocalDates(sagra: SagraInfo): List<LocalDate> {
        val result = mutableListOf<LocalDate>()
        val dtf = DateTimeFormatter.ofPattern("dd/MM/yyyy")

        for (dStr in sagra.date) {
            val expanded = expandDateString(dStr)
            for (item in expanded) {
                try {
                    val ld = LocalDate.parse(item, dtf)
                    result.add(ld)
                } catch (_: Exception) {}
            }
        }
        return if (result.isNotEmpty()) result.distinct().sorted() else listOf(LocalDate.now())
    }

    private fun parseFirstDate(dateStr: String?): Long? {
        if (dateStr == null) return null
        val expanded = expandDateString(dateStr)
        val firstVal = expanded.firstOrNull() ?: return null
        val dtf = DateTimeFormatter.ofPattern("dd/MM/yyyy")
        return try {
            val ld = LocalDate.parse(firstVal, dtf)
            ld.atStartOfDay(ROME_ZONE).toInstant().toEpochMilli()
        } catch (_: Exception) { null }
    }

    private fun parseFirstTime(orari: List<String>): Triple<Int, Int, Pair<Int, Int>?>? {
        for (entry in orari) {
            val range = Pattern.compile("(\\d{1,2})[:.](\\d{2})\\s*(?:-|alle|/)\\s*(\\d{1,2})[:.](\\d{2})").matcher(entry)
            if (range.find()) {
                val startH = range.group(1)?.toIntOrNull() ?: continue
                val startM = range.group(2)?.toIntOrNull() ?: continue
                val endH = range.group(3)?.toIntOrNull() ?: continue
                val endM = range.group(4)?.toIntOrNull() ?: continue
                return Triple(startH, startM, Pair(endH, endM))
            }
            val single = Pattern.compile("(\\d{1,2})[:.](\\d{2})").matcher(entry)
            if (single.find()) {
                val h = single.group(1)?.toIntOrNull() ?: continue
                val m = single.group(2)?.toIntOrNull() ?: continue
                return Triple(h, m, null)
            }
        }
        return null
    }

    private fun parseEventStart(sagra: SagraInfo): Long {
        val dates = parseAllLocalDates(sagra)
        val firstDate = dates.firstOrNull() ?: LocalDate.now()
        val time = parseFirstTime(sagra.orari)
        val ldt = if (time != null) {
            LocalDateTime.of(firstDate, LocalTime.of(time.first, time.second))
        } else {
            LocalDateTime.of(firstDate, LocalTime.of(19, 0))
        }
        return ldt.atZone(ROME_ZONE).toInstant().toEpochMilli()
    }

    private fun parseEventEnd(sagra: SagraInfo, beginMs: Long): Long {
        val dates = parseAllLocalDates(sagra)
        val lastDate = dates.lastOrNull() ?: LocalDate.now()
        val time = parseFirstTime(sagra.orari)
        val ldt = if (time != null && time.third != null) {
            LocalDateTime.of(lastDate, LocalTime.of(time.third!!.first, time.third!!.second))
        } else {
            LocalDateTime.of(lastDate, LocalTime.of(23, 59))
        }
        val endMs = ldt.atZone(ROME_ZONE).toInstant().toEpochMilli()
        return if (endMs >= beginMs) endMs else beginMs + 4 * 60 * 60 * 1000L
    }

    private fun buildDescription(sagra: SagraInfo): String = buildString {
        sagra.descrizione?.let { appendLine(it) }
        if (sagra.orari.isNotEmpty()) appendLine("\nOrari: ${sagra.orari.joinToString(", ")}")
        if (sagra.prezzi.isNotEmpty()) appendLine("Prezzi: ${sagra.prezzi.joinToString(", ")}")
        if (sagra.contatti.isNotEmpty()) appendLine("Contatti: ${sagra.contatti.joinToString(" | ")}")
        append("\n---\nEstratto con SagreAI")
    }
}