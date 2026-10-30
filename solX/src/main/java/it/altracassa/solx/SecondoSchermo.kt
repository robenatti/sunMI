// Copyright AltraConsulenza Snc
// inizio file SecondoSchermo.kt
// Display cliente Android: pagina HTML condivisa tra App e SolX.

package it.altracassa.solx

import android.app.Activity
import android.app.Presentation
import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Display
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

class SecondoSchermo(private val activity: Activity) : DisplayManager.DisplayListener {
    private val displayManager =
        activity.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
    private var started = false
    private var presentation: CustomerPresentation? = null
    private var lastReceipt: JSONObject? = null

    fun start() {
        if (started) return
        started = true
        displayManager.registerDisplayListener(this, Handler(Looper.getMainLooper()))
        refresh()
    }

    fun displayReceipt(data: JSONObject): Boolean {
        lastReceipt = data
        if (presentation == null) refresh()
        presentation?.render(data)
        return presentation != null
    }

    fun stop() {
        if (!started) return
        started = false
        displayManager.unregisterDisplayListener(this)
        presentation?.dismiss()
        presentation = null
    }

    override fun onDisplayAdded(displayId: Int) = refresh()
    override fun onDisplayRemoved(displayId: Int) = refresh()
    override fun onDisplayChanged(displayId: Int) = refresh()

    private fun refresh() {
        if (!started) return

        val target = displayManager
            .getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION)
            .firstOrNull { it.displayId != Display.DEFAULT_DISPLAY }
            ?: displayManager.displays.firstOrNull {
                it.displayId != Display.DEFAULT_DISPLAY
            }

        if (presentation != null && presentation?.display?.displayId == target?.displayId) return

        presentation?.dismiss()
        presentation = null
        if (target == null) return

        try {
            val next = CustomerPresentation(target)
            next.show()
            presentation = next
            lastReceipt?.let { next.render(it) }
        } catch (e: Exception) {
            Log.w("SecondoSchermo", "Secondo display non utilizzabile", e)
        }
    }

    private inner class CustomerPresentation(display: Display) : Presentation(activity, display) {
        private var customerWebView: WebView? = null
        private var ready = false

        override fun onCreate(savedInstanceState: Bundle?) {
            super.onCreate(savedInstanceState)

            val assets = WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(activity))
                .build()

            val page = WebView(context)
            customerWebView = page
            page.settings.javaScriptEnabled = true
            page.settings.domStorageEnabled = true
            page.settings.allowFileAccess = false
            page.settings.allowContentAccess = false
            page.webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest
                ): WebResourceResponse? = assets.shouldInterceptRequest(request.url)

                override fun onPageFinished(view: WebView?, url: String?) {
                    ready = true
                    lastReceipt?.let { render(it) }
                }
            }

            setContentView(page)
            page.loadUrl("https://appassets.androidplatform.net/assets/secondoSchermo/index.html")
        }

        fun render(data: JSONObject) {
            if (!ready) return
            val json = JSONObject.quote(data.toString())
            customerWebView?.evaluateJavascript(
                "window.displayReceipt && window.displayReceipt(JSON.parse($json))",
                null
            )
        }

        override fun onStop() {
            ready = false
            customerWebView?.let { page ->
                (page.parent as? ViewGroup)?.removeView(page)
                page.destroy()
            }
            customerWebView = null
            super.onStop()
        }
    }
}

// fine file SecondoSchermo.kt