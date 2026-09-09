// Copyright AltraConsulenza Snc
// Generated on: 2026-05-09  (Europe/Rome)
// inizio file MainActivity.kt

package com.example.sunmitest2

import android.app.Activity
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.JavascriptInterface
import android.widget.Toast
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.InnerResultCallback
import com.sunmi.peripheral.printer.SunmiPrinterService
import org.json.JSONObject
import com.example.sunmitest2.printer.SunmiPrinterDriver

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
            //Toast.makeText(this@MainActivity, "STAMPANTE CONNESSA", Toast.LENGTH_LONG).show()
        }

        override fun onDisconnected() {
            printerService = null
            //Toast.makeText(this@MainActivity, "STAMPANTE DISCONNESSA", Toast.LENGTH_LONG).show()
        }
    }

    inner class Bridge {

        @JavascriptInterface
        fun exec(json: String) {
            runOnUiThread {
                //Toast.makeText(this@MainActivity, "JS CALL: $json", Toast.LENGTH_SHORT).show()
                handleCommand(json)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        InnerPrinterManager.getInstance().bindService(this, printerCallback)

        webView = WebView(this)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = true
        webView.settings.allowFileAccessFromFileURLs = true
        webView.settings.allowUniversalAccessFromFileURLs = true
        webView.settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        webView.webViewClient = WebViewClient()

        webView.addJavascriptInterface(Bridge(), "Android")

        WebView.setWebContentsDebuggingEnabled(true)

        webView.loadUrl("file:///android_asset/index.html")
    }

    private fun handleCommand(json: String) {
        try {
            val req = JSONObject(json)
            val id = req.getString("id")
            val action = req.getString("action")

            //Toast.makeText(this, "ACTION: $action", Toast.LENGTH_SHORT).show()

            when (action) {

                "hello" -> {
                    sendSuccess(id, JSONObject().put("msg", "HELLO DAL NATIVE"))
                }

                "print" -> {
                    //Toast.makeText(this, "PRINT REQUEST", Toast.LENGTH_SHORT).show()

                    if (!::printerDriver.isInitialized) {
                        //Toast.makeText(this, "DRIVER NON PRONTO", Toast.LENGTH_SHORT).show()
                        sendError(id, "PRINTER_NOT_READY", "Stampante non pronta")
                        return
                    }

                    val payload = req.getJSONArray("payload")

                    printerDriver.print(
                        payload,
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