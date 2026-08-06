package com.sagreai.ui

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.sagreai.ui.calendar.CalendarScreen
import com.sagreai.ui.history.HistoryScreen
import com.sagreai.ui.home.HomeScreen
import com.sagreai.ui.result.ResultScreen
import com.sagreai.ui.settings.SettingsScreen

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Result : Screen("result/{sagraId}") {
        fun createRoute(sagraId: String) = "result/$sagraId"
    }
    object History : Screen("history")
    object Calendar : Screen("calendar")
    object Settings : Screen("settings")
}

private const val ANIM_DURATION = 350

@Composable
fun SagreAiNavHost(navController: NavHostController) {
    NavHost(
        navController = navController,
        startDestination = Screen.Home.route
    ) {
        composable(
            route = Screen.Home.route,
            enterTransition = { fadeIn(tween(ANIM_DURATION)) },
            exitTransition = { fadeOut(tween(ANIM_DURATION)) }
        ) {
            HomeScreen(
                onNavigateToResult = { sagraId ->
                    navController.navigate(Screen.Result.createRoute(sagraId))
                },
                onNavigateToHistory = { navController.navigate(Screen.History.route) },
                onNavigateToCalendar = { navController.navigate(Screen.Calendar.route) },
                onNavigateToSettings = { navController.navigate(Screen.Settings.route) }
            )
        }

        composable(
            route = Screen.Result.route,
            enterTransition = {
                slideIntoContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.Start,
                    animationSpec = tween(ANIM_DURATION)
                )
            },
            exitTransition = {
                slideOutOfContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.End,
                    animationSpec = tween(ANIM_DURATION)
                )
            }
        ) { backStackEntry ->
            val sagraId = backStackEntry.arguments?.getString("sagraId") ?: ""
            ResultScreen(
                sagraId = sagraId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.History.route,
            enterTransition = {
                slideIntoContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.Start,
                    animationSpec = tween(ANIM_DURATION)
                )
            },
            exitTransition = {
                slideOutOfContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.End,
                    animationSpec = tween(ANIM_DURATION)
                )
            }
        ) {
            HistoryScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToResult = { sagraId ->
                    navController.navigate(Screen.Result.createRoute(sagraId))
                }
            )
        }

        composable(
            route = Screen.Calendar.route,
            enterTransition = {
                slideIntoContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.Start,
                    animationSpec = tween(ANIM_DURATION)
                )
            },
            exitTransition = {
                slideOutOfContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.End,
                    animationSpec = tween(ANIM_DURATION)
                )
            }
        ) {
            CalendarScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToResult = { sagraId ->
                    navController.navigate(Screen.Result.createRoute(sagraId))
                }
            )
        }

        composable(
            route = Screen.Settings.route,
            enterTransition = {
                slideIntoContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.Up,
                    animationSpec = tween(ANIM_DURATION)
                )
            },
            exitTransition = {
                slideOutOfContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.Down,
                    animationSpec = tween(ANIM_DURATION)
                )
            }
        ) {
            SettingsScreen(onNavigateBack = { navController.popBackStack() })
        }
    }
}
