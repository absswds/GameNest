package com.gamenest.app

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.updateLayoutParams
import com.gamenest.app.databinding.ActivityMainBinding
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.NetworkInterface
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val handler = Handler(Looper.getMainLooper())

    /** True while a game requested landscape + hidden system bars (see WebAppBridge). */
    private var immersive = false

    // Android 16 + targetSdk 36 no longer calls onBackPressed(): back goes through this callback.
    // Enabled only on the room/game page, where back acts like the page's own "back to lobby" button
    // (seat kept 5 min, lobby shows the resume banner). In the lobby it is off, so back exits the
    // app with the system's predictive back animation.
    private val backToLobby = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() {
            binding.webview.evaluateJavascript(
                "(function(){ if (window.doLeaveRoom) { window.doLeaveRoom(); return 'left'; } return 'none'; })()"
            ) { result ->
                if (result?.trim('"') != "left") binding.webview.loadUrl(SERVER_URL)
            }
        }
    }

    private fun updateBackCallback(url: String?) {
        backToLobby.isEnabled = url?.substringBefore('?')?.endsWith("/game.html") == true
    }

    companion object {
        private const val TAG = "LocalGames"
        private const val NODEJS_PROJECT_NAME = "nodejs-project"
        private const val SERVER_PORT = 3000
        private const val SERVER_URL = "http://localhost:$SERVER_PORT"
        private const val HAPTIC_THROTTLE_MS = 30L
        private val HAPTIC_EVENTS = setOf("turn", "card", "win", "lose", "invalid", "dice", "tick")

        // Cellular (rmnet/ccmni/pdp/clat), VPN (tun/ppp/ipsec) and other interfaces no LAN peer can reach.
        private val NON_LAN_IFACE = Regex("^(rmnet|ccmni|pdp|v4-|clat|tun|ppp|ipsec|dummy|lo|p2p)", RegexOption.IGNORE_CASE)
        // Hotspot / Wi-Fi / Ethernet / USB-tether interfaces.
        private val LAN_IFACE = Regex("^(wlan|ap|swlan|softap|eth|rndis|usb)", RegexOption.IGNORE_CASE)
        // 10/8, 172.16/12, 192.168/16 (excludes 100.64/10 carrier-grade NAT).
        private val PRIVATE_IPV4 = Regex("^(10\\.|192\\.168\\.|172\\.(1[6-9]|2\\d|3[01])\\.)")

        init {
            // Native lib loads libnode.so internally via CMakeLists.txt
            System.loadLibrary("native-lib")
        }
    }

    // JNI - implemented in cpp/native-lib.cpp
    external fun startNodeWithArguments(arguments: Array<String>): Int

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Push status bar below system notch/camera cutout
        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { view, insets ->
            val statusBars = insets.getInsets(WindowInsetsCompat.Type.statusBars())
            binding.statusBar.updateLayoutParams<ViewGroup.MarginLayoutParams> {
                topMargin = statusBars.top
            }
            insets
        }

        binding.statusBar.text = if (resources.configuration.locales[0].language.startsWith("en")) "🚀 Starting game server..." else "🚀 正在启动游戏服务器…"
        binding.webview.visibility = View.GONE
        binding.splash.visibility = View.VISIBLE

        configureWebView()
        onBackPressedDispatcher.addCallback(this, backToLobby)
        registerNetworkCallback()

        // 1. Extract nodejs-project from assets to internal storage
        // 2. Start polling for server readiness (spawns its own thread, returns immediately)
        // 3. Start Node.js — this BLOCKS this thread for the lifetime of the event loop
        thread(name = "node-bootstrap") {
            val projectDir = File(filesDir, NODEJS_PROJECT_NAME)
            if (!projectDir.exists() || shouldRecopyProject()) {
                Log.i(TAG, "Extracting nodejs-project to ${projectDir.absolutePath}")
                copyAssetFolder(assets, NODEJS_PROJECT_NAME, projectDir.absolutePath)
            }
            val mainScript = File(projectDir, "main.js").absolutePath
            Log.i(TAG, "Starting Node.js with $mainScript")
            // Start the poller BEFORE node::Start, because node::Start never returns.
            waitForServer()
            startNodeWithArguments(arrayOf("node", mainScript))
        }
    }

    /** Returns true if assets should be re-copied (version mismatch or DEBUG build). */
    private fun shouldRecopyProject(): Boolean {
        val versionFile = File(filesDir, "$NODEJS_PROJECT_NAME.version")
        val currentVersion = BuildConfig.VERSION_CODE.toString()
        if (!versionFile.exists() || versionFile.readText() != currentVersion) {
            versionFile.writeText(currentVersion)
            return true
        }
        return BuildConfig.DEBUG
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        val ws: WebSettings = binding.webview.settings
        ws.javaScriptEnabled = true
        ws.domStorageEnabled = true
        ws.databaseEnabled = true
        ws.allowFileAccess = true
        ws.allowContentAccess = true
        ws.cacheMode = WebSettings.LOAD_NO_CACHE
        ws.mediaPlaybackRequiresUserGesture = false
        ws.useWideViewPort = true
        ws.loadWithOverviewMode = true
        ws.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        binding.webview.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                // Always unlock on navigation: a page may leave via location.replace, which
                // gives the old page no chance to release the lock, stranding us in landscape.
                // Pages that want landscape re-request it once loaded — this runs before the
                // new page's JS, so there is no race.
                if (immersive) {
                    immersive = false
                    requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
                    applyImmersive(false)
                }
            }

            // Links off the local server (e.g. the GitHub link in the lobby footer) open in the
            // system browser instead of replacing the game UI inside the WebView.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.port == SERVER_PORT || (uri.scheme != "http" && uri.scheme != "https")) return false
                try { startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (e: Exception) { Log.w(TAG, "open link failed", e) }
                return true
            }

            override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
                super.doUpdateVisitedHistory(view, url, isReload)
                updateBackCallback(url)
            }

            override fun onPageFinished(view: WebView, url: String?) {
                super.onPageFinished(view, url)
                updateBackCallback(url)
                view.evaluateJavascript("(function(){ return localStorage.getItem('lang') || 'zh'; })()") { result ->
                    val lang = result?.trim('"') ?: "zh"
                    if (lang != currentLang) {
                        currentLang = lang
                        refreshStatusBarText()
                    }
                }
            }
        }
        binding.webview.webChromeClient = WebChromeClient()
        binding.webview.addJavascriptInterface(WebAppBridge(), "GameNestNative")
    }

    /**
     * Bridge exposed to the WebView as `window.GameNestNative`.
     * Only our own localhost pages are ever loaded, so this is not a remote-content risk.
     */
    inner class WebAppBridge {
        /**
         * Called by the web app when entering/leaving a game that wants the full screen
         * (currently Mahjong). Locks landscape and hides the system bars + the LAN-URL bar.
         */
        @JavascriptInterface
        fun setImmersiveLandscape(on: Boolean) {
            runOnUiThread {
                requestedOrientation = if (on) {
                    ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                } else {
                    ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
                }
                immersive = on
                applyImmersive(on)
            }
        }

        /** Called by public/js/theme.js whenever the page's light/dark theme is applied. */
        @JavascriptInterface
        fun setTheme(dark: Boolean) {
            runOnUiThread { applyBarTheme(dark) }
        }

        /** Called by public/js/haptics.js to trigger native haptic feedback for game events. */
        @JavascriptInterface
        fun haptic(event: String) {
            if (event !in HAPTIC_EVENTS) return
            synchronized(hapticLock) {
                val now = SystemClock.elapsedRealtime()
                if (now - lastHapticAt < HAPTIC_THROTTLE_MS) return
                lastHapticAt = now
            }
            playHaptic(event)
        }
    }

    private val hapticLock = Any()
    private var lastHapticAt = 0L

    private fun getVibrator(): Vibrator? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vm?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    private fun playHaptic(event: String) {
        if (event == "invalid" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            runOnUiThread {
                if (!isFinishing && !isDestroyed) {
                    binding.webview.performHapticFeedback(HapticFeedbackConstants.REJECT)
                }
            }
            return
        }
        val vibrator = getVibrator() ?: return
        if (!vibrator.hasVibrator()) return
        val effect = buildHapticEffect(event, vibrator) ?: return
        try {
            vibrator.vibrate(effect)
        } catch (e: Exception) {
            Log.w(TAG, "haptic failed for $event", e)
        }
    }

    private fun buildHapticEffect(event: String, vibrator: Vibrator): VibrationEffect? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            buildCompositionEffect(event, vibrator)?.let { return it }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return buildPredefinedEffect(event)
        }
        return buildFallbackEffect(event, vibrator)
    }

    private fun buildCompositionEffect(event: String, vibrator: Vibrator): VibrationEffect? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null
        val comp = VibrationEffect.startComposition()
        when (event) {
            "turn" -> {
                if (!vibrator.areAllPrimitivesSupported(
                        VibrationEffect.Composition.PRIMITIVE_QUICK_RISE,
                        VibrationEffect.Composition.PRIMITIVE_CLICK
                    )
                ) return null
                comp.addPrimitive(VibrationEffect.Composition.PRIMITIVE_QUICK_RISE, 0.6f)
                    .addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 0.8f, 60)
            }
            "card" -> {
                if (!vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_CLICK)) return null
                comp.addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 0.7f)
            }
            "win" -> {
                val endPrim = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    VibrationEffect.Composition.PRIMITIVE_THUD
                } else {
                    VibrationEffect.Composition.PRIMITIVE_CLICK
                }
                if (!vibrator.areAllPrimitivesSupported(
                        VibrationEffect.Composition.PRIMITIVE_QUICK_RISE,
                        VibrationEffect.Composition.PRIMITIVE_CLICK,
                        endPrim
                    )
                ) return null
                comp.addPrimitive(VibrationEffect.Composition.PRIMITIVE_QUICK_RISE, 0.7f)
                    .addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 1.0f)
                    .addPrimitive(endPrim, 0.9f, 80)
            }
            "lose" -> {
                val endPrim = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    VibrationEffect.Composition.PRIMITIVE_THUD
                } else {
                    VibrationEffect.Composition.PRIMITIVE_CLICK
                }
                if (!vibrator.areAllPrimitivesSupported(
                        VibrationEffect.Composition.PRIMITIVE_QUICK_FALL,
                        endPrim
                    )
                ) return null
                comp.addPrimitive(VibrationEffect.Composition.PRIMITIVE_QUICK_FALL, 0.8f)
                    .addPrimitive(endPrim, 0.6f, 70)
            }
            "dice" -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    if (!vibrator.areAllPrimitivesSupported(
                            VibrationEffect.Composition.PRIMITIVE_LOW_TICK,
                            VibrationEffect.Composition.PRIMITIVE_THUD
                        )
                    ) return null
                    comp.addPrimitive(VibrationEffect.Composition.PRIMITIVE_LOW_TICK, 0.4f)
                        .addPrimitive(VibrationEffect.Composition.PRIMITIVE_LOW_TICK, 0.5f, 35)
                        .addPrimitive(VibrationEffect.Composition.PRIMITIVE_LOW_TICK, 0.6f, 50)
                        .addPrimitive(VibrationEffect.Composition.PRIMITIVE_THUD, 0.85f, 70)
                } else {
                    if (!vibrator.areAllPrimitivesSupported(
                            VibrationEffect.Composition.PRIMITIVE_TICK,
                            VibrationEffect.Composition.PRIMITIVE_CLICK
                        )
                    ) return null
                    comp.addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, 0.5f)
                        .addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, 0.6f, 35)
                        .addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, 0.7f, 50)
                        .addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 0.9f, 70)
                }
            }
            "tick" -> {
                if (!vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_TICK)) return null
                comp.addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, 0.5f)
            }
            else -> return null
        }
        return comp.compose()
    }

    private fun buildPredefinedEffect(event: String): VibrationEffect? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
        val effectId = when (event) {
            "turn", "win", "invalid" -> VibrationEffect.EFFECT_DOUBLE_CLICK
            "card" -> VibrationEffect.EFFECT_CLICK
            "lose" -> VibrationEffect.EFFECT_HEAVY_CLICK
            "dice", "tick" -> VibrationEffect.EFFECT_TICK
            else -> return null
        }
        return VibrationEffect.createPredefined(effectId)
    }

    private fun buildFallbackEffect(event: String, vibrator: Vibrator): VibrationEffect? {
        val hasAmp = vibrator.hasAmplitudeControl()
        fun waveform(timings: LongArray, amps: IntArray): VibrationEffect =
            if (hasAmp) VibrationEffect.createWaveform(timings, amps, -1)
            else VibrationEffect.createWaveform(timings, -1)
        fun oneShot(ms: Long, amp: Int): VibrationEffect =
            VibrationEffect.createOneShot(ms, if (hasAmp) amp else VibrationEffect.DEFAULT_AMPLITUDE)

        return when (event) {
            "turn" -> waveform(longArrayOf(0, 25, 60, 35), intArrayOf(0, 120, 0, 180))
            "card" -> oneShot(15L, 140)
            "win" -> waveform(longArrayOf(0, 30, 50, 40, 60, 70), intArrayOf(0, 140, 0, 180, 0, 255))
            "lose" -> waveform(longArrayOf(0, 60, 80, 90), intArrayOf(0, 180, 0, 100))
            "invalid" -> waveform(longArrayOf(0, 25, 40, 25), intArrayOf(0, 200, 0, 200))
            "dice" -> VibrationEffect.createWaveform(longArrayOf(0, 15, 35, 15, 50, 20, 70, 35), -1)
            "tick" -> oneShot(12L, 100)
            else -> null
        }
    }

    /** Recolours the LAN-URL bar, the strip behind the system status bar and its icons. */
    private fun applyBarTheme(dark: Boolean) {
        binding.statusBar.setBackgroundColor(if (dark) 0xFF1A1B1E.toInt() else 0xFFFFFFFF.toInt())
        binding.statusBar.setTextColor(if (dark) 0xFFE8E8EA.toInt() else 0xFF1A1A1A.toInt())
        binding.root.setBackgroundColor(if (dark) 0xFF0F1012.toInt() else 0xFFF4F4F2.toInt())
        WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = !dark
    }

    /**
     * Hides/shows the system bars and our own LAN-URL status bar.
     * Bars stay swipe-accessible in immersive mode (BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE).
     */
    private fun applyImmersive(on: Boolean) {
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        if (on) {
            controller.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            controller.hide(WindowInsetsCompat.Type.systemBars())
            binding.statusBar.visibility = View.GONE
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars())
            binding.statusBar.visibility = View.VISIBLE
        }
    }

    /** The system restores the bars on focus loss (notification shade, dialogs) — re-apply. */
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && immersive) applyImmersive(true)
    }

    /** Polls http://localhost:3000 until the HTTP server responds, then loads it. */
    private fun waitForServer() {
        thread(name = "server-poller") {
            val deadline = System.currentTimeMillis() + 30_000  // 30s budget
            while (System.currentTimeMillis() < deadline) {
                if (isServerReady()) {
                    val lanIp = getLanIp()
                    Log.i(TAG, "Server ready, LAN IP: $lanIp")
                    handler.post { onServerReady(lanIp) }
                    return@thread
                }
                Thread.sleep(300)
            }
            Log.e(TAG, "Server did not start within 30 seconds")
            handler.post {
                binding.statusBar.text = if (currentLang == "en") "⏰ Server start timeout" else "⏰ 服务启动超时"
            }
        }
    }

    private fun isServerReady(): Boolean {
        return try {
            val conn = URL(SERVER_URL).openConnection() as HttpURLConnection
            conn.connectTimeout = 500
            conn.readTimeout = 500
            conn.requestMethod = "GET"
            val code = conn.responseCode
            conn.disconnect()
            code in 200..399
        } catch (e: Exception) {
            false
        }
    }

    private fun onServerReady(lanIp: String?) {
        serverReady = true
        currentIsWifi = isOnWifi()
        currentLanIp = lanIp
        val displayUrl = if (lanIp != null) "http://$lanIp:$SERVER_PORT" else SERVER_URL
        binding.statusBar.text = statusBarText(currentIsWifi, displayUrl)
        val wifiFlag = if (currentIsWifi) "1" else "0"
        binding.webview.loadUrl("$SERVER_URL?wifi=$wifiFlag")
        binding.webview.visibility = View.VISIBLE
        binding.splash.visibility = View.GONE
    }

    /** Returns the status bar text in the current WebView language. */
    private fun statusBarText(wifi: Boolean, displayUrl: String? = null): String {
        val url = displayUrl ?: (getLanIp()?.let { "http://$it:$SERVER_PORT" } ?: SERVER_URL)
        return if (wifi) {
            if (currentLang == "en") "📡 Other devices visit: $url" else "📡 其他设备访问：$url"
        } else {
            if (currentLang == "en") "📴 No Wi-Fi — solo or AI play only" else "📴 当前非 Wi-Fi，仅可单机或加 AI 玩"
        }
    }

    /** Refresh status bar text after language change (without reloading WebView). */
    private fun refreshStatusBarText() {
        val displayUrl = getLanIp()?.let { "http://$it:$SERVER_PORT" } ?: SERVER_URL
        binding.statusBar.text = statusBarText(currentIsWifi, displayUrl)
    }

    /**
     * True when other devices can reach this phone over a LAN: the active network is
     * Wi-Fi/Ethernet, or some non-cellular interface has a private IPv4. The second check
     * covers the phone acting as a hotspot and Wi-Fi without internet — in both cases
     * Android keeps cellular as the default network.
     */
    private fun isOnWifi(): Boolean {
        if (getLanIp() != null) return true
        return try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val activeNet = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(activeNet) ?: return false
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
        } catch (e: Exception) {
            Log.w(TAG, "isOnWifi check failed", e)
            true // fail open: assume WiFi so the user can still try
        }
    }

    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var currentIsWifi: Boolean = true
    private var currentLanIp: String? = null
    private var serverReady = false
    private var currentLang: String = "zh"  // WebView language, updated on page load

    // Hotspot on/off and DHCP changes don't move the default network, so no callback
    // fires for them; a cheap interface poll keeps the status bar honest.
    private val networkPoll = object : Runnable {
        override fun run() {
            checkNetwork()
            handler.postDelayed(this, 5_000)
        }
    }

    /** Re-checks LAN reachability on default-network changes and every few seconds. */
    private fun registerNetworkCallback() {
        try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val cb = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: android.net.Network) { handler.post { checkNetwork() } }
                override fun onCapabilitiesChanged(network: android.net.Network, caps: NetworkCapabilities) { handler.post { checkNetwork() } }
                override fun onLinkPropertiesChanged(network: android.net.Network, lp: android.net.LinkProperties) { handler.post { checkNetwork() } }
                override fun onLost(network: android.net.Network) { handler.post { checkNetwork() } }
            }
            cm.registerDefaultNetworkCallback(cb)
            networkCallback = cb
        } catch (e: Exception) {
            Log.w(TAG, "registerNetworkCallback failed", e)
        }
        handler.postDelayed(networkPoll, 5_000)
    }

    private fun checkNetwork() {
        if (!serverReady) return
        val lanIp = getLanIp()
        val nowWifi = isOnWifi()
        if (nowWifi == currentIsWifi && lanIp == currentLanIp) return
        val typeChanged = nowWifi != currentIsWifi
        currentIsWifi = nowWifi
        currentLanIp = lanIp
        val displayUrl = if (lanIp != null) "http://$lanIp:$SERVER_PORT" else SERVER_URL
        binding.statusBar.text = statusBarText(nowWifi, displayUrl)
        if (typeChanged) onNetworkTypeChanged(nowWifi)
    }

    /**
     * Only the lobby depends on ?wifi=, so reload just the lobby. Reloading a game page
     * would throw the host out of a running game; there we only update the stored flag
     * that the lobby reads when the player goes back to it.
     */
    private fun onNetworkTypeChanged(nowWifi: Boolean) {
        val wifiFlag = if (nowWifi) "1" else "0"
        val curUrl = binding.webview.url ?: return
        if (!curUrl.startsWith(SERVER_URL)) return
        val path = android.net.Uri.parse(curUrl).path ?: "/"
        if (path == "/" || path == "/index.html") {
            binding.webview.loadUrl("$SERVER_URL?wifi=$wifiFlag")
        } else {
            binding.webview.evaluateJavascript("try{sessionStorage.setItem('wifi','$wifiFlag')}catch(e){}", null)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(networkPoll)
        try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            networkCallback?.let { cm.unregisterNetworkCallback(it) }
        } catch (e: Exception) { /* ignore */ }
    }

    /**
     * Picks the most likely LAN IP: a private IPv4 on a non-cellular, non-VPN interface.
     * Hotspot / Wi-Fi / Ethernet / USB-tether interfaces first, then 192.168 > 10 > 172.
     * Returns null when the phone only has cellular data (no LAN to share).
     */
    private fun getLanIp(): String? {
        val candidates = mutableListOf<Pair<String, String>>()  // (interface, ip)
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces() ?: return null
            while (interfaces.hasMoreElements()) {
                val iface = interfaces.nextElement()
                // Point-to-point links are tunnels (VPN, vendor gateways like vgate0) — never a LAN.
                if (!iface.isUp || iface.isLoopback || iface.isPointToPoint) continue
                if (NON_LAN_IFACE.containsMatchIn(iface.name)) continue
                val addrs = iface.inetAddresses
                while (addrs.hasMoreElements()) {
                    val ip = addrs.nextElement().hostAddress ?: continue
                    if (ip.indexOf(':') == -1 && PRIVATE_IPV4.containsMatchIn(ip)) {
                        candidates += iface.name to ip
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to enumerate interfaces", e)
        }
        return candidates.minByOrNull { (name, ip) ->
            val ifacePri = if (LAN_IFACE.containsMatchIn(name)) 0 else 10
            ifacePri + when {
                ip.startsWith("192.168.") -> 0
                ip.startsWith("10.") -> 1
                else -> 2
            }
        }?.second
    }

    // --- Asset Copying ---

    private fun copyAssetFolder(
        assetManager: android.content.res.AssetManager,
        fromPath: String,
        toPath: String
    ): Boolean {
        return try {
            val files = assetManager.list(fromPath) ?: return false
            if (files.isEmpty()) {
                copyAssetFile(assetManager, fromPath, toPath)
            } else {
                val dir = File(toPath)
                if (!dir.exists()) dir.mkdirs()
                var ok = true
                for (file in files) {
                    ok = ok && copyAssetFolder(assetManager, "$fromPath/$file", "$toPath/$file")
                }
                ok
            }
        } catch (e: Exception) {
            Log.e(TAG, "copyAssetFolder failed: $fromPath", e)
            false
        }
    }

    private fun copyAssetFile(
        assetManager: android.content.res.AssetManager,
        fromPath: String,
        toPath: String
    ): Boolean {
        return try {
            val input: InputStream = assetManager.open(fromPath)
            val output: OutputStream = FileOutputStream(toPath)
            input.copyTo(output)
            input.close()
            output.flush()
            output.close()
            true
        } catch (e: Exception) {
            Log.e(TAG, "copyAssetFile failed: $fromPath", e)
            false
        }
    }
}
