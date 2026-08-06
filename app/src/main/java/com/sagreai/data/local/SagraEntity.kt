package com.sagreai.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Entità Room per la persistenza delle sagre estratte.
 * Le liste e oggetti complessi sono serializzati come JSON String.
 */
@Entity(tableName = "sagre")
data class SagraEntity(
    @PrimaryKey
    val id: String,
    val nomeSagra: String?,
    val dateJson: String,         // JSON: List<String>
    val orariJson: String,        // JSON: List<String>
    val locationJson: String?,    // JSON: LocationInfo?
    val descrizione: String?,
    val prezziJson: String,       // JSON: List<String>
    val contattiJson: String,     // JSON: List<String>
    val piattiTipiciJson: String = "[]",  // JSON: List<String>
    val tagDieteticiJson: String = "[]",  // JSON: List<String>
    val categoria: String? = null,
    val consigliBorgoJson: String = "[]", // JSON: List<String>
    val spotRadio: String? = null,
    val rawText: String,
    val imageUri: String?,
    val calendarEventId: String?,
    val confidenceScore: Float,
    val extractedAt: Long
)
