// Copyright AltraConsulenza Snc
// Generated on: 2026-05-09  (Europe/Rome)
// inizio file SunmiPrinterDriver.kt

package com.example.sunmitest2.printer

import android.app.Activity
import android.widget.Toast
import com.sunmi.peripheral.printer.InnerResultCallback
import com.sunmi.peripheral.printer.SunmiPrinterService
import org.json.JSONArray

class SunmiPrinterDriver(
    private val service: SunmiPrinterService?,
    private val callback: InnerResultCallback,
    private val activity: Activity
) {

    // ===== PROPORZIONI FISSE 80mm =====
    private val WIDTHS_ALL = 47   // descrizione / iva / prezzo
    private val WIDTHS_3 = intArrayOf(31, 5, 11)   // descrizione / iva / prezzo
    private val ALIGN_3  = intArrayOf(0, 1, 2)

    private val WIDTHS_2 = intArrayOf(31, 16)      // label / valore
    private val ALIGN_2  = intArrayOf(0, 2)

    fun print(
        lines: JSONArray,
        onDone: () -> Unit,
        onError: (Exception) -> Unit
    ) {

        val svc = service ?: run {
            val e = Exception("Stampante non pronta")
            Toast.makeText(activity, "Stampante non pronta", Toast.LENGTH_SHORT).show()
            onError(e)
            return
        }

        try {

            svc.printerInit(callback)

            for (i in 0 until lines.length()) {

                val line = lines.getJSONObject(i)

                val bold = line.optBoolean("bold", false)
                val align = line.optString("align", "left")
                val double = line.optBoolean("double", false)

                // ALIGN
                when (align) {
                    "center" -> svc.setAlignment(1, callback)
                    "right" -> svc.setAlignment(2, callback)
                    else -> svc.setAlignment(0, callback)
                }

                // BOLD
                svc.sendRAWData(
                    if (bold) byteArrayOf(0x1B, 0x45, 0x01)
                    else byteArrayOf(0x1B, 0x45, 0x00),
                    callback
                )

                // DOUBLE SIZE
                svc.sendRAWData(
                    if (double) byteArrayOf(0x1D, 0x21, 0x11)
                    else byteArrayOf(0x1D, 0x21, 0x00),
                    callback
                )

                // ===== QRCODE =====
                if (line.has("qrcode")) {
                    svc.setAlignment(1, callback) // centro
                    svc.printQRCode(line.getString("qrcode"), 4, 0, callback)
                    continue
                }

                // ===== BARCODE =====
                if (line.has("barcode")) {
                    svc.printBarCode(line.getString("barcode"), 8, 80, 2, 2, callback)
                    continue
                }

                // ===== COLUMNS (FIXED WIDTH) =====
                if (line.has("columns")) {

                    val arr = line.getJSONArray("columns")
                    val cols = Array(arr.length()) { arr.getString(it) }

                    when (cols.size) {
                        3 -> svc.printColumnsText(cols, WIDTHS_3, ALIGN_3, callback)
                        2 -> svc.printColumnsText(cols, WIDTHS_2, ALIGN_2, callback)
                        else -> svc.printColumnsText(
                            cols,
                            IntArray(cols.size) { 48 / cols.size },
                            IntArray(cols.size) { 0 },
                            callback
                        )
                    }

                    continue
                }

                // ===== SEPARATOR =====
                if (line.optBoolean("separator", false)) {
                    svc.printText("-".repeat(47) + "\n", callback)
                    continue
                }

                // ===== NEWLINE =====
                if (line.has("newline")) {
                    repeat(line.getInt("newline")) {
                        svc.printText("\n", callback)
                    }
                    continue
                }

                // ===== TEXT =====
                if (line.has("text")) {

                    val text = line.getString("text")

                    svc.printText(text + "\n", callback)

                    continue
                }
            }

            onDone()

        } catch (e: Exception) {
            Toast.makeText(activity, "PRINT ERROR: ${e.message}", Toast.LENGTH_LONG).show()
            onError(e)
        }
    }
}

// fine file SunmiPrinterDriver.kt