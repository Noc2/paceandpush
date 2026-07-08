package com.paceandpush

import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ApplicationInfo
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.text.InputType
import android.util.Base64
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.security.KeyStore
import java.util.Locale
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class MainActivity : ComponentActivity() {
    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val DEFAULT_API_BASE_URL = "https://paceandpush.com"
        const val DEVICE_TOKEN_KEY_ALIAS = "pacepush_mobile_device_token"
        const val PAIRING_CODE_PREFIX = "pp_pair."
        const val PREF_API_BASE_URL = "api_base_url"
        const val PREF_DEVICE_TOKEN = "mobile_device_token"
        const val PREF_DEVICE_TOKEN_CIPHERTEXT = "mobile_device_token_ciphertext"
        const val PREF_DEVICE_TOKEN_IV = "mobile_device_token_iv"
        const val PREF_DISTANCE_UNITS = "distance_units"
        const val PREF_THEME = "theme_preference"
        const val SUPPORT_EMAIL = "hawigxyz@proton.me"
        const val SCORE_FORMULA = "score = sqrt(commit ratio x running ratio) x 100"
        const val SCORE_EXPLANATION =
            "Balanced score compares your commits and running distance with the strongest totals in the selected period. Each side becomes a 0-1 ratio, then the two ratios are combined with a geometric mean."
        const val SCORE_NOTE =
            "A zero on either side makes the score 0, so the balanced board rewards people who ship code and run."
        const val SYNC_LOOKBACK_DAYS = 44L
    }

    private val isDarkTheme: Boolean
        get() = when (themePreference) {
            AppThemePreference.System -> {
                val mode = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
                mode == Configuration.UI_MODE_NIGHT_YES
            }
            AppThemePreference.Light -> false
            AppThemePreference.Dark -> true
        }

    private val ink: Int get() = if (isDarkTheme) Color.rgb(230, 237, 243) else Color.rgb(31, 35, 40)
    private val muted: Int get() = if (isDarkTheme) Color.rgb(139, 148, 158) else Color.rgb(89, 99, 110)
    private val paper: Int get() = if (isDarkTheme) Color.rgb(13, 17, 23) else Color.WHITE
    private val surfacePanel: Int get() = if (isDarkTheme) Color.rgb(22, 27, 34) else Color.rgb(246, 248, 250)
    private val surfacePanelHigh: Int get() = if (isDarkTheme) Color.rgb(33, 38, 45) else Color.rgb(234, 238, 242)
    private val surfaceInset: Int get() = if (isDarkTheme) Color.rgb(48, 54, 61) else Color.rgb(216, 222, 228)
    private val orange = Color.rgb(249, 115, 22)
    private val green: Int get() = if (isDarkTheme) Color.rgb(63, 185, 80) else Color.rgb(26, 127, 55)
    private val red: Int get() = if (isDarkTheme) Color.rgb(255, 123, 114) else Color.rgb(207, 34, 46)
    private val blue: Int get() = if (isDarkTheme) Color.rgb(88, 166, 255) else Color.rgb(9, 105, 218)
    private val yellow: Int get() = if (isDarkTheme) Color.rgb(210, 153, 34) else Color.rgb(255, 248, 197)
    private val line: Int get() = if (isDarkTheme) Color.rgb(48, 54, 61) else Color.rgb(208, 215, 222)
    private val currentUserFill: Int get() = Color.argb(if (isDarkTheme) 42 else 26, 249, 115, 22)

    private var activeTab = Tab.Profile
    private var board = Board.Balanced
    private var boardSearchQuery = ""
    private var apiBaseUrl = DEFAULT_API_BASE_URL
    private var paired = false
    private var pairingInProgress = false
    private var themePreference = AppThemePreference.System
    private var pairingStatusMessage: String? = null
    private var pairingStatusColor = ink
    private var units = DistanceUnits.Metric
    private var healthAuthorized = false
    private var healthStatusMessage = "Health Connect status has not been checked yet."
    private var healthStatusColor = muted
    private var syncInProgress = false
    private var dataLoading = false
    private var dataStatusMessage: String? = null
    private var dataStatusColor = muted

    private var me = emptyMeSummary()
    private var rows = emptyList<LeaderboardRow>()
    private var history = emptyList<ProfileHistoryPoint>()

    private val uiScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val healthSync: HealthConnectDistanceSync by lazy {
        HealthConnectDistanceSync(this)
    }
    private val healthPermissionsLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract(),
    ) { grantedPermissions ->
        healthAuthorized = grantedPermissions.containsAll(healthSync.permissions)
        healthStatusMessage = if (healthAuthorized) {
            "Health Connect access granted. Sync now to upload daily running totals."
        } else {
            "Health Connect permission was not granted. You can retry from Settings."
        }
        healthStatusColor = if (healthAuthorized) green else red
        activeTab = Tab.Settings
        render()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val preferences = getPreferences(MODE_PRIVATE)
        themePreference = AppThemePreference.from(preferences.getString(PREF_THEME, null))
        applyBrandSystemBars()
        apiBaseUrl = if (allowsApiBaseUrlOverride()) {
            normalizeBaseUrl(preferences.getString(PREF_API_BASE_URL, null)) ?: DEFAULT_API_BASE_URL
        } else {
            DEFAULT_API_BASE_URL
        }
        migrateLegacyDeviceToken(preferences)
        paired = hasStoredDeviceToken(preferences)
        units = DistanceUnits.from(preferences.getString(PREF_DISTANCE_UNITS, null))
        render()
        refreshHealthConnectStatus()
        if (paired) {
            refreshRemoteData()
        }
        if (savedInstanceState == null) {
            handlePairingIntent(intent)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        uiScope.cancel()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handlePairingIntent(intent)
    }

    private fun render() {
        val scrollView = ScrollView(this).apply {
            setBackgroundColor(paper)
            addView(
                LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    setBackgroundColor(paper)
                    setPadding(dp(20), dp(20), dp(20), dp(28))
                    if (activeTab == Tab.Board) {
                        addView(header())
                    }
                    addView(tabBar())
                    addView(contentFor(activeTab))
                },
            )
        }

        setContentView(scrollView)
    }

    private fun header(): View {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, dp(18))

            addView(
                TextView(this@MainActivity).apply {
                    text = ">"
                    textSize = 32f
                    gravity = Gravity.CENTER
                    typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
                    setTextColor(ink)
                    setBackgroundColor(orange)
                    layoutParams = LinearLayout.LayoutParams(dp(52), dp(52)).apply {
                        rightMargin = dp(16)
                    }
                },
            )

            addView(
                LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(titleText("Pace & Push", 30f))
                    addView(bodyText("Run. Commit. Repeat.", 16f))
                },
            )
        }
    }

    private fun tabBar(): View {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(16))
            background = borderedBackground(surfacePanel, ink)
            Tab.values().forEachIndexed { index, tab ->
                addView(
                    Button(this@MainActivity).apply {
                        text = tab.title
                        isAllCaps = false
                        setTextColor(ink)
                        background = solidBackground(if (tab == activeTab) orange else surfacePanel)
                        setOnClickListener {
                            activeTab = tab
                            render()
                        }
                    },
                    LinearLayout.LayoutParams(0, dp(48), 1f),
                )
                if (index != Tab.values().lastIndex) {
                    addView(divider(), LinearLayout.LayoutParams(dp(1), dp(48)))
                }
            }
        }
    }

    private fun contentFor(tab: Tab): View {
        return when (tab) {
            Tab.Board -> boardScreen()
            Tab.Profile -> profileScreen()
            Tab.Settings -> settingsScreen()
        }
    }

    private fun boardScreen(): View {
        val filteredRows = rows.filter { matchesBoardSearch(it) }
        val sortedRows = when (board) {
            Board.Balanced -> filteredRows.sortedByDescending { it.score }
            Board.Commits -> filteredRows.sortedByDescending { it.commits }
            Board.Distance -> filteredRows.sortedByDescending { it.kilometers }
        }

        return column {
            dataStatusMessage?.let { message ->
                addView(bodyText(message, 16f).apply {
                    setTextColor(dataStatusColor)
                    setPadding(0, 0, 0, dp(12))
                })
            }
            addView(leaderboardSearchControls())
            addView(
                LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    Board.values().forEach { option ->
                        addView(
                            Button(this@MainActivity).apply {
                                text = option.title
                                isAllCaps = false
                                setTextColor(ink)
                                setBackgroundColor(if (option == board) orange else surfacePanel)
                                setOnClickListener {
                                    board = option
                                    if (paired) {
                                        refreshRemoteData(showLoading = true)
                                    } else {
                                        render()
                                    }
                                }
                            },
                            LinearLayout.LayoutParams(0, dp(48), 1f).apply {
                                rightMargin = dp(6)
                            },
                        )
                    }
                },
            )
            if (board == Board.Balanced) {
                addView(scoreExplanationPanel())
            }

            if (sortedRows.isEmpty()) {
                addView(
                    bodyText(
                        if (boardSearchQuery.trim().isEmpty()) {
                            "No public scores yet."
                        } else {
                            "No matching public developers."
                        },
                        16f,
                    ).apply {
                        setPadding(0, dp(16), 0, dp(12))
                    },
                )
            }

            addView(leaderboardHeader())
            sortedRows.forEachIndexed { index, row ->
                addView(leaderboardRow(index + 1, row, board))
            }
        }
    }

    private fun leaderboardSearchControls(): View {
        val searchInput = EditText(this).apply {
            setText(boardSearchQuery)
            hint = "Developer"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            setSingleLine(true)
            setTextColor(ink)
            setHintTextColor(muted)
            setPadding(dp(10), 0, dp(10), 0)
            background = borderedBackground(surfacePanel, line)
        }

        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, 0, 0, dp(12))
            addView(
                searchInput,
                LinearLayout.LayoutParams(0, dp(48), 1f).apply {
                    rightMargin = dp(6)
                },
            )
            addView(
                Button(this@MainActivity).apply {
                    text = "Search"
                    isAllCaps = false
                    setTextColor(ink)
                    setOnClickListener {
                        boardSearchQuery = searchInput.text.toString()
                        render()
                    }
                },
                LinearLayout.LayoutParams(-2, dp(48)).apply {
                    rightMargin = if (boardSearchQuery.isBlank()) 0 else dp(6)
                },
            )
            if (boardSearchQuery.isNotBlank()) {
                addView(
                    Button(this@MainActivity).apply {
                        text = "Clear"
                        isAllCaps = false
                        setTextColor(ink)
                        setOnClickListener {
                            boardSearchQuery = ""
                            render()
                        }
                    },
                    LinearLayout.LayoutParams(-2, dp(48)),
                )
            }
        }
    }

    private fun matchesBoardSearch(row: LeaderboardRow): Boolean {
        val query = boardSearchQuery.trim()
        if (query.isEmpty()) return true

        return row.login.contains(query, ignoreCase = true) ||
            row.displayName.contains(query, ignoreCase = true)
    }

    private fun profileScreen(): View {
        return panel {
            if (!paired) {
                addView(titleText("Pair this Android device", 28f))
                addView(bodyText("Open Settings and scan the web pairing QR to load your GitHub score and sync running distance.", 16f).apply {
                    setPadding(0, dp(8), 0, dp(12))
                })
                return@panel
            }

            dataStatusMessage?.let { message ->
                addView(bodyText(message, 16f).apply {
                    setTextColor(dataStatusColor)
                    setPadding(0, 0, 0, dp(12))
                })
            }
            addView(titleText("@${me.login}", 28f))
            addView(bodyText(me.displayName, 16f).apply {
                setPadding(0, dp(4), 0, dp(10))
            })
            addView(scoreExplanationPanel())
            addView(profileChartPanel())
            addView(labelText("History").apply { setPadding(0, dp(10), 0, 0) })
            if (history.isEmpty()) {
                addView(chartPlaceholder("No profile history yet. Sync after connecting Health Connect.").apply {
                    setPadding(0, dp(10), 0, 0)
                })
            } else {
                history.forEach { point ->
                    addView(
                        bodyText(
                            "${point.date}    ${point.score.toFixed(1)} score    ${formatDistance(point.kilometers, includeUnit = true)}",
                            15f,
                        ).apply {
                            typeface = Typeface.MONOSPACE
                            setPadding(0, dp(10), 0, dp(6))
                        },
                    )
                }
            }
        }
    }

    private fun profileChartPanel(): View {
        return panel(surfacePanelHigh) {
            addView(labelText("Profile chart"))
            if (history.isEmpty()) {
                addView(chartPlaceholder("No chart data yet.").apply {
                    setPadding(0, dp(10), 0, 0)
                })
            } else {
                val first = history.first()
                val last = history.last()
                addView(bodyText("${first.date} to ${last.date}", 14f).apply {
                    setPadding(0, dp(6), 0, dp(6))
                    typeface = Typeface.DEFAULT_BOLD
                })
                addView(bodyText(
                    "Score ${last.score.toFixed(1)} / ${last.commits} commits / ${formatDistance(last.kilometers, includeUnit = true)}",
                    15f,
                ))
            }
        }
    }

    private fun chartPlaceholder(message: String): View {
        return TextView(this).apply {
            text = message
            textSize = 16f
            gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(muted)
            background = borderedBackground(surfaceInset, line)
            layoutParams = LinearLayout.LayoutParams(-1, dp(144))
        }
    }

    private fun settingsScreen(): View {
        return panel {
            addView(titleText("Settings", 24f))
            addView(labelText("Appearance").apply { setPadding(0, dp(12), 0, 0) })
            addView(themeSelector())
            addView(labelText("Device sync"))
            val statusMessage = pairingStatusMessage
                ?: if (paired) "Device paired for local sync." else "Scan QR or paste a pairing code from the web app."
            val statusColor = if (pairingStatusMessage == null) muted else pairingStatusColor
            addView(bodyText(statusMessage, 16f).apply {
                setTextColor(statusColor)
            })
            addView(
                Button(this@MainActivity).apply {
                    text = "Scan QR"
                    isAllCaps = false
                    isEnabled = !pairingInProgress
                    setTextColor(ink)
                    setBackgroundColor(orange)
                    setOnClickListener {
                        startQrScan()
                    }
                },
            )
            val codeInput = EditText(this@MainActivity).apply {
                hint = "Pairing code or link"
                inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
                typeface = Typeface.MONOSPACE
                setSingleLine(true)
                setPadding(dp(12), dp(8), dp(12), dp(8))
                setTextColor(ink)
                setHintTextColor(muted)
            }
            addView(codeInput)
            addView(
                Button(this@MainActivity).apply {
                    text = "Pair"
                    isAllCaps = false
                    isEnabled = !pairingInProgress
                    setTextColor(ink)
                    setBackgroundColor(orange)
                    setOnClickListener {
                        pairFromPayload(codeInput.text.toString())
                    }
                },
            )
            if (paired) {
                addView(
                    Button(this@MainActivity).apply {
                        text = if (dataLoading) "Refreshing..." else "Refresh Score"
                        isAllCaps = false
                        isEnabled = !dataLoading
                        setTextColor(ink)
                        setBackgroundColor(orange)
                        setOnClickListener {
                            refreshRemoteData()
                        }
                    },
                )
            }

            addView(labelText("Health Connect").apply { setPadding(0, dp(12), 0, 0) })
            addView(bodyText(healthStatusMessage, 16f).apply {
                setTextColor(healthStatusColor)
            })
            if (healthConnectAvailable()) {
                addView(
                    Button(this@MainActivity).apply {
                        text = if (healthAuthorized) "Health Connect Enabled" else "Enable Health Connect"
                        isAllCaps = false
                        isEnabled = !syncInProgress
                        setTextColor(ink)
                        setBackgroundColor(if (healthAuthorized) yellow else orange)
                        setOnClickListener {
                            requestHealthConnectPermissions()
                        }
                    },
                )
            }
            addView(
                Button(this@MainActivity).apply {
                    text = if (syncInProgress) "Syncing..." else "Sync Now"
                    isAllCaps = false
                    isEnabled = paired && healthAuthorized && !syncInProgress
                    setTextColor(ink)
                    setBackgroundColor(if (isEnabled) orange else line)
                    setOnClickListener {
                        syncHealthConnectNow()
                    }
                },
            )
            if (paired) {
                addView(
                    Button(this@MainActivity).apply {
                        text = "Disconnect GitHub"
                        isAllCaps = false
                        isEnabled = !pairingInProgress && !syncInProgress
                        setTextColor(ink)
                        setBackgroundColor(surfacePanelHigh)
                        setOnClickListener {
                            disconnectGitHub()
                        }
                    },
                )
            }
            addView(
                Button(this@MainActivity).apply {
                    text = "Beta Feedback"
                    isAllCaps = false
                    setTextColor(ink)
                    setBackgroundColor(surfacePanelHigh)
                    setOnClickListener {
                        openSupportEmail()
                    }
                },
            )
            if (allowsApiBaseUrlOverride()) {
                addView(labelText("API base URL").apply { setPadding(0, dp(12), 0, 0) })
                val urlInput = EditText(this@MainActivity).apply {
                    setText(apiBaseUrl)
                    inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
                    typeface = Typeface.MONOSPACE
                    setSingleLine(true)
                    setTextColor(ink)
                    setHintTextColor(muted)
                    background = borderedBackground(surfacePanelHigh, line)
                }
                addView(urlInput)
                addView(
                    Button(this@MainActivity).apply {
                        text = "Save Server"
                        isAllCaps = false
                        setTextColor(ink)
                        setBackgroundColor(orange)
                        setOnClickListener {
                            val normalizedUrl = normalizeBaseUrl(urlInput.text.toString())
                            if (normalizedUrl == null) {
                                activeTab = Tab.Settings
                                render()
                                return@setOnClickListener
                            }
                            apiBaseUrl = normalizedUrl
                            getPreferences(MODE_PRIVATE)
                                .edit()
                                .putString(PREF_API_BASE_URL, normalizedUrl)
                                .apply()
                            render()
                        }
                    },
                )
            } else {
                addView(labelText("Server").apply { setPadding(0, dp(12), 0, 0) })
                addView(bodyText("API: paceandpush.com", 16f))
            }
            addView(labelText("Distance units").apply { setPadding(0, dp(12), 0, 0) })
            addView(unitSelector())
            addView(bodyText("Public leaderboard: ${if (me.publicLeaderboard) "On" else "Off"}", 16f))
            addView(scoreExplanationPanel())
        }
    }

    private fun leaderboardHeader(): View {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(
                LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(0, dp(14), 0, dp(8))

                    addView(labelText("#"), LinearLayout.LayoutParams(dp(48), -2))
                    addView(labelText("Developer"), LinearLayout.LayoutParams(0, -2, 1f))
                    addView(
                        labelText(board.leaderboardMetricTitle(units)).apply {
                            gravity = Gravity.END
                        },
                        LinearLayout.LayoutParams(dp(108), -2),
                    )
                },
            )
            addView(divider(), LinearLayout.LayoutParams(-1, dp(1)))
        }
    }

    private fun leaderboardRow(rank: Int, row: LeaderboardRow, board: Board): View {
        val metric = board.leaderboardMetric(row, units)

        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            isClickable = true
            setOnClickListener {
                openPublicProfile(row.login)
            }

            addView(
                LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(0, dp(14), 0, dp(14))
                    if (row.login.equals(me.login, ignoreCase = true)) {
                        setBackgroundColor(currentUserFill)
                    }

                    addView(
                        bodyText(rank.toString().padStart(2, '0'), 18f).apply {
                            typeface = Typeface.MONOSPACE
                            if (rank <= 3) {
                                typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
                                gravity = Gravity.CENTER
                                setTextColor(ink)
                                setBackgroundColor(yellow)
                                setPadding(dp(4), dp(3), dp(4), dp(3))
                            }
                        },
                        LinearLayout.LayoutParams(dp(48), -2),
                    )

                    addView(
                        LinearLayout(this@MainActivity).apply {
                            orientation = LinearLayout.VERTICAL
                            addView(titleText(row.login, 18f).apply { typeface = Typeface.MONOSPACE })
                            addView(bodyText(row.displayName, 14f))
                        },
                        LinearLayout.LayoutParams(0, -2, 1f),
                    )

                    addView(
                        LinearLayout(this@MainActivity).apply {
                            orientation = LinearLayout.VERTICAL
                            gravity = Gravity.END
                            addView(scoreText(metric.value, 18f, metric.color).apply {
                                gravity = Gravity.END
                            })
                            metric.detail?.let { detail ->
                                addView(bodyText(detail, 13f).apply {
                                    gravity = Gravity.END
                                    typeface = Typeface.DEFAULT_BOLD
                                })
                            }
                        },
                        LinearLayout.LayoutParams(dp(108), -2),
                    )
                },
            )
            addView(divider(), LinearLayout.LayoutParams(-1, dp(1)))
        }
    }

    private fun themeSelector(): View {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            AppThemePreference.values().forEach { option ->
                addView(
                    Button(this@MainActivity).apply {
                        text = option.title
                        isAllCaps = false
                        setTextColor(ink)
                        setBackgroundColor(if (option == themePreference) orange else surfacePanelHigh)
                        setOnClickListener {
                            themePreference = option
                            getPreferences(MODE_PRIVATE)
                                .edit()
                                .putString(PREF_THEME, option.rawValue)
                                .apply()
                            applyBrandSystemBars()
                            render()
                        }
                    },
                    LinearLayout.LayoutParams(0, dp(48), 1f).apply {
                        rightMargin = dp(6)
                    },
                )
            }
        }
    }

    private fun unitSelector(): View {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            DistanceUnits.values().forEach { option ->
                addView(
                    Button(this@MainActivity).apply {
                        text = option.title
                        isAllCaps = false
                        setTextColor(ink)
                        setBackgroundColor(if (option == units) orange else surfacePanelHigh)
                        setOnClickListener {
                            units = option
                            getPreferences(MODE_PRIVATE)
                                .edit()
                                .putString(PREF_DISTANCE_UNITS, option.rawValue)
                                .apply()
                            render()
                        }
                    },
                    LinearLayout.LayoutParams(0, dp(48), 1f).apply {
                        rightMargin = dp(6)
                    },
                )
            }
        }
    }

    private fun scoreExplanationPanel(): View {
        return panel(surfacePanelHigh) {
            addView(labelText("How score works"))
            addView(bodyText(SCORE_EXPLANATION, 15f).apply {
                setPadding(0, dp(6), 0, dp(6))
            })
            addView(bodyText(SCORE_FORMULA, 14f).apply {
                typeface = Typeface.MONOSPACE
                setTextColor(ink)
                setPadding(dp(8), dp(6), dp(8), dp(6))
            })
            addView(bodyText(SCORE_NOTE, 15f))
        }
    }

    private fun Board.leaderboardMetricTitle(units: DistanceUnits): String {
        return when (this) {
            Board.Balanced -> "Score"
            Board.Commits -> "Commits"
            Board.Distance -> "Run ${units.abbreviation}"
        }
    }

    private fun Board.leaderboardMetric(row: LeaderboardRow, units: DistanceUnits): LeaderboardMetric {
        return when (this) {
            Board.Balanced -> LeaderboardMetric(
                value = row.score.toFixed(1),
                detail = "${row.commits} commits / ${formatDistance(row.kilometers, includeUnit = true)}",
                color = blue,
            )
            Board.Commits -> LeaderboardMetric(
                value = row.commits.toString(),
                detail = null,
                color = green,
            )
            Board.Distance -> LeaderboardMetric(
                value = units.format(row.kilometers),
                detail = null,
                color = red,
            )
        }
    }

    private fun startQrScan() {
        val options = GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()
        val scanner = GmsBarcodeScanning.getClient(this, options)

        pairingStatusMessage = "Opening QR scanner..."
        pairingStatusColor = ink
        activeTab = Tab.Settings
        render()

        scanner.startScan()
            .addOnSuccessListener { barcode ->
                pairFromPayload(barcode.rawValue.orEmpty())
            }
            .addOnCanceledListener {
                showPairingStatus("QR scan canceled.", ink)
            }
            .addOnFailureListener { error ->
                showPairingError("Could not scan QR: ${error.message ?: "scanner unavailable."}")
            }
    }

    private fun handlePairingIntent(intent: Intent?) {
        if (intent?.action != Intent.ACTION_VIEW) return
        val payload = intent.dataString ?: return
        pairFromPayload(payload)
    }

    private fun pairFromPayload(rawPayload: String) {
        activeTab = Tab.Settings
        val pairingPayload = parsePairingPayload(rawPayload)
        if (pairingPayload == null) {
            showPairingError("Enter a valid Pace & Push pairing code or QR link.")
            return
        }

        exchangePairingCode(pairingPayload)
    }

    private fun parsePairingPayload(rawPayload: String): PairingPayload? {
        val value = rawPayload.trim()
        if (isPairingCode(value)) {
            return PairingPayload(code = value)
        }

        val uri = runCatching { Uri.parse(value) }.getOrNull() ?: return null
        val scheme = uri.scheme?.lowercase(Locale.US) ?: return null
        if (scheme == "pacepush" && uri.host?.equals("pair", ignoreCase = true) == true) {
            return pairingPayloadFromCode(uri.getQueryParameter("code"), queryBaseUrl(uri))
        }

        val path = uri.path?.trimEnd('/') ?: ""
        if ((scheme == "https" || scheme == "http") && path == "/mobile/pair" && isAllowedPairingHost(uri, scheme)) {
            return pairingPayloadFromCode(uri.getQueryParameter("code"), originFrom(uri))
        }

        return null
    }

    private fun pairingPayloadFromCode(code: String?, baseUrl: String?): PairingPayload? {
        val normalizedCode = code?.trim() ?: return null
        if (!isPairingCode(normalizedCode)) return null
        return PairingPayload(code = normalizedCode, baseUrl = baseUrl)
    }

    private fun isPairingCode(value: String): Boolean {
        return value.startsWith(PAIRING_CODE_PREFIX) && value.length > PAIRING_CODE_PREFIX.length
    }

    private fun exchangePairingCode(pairingPayload: PairingPayload) {
        val targetBaseUrl = if (allowsApiBaseUrlOverride()) {
            normalizeBaseUrl(pairingPayload.baseUrl ?: apiBaseUrl)
        } else {
            DEFAULT_API_BASE_URL
        }
        if (targetBaseUrl == null) {
            showPairingError("Set a valid API base URL before pairing.")
            return
        }

        pairingInProgress = true
        pairingStatusMessage = "Pairing with ${Uri.parse(targetBaseUrl).host ?: targetBaseUrl}..."
        pairingStatusColor = ink
        activeTab = Tab.Settings
        render()

        Thread {
            val result = runCatching {
                exchangeDeviceToken(targetBaseUrl, pairingPayload.code)
            }

            runOnUiThread {
                pairingInProgress = false
                result
                    .onSuccess { exchangeResult ->
                        runCatching {
                            storePairingCredentials(targetBaseUrl, exchangeResult.token)
                        }.onSuccess {
                            apiBaseUrl = targetBaseUrl
                            paired = true
                            pairingStatusMessage = "Device paired."
                            pairingStatusColor = green
                            refreshHealthConnectStatus()
                            refreshRemoteData()
                        }.onFailure {
                            paired = false
                            pairingStatusMessage = "Could not store the device token securely."
                            pairingStatusColor = red
                        }
                    }
                    .onFailure { error ->
                        pairingStatusMessage = error.message ?: "Pairing failed."
                        pairingStatusColor = red
                    }
                render()
            }
        }.start()
    }

    private fun exchangeDeviceToken(baseUrl: String, code: String): DeviceExchangeResult {
        val label = Build.MODEL?.trim()?.ifBlank { "Android" } ?: "Android"
        val requestBody = JSONObject()
            .put("code", code)
            .put("platform", "android")
            .put("label", label)
            .toString()

        val connection = (URL("${baseUrl.trimEnd('/')}/api/mobile/devices").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
        }

        return try {
            connection.outputStream.use { output ->
                output.write(requestBody.toByteArray(Charsets.UTF_8))
            }

            val responseCode = connection.responseCode
            val responseBody = readResponseBody(connection, responseCode)
            if (responseCode !in 200..299) {
                throw IOException("Pairing failed ($responseCode): ${serverErrorMessage(responseBody)}")
            }

            val token = JSONObject(responseBody).optString("token").trim()
            if (token.isBlank()) {
                throw IOException("Pairing response did not include a device token.")
            }

            DeviceExchangeResult(token = token)
        } finally {
            connection.disconnect()
        }
    }

    private fun refreshHealthConnectStatus() {
        val sdkStatus = healthSync.sdkStatus()
        if (sdkStatus != HealthConnectClient.SDK_AVAILABLE) {
            healthAuthorized = false
            healthStatusMessage = healthConnectAvailabilityMessage(sdkStatus)
            healthStatusColor = red
            render()
            return
        }

        healthStatusMessage = "Checking Health Connect permissions..."
        healthStatusColor = ink
        render()

        uiScope.launch {
            val hasPermissions = runCatching {
                withContext(Dispatchers.IO) {
                    healthSync.hasPermissions()
                }
            }

            healthAuthorized = hasPermissions.getOrDefault(false)
            healthStatusMessage = if (healthAuthorized) {
                "Health Connect access is enabled for running distance sync."
            } else {
                "Health Connect access is not enabled yet."
            }
            healthStatusColor = if (healthAuthorized) green else muted
            render()
        }
    }

    private fun healthConnectAvailable(): Boolean {
        return healthSync.sdkStatus() == HealthConnectClient.SDK_AVAILABLE
    }

    private fun healthConnectAvailabilityMessage(sdkStatus: Int = healthSync.sdkStatus()): String {
        return when (sdkStatus) {
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ->
                "Health Connect needs to be installed or updated before syncing."
            else -> "Health Connect is not available on this device."
        }
    }

    private fun requestHealthConnectPermissions() {
        val sdkStatus = healthSync.sdkStatus()
        if (sdkStatus != HealthConnectClient.SDK_AVAILABLE) {
            healthAuthorized = false
            healthStatusMessage = healthConnectAvailabilityMessage(sdkStatus)
            healthStatusColor = red
            activeTab = Tab.Settings
            render()
            return
        }

        healthStatusMessage = "Opening Health Connect permission request..."
        healthStatusColor = ink
        activeTab = Tab.Settings
        render()
        healthPermissionsLauncher.launch(healthSync.permissions)
    }

    private fun syncHealthConnectNow() {
        if (!paired) {
            healthStatusMessage = "Pair this Android device before syncing."
            healthStatusColor = red
            activeTab = Tab.Settings
            render()
            return
        }

        if (!healthAuthorized) {
            requestHealthConnectPermissions()
            return
        }

        val token = storedDeviceToken(getPreferences(MODE_PRIVATE))
        if (token.isNullOrBlank()) {
            paired = false
            healthStatusMessage = "Pairing credentials are missing. Pair this device again."
            healthStatusColor = red
            activeTab = Tab.Settings
            render()
            return
        }

        val baseUrl = apiBaseUrl
        val startedAt = Instant.now()
        syncInProgress = true
        healthStatusMessage = "Syncing running distance from Health Connect..."
        healthStatusColor = ink
        activeTab = Tab.Settings
        render()

        uiScope.launch {
            try {
                val outcome = withContext(Dispatchers.IO) {
                    val endDate = LocalDate.now(ZoneOffset.UTC)
                    val syncResult = healthSync.collectDistanceDays(
                        startDate = endDate.minusDays(SYNC_LOOKBACK_DAYS),
                        endDate = endDate,
                    )
                    val upload = uploadDistanceDays(baseUrl, token, syncResult.days)
                    val status = if (syncResult.days.isEmpty()) "warning" else "success"
                    recordSyncRun(
                        baseUrl = baseUrl,
                        token = token,
                        status = status,
                        startedAt = Instant.ofEpochMilli(syncResult.startedAtEpochMillis),
                        finishedAt = Instant.ofEpochMilli(syncResult.finishedAtEpochMillis),
                        counters = JSONObject()
                            .put("daysCollected", syncResult.days.size)
                            .put("daysAccepted", upload.accepted)
                            .put("daysFlagged", upload.flagged),
                    )
                    HealthSyncOutcome(
                        collected = syncResult.days.size,
                        accepted = upload.accepted,
                        flagged = upload.flagged,
                        status = status,
                    )
                }

                syncInProgress = false
                healthStatusMessage = if (outcome.collected == 0) {
                    "Sync finished with no running sessions found. Check Health Connect if distance should be present."
                } else {
                    "Sync finished: ${outcome.accepted} day(s) uploaded."
                }
                healthStatusColor = if (outcome.status == "success") green else muted
                if (outcome.flagged > 0) {
                    healthStatusMessage = "${healthStatusMessage} ${outcome.flagged} day(s) flagged for review."
                }
                render()
                refreshRemoteData(showLoading = false)
            } catch (error: Throwable) {
                withContext(Dispatchers.IO) {
                    runCatching {
                        recordSyncRun(
                            baseUrl = baseUrl,
                            token = token,
                            status = "error",
                            startedAt = startedAt,
                            finishedAt = Instant.now(),
                            counters = JSONObject().put("daysCollected", 0),
                            errorSummary = error.message?.take(500) ?: "Android sync failed.",
                        )
                    }
                }
                syncInProgress = false
                healthAuthorized = false
                healthStatusMessage = error.message ?: "Health Connect sync failed."
                healthStatusColor = red
                render()
            }
        }
    }

    private fun refreshRemoteData(showLoading: Boolean = true) {
        val token = storedDeviceToken(getPreferences(MODE_PRIVATE))
        if (token.isNullOrBlank()) {
            paired = false
            me = emptyMeSummary()
            rows = emptyList()
            history = emptyList()
            dataStatusMessage = "Pair this device from web Settings to load your score."
            dataStatusColor = red
            render()
            return
        }

        if (showLoading) {
            dataLoading = true
            dataStatusMessage = "Loading your Pace & Push score..."
            dataStatusColor = ink
            render()
        }

        val selectedBoard = board
        val baseUrl = apiBaseUrl
        uiScope.launch {
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    fetchRemoteSnapshot(baseUrl, token, selectedBoard)
                }
            }

            dataLoading = false
            result
                .onSuccess { snapshot ->
                    paired = true
                    me = snapshot.me
                    rows = snapshot.rows
                    history = snapshot.history
                    units = snapshot.units
                    dataStatusMessage = null
                    dataStatusColor = muted
                }
                .onFailure { error ->
                    dataStatusMessage = error.message ?: "Could not load Pace & Push data."
                    dataStatusColor = red
                }
            render()
        }
    }

    private fun disconnectGitHub() {
        val token = storedDeviceToken(getPreferences(MODE_PRIVATE))
        if (token.isNullOrBlank()) {
            clearStoredPairingCredentials()
            paired = false
            me = emptyMeSummary()
            rows = emptyList()
            history = emptyList()
            pairingStatusMessage = "This device is already disconnected."
            pairingStatusColor = muted
            activeTab = Tab.Settings
            render()
            return
        }

        pairingInProgress = true
        pairingStatusMessage = "Disconnecting GitHub and revoking this device..."
        pairingStatusColor = ink
        activeTab = Tab.Settings
        render()

        val baseUrl = apiBaseUrl
        uiScope.launch {
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    jsonRequest("DELETE", baseUrl, "/api/mobile/me/github/disconnect", token)
                }
            }

            pairingInProgress = false
            result
                .onSuccess {
                    clearStoredPairingCredentials()
                    paired = false
                    me = emptyMeSummary()
                    rows = emptyList()
                    history = emptyList()
                    dataStatusMessage = null
                    pairingStatusMessage = "GitHub disconnected and this device was revoked."
                    pairingStatusColor = green
                }
                .onFailure { error ->
                    pairingStatusMessage = error.message ?: "Could not disconnect GitHub."
                    pairingStatusColor = red
                }
            render()
        }
    }

    private fun fetchRemoteSnapshot(baseUrl: String, token: String, selectedBoard: Board): RemoteSnapshot {
        val meJson = jsonRequest("GET", baseUrl, "/api/mobile/me", token)
        val profileJson = jsonRequest("GET", baseUrl, "/api/mobile/me/profile", token)
        val leaderboardJson = jsonRequest(
            "GET",
            baseUrl,
            "/api/leaderboard?board=${selectedBoard.apiValue}",
            null,
        )

        return RemoteSnapshot(
            me = parseMe(meJson),
            units = DistanceUnits.from(meJson.optString("units").takeIf { it.isNotBlank() }),
            rows = parseLeaderboardRows(leaderboardJson),
            history = parseHistory(profileJson),
        )
    }

    private fun uploadDistanceDays(
        baseUrl: String,
        token: String,
        days: List<HealthConnectDistanceDay>,
    ): DistanceDaysUploadResult {
        val payloadDays = JSONArray()
        days.forEach { day ->
            payloadDays.put(
                JSONObject()
                    .put("date", day.date)
                    .put("meters", day.meters)
                    .put("sourcePlatform", day.sourcePlatform)
                    .put("sourceHash", day.sourceHash),
            )
        }

        val response = jsonRequest(
            "POST",
            baseUrl,
            "/api/mobile/distance-days",
            token,
            JSONObject().put("days", payloadDays),
        )

        return DistanceDaysUploadResult(
            accepted = response.optInt("accepted", 0),
            flagged = response.optInt("flagged", 0),
        )
    }

    private fun recordSyncRun(
        baseUrl: String,
        token: String,
        status: String,
        startedAt: Instant,
        finishedAt: Instant,
        counters: JSONObject,
        errorSummary: String? = null,
    ) {
        val payload = JSONObject()
            .put("platform", "android")
            .put("status", status)
            .put("startedAt", startedAt.toString())
            .put("finishedAt", finishedAt.toString())
            .put("counters", counters)
        if (!errorSummary.isNullOrBlank()) {
            payload.put("errorSummary", errorSummary)
        }

        jsonRequest("POST", baseUrl, "/api/mobile/sync-runs", token, payload)
    }

    private fun jsonRequest(
        method: String,
        baseUrl: String,
        path: String,
        token: String?,
        body: JSONObject? = null,
    ): JSONObject {
        val connection = (URL("${baseUrl.trimEnd('/')}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            token?.let { setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }

        return try {
            if (body != null) {
                connection.outputStream.use { output ->
                    output.write(body.toString().toByteArray(Charsets.UTF_8))
                }
            }

            val responseCode = connection.responseCode
            val responseBody = readResponseBody(connection, responseCode)
            if (responseCode !in 200..299) {
                throw IOException("API request failed ($responseCode): ${serverErrorMessage(responseBody)}")
            }
            if (responseBody.isBlank()) JSONObject() else JSONObject(responseBody)
        } finally {
            connection.disconnect()
        }
    }

    private fun parseMe(json: JSONObject): MeSummary {
        return MeSummary(
            login = json.optString("login").ifBlank { "you" },
            displayName = json.optString("displayName").ifBlank { json.optString("login").ifBlank { "Pace & Push" } },
            score = parseScore(json.optJSONObject("score") ?: JSONObject()),
            publicLeaderboard = json.optBoolean("publicLeaderboard", true),
        )
    }

    private fun parseScore(json: JSONObject): ScoreSummary {
        return ScoreSummary(
            period = json.optString("period"),
            score = json.optDouble("score", 0.0),
            rank = if (json.isNull("rank")) null else json.optInt("rank"),
            commits = json.optInt("commits", 0),
            kilometers = json.optDouble("kilometers", 0.0),
            lastSyncAt = json.optString("lastSyncAt").takeIf { it.isNotBlank() },
        )
    }

    private fun parseLeaderboardRows(json: JSONObject): List<LeaderboardRow> {
        val items = json.optJSONArray("rows") ?: JSONArray()
        return (0 until items.length()).mapNotNull { index ->
            val row = items.optJSONObject(index) ?: return@mapNotNull null
            LeaderboardRow(
                rank = row.optInt("rank", index + 1),
                login = row.optString("login").ifBlank { "unknown" },
                displayName = row.optString("displayName").ifBlank { row.optString("login").ifBlank { "Unknown" } },
                score = row.optDouble("score", 0.0),
                commits = row.optInt("commits", 0),
                kilometers = row.optDouble("kilometers", 0.0),
                streakDays = row.optInt("streakDays", 0),
            )
        }
    }

    private fun parseHistory(json: JSONObject): List<ProfileHistoryPoint> {
        val items = json.optJSONArray("history") ?: JSONArray()
        return (0 until items.length()).mapNotNull { index ->
            val point = items.optJSONObject(index) ?: return@mapNotNull null
            ProfileHistoryPoint(
                date = point.optString("date").takeIf { it.isNotBlank() } ?: return@mapNotNull null,
                commits = point.optInt("commits", 0),
                kilometers = point.optDouble("kilometers", 0.0),
                score = point.optDouble("score", 0.0),
            )
        }
    }

    private fun storePairingCredentials(baseUrl: String, token: String) {
        val encryptedToken = encryptDeviceToken(token)
        val editor = getPreferences(MODE_PRIVATE)
            .edit()
            .putString(PREF_DEVICE_TOKEN_CIPHERTEXT, encryptedToken.ciphertext)
            .putString(PREF_DEVICE_TOKEN_IV, encryptedToken.iv)
            .remove(PREF_DEVICE_TOKEN)

        if (allowsApiBaseUrlOverride()) {
            editor.putString(PREF_API_BASE_URL, baseUrl)
        } else {
            editor.remove(PREF_API_BASE_URL)
        }

        editor.apply()
    }

    private fun clearStoredPairingCredentials() {
        getPreferences(MODE_PRIVATE)
            .edit()
            .remove(PREF_DEVICE_TOKEN)
            .remove(PREF_DEVICE_TOKEN_CIPHERTEXT)
            .remove(PREF_DEVICE_TOKEN_IV)
            .apply()
    }

    private fun migrateLegacyDeviceToken(preferences: SharedPreferences) {
        if (hasStoredDeviceToken(preferences)) {
            preferences.edit().remove(PREF_DEVICE_TOKEN).apply()
            return
        }

        val legacyToken = preferences.getString(PREF_DEVICE_TOKEN, null)?.trim()
        if (legacyToken.isNullOrBlank()) return

        runCatching {
            val encryptedToken = encryptDeviceToken(legacyToken)
            preferences.edit()
                .putString(PREF_DEVICE_TOKEN_CIPHERTEXT, encryptedToken.ciphertext)
                .putString(PREF_DEVICE_TOKEN_IV, encryptedToken.iv)
                .remove(PREF_DEVICE_TOKEN)
                .apply()
        }.onFailure {
            preferences.edit().remove(PREF_DEVICE_TOKEN).apply()
        }
    }

    private fun hasStoredDeviceToken(preferences: SharedPreferences): Boolean {
        return !preferences.getString(PREF_DEVICE_TOKEN_CIPHERTEXT, null).isNullOrBlank() &&
            !preferences.getString(PREF_DEVICE_TOKEN_IV, null).isNullOrBlank()
    }

    private fun storedDeviceToken(preferences: SharedPreferences): String? {
        val ciphertext = preferences.getString(PREF_DEVICE_TOKEN_CIPHERTEXT, null)?.trim()
        val iv = preferences.getString(PREF_DEVICE_TOKEN_IV, null)?.trim()
        if (ciphertext.isNullOrBlank() || iv.isNullOrBlank()) return null

        return runCatching {
            decryptDeviceToken(EncryptedDeviceToken(ciphertext = ciphertext, iv = iv))
        }.getOrNull()?.takeIf { it.isNotBlank() }
    }

    private fun encryptDeviceToken(token: String): EncryptedDeviceToken {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, deviceTokenSecretKey())
        val ciphertext = cipher.doFinal(token.toByteArray(Charsets.UTF_8))
        return EncryptedDeviceToken(
            ciphertext = Base64.encodeToString(ciphertext, Base64.NO_WRAP),
            iv = Base64.encodeToString(cipher.iv, Base64.NO_WRAP),
        )
    }

    private fun decryptDeviceToken(encryptedToken: EncryptedDeviceToken): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val iv = Base64.decode(encryptedToken.iv, Base64.NO_WRAP)
        cipher.init(Cipher.DECRYPT_MODE, deviceTokenSecretKey(), GCMParameterSpec(128, iv))
        val plaintext = cipher.doFinal(Base64.decode(encryptedToken.ciphertext, Base64.NO_WRAP))
        return plaintext.toString(Charsets.UTF_8)
    }

    private fun deviceTokenSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (keyStore.getKey(DEVICE_TOKEN_KEY_ALIAS, null) as? SecretKey)?.let { return it }

        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        keyGenerator.init(
            KeyGenParameterSpec.Builder(
                DEVICE_TOKEN_KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build(),
        )
        return keyGenerator.generateKey()
    }

    private fun readResponseBody(connection: HttpURLConnection, responseCode: Int): String {
        val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
        return stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
    }

    private fun serverErrorMessage(responseBody: String): String {
        if (responseBody.isBlank()) return "server returned an error."
        val jsonMessage = runCatching {
            val json = JSONObject(responseBody)
            json.optString("error").ifBlank { json.optString("message") }
        }.getOrNull()
        return jsonMessage?.takeIf { it.isNotBlank() } ?: responseBody.take(160)
    }

    private fun showPairingStatus(message: String, color: Int) {
        pairingInProgress = false
        pairingStatusMessage = message
        pairingStatusColor = color
        activeTab = Tab.Settings
        render()
    }

    private fun showPairingError(message: String) {
        showPairingStatus(message, red)
    }

    private fun applyBrandSystemBars() {
        window.statusBarColor = paper
        window.navigationBarColor = paper

        var flags = 0
        if (!isDarkTheme && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = flags or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        }
        if (!isDarkTheme && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags = flags or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        }
        window.decorView.systemUiVisibility = flags
    }

    private fun openPublicProfile(login: String) {
        val url = "${DEFAULT_API_BASE_URL}/users/${Uri.encode(login)}"
        runCatching {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }.onFailure {
            dataStatusMessage = "Could not open public profile."
            dataStatusColor = red
            render()
        }
    }

    private fun openSupportEmail() {
        val subject = Uri.encode("Pace & Push beta feedback")
        runCatching {
            startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:$SUPPORT_EMAIL?subject=$subject")))
        }.onFailure {
            pairingStatusMessage = "No email app is available. Send feedback to $SUPPORT_EMAIL."
            pairingStatusColor = red
            activeTab = Tab.Settings
            render()
        }
    }

    private fun queryBaseUrl(uri: Uri): String? {
        if (!allowsApiBaseUrlOverride()) return null

        listOf("baseUrl", "base_url", "apiBaseUrl").forEach { key ->
            allowedBaseUrl(uri.getQueryParameter(key))?.let { return it }
        }
        return null
    }

    private fun allowedBaseUrl(value: String?): String? {
        val normalized = normalizeBaseUrl(value) ?: return null
        val uri = Uri.parse(normalized)
        val scheme = uri.scheme?.lowercase(Locale.US) ?: return null
        val host = uri.host?.lowercase(Locale.US) ?: return null
        val defaultHost = Uri.parse(DEFAULT_API_BASE_URL).host?.lowercase(Locale.US)
        val currentHost = normalizeBaseUrl(apiBaseUrl)?.let { Uri.parse(it).host?.lowercase(Locale.US) }
        val isKnownHost = host == defaultHost || host == currentHost
        val isLocalhost = host == "localhost" || host == "127.0.0.1"

        return if ((scheme == "https" && isKnownHost) || ((scheme == "http" || scheme == "https") && isLocalhost)) {
            normalized
        } else {
            null
        }
    }

    private fun isAllowedPairingHost(uri: Uri, scheme: String): Boolean {
        val host = uri.host?.lowercase(Locale.US) ?: return false
        val defaultHost = Uri.parse(DEFAULT_API_BASE_URL).host?.lowercase(Locale.US)
        if (scheme == "https" && host == defaultHost) return true

        val currentUri = normalizeBaseUrl(apiBaseUrl)?.let { Uri.parse(it) }
        val currentHost = currentUri?.host?.lowercase(Locale.US)
        val currentScheme = currentUri?.scheme?.lowercase(Locale.US)
        return currentHost != null && host == currentHost && scheme == currentScheme
    }

    private fun originFrom(uri: Uri): String? {
        val scheme = uri.scheme?.lowercase(Locale.US) ?: return null
        val authority = uri.encodedAuthority ?: return null
        return normalizeBaseUrl("$scheme://$authority")
    }

    private fun normalizeBaseUrl(value: String?): String? {
        val trimmed = value?.trim()?.trimEnd('/') ?: return null
        if (trimmed.isBlank()) return null

        val candidate = if ("://" in trimmed) trimmed else "https://$trimmed"
        val uri = runCatching { Uri.parse(candidate) }.getOrNull() ?: return null
        val scheme = uri.scheme?.lowercase(Locale.US)
        if (scheme != "http" && scheme != "https") return null
        val authority = uri.encodedAuthority ?: return null
        return "$scheme://$authority"
    }

    private fun allowsApiBaseUrlOverride(): Boolean {
        return (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
    }

    private fun panel(fillColor: Int = surfacePanel, build: LinearLayout.() -> Unit): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(16))
            setBackgroundColor(fillColor)
            layoutParams = LinearLayout.LayoutParams(-1, -2).apply {
                bottomMargin = dp(12)
            }
            build()
        }
    }

    private fun column(build: LinearLayout.() -> Unit): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            build()
        }
    }

    private fun titleText(value: String, size: Float): TextView {
        return TextView(this).apply {
            text = value
            textSize = size
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(ink)
        }
    }

    private fun bodyText(value: String, size: Float): TextView {
        return TextView(this).apply {
            text = value
            textSize = size
            setTextColor(muted)
        }
    }

    private fun labelText(value: String): TextView {
        return TextView(this).apply {
            text = value.uppercase()
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(muted)
        }
    }

    private fun scoreText(value: String, size: Float, color: Int): TextView {
        return TextView(this).apply {
            text = value
            textSize = size
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(color)
        }
    }

    private fun divider(): View {
        return View(this).apply {
            setBackgroundColor(line)
        }
    }

    private fun solidBackground(fillColor: Int): GradientDrawable {
        return GradientDrawable().apply {
            setColor(fillColor)
        }
    }

    private fun borderedBackground(fillColor: Int, strokeColor: Int): GradientDrawable {
        return GradientDrawable().apply {
            setColor(fillColor)
            setStroke(dp(1), strokeColor)
        }
    }

    private fun Double.toFixed(digits: Int): String = "%.${digits}f".format(this)

    private fun formatDistance(kilometers: Double, includeUnit: Boolean = false): String {
        return units.format(kilometers, includeUnit)
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }
}

