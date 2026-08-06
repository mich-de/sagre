package com.sagreai

import android.app.Application
import dagger.hilt.android.HiltAndroidApp
import timber.log.Timber

@HiltAndroidApp
class SagreAiApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        // Timber logging (solo in debug)
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        }

        Timber.i("SagreAI avviata — versione ${BuildConfig.VERSION_NAME}")
    }
}
