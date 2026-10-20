package com.sagreai.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

/**
 * Database principale dell'app.
 * exportSchema = true per le migration (schema salvato in assets/)
 */
@Database(
    entities = [SagraEntity::class],
    version = 2,
    exportSchema = false
)
abstract class SagreAiDatabase : RoomDatabase() {
    abstract fun sagraDao(): SagraDao

    companion object {
        const val DATABASE_NAME = "sagreai_db"
    }
}
