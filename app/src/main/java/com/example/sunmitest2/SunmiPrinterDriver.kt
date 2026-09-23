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

    private data class PrintProfile(
        val totalWidth: Int,
        val widths3: IntArray,
        val widths2: IntArray
    )

    private val ALIGN_3 = intArrayOf(0, 1, 2)
    private val ALIGN_2 = intArrayOf(0, 2)

    private fun profileFor(paperWidthMm: Int): PrintProfile {
        return if (paperWidthMm <= 58) {
            PrintProfile(
                totalWidth = 31,
                widths3 = intArrayOf(19, 4, 8),
                widths2 = intArrayOf(19, 12)
            )
        } else {
            PrintProfile(
                totalWidth = 47,
                widths3 = intArrayOf(31, 5, 11),
                widths2 = intArrayOf(31, 16)
            )
        }
    }

    fun print(
        lines: JSONArray,
        paperWidthMm: Int = 80,
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

            val profile = profileFor(paperWidthMm)

            svc.printerInit(callback)

            for (i in 0 until lines.length()) {

                val line = lines.getJSONObject(i)

                val bold = line.optBoolean("bold", false)
                val align = line.optString("align", "left")
                val double = line.optBoolean("double", false)

                when (align) {
                    "center" -> svc.setAlignment(1, callback)
                    "right" -> svc.setAlignment(2, callback)
                    else -> svc.setAlignment(0, callback)
                }

                svc.sendRAWData(
                    if (bold) byteArrayOf(0x1B, 0x45, 0x01)
                    else byteArrayOf(0x1B, 0x45, 0x00),
                    callback
                )

                svc.sendRAWData(
                    if (double) byteArrayOf(0x1D, 0x21, 0x11)
                    else byteArrayOf(0x1D, 0x21, 0x00),
                    callback
                )

                if (line.has("qrcode")) {
                    svc.setAlignment(1, callback)
                    svc.printQRCode(line.getString("qrcode"), 4, 0, callback)
                    continue
                }

                if (line.has("barcode")) {
                    svc.printBarCode(line.getString("barcode"), 8, 80, 2, 2, callback)
                    continue
                }

                if (line.has("columns")) {

                    val arr = line.getJSONArray("columns")
                    val cols = Array(arr.length()) { arr.getString(it) }

                    val isReceiptHeader58 =
                        paperWidthMm <= 58 &&
                        cols.size == 3 &&
                        cols[2] == "PREZZO (€)"

                    val isElectronicPayment58 =
                        paperWidthMm <= 58 &&
                        cols.size == 2 &&
                        cols[0].equals("PAGAMENTO ELETTRONICO", ignoreCase = true)

                    val isProductsClose58 =
                        paperWidthMm <= 58 &&
                        cols.size == 2 &&
                        cols[0] == "Incasso per PRODOTTI"

                    if (isReceiptHeader58) {
                        cols[2] = "PREZZO €"
                    }

                    when (cols.size) {
                        3 -> svc.printColumnsText(
                            cols,
                            if (isReceiptHeader58) intArrayOf(19, 4, 9) else profile.widths3,
                            ALIGN_3,
                            callback
                        )
                        2 -> svc.printColumnsText(
                            cols,
                            when {
                                isElectronicPayment58 -> intArrayOf(21, 10)
                                isProductsClose58 -> intArrayOf(20, 11)
                                else -> profile.widths2
                            },
                            ALIGN_2,
                            callback
                        )
                        else -> svc.printColumnsText(
                            cols,
                            IntArray(cols.size) { profile.totalWidth / cols.size },
                            IntArray(cols.size) { 0 },
                            callback
                        )
                    }

                    continue
                }

                if (line.optBoolean("separator", false)) {
                    svc.printText("-".repeat(profile.totalWidth) + "\n", callback)
                    continue
                }

                if (line.has("newline")) {
                    repeat(line.getInt("newline")) {
                        svc.printText("\n", callback)
                    }
                    continue
                }

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