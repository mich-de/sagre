package com.sagreai.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object per SagraEntity.
 * Tutte le operazioni di lettura reattive usano Flow.
 */
@Dao
interface SagraDao {

    @Query("SELECT * FROM sagre ORDER BY extractedAt DESC")
    fun getAllSagre(): Flow<List<SagraEntity>>

    @Query("SELECT * FROM sagre WHERE id = :id LIMIT 1")
    suspend fun getSagraById(id: String): SagraEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSagra(sagra: SagraEntity)

    @Query("DELETE FROM sagre WHERE id = :id")
    suspend fun deleteSagraById(id: String)

    @Query("DELETE FROM sagre")
    suspend fun deleteAll()

    @Query("SELECT COUNT(*) FROM sagre")
    suspend fun count(): Int
}
