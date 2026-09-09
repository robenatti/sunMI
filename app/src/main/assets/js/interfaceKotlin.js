// Copyright AltraConsulenza Snc
// Generated on: 2026-05-09 (Europe/Rome)
// inizio file interfaceKotlin.js

// Funzioni esposte:
// - Bridge.exec(action, payload, timeout): invia un comando al layer nativo Android/Kotlin.
// - Bridge.onNativeResponse(response): riceve la risposta dal layer nativo.
// - window.onNativeResponse(res): entry point globale richiamabile dal layer nativo.

const Bridge = {
    callbacks: {},
    timeoutMs: 5000,
    seq: 0,

    exec(action, payload = {}, timeout = 5000) {
        return new Promise((resolve, reject) => {

            this.seq++

            const id = Date.now().toString() + "-" + this.seq.toString()

            const timer = setTimeout(() => {
                delete this.callbacks[id]
                reject({ message: "Timeout native", action: action })
            }, timeout)

            this.callbacks[id] = {
                resolve: resolve,
                reject: reject,
                timer: timer
            }

            try {
                Android.exec(JSON.stringify({
                    id: id,
                    action: action,
                    payload: payload
                }))
            } catch (e) {
                clearTimeout(timer)
                delete this.callbacks[id]

                reject({
                    message: "Errore chiamata native",
                    action: action,
                    error: e && e.message ? e.message : String(e)
                })
            }

        })
    },

    onNativeResponse(response) {
        let res = null

        try {
            res = JSON.parse(response)
        } catch (e) {
            return
        }

        const cb = this.callbacks[res.id]

        if (!cb) return

        clearTimeout(cb.timer)

        if (res.success) {
            cb.resolve(res.data)
        } else {
            cb.reject(res.error || { message: "Errore native" })
        }

        delete this.callbacks[res.id]
    }
}

window.onNativeResponse = function (res) {
    Bridge.onNativeResponse(res)
}

if (typeof Android === "undefined") {

    window.Android = {
        exec: function (json) {

            const req = JSON.parse(json)

            setTimeout(() => {
                window.onNativeResponse(JSON.stringify({
                    id: req.id,
                    success: true,
                    data: {
                        mock: true,
                        action: req.action
                    }
                }))
            }, 300)
        }
    }
}

// fine file interfaceKotlin.js