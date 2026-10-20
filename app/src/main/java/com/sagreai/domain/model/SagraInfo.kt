package com.sagreai.domain.model

import kotlinx.serialization.Serializable

/**
 * Modello principale che rappresenta le informazioni estratte
 * da una locandina/immagine di sagra o evento locale italiano.
 *
 * Questo è l'oggetto di dominio puro: nessuna dipendenza da framework.
 */
@Serializable
data class SagraInfo(
    val id: String = java.util.UUID.randomUUID().toString(),
    val nomeSagra: String? = null,
    val date: List<String> = emptyList(),
    val orari: List<String> = emptyList(),
    val location: LocationInfo? = null,
    val descrizione: String? = null,
    val prezzi: List<String> = emptyList(),
    val contatti: List<String> = emptyList(),
    val piattiTipici: List<String> = emptyList(),
    val tagDietetici: List<String> = emptyList(),
    val categoria: String? = null,
    val consigliBorgo: List<String> = emptyList(),
    val spotRadio: String? = null,
    val rawText: String = "",
    val imageUri: String? = null,
    val calendarEventId: String? = null,
    val confidenceScore: Float = 0f,
    val extractedAt: Long = System.currentTimeMillis()
) {
    /** Restituisce true se almeno un campo principale è stato estratto */
    val hasContent: Boolean
        get() = !nomeSagra.isNullOrBlank() ||
                date.isNotEmpty() ||
                orari.isNotEmpty() ||
                location != null

    /** Restituisce una stringa di riepilogo breve */
    val summary: String
        get() = buildString {
            nomeSagra?.let { append(it) } ?: append("Sagra senza nome")
            if (date.isNotEmpty()) append(" • ${date.first()}")
            location?.citta?.let { append(" • $it") }
        }
}

/**
 * Informazioni di localizzazione estratte dall'immagine.
 */
@Serializable
data class LocationInfo(
    val luogo: String? = null,      // nome del luogo (es. "Piazza del Comune")
    val indirizzo: String? = null,  // via e numero civico
    val citta: String? = null,      // città
    val provincia: String? = null   // sigla provincia (es. "MI")
) {
    /** Stringa leggibile dell'indirizzo completo */
    val fullAddress: String
        get() = listOfNotNull(luogo, indirizzo, citta, provincia)
            .filter { it.isNotBlank() }
            .joinToString(", ")

    /** URL per aprire Google Maps */
    val mapsUrl: String?
        get() = if (fullAddress.isNotBlank()) {
            "https://maps.google.com/?q=${fullAddress.replace(" ", "+")}"
        } else null
}