private enum class Tab(val title: String) {
    Profile("Profile"),
    Board("Board"),
    Settings("Settings"),
}

private enum class Board(val title: String, val apiValue: String) {
    Balanced("Balanced", "balanced"),
    Commits("Commits", "commits"),
    Distance("Run", "distance"),
}

private enum class AppThemePreference(val rawValue: String, val title: String) {
    System("system", "System"),
    Light("light", "Light"),
    Dark("dark", "Dark");

    companion object {
        fun from(value: String?): AppThemePreference {
            return values().firstOrNull { it.rawValue == value } ?: System
        }
    }
}

private enum class DistanceUnits(
    val rawValue: String,
    val title: String,
    val abbreviation: String,
    private val factor: Double,
) {
    Metric("metric", "Kilometers", "km", 1.0),
    Imperial("imperial", "Miles", "mi", 0.621371);

    fun format(kilometers: Double, includeUnit: Boolean = false): String {
        val formatted = "%.1f".format(kilometers * factor)
        return if (includeUnit) "$formatted $abbreviation" else formatted
    }

    companion object {
        fun from(value: String?): DistanceUnits {
            return values().firstOrNull { it.rawValue == value } ?: Metric
        }
    }
}

private data class MeSummary(
    val login: String,
    val displayName: String,
    val score: ScoreSummary,
    val publicLeaderboard: Boolean,
)

