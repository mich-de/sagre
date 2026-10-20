package com.sagreai.data.repository

import com.sagreai.data.local.SagraDao
import com.sagreai.data.local.SagraEntityMapper.toDomain
import com.sagreai.data.local.SagraEntityMapper.toEntity
import com.sagreai.domain.model.SagraInfo
import com.sagreai.domain.repository.SagraRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Implementazione di [SagraRepository] che usa Room come sorgente.
 */
@Singleton
class SagraRepositoryImpl @Inject constructor(
    private val dao: SagraDao
) : SagraRepository {

    override fun getAllSagre(): Flow<List<SagraInfo>> =
        dao.getAllSagre().map { entities ->
            entities.map { it.toDomain() }
        }

    override suspend fun saveSagra(sagra: SagraInfo): Result<Unit> = runCatching {
        dao.insertSagra(sagra.toEntity())
        Timber.d("Sagra salvata: ${sagra.id} - ${sagra.nomeSagra}")
    }.onFailure { Timber.e(it, "Errore salvataggio sagra") }

    override suspend fun deleteSagra(id: String): Result<Unit> = runCatching {
        dao.deleteSagraById(id)
        Timber.d("Sagra eliminata: $id")
    }.onFailure { Timber.e(it, "Errore eliminazione sagra") }

    override suspend fun getSagraById(id: String): SagraInfo? =
        dao.getSagraById(id)?.toDomain()
}
