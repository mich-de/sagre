package com.sagreai.domain.usecase

import com.sagreai.domain.model.SagraInfo
import com.sagreai.domain.repository.SagraRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

/** Salva una sagra nel database locale (Room) */
class SaveSagraUseCase @Inject constructor(
    private val repository: SagraRepository
) {
    suspend operator fun invoke(sagra: SagraInfo): Result<Unit> =
        repository.saveSagra(sagra)
}

/** Restituisce tutte le sagre salvate come Flow reattivo */
class GetHistoryUseCase @Inject constructor(
    private val repository: SagraRepository
) {
    operator fun invoke(): Flow<List<SagraInfo>> =
        repository.getAllSagre()
}

/** Elimina una sagra dal database locale */
class DeleteSagraUseCase @Inject constructor(
    private val repository: SagraRepository
) {
    suspend operator fun invoke(id: String): Result<Unit> =
        repository.deleteSagra(id)
}

/** Recupera una singola sagra per ID */
class GetSagraByIdUseCase @Inject constructor(
    private val repository: SagraRepository
) {
    suspend operator fun invoke(id: String): SagraInfo? =
        repository.getSagraById(id)
}
