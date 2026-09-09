// Copyright AltraConsulenza Snc
// Motore POS. Nessuna dipendenza dalla UI.

const POS = (() => {
    let items = []
    let total = 0
    let listeners = new Map()
    let prepared = false
    let paymentRunning = false

    function clone(value) {
        return JSON.parse(JSON.stringify(value))
    }

    function roundMoney(value) {
        return Math.round(Number(value || 0) * 100) / 100
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

        set.forEach(callback => {
            try {
                callback(clone(detail || {}))
            } catch (e) {
                console.error(e)
            }
        })
    }

    function recalc() {
        total = roundMoney(items.reduce((sum, item) => sum + Number(item.prezzo || 0), 0))
        emit("change", getState())
    }

    function getState() {
        return {
            items: clone(items),
            total: total,
            paymentRunning: paymentRunning
        }
    }

    function addArticle(article, overridePrice) {
        if (!article || paymentRunning) return

        const prezzo = overridePrice == null
            ? Number(article.prezzo || 0)
            : Number(overridePrice || 0)

        const row = {
            nome: article.nome,
            prezzo: roundMoney(prezzo),
            prezzobase: roundMoney(article.prezzo || 0),
            tipo: article.tipo === "P" ? "P" : "S"
        }

        if (row.tipo === "P") {
            row.idp = article._id
            row.pezzi = 1
        }

        items.push(row)

        if (items.length === 1 && !prepared) {
            prepared = true
            Fiscal.prepareIT().catch(() => {})
        }

        recalc()
    }

    function removeItem(index) {
        if (paymentRunning) return
        const idx = Number(index)
        if (idx < 0 || idx >= items.length) return
        items.splice(idx, 1)
        recalc()
    }

    function setPrice(index, price) {
        if (paymentRunning) return
        const idx = Number(index)
        if (idx < 0 || idx >= items.length) return
        items[idx].prezzo = roundMoney(price)
        recalc()
    }

    function duplicateItem(index, count) {
        if (paymentRunning) return
        const idx = Number(index)
        const qty = Math.floor(Number(count || 0))

        if (idx < 0 || idx >= items.length || qty <= 1) return

        const base = items[idx]

        for (let i = 1; i < qty; i++) {
            const copy = clone(base)
            if (copy.tipo === "P") copy.pezzi = 1
            items.push(copy)
        }

        recalc()
    }

    function addDiscount(value, percentMode) {
        if (paymentRunning) return
        const entered = Math.abs(Number(value || 0))
        if (entered <= 0) return

        const amount = percentMode
            ? roundMoney(total * entered / 100)
            : roundMoney(entered)

        if (amount <= 0) return

        items.push({
            nome: percentMode
                ? "SCONTO " + String(entered).replace(".", ",") + "%"
                : "SCONTO",
            prezzo: -amount,
            prezzobase: -amount,
            tipo: "S",
            sconto: true
        })

        recalc()
    }

    function reset() {
        items = []
        total = 0
        prepared = false
        paymentRunning = false
        emit("change", getState())
        emit("reset", {})
    }

    function localDateParts(date) {
        const yyyy = String(date.getFullYear())
        const mm = String(date.getMonth() + 1).padStart(2, "0")
        const dd = String(date.getDate()).padStart(2, "0")
        const hh = String(date.getHours()).padStart(2, "0")
        const mi = String(date.getMinutes()).padStart(2, "0")
        const ss = String(date.getSeconds()).padStart(2, "0")

        return {
            anno: yyyy,
            mese: yyyy + mm,
            giorno: yyyy + mm + dd,
            data: dd + "/" + mm + "/" + yyyy,
            ora: hh + ":" + mi,
            idPrefix: yyyy + mm + dd + hh + mi + ss + "00"
        }
    }

    async function buildReceipt(tipo) {
        const now = new Date()
        const parts = localDateParts(now)
        const device = await DB.getDeviceConfig()
        const superConnect = Number(device.superConnect || 1)
        const numero = await DB.nextReceiptNumber(superConnect)
        const righe = clone(items)

        const totServizi = roundMoney(righe
            .filter(r => r.tipo === "S" && !r.sconto)
            .reduce((sum, r) => sum + Number(r.prezzo || 0), 0))

        const totProdotti = roundMoney(righe
            .filter(r => r.tipo === "P")
            .reduce((sum, r) => sum + Number(r.prezzo || 0), 0))

        const totSconto = roundMoney(righe
            .filter(r => r.sconto || Number(r.prezzo || 0) < 0)
            .reduce((sum, r) => sum + Math.abs(Number(r.prezzo || 0)), 0))

        return {
            _id: parts.idPrefix + "-" + String(superConnect) + "-" + String(numero).padStart(4, "0"),
            documento: "Ricevuta",
            data: parts.data,
            numero: numero,
            mp: tipo,
            timestamp: now.toISOString(),
            ora: parts.ora,
            anno: parts.anno,
            mese: parts.mese,
            giorno: parts.giorno,
            righe: righe,
            righeL: righe.length,
            totSconto: totSconto,
            totale: roundMoney(total),
            totServizi: totServizi,
            totProdotti: totProdotti,
            superConnect: superConnect
        }
    }

    async function pay(tipo) {
        if (!items.length) {
            emit("payment:empty", {})
            return null
        }

        if (paymentRunning) return null

        paymentRunning = true
        emit("change", getState())
        emit("payment:start", { tipo: tipo, total: total })

        try {
            const receipt = await buildReceipt(tipo)

            emit("fiscal:start", { receipt: receipt })
            const fiscal = await Fiscal.fiscalizeIT(receipt)
            receipt.fiscal = fiscal
            receipt.rCode = fiscal.numero || ""
            emit("fiscal:end", { receipt: receipt })

            await DB.saveReceipt(receipt)
            emit("receipt:saved", { receipt: receipt })

            const printData = renderReceiptIT(Object.assign({}, receipt, {
                data: receipt.data,
                ora: receipt.ora
            }))

            let printError = null

            try {
                emit("print:start", { receipt: receipt })
                await Bridge.exec("print", printData, Config.printTimeoutMs || 60000)
                emit("print:end", { receipt: receipt })
            } catch (error) {
                printError = error
                emit("print:error", {
                    receipt: receipt,
                    message: error && error.message ? error.message : String(error)
                })
            }

            emit("payment:end", {
                receipt: receipt,
                printError: !!printError
            })

            reset()
            return receipt
        } catch (error) {
            paymentRunning = false
            emit("change", getState())
            emit("error", {
                message: error && error.message ? error.message : String(error)
            })
            throw error
        }
    }

    return {
        on,
        getState,
        addArticle,
        removeItem,
        setPrice,
        duplicateItem,
        addDiscount,
        reset,
        pay
    }
})()
