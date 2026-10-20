package com.sagreai

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.navigation.compose.rememberNavController
import com.sagreai.ui.SagreAiNavHost
import com.sagreai.ui.theme.SagreAiTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // Splash screen (deve stare prima di super.onCreate)
        installSplashScreen()

        super.onCreate(savedInstanceState)

        // Edge-to-edge: contenuto sotto status bar e navigation bar
        enableEdgeToEdge()

        setContent {
            SagreAiTheme(darkTheme = true) { // Default dark
                Surface(modifier = Modifier.fillMaxSize()) {
                    val navController = rememberNavController()
                    SagreAiNavHost(navController = navController)
                }
            }
        }
    }
}
