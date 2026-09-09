// Copyright AltraConsulenza Snc
// Generated on: 2026-04-10 (Europe/Rome)
// inizio file NexiMobileDriver.kt

package com.example.sunmitest2.nexi

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.widget.Toast

class NexiMobileDriver(
    private val activity: Activity
) {

    fun pay(
        amountEuro: Double,
        jsId: String
    ) {

        try {

            // ===== CONVERSIONE IMPORTO =====
            val amountCents = (amountEuro * 100).toInt()

            // ===== CALLBACK URI =====
            val callback = "demonexi://payment"

            // ===== COSTRUZIONE URI =====
            val uri = Uri.Builder()
                .scheme("neximpos")
                .authority("payment")
                .appendQueryParameter("amount", amountCents.toString())
                .appendQueryParameter("callerTrxId", jsId)
                .appendQueryParameter("callerName", "SunmiApp")
                .appendQueryParameter("uri", callback)
                .appendQueryParameter("sendTicket", "true")
                .appendQueryParameter("urlTicket", "true")
                .build()

            // ===== INTENT =====
            val intent = Intent(Intent.ACTION_VIEW, uri)

            activity.startActivity(intent)

        } catch (e: Exception) {
            Toast.makeText(activity, "NEXI ERROR: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
}

// fine file NexiMobileDriver.kt