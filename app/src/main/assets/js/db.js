// Copyright AltraConsulenza Snc
// PouchDB persistence layer. Nessuna dipendenza dalla UI.

const DB = (() => {
    let dbs = null
    let dbNames = null
    let remotes = null
    let syncHandles = []
    let initialized = false
    let initPromise = null

    function cleanName(value) {
        return String(value || "sunmi")
            .toLowerCase()
            .replace(/[^a-z0-9_$()+-]/g, "-")
    }

    function parseNumber(value) {
        if (typeof value === "number") return value
        const normalized = String(value || "0").replace(",", ".")
        const n = Number(normalized)
        return Number.isFinite(n) ? n : 0
    }

    function uuid() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return window.crypto.randomUUID()
        }

        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0
            const v = c === "x" ? r : (r & 0x3 | 0x8)
            return v.toString(16)
        })
    }

    function withTimeout(promise, ms, message) {
        return Promise.race([
            promise,
            new Promise((resolve, reject) => {
                setTimeout(() => reject(new Error(message || "Timeout")), ms)
            })
        ])
    }

    async function init() {
        if (initialized) return
        if (initPromise) return initPromise

        initPromise = (async () => {
            if (typeof PouchDB === "undefined") {
                throw new Error("PouchDB non disponibile")
            }

            const prefix = cleanName(Config.salone || Config.piva || "sunmi")

            dbNames = {
                articoli: prefix + "-pos-articoli",
                config: prefix + "-pos-config",
                receipt: prefix + "-pos-receipt"
            }

            dbs = {
                articoli: new PouchDB(dbNames.articoli),
                config: new PouchDB(dbNames.config),
                receipt: new PouchDB(dbNames.receipt)
            }

            configureRemotes()
            await primeFromRemote()
            await ensureSeed()
            startLiveSync()
            initialized = true
        })()

        try {
            await initPromise
        } catch (error) {
            syncHandles.forEach(handle => {
                if (handle && typeof handle.cancel === "function") handle.cancel()
            })
            syncHandles = []
            dbs = null
            dbNames = null
            remotes = null
            initialized = false
            throw error
        } finally {
            initPromise = null
        }
    }

    function configureRemotes() {
        const base = String(Config.couchdbBaseUrl || "").replace(/\/$/, "")
        if (!base) return

        remotes = {}
        Object.keys(dbs).forEach(key => {
            remotes[key] = new PouchDB(base + "/" + dbNames[key])
        })
    }

    async function primeFromRemote() {
        if (!remotes) return

        await Promise.all(Object.keys(dbs).map(async key => {
            try {
                await dbs[key].replicate.from(remotes[key])
            } catch (e) {
                console.warn("Replica iniziale non disponibile", key, e)
            }
        }))
    }

    function startLiveSync() {
        if (!remotes) return

        Object.keys(dbs).forEach(key => {
            const handle = dbs[key].sync(remotes[key], {
                live: true,
                retry: true
            })

            syncHandles.push(handle)
        })
    }

    async function ensureSeed() {
        let configDoc = null

        try {
            configDoc = await dbs.config.get("config-pos")
        } catch (e) {
            if (e.status !== 404) throw e
        }

        if (!configDoc) {
            const reparti = (Config.reparti || []).slice(1).map((nome, index) => ({
                id: index + 1,
                nome: nome || ("R" + (index + 1)),
                vista: "BOTTONI"
            }))

            configDoc = {
                _id: "config-pos",
                tipo: "config",
                reparti: reparti,
                casse: [
                    { id: 1, nome: "Cassa 1" }
                ]
            }

            await dbs.config.put(configDoc)
        }

        try {
            await dbs.config.get("_local/device")
        } catch (e) {
            if (e.status !== 404) throw e

            await dbs.config.put({
                _id: "_local/device",
                superConnect: Number(Config.superConnect || 1)
            })
        }

        const info = await dbs.articoli.info()

        if (info.doc_count === 0 && Array.isArray(Config.listino)) {
            const docs = Config.listino.map((item, index) => {
                const isProduct = Number(item.reparto) === 8

                return {
                    _id: "seed-" + String(index + 1).padStart(4, "0"),
                    tipo: isProduct ? "P" : "S",
                    nome: item.servizio || item.prodotto || "Articolo",
                    prezzo: parseNumber(item.prezzo),
                    prezzobase: parseNumber(item.prezzo),
                    reparto: Number(item.reparto || 1),
                    posizione: Number(item.posizione || 1),
                    categoria: item.categoria || "",
                    barcode: item.barcode || "",
                    marca: item.marca || "",
                    fornitore: item.fornitore || "",
                    attivo: true
                }
            })

            if (docs.length) {
                await dbs.articoli.bulkDocs(docs)
            }
        }
    }

    async function audit() {
        if (!dbs || !initialized) throw new Error("Database non inizializzato")

        const id = "_local/audit-" + Date.now()
        const value = "SOLX-AUDIT"

        const put = await dbs.config.put({
            _id: id,
            value: value,
            timestamp: new Date().toISOString()
        })

        if (!put || !put.ok) throw new Error("Scrittura audit fallita")

        const read = await dbs.config.get(id)
        if (!read || read.value !== value) throw new Error("Lettura audit fallita")

        await dbs.config.remove(read)

        const infos = await Promise.all([
            dbs.articoli.info(),
            dbs.config.info(),
            dbs.receipt.info()
        ])

        return {
            message:
                "R/W OK - articoli=" + infos[0].doc_count +
                " config=" + infos[1].doc_count +
                " receipt=" + infos[2].doc_count
        }
    }

    async function auditRemote() {
        if (!Config.couchdbBaseUrl) {
            return { warning: "non configurato" }
        }

        if (!remotes || !remotes.config) {
            throw new Error("Remote CouchDB non inizializzato")
        }

        const info = await withTimeout(
            remotes.config.info(),
            3500,
            "Timeout connessione CouchDB"
        )

        return {
            message: "online - " + (info.db_name || dbNames.config)
        }
    }

    async function getConfig() {
        return dbs.config.get("config-pos")
    }

    async function saveConfig(doc) {
        const current = await dbs.config.get("config-pos")
        const next = Object.assign({}, current, doc, {
            _id: "config-pos",
            _rev: current._rev
        })

        await dbs.config.put(next)
        return getConfig()
    }

    async function getDeviceConfig() {
        return dbs.config.get("_local/device")
    }

    async function saveDeviceConfig(doc) {
        let current = null

        try {
            current = await dbs.config.get("_local/device")
        } catch (e) {
            if (e.status !== 404) throw e
        }

        const next = Object.assign({}, current || {}, doc, {
            _id: "_local/device"
        })

        if (current && current._rev) next._rev = current._rev

        await dbs.config.put(next)
        return getDeviceConfig()
    }

    async function getAllArticles() {
        const result = await dbs.articoli.allDocs({ include_docs: true })

        return result.rows
            .map(row => row.doc)
            .filter(doc => doc && !doc._id.startsWith("_design/"))
    }

    async function getArticle(id) {
        return dbs.articoli.get(id)
    }

    async function saveArticle(article) {
        const doc = Object.assign({}, article)

        if (!doc._id) doc._id = uuid()

        const result = await dbs.articoli.put(doc)
        doc._rev = result.rev

        return doc
    }

    async function nextReceiptNumber(superConnect) {
        const id = "_local/receipt-counter-" + String(superConnect)

        for (let attempt = 0; attempt < 5; attempt++) {
            let current = null

            try {
                current = await dbs.config.get(id)
            } catch (e) {
                if (e.status !== 404) throw e
            }

            const numero = Number(current && current.numero || 0) + 1
            const doc = {
                _id: id,
                numero: numero
            }

            if (current && current._rev) doc._rev = current._rev

            try {
                await dbs.config.put(doc)
                return numero
            } catch (e) {
                if (e.status !== 409) throw e
            }
        }

        throw new Error("Impossibile aggiornare il numero ricevuta")
    }

    async function saveReceipt(receipt) {
        const result = await dbs.receipt.put(receipt)
        return Object.assign({}, receipt, { _rev: result.rev })
    }

    async function getReceiptsByDay(giorno) {
        const result = await dbs.receipt.allDocs({
            startkey: String(giorno),
            endkey: String(giorno) + "\ufff0",
            include_docs: true
        })

        return result.rows
            .map(row => row.doc)
            .filter(doc => doc && doc.documento === "Ricevuta")
    }

    async function getReceipt(id) {
        return dbs.receipt.get(id)
    }

    return {
        init,
        audit,
        auditRemote,
        getConfig,
        saveConfig,
        getDeviceConfig,
        saveDeviceConfig,
        getAllArticles,
        getArticle,
        saveArticle,
        nextReceiptNumber,
        saveReceipt,
        getReceiptsByDay,
        getReceipt
    }
})()