private data class ScoreSummary(
    val period: String,
    val score: Double,
    val rank: Int?,
    val commits: Int,
    val kilometers: Double,
    val lastSyncAt: String?,
)

private data class LeaderboardRow(
    val rank: Int,
    val login: String,
    val displayName: String,
    val score: Double,
    val commits: Int,
    val kilometers: Double,
    val streakDays: Int,
)

private data class LeaderboardMetric(
    val value: String,
    val detail: String?,
    val color: Int,
)

private data class ProfileHistoryPoint(
    val date: String,
    val commits: Int,
    val kilometers: Double,
    val score: Double,
)

private data class PairingPayload(
    val code: String,
    val baseUrl: String? = null,
)

private data class DeviceExchangeResult(
    val token: String,
)

private data class RemoteSnapshot(
    val me: MeSummary,
    val units: DistanceUnits,
    val rows: List<LeaderboardRow>,
    val history: List<ProfileHistoryPoint>,
)

private data class DistanceDaysUploadResult(
    val accepted: Int,
    val flagged: Int,
)

private data class HealthSyncOutcome(
    val collected: Int,
    val accepted: Int,
    val flagged: Int,
    val status: String,
)

private data class EncryptedDeviceToken(
    val ciphertext: String,
    val iv: String,
)

private fun emptyMeSummary(): MeSummary {
    return MeSummary(
        login = "you",
        displayName = "Pace & Push",
        score = ScoreSummary(
            period = "",
            score = 0.0,
            rank = null,
            commits = 0,
            kilometers = 0.0,
            lastSyncAt = null,
        ),
        publicLeaderboard = true,
    )
}
