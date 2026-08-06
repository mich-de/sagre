package com.sagreai.data.local

import com.sagreai.domain.model.LocationInfo
import com.sagreai.domain.model.SagraInfo
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Mapper bidirezionale tra SagraEntity (Room) e SagraInfo (domain).
 * Gestisce la serializzazione/deserializzazione di liste e oggetti complessi.
 */
object SagraEntityMapper {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    fun SagraEntity.toDomain(): SagraInfo = SagraInfo(
        id = id,
        nomeSagra = nomeSagra,
        date = runCatching { json.decodeFromString<List<String>>(dateJson) }.getOrDefault(emptyList()),
        orari = runCatching { json.decodeFromString<List<String>>(orariJson) }.getOrDefault(emptyList()),
        location = locationJson?.let { runCatching { json.decodeFromString<LocationInfo>(it) }.getOrNull() },
        descrizione = descrizione,
        prezzi = runCatching { json.decodeFromString<List<String>>(prezziJson) }.getOrDefault(emptyList()),
        contatti = runCatching { json.decodeFromString<List<String>>(contattiJson) }.getOrDefault(emptyList()),
        piattiTipici = runCatching { json.decodeFromString<List<String>>(piattiTipiciJson) }.getOrDefault(emptyList()),
        tagDietetici = runCatching { json.decodeFromString<List<String>>(tagDieteticiJson) }.getOrDefault(emptyList()),
        categoria = categoria,
        consigliBorgo = runCatching { json.decodeFromString<List<String>>(consigliBorgoJson) }.getOrDefault(emptyList()),
        spotRadio = spotRadio,
        rawText = rawText,
        imageUri = imageUri,
        calendarEventId = calendarEventId,
        confidenceScore = confidenceScore,
        extractedAt = extractedAt
    )

    fun SagraInfo.toEntity(): SagraEntity = SagraEntity(
        id = id,
        nomeSagra = nomeSagra,
        dateJson = json.encodeToString(date),
        orariJson = json.encodeToString(orari),
        locationJson = location?.let { json.encodeToString(it) },
        descrizione = descrizione,
        prezziJson = json.encodeToString(prezzi),
        contattiJson = json.encodeToString(contatti),
        piattiTipiciJson = json.encodeToString(piattiTipici),
        tagDieteticiJson = json.encodeToString(tagDietetici),
        categoria = categoria,
        consigliBorgoJson = json.encodeToString(consigliBorgo),
        spotRadio = spotRadio,
        rawText = rawText,
        imageUri = imageUri,
        calendarEventId = calendarEventId,
        confidenceScore = confidenceScore,
        extractedAt = extractedAt
    )
}
