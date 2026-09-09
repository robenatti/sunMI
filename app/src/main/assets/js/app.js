// Copyright AltraConsulenza Snc
// Facade pubblica del business: le UI conoscono solo AppAPI.

const AppAPI = (() => {
    const listeners = new Map()
    const posUnsubscribers = []

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
        await DB.init()
        await Catalog.init()

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
        await Router.open("cassa")
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

window.addEventListener("DOMContentLoaded", async () => {
    try {
        await AppAPI.init()
    } catch (error) {
        const box = document.getElementById("appError")
        box.textContent = error && error.message ? error.message : String(error)
        box.classList.add("show")
    }
})
