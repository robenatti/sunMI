// Copyright AltraConsulenza Snc
// Generated on: 2026-05-09  (Europe/Rome)
// inizio file MainActivity.kt

package com.example.sunmitest2

import android.app.Activity
import android.app.AlertDialog
import android.app.Dialog
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.Build
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.provider.Settings
import android.util.Base64
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
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

        webView.webChromeClient = object : WebChromeClient() {
            override fun onJsConfirm(
                view: WebView?,
                url: String?,
                message: String?,
                result: JsResult?
            ): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message ?: "")
                    .setNegativeButton("NO") { dialog, _ ->
                        result?.cancel()
                        dialog.dismiss()
                    }
                    .setPositiveButton("OK") { dialog, _ ->
                        result?.confirm()
                        dialog.dismiss()
                    }
                    .setOnCancelListener {
                        result?.cancel()
                    }
                    .show()

                return true
            }
        }

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

    private fun openPdfInternal(file: File) {
        val descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
        val renderer = PdfRenderer(descriptor)

        if (renderer.pageCount <= 0) {
            renderer.close()
            descriptor.close()
            throw IllegalStateException("PDF senza pagine")
        }

        val dialog = Dialog(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.WHITE)
        }

        val title = TextView(this).apply {
            text = file.name
            setTextColor(Color.BLACK)
            textSize = 16f
            gravity = Gravity.CENTER
            setPadding(12, 12, 12, 12)
        }

        val image = ImageView(this).apply {
            adjustViewBounds = true
            scaleType = ImageView.ScaleType.FIT_CENTER
            setBackgroundColor(Color.WHITE)
        }

        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(8, 8, 8, 8)
        }

        val previous = Button(this).apply { text = "←" }
        val pageLabel = TextView(this).apply {
            setTextColor(Color.BLACK)
            gravity = Gravity.CENTER
        }
        val next = Button(this).apply { text = "→" }
        val close = Button(this).apply { text = "CHIUDI" }

        controls.addView(previous, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        controls.addView(pageLabel, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 2f))
        controls.addView(next, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        controls.addView(close, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 2f))

        root.addView(title, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        root.addView(image, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        root.addView(controls, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        dialog.setContentView(root)

        var pageIndex = 0
        var bitmap: Bitmap? = null

        fun renderPage() {
            val page = renderer.openPage(pageIndex)
            val targetWidth = resources.displayMetrics.widthPixels.coerceAtLeast(1)
            val targetHeight = (targetWidth.toFloat() * page.height.toFloat() / page.width.toFloat())
                .toInt()
                .coerceAtLeast(1)

            bitmap?.recycle()
            bitmap = Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888).apply {
                eraseColor(Color.WHITE)
            }

            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            page.close()

            image.setImageBitmap(bitmap)
            pageLabel.text = "${pageIndex + 1} / ${renderer.pageCount}"
            previous.isEnabled = pageIndex > 0
            next.isEnabled = pageIndex < renderer.pageCount - 1
        }

        previous.setOnClickListener {
            if (pageIndex > 0) {
                pageIndex--
                renderPage()
            }
        }

        next.setOnClickListener {
            if (pageIndex < renderer.pageCount - 1) {
                pageIndex++
                renderPage()
            }
        }

        close.setOnClickListener {
            dialog.dismiss()
        }

        dialog.setOnDismissListener {
            image.setImageDrawable(null)
            bitmap?.recycle()
            renderer.close()
            descriptor.close()
        }

        renderPage()
        dialog.show()
        dialog.window?.setLayout(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
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

                    openPdfInternal(file)
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
