// Copyright AltraConsulenza Snc
// Generated on: 2026-05-09  (Europe/Rome)
// inizio file MainActivity.kt

package com.example.sunmitest2

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.core.content.FileProvider
import androidx.webkit.WebViewAssetLoader
import com.example.sunmitest2.printer.SunmiPrinterDriver
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.InnerResultCallback
import com.sunmi.peripheral.printer.SunmiPrinterService
import org.json.JSONObject
import java.io.File

class MainActivity : Activity() {

    private var printerService: SunmiPrinterService? = null
    private lateinit var webView: WebView
    private lateinit var printerDriver: SunmiPrinterDriver

    private val callback = object : InnerResultCallback() {
        override fun onRunResult(isSuccess: Boolean) {}
        override fun onReturnString(result: String?) {}
        override fun onRaiseException(code: Int, msg: String?) {
            Toast.makeText(this@MainActivity, "Errore: $msg", Toast.LENGTH_LONG).show()
        }
        override fun onPrintResult(code: Int, msg: String?) {}
    }

    private val printerCallback = object : InnerPrinterCallback() {
        override fun onConnected(service: SunmiPrinterService) {
            printerService = service
            printerDriver = SunmiPrinterDriver(service, callback, this@MainActivity)
        }

        override fun onDisconnected() {
            printerService = null
        }
    }

    inner class Bridge {

        @JavascriptInterface
        fun exec(json: String) {
            runOnUiThread {
                handleCommand(json)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        InnerPrinterManager.getInstance().bindService(this, printerCallback)

        webView = WebView(this)
        setContentView(webView)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest
            ): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }
        }

        webView.addJavascriptInterface(Bridge(), "Android")

        WebView.setWebContentsDebuggingEnabled(true)

        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (!::webView.isInitialized) return

        webView.evaluateJavascript(
            "window.onAndroidBack ? window.onAndroidBack() : false",
            null
        )
    }

    private fun pdfFile(fileName: String): File {
        val pdfDir = File(filesDir, "pdf")
        if (!pdfDir.exists()) pdfDir.mkdirs()
        return File(pdfDir, File(fileName).name)
    }

    private fun handleCommand(json: String) {
        try {
            val req = JSONObject(json)
            val id = req.getString("id")
            val action = req.getString("action")

            when (action) {

                "hello" -> {
                    sendSuccess(id, JSONObject().put("msg", "HELLO DAL NATIVE"))
                }

                "hardware_status" -> {
                    val data = JSONObject()
                    data.put("androidBridge", true)
                    data.put("printerService", printerService != null)
                    data.put("printerDriver", ::printerDriver.isInitialized)
                    data.put("manufacturer", Build.MANUFACTURER ?: "")
                    data.put("model", Build.MODEL ?: "")
                    data.put("android", Build.VERSION.RELEASE ?: "")
                    data.put("sdk", Build.VERSION.SDK_INT)
                    data.put("deviceId", Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "")
                    sendSuccess(id, data)
                }

                "print" -> {
                    if (!::printerDriver.isInitialized) {
                        sendError(id, "PRINTER_NOT_READY", "Stampante non pronta")
                        return
                    }

                    val rawPayload = req.get("payload")
                    val payload = if (rawPayload is JSONObject)
                        rawPayload.getJSONArray("lines")
                    else
                        rawPayload as org.json.JSONArray
                    val paperWidthMm = if (rawPayload is JSONObject)
                        rawPayload.optInt("paperWidthMm", 80)
                    else
                        80

                    printerDriver.print(
                        payload,
                        paperWidthMm,
                        onDone = {
                            sendSuccess(id, JSONObject().put("msg", "PRINT OK"))
                        },
                        onError = { e ->
                            sendError(
                                id,
                                "PRINT_ERROR",
                                e.message ?: "Errore stampa"
                            )
                        }
                    )
                }

                "pdf_save" -> {
                    val payload = req.getJSONObject("payload")
                    val fileName = payload.optString("fileName")
                    val contentB64 = payload.optString("contentB64")

                    if (fileName.isBlank() || contentB64.isBlank()) {
                        sendError(id, "PDF_DATA_MISSING", "Nome file o contenuto PDF mancante")
                        return
                    }

                    val file = pdfFile(fileName)
                    file.writeBytes(Base64.decode(contentB64, Base64.DEFAULT))

                    sendSuccess(id, JSONObject()
                        .put("fileName", file.name)
                        .put("saved", true))
                }

                "pdf_exists" -> {
                    val payload = req.getJSONObject("payload")
                    val fileName = payload.optString("fileName")
                    val file = pdfFile(fileName)

                    sendSuccess(id, JSONObject()
                        .put("fileName", file.name)
                        .put("exists", file.exists()))
                }

                "pdf_open" -> {
                    val payload = req.getJSONObject("payload")
                    val fileName = payload.optString("fileName")
                    val file = pdfFile(fileName)

                    if (!file.exists()) {
                        sendError(id, "PDF_NOT_FOUND", "PDF locale non trovato")
                        return
                    }

                    val uri = FileProvider.getUriForFile(
                        this,
                        packageName + ".fileprovider",
                        file
                    )

                    val intent = Intent(Intent.ACTION_VIEW)
                    intent.setDataAndType(uri, "application/pdf")
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    startActivity(intent)

                    sendSuccess(id, JSONObject().put("opened", true))
                }

                else -> {
                    sendError(id, "UNKNOWN_ACTION", "Azione non riconosciuta")
                }
            }

        } catch (e: Exception) {
            Toast.makeText(this, "JSON ERROR: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun sendSuccess(id: String, data: JSONObject) {
        val res = JSONObject()
        res.put("id", id)
        res.put("success", true)
        res.put("data", data)

        sendToJs(res)
    }

    private fun sendError(id: String, code: String, message: String) {
        val err = JSONObject()
        err.put("code", code)
        err.put("message", message)

        val res = JSONObject()
        res.put("id", id)
        res.put("success", false)
        res.put("error", err)

        sendToJs(res)
    }

    private fun sendToJs(json: JSONObject) {
        val payload = JSONObject.quote(json.toString())
        val script = "window.onNativeResponse($payload)"

        runOnUiThread {
            webView.evaluateJavascript(script, null)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        InnerPrinterManager.getInstance().unBindService(this, printerCallback)
    }
}

// fine file MainActivity.kt
