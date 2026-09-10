// Copyright AltraConsulenza Snc
// Facade pubblica del business: le UI conoscono solo AppAPI.

const AppAPI = (() => {
    const listeners = new Map()
    const posUnsubscribers = []
    let initialized = false

    function clone(value) {
        return JSON.parse(JSON.stringify(value))
    }

    function on(eventName, callback) {
        if (!listeners.has(eventName)) listeners.set(eventName, new Set())
        listeners.get(eventName).add(callback)

        return () => {
            const set = listeners.get(eventName)
            if (set) set.delete(callback)
        }
    }

    function emit(eventName, detail) {
        const set = listeners.get(eventName)
        if (!set) return
        set.forEach(cb => cb(clone(detail || {})))
    }

    async function init() {
        if (initialized) return;

        await DB.init();
        await Catalog.init();

        [
            "change",
            "reset",
            "payment:start",
            "payment:empty",
            "fiscal:start",
            "fiscal:end",
            "receipt:saved",
            "print:start",
            "print:end",
            "print:error",
            "payment:end",
            "error"
        ].forEach(name => {
            posUnsubscribers.push(POS.on(name, detail => emit("pos:" + name, detail)))
        })

        Barcode.start()
        initialized = true
    }

    function getReparti() {
        return clone(Catalog.getReparti())
    }

    function getRepartoView(id) {
        const reparto = Catalog.getReparto(id)
        if (!reparto) return null

        if (String(reparto.vista || "BOTTONI").toUpperCase() === "LISTA") {
            return {
                reparto: clone(reparto),
                vista: "LISTA",
                articoli: clone(Catalog.getByReparto(id))
            }
        }

        return {
            reparto: clone(reparto),
            vista: "BOTTONI",
            slots: clone(Catalog.getButtonSlots(id))
        }
    }

    function searchArticoli(reparto, text) {
        return clone(Catalog.search(reparto, text))
    }

    function searchAllArticoli(text) {
        return clone(Catalog.search(null, text))
    }

    function getArticolo(id) {
        const article = Catalog.getById(id)
        return article ? clone(article) : null
    }

    function addArticolo(id, overridePrice) {
        const article = Catalog.getById(id)
        if (!article) return false
        POS.addArticle(article, overridePrice)
        return true
    }

    function scanBarcode(code) {
        const article = Catalog.findBarcode(code)

        if (!article) {
            emit("barcode:notfound", { code: code })
            return false
        }

        POS.addArticle(article)
        emit("barcode:found", { code: code, article: article })
        return true
    }

    function getPosState() {
        return POS.getState()
    }

    function removeItem(index) {
        POS.removeItem(index)
    }

    function setItemPrice(index, price) {
        POS.setPrice(index, price)
    }

    function duplicateItem(index, count) {
        POS.duplicateItem(index, count)
    }

    function addDiscount(value, percentMode) {
        POS.addDiscount(value, percentMode)
    }

    function resetPos() {
        POS.reset()
    }

    function pay(tipo) {
        return POS.pay(tipo)
    }

    async function saveArticle(article) {
        return Catalog.saveArticle(article)
    }

    async function saveReparti(reparti) {
        return Catalog.saveReparti(reparti)
    }

    async function getConfig() {
        const result = await Promise.all([
            DB.getConfig(),
            DB.getDeviceConfig()
        ])

        return {
            config: clone(result[0]),
            device: clone(result[1])
        }
    }

    async function saveCasse(casse, superConnect) {
        await Catalog.saveCasse(casse)
        await DB.saveDeviceConfig({ superConnect: Number(superConnect || 1) })
        return getConfig()
    }

    function getCasse() {
        return clone(Catalog.getCasse())
    }

    async function getDailySummary(giorno, selectedCasse) {
        return clone(await Reports.daily(giorno, selectedCasse))
    }

    return {
        init,
        on,
        getReparti,
        getRepartoView,
        searchArticoli,
        searchAllArticoli,
        getArticolo,
        addArticolo,
        scanBarcode,
        getPosState,
        removeItem,
        setItemPrice,
        duplicateItem,
        addDiscount,
        resetPos,
        pay,
        saveArticle,
        saveReparti,
        getConfig,
        saveCasse,
        getCasse,
        getDailySummary
    }
})()

