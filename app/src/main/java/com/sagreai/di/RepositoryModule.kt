package com.sagreai.di

import com.sagreai.data.remote.AiExtractionRepositoryImpl
import com.sagreai.data.repository.SagraRepositoryImpl
import com.sagreai.domain.repository.AiExtractionRepository
import com.sagreai.domain.repository.SagraRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindSagraRepository(
        impl: SagraRepositoryImpl
    ): SagraRepository

    @Binds
    @Singleton
    abstract fun bindAiExtractionRepository(
        impl: AiExtractionRepositoryImpl
    ): AiExtractionRepository
}
