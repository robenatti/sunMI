// Boot minimale volutamente ES5: deve restare visibile anche se un modulo moderno fallisce.

var BootTerminal = (function () {
    var technical = []
    var runtimeErrors = 0

    function el(id) {
        return document.getElementById(id)
    }

    function safeText(value) {
        if (value == null) return ""
        return String(value)
    }

    function append(status, message, detail) {
        var log = el("bootLog")
        if (!log) return

        var line = document.createElement("div")
        var label = status
        var css = "boot-info"

        if (status === "OK") css = "boot-ok"
        else if (status === "WARN") css = "boot-warn"
        else if (status === "FAIL") css = "boot-fail"
        else label = "...."

        line.className = "boot-line " + css
        line.textContent = "[" + label + "] " + safeText(message)
        log.appendChild(line)

        if (detail) {
            technical.push(safeText(message) + "\n" + safeText(detail))
        }

        var monitor = document.querySelector(".boot-monitor")
        if (monitor) monitor.scrollTop = monitor.scrollHeight
    }

    function reset() {
        var log = el("bootLog")
        if (log) log.innerHTML = ""

        var summary = el("bootSummary")
        if (summary) summary.textContent = ""

        var actions = el("bootActions")
        if (actions) actions.classList.remove("show")

        var detail = el("bootTechnical")
        if (detail) {
            detail.classList.remove("show")
            detail.textContent = ""
        }
    }

    function show() {
        var screen = el("bootScreen")
        if (screen) screen.classList.remove("hidden")
    }

    function hide() {
        var screen = el("bootScreen")
        if (screen) screen.classList.add("hidden")
    }

    function info(message, detail) {
        append("INFO", message, detail)
    }

    function ok(message, detail) {
        append("OK", message, detail)
    }

    function warn(message, detail) {
        append("WARN", message, detail)
    }

    function fail(message, detail) {
        append("FAIL", message, detail)
    }

    function assetFailure(name) {
        runtimeErrors++
        fail("Modulo non caricato: " + name, "Errore caricamento asset/script")
    }

    function captureError(message, source, line, column, error) {
        runtimeErrors++

        var detail = ""
        if (source) detail += source
        if (line) detail += ":" + line
        if (column) detail += ":" + column
        if (error && error.stack) detail += "\n" + error.stack

        fail("Errore JavaScript: " + safeText(message), detail)
        return false
    }

    function captureRejection(event) {
        runtimeErrors++
        var reason = event && event.reason ? event.reason : "Promise rifiutata"
        var message = reason && reason.message ? reason.message : safeText(reason)
        var detail = reason && reason.stack ? reason.stack : ""
        fail("Promise non gestita: " + message, detail)
    }

    function ready(message) {
        var summary = el("bootSummary")
        if (summary) {
            summary.className = "boot-summary boot-ok"
            summary.textContent = message || "SYSTEM READY"
        }
    }

    function failed(count) {
        var summary = el("bootSummary")
        if (summary) {
            summary.className = "boot-summary boot-fail"
            summary.textContent = "BOOT FAILED - " + count + " errore/i bloccante/i"
        }

        var actions = el("bootActions")
        if (actions) actions.classList.add("show")
    }

    function setTechnical(extra) {
        var detail = el("bootTechnical")
        if (!detail) return

        var rows = technical.slice()
        if (extra) rows.push(safeText(extra))
        detail.textContent = rows.join("\n\n") || "Nessun dettaglio tecnico disponibile."
    }

    function getRuntimeErrorCount() {
        return runtimeErrors
    }

    window.onerror = captureError
    window.addEventListener("unhandledrejection", captureRejection)

    window.addEventListener("load", function () {
        setTimeout(function () {
            if (!window.__BOOT_STARTED__) {
                show()
                fail("SystemAudit non avviato", "app.js non caricato o errore prima dell'avvio dell'audit")
                failed(1)
                setTechnical()
            }
        }, 1200)
    })

    document.addEventListener("click", function (event) {
        if (event.target && event.target.id === "bootDetails") {
            var detail = el("bootTechnical")
            if (!detail) return
            setTechnical()
            detail.classList.toggle("show")
        }

        if (event.target && event.target.id === "bootRetry") {
            if (window.SystemAudit && typeof window.SystemAudit.run === "function") {
                window.SystemAudit.run()
            }
        }
    })

    return {
        reset: reset,
        show: show,
        hide: hide,
        info: info,
        ok: ok,
        warn: warn,
        fail: fail,
        ready: ready,
        failed: failed,
        setTechnical: setTechnical,
        assetFailure: assetFailure,
        getRuntimeErrorCount: getRuntimeErrorCount
    }
})()