window.SystemAudit = (() => {
    let running = false

    function messageOf(error) {
        return error && error.message ? error.message : String(error)
    }

    function stackOf(error) {
        return error && error.stack ? error.stack : ""
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    async function runStep(label, fn, options) {
        const opts = options || {}

        try {
            const result = await fn()
            const detail = result && result.detail ? result.detail : ""

            if (result && result.warning) {
                BootTerminal.warn(label + " - " + result.warning, detail)
                return { ok: true, warning: true, result: result }
            }

            BootTerminal.ok(label + (result && result.message ? " - " + result.message : ""), detail)
            return { ok: true, result: result }
        } catch (error) {
            const detail = stackOf(error)

            if (opts.warning) {
                BootTerminal.warn(label + " - " + messageOf(error), detail)
                return { ok: true, warning: true }
            }

            BootTerminal.fail(label + " - " + messageOf(error), detail)
            return { ok: false }
        }
    }

    async function auditRuntime() {
        const required = [
            ["Promise", typeof Promise !== "undefined"],
            ["Map", typeof Map !== "undefined"],
            ["Set", typeof Set !== "undefined"],
            ["fetch", typeof fetch === "function"],
            ["IndexedDB", typeof indexedDB !== "undefined"],
            ["Array.from", typeof Array.from === "function"]
        ]

        const missing = required.filter(row => !row[1]).map(row => row[0])
        if (missing.length) throw new Error("API mancanti: " + missing.join(", "))

        return { message: navigator.userAgent }
    }

    async function auditModules() {
        const required = [
            ["Config", typeof Config !== "undefined"],
            ["Bridge Android", typeof Bridge !== "undefined"],
            ["Receipt renderer", typeof renderReceiptIT === "function"],
            ["DB", typeof DB !== "undefined"],
            ["Catalog", typeof Catalog !== "undefined"],
            ["Fiscal", typeof Fiscal !== "undefined"],
            ["POS", typeof POS !== "undefined"],
            ["Reports", typeof Reports !== "undefined"],
            ["Router", typeof Router !== "undefined"],
            ["Barcode", typeof Barcode !== "undefined"]
        ]

        const missing = required.filter(row => !row[1]).map(row => row[0])
        if (missing.length) throw new Error("Moduli mancanti: " + missing.join(", "))

        return { message: required.length + " moduli caricati" }
    }

    async function auditReceiptRenderer() {
        const rows = renderReceiptIT({
            righe: [],
            totale: 0,
            mp: "CA",
            data: "01/01/2000",
            ora: "00:00",
            fiscal: {}
        })

        if (!Array.isArray(rows) || rows.length === 0) {
            throw new Error("Il renderer non produce righe di stampa")
        }

        return { message: rows.length + " comandi generati" }
    }

    async function auditCatalog() {
        await Catalog.init()
        const reparti = Catalog.getReparti()
        const articoli = Catalog.getAll()

        if (!Array.isArray(reparti)) throw new Error("Reparti non validi")
        if (!Array.isArray(articoli)) throw new Error("Articoli non validi")

        return {
            message: reparti.length + " reparti / " + articoli.length + " articoli"
        }
    }

    async function auditPOS() {
        const state = POS.getState()
        if (!state || !Array.isArray(state.items)) throw new Error("Stato POS non valido")
        if (typeof state.total !== "number") throw new Error("Totale POS non valido")
        return { message: "motore pronto" }
    }

    async function auditReports() {
        if (typeof Reports.daily !== "function") throw new Error("Reports.daily non disponibile")
        return { message: "riepiloghi disponibili" }
    }

    async function auditFiscal() {
        if (typeof Fiscal.prepareIT !== "function" || typeof Fiscal.fiscalizeIT !== "function") {
            throw new Error("Interfaccia fiscale incompleta")
        }

        if (!Config.intestazione || !Config.intestazione.userScade) {
            return { warning: "identificativo fiscale non configurato" }
        }

        return { message: "interfaccia configurata" }
    }

    async function auditHardware() {
        let last = null

        for (let attempt = 0; attempt < 8; attempt++) {
            last = await Bridge.auditHardware(1200)

            if (last.mock) {
                return { warning: "bridge mock browser - hardware non verificabile" }
            }

            if (last.androidBridge && last.printerService && last.printerDriver) {
                return {
                    message: (last.manufacturer || "SUNMI") + " " + (last.model || "") + " / stampante pronta"
                }
            }

            await delay(300)
        }

        if (!last || !last.androidBridge) throw new Error("Bridge Android non disponibile")
        throw new Error("Stampante Sunmi non pronta")
    }

    async function auditViews() {
        const results = await Router.auditAll()
        let failures = 0

        results.forEach(result => {
            if (result.ok) {
                BootTerminal.ok("VIEW " + result.name.toUpperCase() + " - HTML / CSS / JS / audit")
            } else {
                failures++
                BootTerminal.fail(
                    "VIEW " + result.name.toUpperCase() + " - " + result.error,
                    result.detail || ""
                )
            }
        })

        return failures
    }

    async function run() {
        if (running) return
        running = true
        window.__BOOT_STARTED__ = true

        const earlyErrors = BootTerminal.getRuntimeErrorCount()
        const appView = document.getElementById("appView")
        if (appView) appView.style.display = "none"

        BootTerminal.show()
        BootTerminal.reset()
        BootTerminal.info("SOLX POS SYSTEM BOOT")
        BootTerminal.info("Audit completo sistema")
        if (earlyErrors) {
            BootTerminal.warn("Rilevati " + earlyErrors + " errore/i JavaScript prima dell'audit - vedere DETTAGLI")
        }

        let failures = 0

        let step = await runStep("JavaScript runtime", auditRuntime)
        if (!step.ok) failures++

        step = await runStep("Moduli applicativi", auditModules)
        if (!step.ok) failures++

        step = await runStep("PouchDB library", async () => {
            if (typeof PouchDB === "undefined") throw new Error("PouchDB non caricato")
            return { message: "v" + (PouchDB.version || "?") + " locale" }
        })
        if (!step.ok) failures++

        let dbReady = false
        step = await runStep("Database locale", async () => {
            await DB.init()
            const result = await DB.audit()
            dbReady = true
            return result
        })
        if (!step.ok) failures++

        if (dbReady) {
            await runStep("CouchDB remoto", () => DB.auditRemote(), { warning: true })
        } else {
            BootTerminal.warn("CouchDB remoto - non verificato perché il DB locale non è disponibile")
        }

        step = await runStep("Configurazione POS", async () => {
            if (!dbReady) throw new Error("Database non disponibile")
            const config = await DB.getConfig()
            if (!config || !Array.isArray(config.reparti)) throw new Error("Configurazione reparti non valida")
            return { message: config.reparti.length + " reparti configurati" }
        })
        if (!step.ok) failures++

        step = await runStep("Catalogo articoli", auditCatalog)
        if (!step.ok) failures++

        step = await runStep("Motore POS", auditPOS)
        if (!step.ok) failures++

        step = await runStep("Renderer ricevuta", auditReceiptRenderer)
        if (!step.ok) failures++

        step = await runStep("Report giornalieri", auditReports)
        if (!step.ok) failures++

        await runStep("Interfaccia fiscale", auditFiscal, { warning: true })

        step = await runStep("Bridge Android / stampante", auditHardware)
        if (!step.ok) failures++

        step = await runStep("Barcode HID", async () => {
            Barcode.start()
            return { message: "listener tastiera attivo" }
        })
        if (!step.ok) failures++

        const viewFailures = await auditViews()
        failures += viewFailures

        if (failures === 0) {
            step = await runStep("AppAPI", async () => {
                await AppAPI.init()
                return { message: "business inizializzato" }
            })

            if (!step.ok) failures++
        }

        if (failures === 0) {
            step = await runStep("Interfaccia cassa", async () => {
                await Router.open("cassa")
                return { message: "mount completato" }
            })

            if (!step.ok) failures++
        }

        if (failures === 0) {
            BootTerminal.ready("SYSTEM READY - avvio cassa")
            if (appView) appView.style.display = ""
            setTimeout(() => BootTerminal.hide(), 450)
        } else {
            BootTerminal.failed(failures)
            BootTerminal.setTechnical()
        }

        running = false
    }

    return { run }
})()

window.addEventListener("DOMContentLoaded", () => {
    SystemAudit.run()
})
