// Copyright AltraConsulenza Snc
// Generated on: 2026-05-09 (Europe/Rome)
// inizio file posFlow.js

// Funzioni esposte:
// - emitPosEvent(name, detail): emette un evento applicativo POS verso la UI o altri listener.
// - logStep(step, data): registra un passaggio logico emettendo evento pos:log.
// - waitForUIPaint(): attende un piccolo tempo per permettere alla UI di disegnare popup/barra.
// - requestPaymentConfirm(tipo, receipt): richiede conferma pagamento tramite evento asincrono.
// - recalcTotal(): ricalcola il totale carrello.
// - addService(nome, prezzo): aggiunge un servizio al carrello POS.
// - addDiscount(nome, importo): aggiunge una riga sconto negativa al carrello.
// - updateItemPrice(index, prezzo): modifica il prezzo di una riga carrello.
// - removeItem(index): elimina una riga carrello.
// - duplicateItem(index, count): replica una riga carrello fino alla quantità richiesta.
// - reset(): svuota il carrello POS.
// - startPayment(tipo): avvia il flusso completo di pagamento, fiscalizzazione e stampa.
// - buildFiche(): costruisce la fiche interna partendo dal carrello.
// - createReceiptFromFiche(fiche, tipo): costruisce la ricevuta logica dalla fiche.
// - buildPayment(tipo): costruisce l'oggetto pagamento.
// - simulatePOSPayment(receipt): esegue simulazione pagamento POS tramite evento.
// - fiscalizeIT(receipt): invia la ricevuta al servizio fiscale italiano.
// - fiscalizeAL(receipt): invia la ricevuta al servizio fiscale albanese.

function emitPosEvent(name, detail) {
    document.dispatchEvent(new CustomEvent(name, {
        detail: detail || {}
    }))
}

function logStep(step, data) {
    if (Config.debugLog !== true) return

    emitPosEvent("pos:log", {
        step: step,
        data: data || null,
        timestamp: new Date().toISOString()
    })
}

function waitForUIPaint() {
    return new Promise((resolve) => {
        setTimeout(resolve, 200)
    })
}

function requestPaymentConfirm(tipo, receipt) {

    return new Promise((resolve) => {

        emitPosEvent("pos:payment:confirm-request", {
            tipo: tipo,
            receipt: receipt,
            resolve: resolve
        })

    })
}

function recalcTotal() {
    window.items = window.items || []

    window.total = window.items.reduce((sum, i) => {
        return sum + Number(i.prezzo || 0)
    }, 0)

    return window.total
}

function addService(nome, prezzo) {

    const service = {
        nome: nome,
        prezzo: Number(prezzo || 0)
    }

    window.items = window.items || []
    window.items.push(service)

    if (window.items.length === 1) {
        prepareFiscalIT()
    }

    recalcTotal()

    emitPosEvent("pos:item:add", {
        service: service,
        index: window.items.length - 1,
        items: window.items,
        total: window.total
    })

    document.dispatchEvent(new Event("pos:update"))
}

function addDiscount(nome, importo) {

    const value = Math.abs(Number(importo || 0))

    if (value <= 0) {
        return
    }

    const service = {
        nome: nome || "SCONTO",
        prezzo: -value
    }

    window.items = window.items || []
    window.items.push(service)

    recalcTotal()

    emitPosEvent("pos:item:add", {
        service: service,
        index: window.items.length - 1,
        items: window.items,
        total: window.total
    })

    document.dispatchEvent(new Event("pos:update"))
}

function updateItemPrice(index, prezzo) {
    window.items = window.items || []

    const idx = Number(index)

    if (idx < 0 || idx >= window.items.length) {
        return
    }

    window.items[idx].prezzo = Number(prezzo || 0)

    recalcTotal()

    emitPosEvent("pos:item:update", {
        index: idx,
        item: window.items[idx],
        items: window.items,
        total: window.total
    })

    document.dispatchEvent(new Event("pos:update"))
}

