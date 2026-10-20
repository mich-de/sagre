package com.sagreai.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = OrangeHot,
    onPrimary = BackgroundDark,
    primaryContainer = PurpleDeep,
    onPrimaryContainer = OrangeLight,
    secondary = PurpleMid,
    onSecondary = OnBackgroundDark,
    secondaryContainer = Surface3Dark,
    onSecondaryContainer = PurpleLight,
    tertiary = GoldPrimary,
    onTertiary = BackgroundDark,
    background = BackgroundDark,
    onBackground = OnBackgroundDark,
    surface = SurfaceDark,
    onSurface = OnSurfaceDark,
    surfaceVariant = Surface2Dark,
    onSurfaceVariant = OnSurfaceVariantDark,
    outline = OutlineDark,
    error = ErrorRed,
    onError = OnBackgroundDark
)

private val LightColorScheme = lightColorScheme(
    primary = OrangeHot,
    onPrimary = OnBackgroundLight,
    primaryContainer = OrangeLight,
    onPrimaryContainer = OnBackgroundLight,
    secondary = PurpleMid,
    onSecondary = SurfaceLight,
    secondaryContainer = PurpleLight,
    onSecondaryContainer = PurpleDeep,
    tertiary = GoldDark,
    onTertiary = SurfaceLight,
    background = BackgroundLight,
    onBackground = OnBackgroundLight,
    surface = SurfaceLight,
    onSurface = OnSurfaceLight,
    surfaceVariant = Surface2Light,
    onSurfaceVariant = OnSurfaceVariantLight,
    outline = OutlineLight,
    error = ErrorRed,
    onError = SurfaceLight
)

@Composable
fun SagreAiTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // Dynamic Color: usa la palette dall'immagine di sfondo (Android 12+)
    dynamicColor: Boolean = false, // Disabilitato: manteniamo il branding
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context)
            else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    // Configura la status bar per trasparenza (edge-to-edge)
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !darkTheme
                isAppearanceLightNavigationBars = !darkTheme
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = AppTypography,
        content = content
    )
}
