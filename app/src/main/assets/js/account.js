// Copyright AltraConsulenza Snc
// Bootstrap account e configurazione dispositivo. Funziona anche offline dopo la prima configurazione.

const Account = (() => {
    const DB_NAME = "solx-bootstrap"
    const ACCOUNT_ID = "account-current"
    const DEVICE_ID = "_local/device-bootstrap"

    let db = null
    let currentAccount = null
    let currentDevice = null
    let deviceId = ""
    let lastAccountUpdate = ""
    let serverOnline = false
    let serverError = ""

    function clone(value) {
        return value == null ? value : JSON.parse(JSON.stringify(value))
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

    function localTimestamp() {
        const now = new Date()
        const pad = value => String(value).padStart(2, "0")

        return String(now.getFullYear()) +
            pad(now.getMonth() + 1) +
            pad(now.getDate()) +
            "T" +
            pad(now.getHours()) +
            pad(now.getMinutes()) +
            pad(now.getSeconds())
    }

    function timeoutFetch(url, options, ms) {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null
        const timer = controller ? setTimeout(() => controller.abort(), ms) : null
        const opts = Object.assign({}, options || {})
        if (controller) opts.signal = controller.signal

        return fetch(url, opts).finally(() => {
            if (timer) clearTimeout(timer)
        })
    }

    function findDevice(account, id) {
        const devices = account && Array.isArray(account.devices) ? account.devices : []
        const found = devices.find(item => {
            if (typeof item === "string") return item === id
            return item && String(item.deviceId || item.seriale || item.serial || "") === String(id)
        })

        if (typeof found === "string") return { deviceId: found }
        if (found) return clone(found)

        const serials = account && Array.isArray(account.seriali) ? account.seriali : []
        if (serials.map(String).includes(String(id))) return { deviceId: id }

        return null
    }

    function accountComparable(account, device) {
        const clean = clone(account || {})
        delete clean._rev
        return JSON.stringify({
            account: clean,
            device: device || null
        })
    }

    function apply(account, device) {
        if (!account) return

        currentAccount = clone(account)
        currentDevice = clone(device || findDevice(account, deviceId))

        Config.account = clone(account)

        if (account.salone) Config.salone = account.salone
        if (account.cf) Config.cf = account.cf
        if (account.piva) Config.piva = account.piva
        if (account.pin) Config.pin = account.pin
        if (typeof account.pwd !== "undefined") Config.pwd = account.pwd
        if (account.serverHost) Config.serverHost = account.serverHost
        if (account.dataScadenza) Config.dataScadenza = account.dataScadenza

        Config.allowChangeIntestazione = account.allowChangeIntestazione === true
        Config.allowChangeUsername = account.allowChangeUsername === true
        Config.allowChangePassword = account.allowChangePassword === true
        Config.allowAddCash = account.allowAddCash === true

        if (account.intestazione) {
            Config.intestazione = Object.assign({}, Config.intestazione || {}, account.intestazione)
        }

        Config.intestazione = Config.intestazione || {}
        if (account._id) Config.intestazione.userScade = account._id

        if (currentDevice) {
            if (currentDevice.cassa) Config.superConnect = Number(currentDevice.cassa)
            if (currentDevice.superConnect) Config.superConnect = Number(currentDevice.superConnect)
            if (currentDevice.paperWidthMm)
                Config.paperWidthMm = Number(currentDevice.paperWidthMm) <= 58 ? 58 : 80
        }
    }

    async function ensureDb() {
        if (!db) db = new PouchDB(DB_NAME)
        return db
    }

    async function loadPermanentDeviceId() {
        await ensureDb()

        let local = null
        try {
            local = await db.get(DEVICE_ID)
        } catch (e) {
            if (e.status !== 404) throw e
        }

        if (local && local.deviceId) {
            deviceId = String(local.deviceId)
            return deviceId
        }

        let nativeId = ""
        try {
            const hardware = await Bridge.auditHardware(1800)
            nativeId = String(hardware && hardware.deviceId || "").trim()
        } catch (e) {}

        deviceId = nativeId || uuid()

        await db.put({
            _id: DEVICE_ID,
            deviceId: deviceId,
            createdAt: new Date().toISOString()
        })

        return deviceId
    }

    async function loadLocalAccount() {
        await ensureDb()

        try {
            const doc = await db.get(ACCOUNT_ID)
            currentAccount = clone(doc.account || null)
            currentDevice = clone(doc.device || null)
            lastAccountUpdate = doc.updatedAt || ""
            apply(currentAccount, currentDevice)
            return doc
        } catch (e) {
            if (e.status !== 404) throw e
            return null
        }
    }

    async function saveLocalAccount(account, device) {
        await ensureDb()

        let current = null
        try {
            current = await db.get(ACCOUNT_ID)
        } catch (e) {
            if (e.status !== 404) throw e
        }

        const doc = {
            _id: ACCOUNT_ID,
            account: clone(account),
            device: clone(device || null),
            updatedAt: new Date().toISOString()
        }

        if (current && current._rev) doc._rev = current._rev

        const result = await db.put(doc)
        doc._rev = result.rev
        lastAccountUpdate = doc.updatedAt
        return doc
    }

    function accountUrl() {
        return String(Config.accountServerUrl || "").replace(/\/$/, "") +
            "/accountByDevice?deviceId=" + encodeURIComponent(deviceId) +
            "&localTimestamp=" + localTimestamp()
    }

    async function fetchRemote() {
        if (!Config.accountServerUrl) throw new Error("Server account non configurato")

        try {
            const res = await timeoutFetch(
                accountUrl(),
                { method: "GET", cache: "no-store" },
                Number(Config.accountTimeoutMs || 3500)
            )

            if (!res.ok) throw new Error("HTTP " + res.status)

            const json = await res.json()
            const account = json.account ||
                (json.return && json.return.account) ||
                (json.result === "OK" && json.return && json.return._id ? json.return : null) ||
                (json._id ? json : null)

            if (!account)
                throw new Error(json && (json.error || json.return) ? String(json.error || json.return) : "Account dispositivo non trovato")

            const device = json.device ||
                (json.return && json.return.device) ||
                findDevice(account, deviceId)

            if (!device)
                throw new Error("Dispositivo non associato all'account")

            serverOnline = true
            serverError = ""

            return {
                account: account,
                device: device
            }
        } catch (e) {
            serverOnline = false
            serverError = e && e.message ? e.message : String(e)
            throw e
        }
    }

    async function init() {
        await loadPermanentDeviceId()
        const local = await loadLocalAccount()

        try {
            const remote = await fetchRemote()
            const different = !local ||
                accountComparable(local.account, local.device) !==
                accountComparable(remote.account, remote.device)

            if (different) {
                await saveLocalAccount(remote.account, remote.device)
                apply(remote.account, remote.device)
                return { changed: true, source: "remote" }
            }

            apply(remote.account, remote.device)
            return { changed: false, source: "remote" }
        } catch (e) {
            if (local && local.account) {
                apply(local.account, local.device)
                return { changed: false, source: "local", warning: serverError }
            }

            return { changed: false, source: "fallback", warning: serverError }
        }
    }

    async function auditLocalDatabase() {
        await ensureDb()
        const info = await db.info()

        return {
            message: DB_NAME + " - esiste - " + Number(info.doc_count || 0) + " documenti"
        }
    }

    async function checkServer() {
        if (!serverOnline) {
            if (serverError) throw new Error(serverError)
            await fetchRemote()
        }

        return {
            message: "online - account dispositivo trovato",
            deviceId: deviceId
        }
    }

    async function updateAccount(changes) {
        if (!currentAccount) throw new Error("Account non configurato")

        const base = String(Config.accountServerUrl || "").replace(/\/$/, "")
        if (!base) throw new Error("Server account non configurato")

        const res = await timeoutFetch(
            base + "/accountUpdate?localTimestamp=" + localTimestamp(),
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    deviceId: deviceId,
                    id: currentAccount._id,
                    changes: changes || {}
                })
            },
            Number(Config.accountTimeoutMs || 3500)
        )

        if (!res.ok) throw new Error("HTTP " + res.status)

        const json = await res.json()
        const account = json.account || (json.return && json.return.account)
        if (!account) throw new Error(json.error || "Aggiornamento account non confermato")

        const device = json.device || findDevice(account, deviceId) || currentDevice
        await saveLocalAccount(account, device)
        apply(account, device)

        return getState()
    }

    function getState() {
        return {
            deviceId: deviceId,
            account: clone(currentAccount),
            device: clone(currentDevice),
            lastAccountUpdate: lastAccountUpdate,
            serverOnline: serverOnline,
            serverError: serverError
        }
    }

    return {
        init,
        auditLocalDatabase,
        checkServer,
        updateAccount,
        getState
    }
})()