function removeItem(index) {
    window.items = window.items || []

    const idx = Number(index)

    if (idx < 0 || idx >= window.items.length) {
        return
    }

    const removed = window.items.splice(idx, 1)[0]

    recalcTotal()

    emitPosEvent("pos:item:remove", {
        index: idx,
        removed: removed,
        items: window.items,
        total: window.total
    })

    document.dispatchEvent(new Event("pos:update"))
}

function duplicateItem(index, count) {
    window.items = window.items || []

    const idx = Number(index)
    const qty = Number(count || 0)

    if (idx < 0 || idx >= window.items.length) {
        return
    }

    if (qty <= 1) {
        return
    }

    const base = window.items[idx]

    for (let i = 1; i < qty; i++) {
        window.items.push({
            nome: base.nome,
            prezzo: Number(base.prezzo || 0)
        })
    }

    recalcTotal()

    emitPosEvent("pos:item:duplicate", {
        index: idx,
        item: base,
        count: qty,
        items: window.items,
        total: window.total
    })

    document.dispatchEvent(new Event("pos:update"))
}

function reset() {
    window.items = []
    window.total = 0

    emitPosEvent("pos:reset", {
        items: window.items,
        total: window.total
    })

    document.dispatchEvent(new Event("pos:update"))
}

async function startPayment(tipo) {

    if (!window.items || window.items.length === 0) {
        emitPosEvent("pos:payment:empty", {
            tipo: tipo
        })
        return
    }

    logStep("START", {
        tipo: tipo,
        total: window.total,
        items: window.items
    })

    emitPosEvent("pos:payment:start", {
        tipo: tipo,
        total: window.total,
        items: window.items,
        timeout: Config.progressMaxMs || 10000
    })

    await waitForUIPaint()

    try {

        let fiche = buildFiche()

        logStep("FICHE", fiche)

        emitPosEvent("pos:payment:fiche-built", {
            tipo: tipo,
            fiche: fiche
        })

        let receipt = createReceiptFromFiche(fiche, tipo)

        logStep("RECEIPT", receipt)

        emitPosEvent("pos:payment:receipt-built", {
            tipo: tipo,
            receipt: receipt
        })

        let paymentOk = true

        if (0) {
            if (tipo === "CA") {
                paymentOk = await requestPaymentConfirm(tipo, receipt)
            } else {
                paymentOk = await simulatePOSPayment(receipt)
            }
        }

        if (!paymentOk) {
            logStep("PAYMENT CANCELLED")

            emitPosEvent("pos:payment:cancelled", {
                tipo: tipo,
                receipt: receipt
            })

            return
        }

        receipt.pagamento = buildPayment(tipo)

        logStep("PAYMENT OK", receipt.pagamento)

        emitPosEvent("pos:payment:ok", {
            tipo: tipo,
            receipt: receipt,
            pagamento: receipt.pagamento
        })

        emitPosEvent("pos:fiscal:start", {
            tipo: tipo,
            receipt: receipt
        })

        const fiscal = await fiscalizeIT(receipt)
        //const fiscal = await fiscalizeAL(receipt)

        receipt.fiscal = fiscal

        logStep("FISCAL", fiscal)

        emitPosEvent("pos:fiscal:end", {
            tipo: tipo,
            receipt: receipt,
            fiscal: fiscal
        })

        const printData = renderReceiptIT({
        //const printData = renderReceiptAL({
            ...receipt,
            data: new Date().toLocaleDateString(),
            ora: new Date().toLocaleTimeString().slice(0, 5)
        })

        logStep("PRINT", printData)

        emitPosEvent("pos:print:start", {
            tipo: tipo,
            receipt: receipt,
            printData: printData,
            timeout: Config.progressMaxMs || 10000
        })

        await waitForUIPaint()

        await Bridge.exec("print", printData, Config.printTimeoutMs || 60000)

        emitPosEvent("pos:print:end", {
            tipo: tipo,
            receipt: receipt,
            printData: printData
        })

        logStep("DONE")

        emitPosEvent("pos:payment:end", {
            tipo: tipo,
            receipt: receipt
        })

        reset()

    } catch (err) {

        logStep("ERROR", err)
        logStep("ERROR STRING", err && err.message ? err.message : "")
        logStep("ERROR FULL", err)

        emitPosEvent("pos:error", {
            tipo: tipo,
            error: err,
            message: err && err.message ? err.message : String(err)
        })
    }
}

