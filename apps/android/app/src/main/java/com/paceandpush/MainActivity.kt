package com.paceandpush

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

class MainActivity : Activity() {
    private companion object {
        const val DEFAULT_API_BASE_URL = "https://paceandpush.com"
        const val PAIRING_CODE_PREFIX = "pp_pair."
        const val PREF_API_BASE_URL = "api_base_url"
        const val PREF_DEVICE_TOKEN = "mobile_device_token"
        const val PREF_DISTANCE_UNITS = "distance_units"
    }

    private val ink = Color.rgb(33, 30, 26)
    private val paper = Color.rgb(248, 242, 230)
    private val gold = Color.rgb(247, 201, 72)
    private val green = Color.rgb(36, 161, 72)
    private val red = Color.rgb(250, 77, 54)
    private val blue = Color.rgb(15, 98, 254)

    private var activeTab = Tab.Today
    private var board = Board.Balanced
    private var boardSearchQuery = ""
    private var apiBaseUrl = DEFAULT_API_BASE_URL
    private var paired = false
    private var pairingInProgress = false
    private var pairingStatusMessage: String? = null
    private var pairingStatusColor = ink
    private var units = DistanceUnits.Metric

    private val me = MeSummary(
        login = "Noc2",
        displayName = "David Hawig",
        score = ScoreSummary(
            period = "2026-07",
            score = 94.2,
            rank = 1,
            commits = 312,
            kilometers = 86.4,
            lastSyncAt = "2026-07-03T13:45:00.000Z",
        ),
        publicLeaderboard = true,
    )

    private val rows = listOf(
        LeaderboardRow(1, "Noc2", "David Hawig", 94.2, 312, 86.4, 11),
        LeaderboardRow(2, "alina-dev", "Alina Roth", 88.7, 244, 97.8, 8),
        LeaderboardRow(3, "mjansen", "Mika Jansen", 77.1, 178, 73.2, 5),
        LeaderboardRow(4, "ship-patch", "Sam Patel", 71.8, 421, 31.9, 2),
        LeaderboardRow(5, "irunlint", "Iris Kim", 69.6, 133, 102.0, 9),
    )

