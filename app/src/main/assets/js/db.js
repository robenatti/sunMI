// Copyright AltraConsulenza Snc
// PouchDB persistence layer. Nessuna dipendenza dalla UI.

const DB = (() => {
    let dbs = null
    let dbNames = null
    let remotes = null
    let syncHandles = []
    let syncState = {}
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
                magazzino: prefix + "-magazzino",
                config: prefix + "-config",
                receipt: prefix + "-receipt"
            }

            dbs = {
                magazzino: new PouchDB(dbNames.magazzino),
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
        const base = String(Config.serverHost || "").replace(/\/$/, "")
        if (!base) return

        remotes = {}
        Object.keys(dbs).forEach(key => {
            remotes[key] = new PouchDB(base + "/" + dbNames[key], { skip_setup: true })
        })
    }

    async function primeFromRemote() {
        if (!remotes) return

        await Promise.all(Object.keys(dbs).map(async key => {
            const replication = dbs[key].replicate.from(remotes[key])
            let timer = null

            try {
                await Promise.race([
                    replication,
                    new Promise((resolve, reject) => {
                        timer = setTimeout(() => reject(new Error("Timeout replica iniziale")), 2500)
                    })
                ])
            } catch (e) {
                if (replication && typeof replication.cancel === "function") replication.cancel()
                console.warn("Replica iniziale non disponibile", key, e)
            } finally {
                if (timer) clearTimeout(timer)
            }
        }))
    }

    function startLiveSync() {
        if (!remotes) return

        Object.keys(dbs).forEach(key => {
            syncState[key] = {
                status: "STARTING",
                lastOk: "",
                error: ""
            }

            const handle = dbs[key].sync(remotes[key], {
                live: true,
                retry: true
            })

            handle.on("active", () => {
                syncState[key].status = "ACTIVE"
                syncState[key].error = ""
            })

            handle.on("change", () => {
                syncState[key].status = "ACTIVE"
                syncState[key].lastOk = new Date().toISOString()
                syncState[key].error = ""
            })

            handle.on("paused", error => {
                if (error) {
                    syncState[key].status = "PAUSED"
                    syncState[key].error = error.message || String(error)
                } else {
                    syncState[key].status = "OK"
                    syncState[key].lastOk = new Date().toISOString()
                    syncState[key].error = ""
                }
            })

            handle.on("denied", error => {
                syncState[key].status = "DENIED"
                syncState[key].error = error && error.message ? error.message : String(error || "")
            })

            handle.on("error", error => {
                syncState[key].status = "ERROR"
                syncState[key].error = error && error.message ? error.message : String(error || "")
            })

            syncHandles.push(handle)
        })
    }

    async function ensureSeed() {
        function buildSeedReparti() {
            const counts = {}

            ;(Config.listino || []).forEach(item => {
                const reparto = Number(item.reparto || 1)
                counts[reparto] = Number(counts[reparto] || 0) + 1
            })

            return (Config.reparti || []).slice(1).map((nome, index) => {
                const id = index + 1
                const upperName = String(nome || "").toUpperCase()

                return {
                    id: id,
                    nome: nome || ("R" + id),
                    vista:
                        upperName === "TUTTI" || Number(counts[id] || 0) > 16
                            ? "LISTA"
                            : "BOTTONI"
                }
            })
        }

        function buildSeedDocs() {
            if (!Array.isArray(Config.listino)) return []

            return Config.listino.map(item => {
                const isProduct = item.tipo === "P" || Number(item.reparto) === 8

                return {
                    _id: uuid(),
                    tipo: isProduct ? "P" : "S",
                    nome: item.servizio || item.prodotto || "Articolo",
                    prezzo: parseNumber(item.prezzo),
                    prezzobase: parseNumber(item.prezzo),
                    reparto: Number(item.reparto || 1),
                    posizione: Number(item.posizione || 1),
                    categoria: item.categoria || "",
                    codice: String(item.codice || ""),
                    iva: parseNumber(typeof item.iva !== "undefined" ? item.iva : 22),
                    barcode: item.barcode || "",
                    marca: item.marca || "",
                    fornitore: item.fornitore || "",
                    attivo: true
                }
            })
        }

        let configDoc = null

        try {
            configDoc = await dbs.config.get("config-pos")
        } catch (e) {
            if (e.status !== 404) throw e
        }

        const seedVersion = String(Config.seedVersion || "")
        const forceSeed =
            !!seedVersion &&
            String(configDoc && configDoc.seedVersion || "") !== seedVersion

        if (forceSeed) {
            const currentArticles = await dbs.magazzino.allDocs({ include_docs: true })
            const deletions = currentArticles.rows
                .map(row => row.doc)
                .filter(doc => doc && !doc._id.startsWith("_design/"))
                .map(doc => ({
                    _id: doc._id,
                    _rev: doc._rev,
                    _deleted: true
                }))

            if (deletions.length) {
                await dbs.magazzino.bulkDocs(deletions)
            }

            const docs = buildSeedDocs()
            if (docs.length) {
                await dbs.magazzino.bulkDocs(docs)
            }

            const nextConfig = Object.assign({}, configDoc || {}, {
                _id: "config-pos",
                tipo: "config",
                reparti: buildSeedReparti(),
                seedVersion: seedVersion
            })

            if (!Array.isArray(nextConfig.casse) || !nextConfig.casse.length) {
                nextConfig.casse = [
                    { id: 1, nome: "Cassa 1" }
                ]
            }

            if (configDoc && configDoc._rev) nextConfig._rev = configDoc._rev

            await dbs.config.put(nextConfig)
            configDoc = await dbs.config.get("config-pos")
        } else if (!configDoc) {
            configDoc = {
                _id: "config-pos",
                tipo: "config",
                reparti: buildSeedReparti(),
                casse: [
                    { id: 1, nome: "Cassa 1" }
                ],
                seedVersion: seedVersion
            }

            await dbs.config.put(configDoc)
        }

        let deviceDoc = null

        try {
            deviceDoc = await dbs.config.get("_local/device")
        } catch (e) {
            if (e.status !== 404) throw e
        }

        const accountState = typeof Account !== "undefined" ? Account.getState() : {}
        const accountDevice = accountState && accountState.device ? accountState.device : null

        const superConnect = accountDevice && (accountDevice.cassa || accountDevice.superConnect)
            ? Number(accountDevice.cassa || accountDevice.superConnect)
            : Number(deviceDoc && deviceDoc.superConnect || Config.superConnect || 1)

        const paperWidthMm = accountDevice && accountDevice.paperWidthMm
            ? (Number(accountDevice.paperWidthMm) <= 58 ? 58 : 80)
            : (Number(deviceDoc && deviceDoc.paperWidthMm || Config.paperWidthMm || 80) <= 58 ? 58 : 80)

        const nextDevice = Object.assign({}, deviceDoc || {}, {
            _id: "_local/device",
            deviceId: accountState && accountState.deviceId
                ? accountState.deviceId
                : String(deviceDoc && deviceDoc.deviceId || ""),
            superConnect: superConnect,
            paperWidthMm: paperWidthMm
        })

        if (deviceDoc && deviceDoc._rev) nextDevice._rev = deviceDoc._rev

        const deviceChanged = !deviceDoc ||
            String(deviceDoc.deviceId || "") !== String(nextDevice.deviceId || "") ||
            Number(deviceDoc.superConnect || 1) !== Number(nextDevice.superConnect) ||
            Number(deviceDoc.paperWidthMm || 80) !== Number(nextDevice.paperWidthMm)

        if (deviceChanged) await dbs.config.put(nextDevice)

        const info = await dbs.magazzino.info()

        if (info.doc_count === 0 && Array.isArray(Config.listino)) {
            const docs = buildSeedDocs()

            if (docs.length) {
                await dbs.magazzino.bulkDocs(docs)
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
            dbs.magazzino.info(),
            dbs.config.info(),
            dbs.receipt.info()
        ])

        return {
            message:
                "R/W OK - magazzino=" + infos[0].doc_count +
                " config=" + infos[1].doc_count +
                " receipt=" + infos[2].doc_count
        }
    }

    async function auditLocalDatabase(key) {
        if (!dbs || !dbs[key] || !dbNames || !dbNames[key]) {
            throw new Error("Database locale non inizializzato: " + key)
        }

        const info = await dbs[key].info()

        return {
            message:
                dbNames[key] +
                " - esiste - " +
                Number(info.doc_count || 0) +
                " documenti"
        }
    }

    async function auditRemoteDatabase(key) {
        if (!Config.serverHost) {
            return { warning: "NON CONFIGURATO" }
        }

        if (!remotes || !remotes[key] || !dbNames || !dbNames[key]) {
            throw new Error("Remote CouchDB non inizializzato: " + key)
        }

        try {
            const info = await withTimeout(
                remotes[key].info(),
                2000,
                "Timeout connessione CouchDB"
            )

            return {
                message:
                    (info.db_name || dbNames[key]) +
                    " - esiste - " +
                    Number(info.doc_count || 0) +
                    " documenti"
            }
        } catch (error) {
            if (error && Number(error.status) === 404) {
                throw new Error(dbNames[key] + " - NON ESISTE")
            }

            return {
                warning: dbNames[key] + " - NON RAGGIUNGIBILE"
            }
        }
    }

    async function auditRemote() {
        return auditRemoteDatabase("config")
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
        const result = await dbs.magazzino.allDocs({ include_docs: true })

        return result.rows
            .map(row => row.doc)
            .filter(doc => doc && !doc._id.startsWith("_design/"))
    }

    async function getArticle(id) {
        return dbs.magazzino.get(id)
    }

    async function saveArticle(article) {
        const doc = Object.assign({}, article)

        if (!doc._id) doc._id = uuid()

        const result = await dbs.magazzino.put(doc)
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
        const doc = Object.assign({}, receipt)

        if (!doc._rev && doc._id) {
            try {
                const current = await dbs.receipt.get(doc._id)
                doc._rev = current._rev
            } catch (e) {
                if (e.status !== 404) throw e
            }
        }

        const result = await dbs.receipt.put(doc)
        return Object.assign({}, doc, { _rev: result.rev })
    }

    function normalizeReceipt(doc) {
        if (!doc) return doc

        const copy = Object.assign({}, doc)

        if (!copy.fiscalStatus) {
            const numero = copy.fiscal && copy.fiscal.numero ? String(copy.fiscal.numero) : ""
            copy.fiscalStatus = numero && numero !== "Servizio Non Disponibile" ? "OK" : "ERROR"
        }

        if (!copy.printStatus) copy.printStatus = "OK"
        if (typeof copy.annullata === "undefined") copy.annullata = false

        return copy
    }

    async function getReceiptsByDay(giorno) {
        const result = await dbs.receipt.allDocs({
            startkey: String(giorno),
            endkey: String(giorno) + "\ufff0",
            include_docs: true
        })

        return result.rows
            .map(row => normalizeReceipt(row.doc))
            .filter(doc => doc && doc.documento === "Ricevuta")
    }

    async function getReceipt(id) {
        return normalizeReceipt(await dbs.receipt.get(id))
    }

    async function getPendingFiscalReceipts() {
        const result = await dbs.receipt.allDocs({ include_docs: true })

        return result.rows
            .map(row => normalizeReceipt(row.doc))
            .filter(doc =>
                doc &&
                doc.documento === "Ricevuta" &&
                doc.annullata !== true &&
                doc.fiscalStatus !== "OK"
            )
            .sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")))
    }

    function getReplicationStatus() {
        return JSON.parse(JSON.stringify(syncState || {}))
    }

    async function auditReplication(key) {
        if (!remotes || !remotes[key]) throw new Error("Replica remota non configurata: " + key)

        const state = syncState[key] || { status: "STARTING", lastOk: "", error: "" }

        if (state.status === "ERROR" || state.status === "DENIED") {
            throw new Error(state.status)
        }

        return {
            message:
                state.status +
                (state.lastOk ? " - ultimo OK " + state.lastOk : "")
        }
    }

    return {
        init,
        audit,
        auditLocalDatabase,
        auditRemoteDatabase,
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
        getReceipt,
        getPendingFiscalReceipts,
        getReplicationStatus,
        auditReplication
    }
})()