// ===== BUILD FICHE =====
function buildFiche() {
    return {
        _id: "F-" + Date.now(),
        righe: window.items,
        totale: window.total,
        timestamp: new Date().toISOString()
    }
}

// ===== CREATE RECEIPT =====
function createReceiptFromFiche(fiche, tipo) {

    const now = new Date()

    return {
        _id: "R-" + Date.now(),
        ficheID: fiche._id,
        documento: "Ricevuta",
        data: now.toLocaleDateString(),
        ora: now.toLocaleTimeString().slice(0, 5),
        righe: window.items,
        totale: window.total,
        mp: tipo
    }
}

// ===== PAYMENT =====
function buildPayment(tipo) {
    return {
        tipo: tipo === "CC" ? "POS" : "CONTANTI",
        esito: "OK",
        timestamp: new Date().toISOString()
    }
}

// ===== POS SIMULATION =====
async function simulatePOSPayment(receipt) {

    logStep("POS SIM START", receipt)

    const ok = await requestPaymentConfirm("CC", receipt)

    if (ok) logStep("POS SIM OK")
    else logStep("POS SIM CANCEL")

    return ok
}

// ===== FISCAL =====

async function prepareFiscalIT() {
    //return;
    const idc = Config.intestazione?.userScade || Config.userScade || "250aa4c6210a214913c283e65f00489f"
    const url = "http://trbl.it:7811/scAdE"

    try {
        logStep("FISCAL PREPARE START", {
            idc: idc
        })

        const paramS =
            "action=prepare&idc=" +
            encodeURIComponent(idc)

        const res = await fetch(url + "?" + paramS)
        const json = await res.json()

        logStep("FISCAL PREPARE RESPONSE", json)

        if (
            json.result !== "OK" ||
            !json.return ||
            json.return.done === "KO"
        ) {
            scAdEPrepared = false
        }

    } catch (err) {
        scAdEPrepared = false
        logStep("FISCAL PREPARE ERROR", err)
    }
}

async function fiscalizeIT(receipt) {

    const idc = Config.intestazione?.userScade || Config.userScade || "250aa4c6210a214913c283e65f00489f"
    const url = "http://trbl.it:7811/scAdE"

    const payload = {
        totale: receipt.totale.toString().replace(".", ","),
        mp: receipt.mp === "CC" ? "POS" : "CONTANTI",
        servizi: receipt.righe
    }

    logStep("FISCAL REQUEST", payload)

    const paramS = "idc=" + idc + "&receipt=" + JSON.stringify(payload)

    const res = await fetch(url + "?" + paramS)
    const json = await res.json()

    logStep("FISCAL RESPONSE", json)

    const fisc = json.return?.fiscAL || {}

    return {
        numero: fisc.documento_numero || "Servizio Non Disponibile",
        data: fisc.data || "",
        ora: fisc.ora || ""
    }
}

async function fiscalizeAL(receipt) {

    const idc = "b664c29d2984391ea1f3ec3e84013600"
    const url = "http://trbl.it:7811/fiscalAL"

    const payload = {
        id: receipt._id,
        totale: receipt.totale,
        mp: receipt.mp === "CC" ? "POS" : "CONTANTI",
        righe: receipt.righe
    }

    logStep("FISCAL REQUEST", payload)

    const paramS = "idc=" + idc + "&receipt=" + JSON.stringify(payload)

    const res = await fetch(url + "?" + paramS)
    const json = await res.json()

    logStep("FISCAL RESPONSE", json)

    const fisc = json.return?.fiscAL || {}

    return {
        numero: fisc.documento_numero || "FISKALIZIMI I PADISPONUESHËM",
        firma: fisc.firma || "DO TË FISKALIZOHET SAPO TË JETË E MUNDUR",
        link: fisc.link || "",
        data: fisc.data || "",
        ora: fisc.ora || ""
    }
}

// fine file posFlow.js