package com.sagreai.di

import android.content.Context
import androidx.room.Room
import com.sagreai.data.local.SagraDao
import com.sagreai.data.local.SagreAiDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): SagreAiDatabase =
        Room.databaseBuilder(
            context,
            SagreAiDatabase::class.java,
            SagreAiDatabase.DATABASE_NAME
        )
            .fallbackToDestructiveMigration() // Dev only: in prod usare Migration
            .build()

    @Provides
    @Singleton
    fun provideSagraDao(db: SagreAiDatabase): SagraDao = db.sagraDao()
}