    private val history = listOf(
        ProfileHistoryPoint("2026-07-01", 41, 8.1, 42.8),
        ProfileHistoryPoint("2026-07-02", 93, 23.5, 68.4),
        ProfileHistoryPoint("2026-07-03", 128, 31.2, 75.6),
        ProfileHistoryPoint("2026-07-04", 176, 43.8, 80.9),
        ProfileHistoryPoint("2026-07-05", 219, 58.7, 86.3),
        ProfileHistoryPoint("2026-07-06", 260, 71.5, 90.4),
        ProfileHistoryPoint("2026-07-07", 312, 86.4, 94.2),
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val preferences = getPreferences(MODE_PRIVATE)
        apiBaseUrl = normalizeBaseUrl(preferences.getString(PREF_API_BASE_URL, null)) ?: DEFAULT_API_BASE_URL
        paired = !preferences.getString(PREF_DEVICE_TOKEN, null).isNullOrBlank()
        units = DistanceUnits.from(preferences.getString(PREF_DISTANCE_UNITS, null))
        render()
        if (savedInstanceState == null) {
            handlePairingIntent(intent)
        }
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
                    setPadding(dp(20), dp(20), dp(20), dp(28))
                    addView(header())
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
                    setBackgroundColor(gold)
                    layoutParams = LinearLayout.LayoutParams(dp(52), dp(52)).apply {
                        rightMargin = dp(12)
                    }
                },
            )

            addView(
                LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(titleText("Pace & Push", 30f))
                    addView(bodyText("Healthy body, shipped code.", 16f))
                },
            )
        }
    }

    private fun tabBar(): View {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(16))
            Tab.values().forEach { tab ->
                addView(
                    Button(this@MainActivity).apply {
                        text = tab.title
                        isAllCaps = false
                        setTextColor(ink)
                        setBackgroundColor(if (tab == activeTab) gold else paper)
                        setOnClickListener {
                            activeTab = tab
                            render()
                        }
                    },
                    LinearLayout.LayoutParams(0, dp(48), 1f).apply {
                        rightMargin = dp(4)
                    },
                )
            }
        }
    }

    private fun contentFor(tab: Tab): View {
        return when (tab) {
            Tab.Today -> todayScreen()
            Tab.Board -> boardScreen()
            Tab.Profile -> profileScreen()
            Tab.Sync -> syncScreen()
            Tab.Settings -> settingsScreen()
        }
    }

    private fun todayScreen(): View {
        return column {
            addView(
                panel {
                    addView(labelText("Your July score"))
                    addView(scoreText(me.score.score.toFixed(1), 72f, ink))
                    addView(bodyText("Rank ${me.score.rank} this month.", 20f))
                },
            )

            addView(metricRow("Commits", me.score.commits.toString(), green, units.title, formatDistance(me.score.kilometers), red))
            addView(metricRow("Board", "#${me.score.rank}", blue, "Sync", "Ready", ink))
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
                                setBackgroundColor(if (option == board) gold else paper)
                                setOnClickListener {
                                    board = option
                                    render()
                                }
                            },
                            LinearLayout.LayoutParams(0, dp(48), 1f).apply {
                                rightMargin = dp(6)
                            },
                        )
                    }
                },
            )

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

            sortedRows.forEachIndexed { index, row ->
                addView(leaderboardRow(index + 1, row))
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
            setHintTextColor(ink)
            setPadding(dp(10), 0, dp(10), 0)
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
            addView(titleText("@${me.login}", 28f))
            addView(bodyText("Healthy body, shipped code.", 16f))
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

    private fun syncScreen(): View {
        lateinit var codeInput: EditText

        return panel {
            addView(titleText("Connect this device", 22f))
            val statusMessage = pairingStatusMessage
                ?: if (paired) "Device paired for local sync." else "Scan QR or paste a pairing code from the web app."
            val statusColor = if (pairingStatusMessage == null) ink else pairingStatusColor
            addView(bodyText(statusMessage, 16f).apply {
                setTextColor(statusColor)
                alpha = if (pairingStatusMessage == null) 0.74f else 0.86f
            })
            addView(
                Button(this@MainActivity).apply {
                    text = "Scan QR"
                    isAllCaps = false
                    isEnabled = !pairingInProgress
                    setTextColor(ink)
                    setBackgroundColor(gold)
                    setOnClickListener {
                        startQrScan()
                    }
                },
            )
            codeInput = EditText(this@MainActivity).apply {
                hint = "Pairing code or link"
                inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
                typeface = Typeface.MONOSPACE
                setSingleLine(true)
                setPadding(dp(12), dp(8), dp(12), dp(8))
                setTextColor(ink)
            }
            addView(codeInput)
            addView(
                Button(this@MainActivity).apply {
                    text = "Pair"
                    isAllCaps = false
                    isEnabled = !pairingInProgress
                    setTextColor(ink)
                    setBackgroundColor(gold)
                    setOnClickListener {
                        pairFromPayload(codeInput.text.toString())
                    }
                },
            )
        }
    }

    private fun settingsScreen(): View {
        lateinit var urlInput: EditText

        return panel {
            addView(titleText("Settings", 24f))
            addView(labelText("API base URL"))
            urlInput = EditText(this@MainActivity).apply {
                setText(apiBaseUrl)
                inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
                typeface = Typeface.MONOSPACE
                setSingleLine(true)
                setTextColor(ink)
            }
            addView(urlInput)
            addView(labelText("Distance units").apply { setPadding(0, dp(12), 0, 0) })
            addView(unitSelector())
            addView(bodyText("Public leaderboard: ${if (me.publicLeaderboard) "On" else "Off"}", 16f))
            addView(
                Button(this@MainActivity).apply {
                    text = "Save"
                    isAllCaps = false
                    setTextColor(ink)
                    setBackgroundColor(gold)
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
        }
    }

    private fun metricRow(
        leftTitle: String,
        leftValue: String,
        leftColor: Int,
        rightTitle: String,
        rightValue: String,
        rightColor: Int,
    ): View {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            addView(metricTile(leftTitle, leftValue, leftColor), LinearLayout.LayoutParams(0, -2, 1f).apply { rightMargin = dp(8) })
            addView(metricTile(rightTitle, rightValue, rightColor), LinearLayout.LayoutParams(0, -2, 1f))
        }
    }

    private fun metricTile(title: String, value: String, color: Int): View {
        return panel {
            addView(labelText(title))
            addView(scoreText(value, 30f, color))
        }
    }

    private fun leaderboardRow(rank: Int, row: LeaderboardRow): View {
        return panel {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL

            addView(
                bodyText(rank.toString().padStart(2, '0'), 18f).apply {
                    typeface = Typeface.MONOSPACE
                    layoutParams = LinearLayout.LayoutParams(dp(48), -2)
                },
            )

            addView(
                LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(titleText(row.login, 18f).apply { typeface = Typeface.MONOSPACE })
                    addView(bodyText(row.displayName, 14f))
                    layoutParams = LinearLayout.LayoutParams(0, -2, 1f)
                },
            )

            addView(
                LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.END
                    addView(scoreText(row.score.toFixed(1), 18f, blue))
                    addView(bodyText(formatDistance(row.kilometers, includeUnit = true), 13f).apply {
                        gravity = Gravity.END
                        typeface = Typeface.DEFAULT_BOLD
                    })
                },
            )
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
                        setBackgroundColor(if (option == units) gold else paper)
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

    private fun startQrScan() {
        val options = GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()
        val scanner = GmsBarcodeScanning.getClient(this, options)

        pairingStatusMessage = "Opening QR scanner..."
        pairingStatusColor = ink
        activeTab = Tab.Sync
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
        activeTab = Tab.Sync
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
        val targetBaseUrl = normalizeBaseUrl(pairingPayload.baseUrl ?: apiBaseUrl)
        if (targetBaseUrl == null) {
            showPairingError("Set a valid API base URL before pairing.")
            return
        }

        pairingInProgress = true
        pairingStatusMessage = "Pairing with ${Uri.parse(targetBaseUrl).host ?: targetBaseUrl}..."
        pairingStatusColor = ink
        activeTab = Tab.Sync
        render()

        Thread {
            val result = runCatching {
                exchangeDeviceToken(targetBaseUrl, pairingPayload.code)
            }

            runOnUiThread {
                pairingInProgress = false
                result
                    .onSuccess { exchangeResult ->
                        apiBaseUrl = targetBaseUrl
                        paired = true
                        pairingStatusMessage = "Device paired."
                        pairingStatusColor = green
                        getPreferences(MODE_PRIVATE)
                            .edit()
                            .putString(PREF_API_BASE_URL, targetBaseUrl)
                            .putString(PREF_DEVICE_TOKEN, exchangeResult.token)
                            .apply()
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
        activeTab = Tab.Sync
        render()
    }

    private fun showPairingError(message: String) {
        showPairingStatus(message, red)
    }

    private fun queryBaseUrl(uri: Uri): String? {
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

    private fun panel(build: LinearLayout.() -> Unit): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(16))
            setBackgroundColor(paper)
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
            setTextColor(ink)
            alpha = 0.74f
        }
    }

    private fun labelText(value: String): TextView {
        return TextView(this).apply {
            text = value.uppercase()
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(ink)
            alpha = 0.62f
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

    private fun Double.toFixed(digits: Int): String = "%.${digits}f".format(this)

    private fun formatDistance(kilometers: Double, includeUnit: Boolean = false): String {
        return units.format(kilometers, includeUnit)
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }
}

private enum class Tab(val title: String) {
    Today("Today"),
    Board("Board"),
    Profile("Profile"),
    Sync("Sync"),
    Settings("Settings"),
}

private enum class Board(val title: String) {
    Balanced("Balanced"),
    Commits("Commits"),
    Distance("Distance"),
}

private enum class DistanceUnits(
    val rawValue: String,
    val title: String,
    private val abbreviation: String,
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
    val rank: Int,
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
