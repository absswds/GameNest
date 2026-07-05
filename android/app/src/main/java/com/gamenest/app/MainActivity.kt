package com.gamenest.app

import android.annotation.SuppressLint
import android.content.Context
import android.net.wifi.WifiManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
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

    companion object {
        private const val TAG = "LocalGames"
        private const val NODEJS_PROJECT_NAME = "nodejs-project"
        private const val SERVER_PORT = 3000
        private const val SERVER_URL = "http://localhost:$SERVER_PORT"

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

        binding.statusBar.text = "🎲 正在启动服务器…"
        binding.webview.visibility = View.GONE
        binding.splash.visibility = View.VISIBLE

        configureWebView()

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
        binding.webview.webViewClient = WebViewClient()
        binding.webview.webChromeClient = WebChromeClient()
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
                binding.statusBar.text = "❌ 服务器启动超时，请重启 App"
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
        val displayUrl = if (lanIp != null) "http://$lanIp:$SERVER_PORT" else SERVER_URL
        binding.statusBar.text = "📡 其他设备访问：$displayUrl"
        binding.webview.loadUrl(SERVER_URL)
        binding.webview.visibility = View.VISIBLE
        binding.splash.visibility = View.GONE
    }

    /** Picks the most likely LAN IP (192.168.x.x > 10.x.x.x > others). */
    private fun getLanIp(): String? {
        val candidates = mutableListOf<String>()
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val iface = interfaces.nextElement()
                if (!iface.isUp || iface.isLoopback) continue
                val addrs = iface.inetAddresses
                while (addrs.hasMoreElements()) {
                    val addr = addrs.nextElement()
                    if (!addr.isLoopbackAddress &&
                        addr.hostAddress != null &&
                        addr.hostAddress!!.indexOf(':') == -1) {
                        candidates += addr.hostAddress!!
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to enumerate interfaces", e)
        }
        // Sort: 192.168.* first, then 10.*, then others
        return candidates.minByOrNull { ip ->
            when {
                ip.startsWith("192.168.") -> 0
                ip.startsWith("10.") -> 1
                else -> 2
            }
        }
    }

    @Suppress("OVERRIDE_DEPRECATION", "DEPRECATION")
    override fun onBackPressed() {
        if (binding.webview.canGoBack()) {
            binding.webview.goBack()
        } else {
            super.onBackPressed()
        }
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
