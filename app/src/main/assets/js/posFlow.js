// Copyright AltraConsulenza Snc
// Motore POS. Nessuna dipendenza dalla UI.

const POS = (() => {
    let items = [];
    let total = 0;
    let listeners = new Map();
    let prepared = false;
    let paymentRunning = false;
    let recoveryTimer = null;
    let recoveryRunning = false;
    let fiscalLocks = new Map();

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function roundMoney(value) {
        return Math.round(Number(value || 0) * 100) / 100;
    }

    function quantityOf(item) {
        const value = Math.floor(Number(item && item.quantita || 1));
        return value > 0 ? value : 1;
    }

    function on(eventName, callback) {
        if (!listeners.has(eventName)) listeners.set(eventName, new Set());
        listeners.get(eventName).add(callback);
        return () => {
            const set = listeners.get(eventName);
            if (set) set.delete(callback);
        };
    }

    function emit(eventName, detail) {
        const set = listeners.get(eventName);
        if (!set) return;
        set.forEach(callback => {
            try {
                callback(clone(detail || {}));
            } catch (e) {
                console.error(e);
            }
        });
    }

    function recalc() {
        total = roundMoney(items.reduce((sum, item) => {
            return sum + Number(item.prezzo || 0) * quantityOf(item);
        }, 0));
        emit("change", getState());
    }

    function getState() {
        return {
            items: clone(items),
            total: total,
            paymentRunning: paymentRunning
        };
    }

    function addArticle(article, overridePrice) {
        if (!article || paymentRunning) return;

        const prezzo = overridePrice == null
            ? Number(article.prezzo || 0)
            : Number(overridePrice || 0);

        const row = {
            nome: article.nome,
            prezzo: roundMoney(prezzo),
            prezzobase: roundMoney(article.prezzo || 0),
            quantita: 1,
            iva:
                article.iva === "" || typeof article.iva === "undefined" || article.iva === null
                    ? 22
                    : Number(article.iva),
            tipo: article.tipo === "P" ? "P" : "S"
        };

        if (row.tipo === "P") {
            row.idp = article._id;
            row.pezzi = 1;
        }

        items.push(row);

        if (items.length === 1 && !prepared) {
            prepared = true;
            Fiscal.prepareIT().catch(() => {});
        }

        recalc();
    }

    function removeItem(index) {
        if (paymentRunning) return;
        const idx = Number(index);
        if (idx < 0 || idx >= items.length) return;
        items.splice(idx, 1);
        recalc();
    }

    function setPrice(index, price) {
        if (paymentRunning) return;
        const idx = Number(index);
        if (idx < 0 || idx >= items.length) return;
        items[idx].prezzo = roundMoney(price);
        recalc();
    }

    function setItemValues(index, quantity, price) {
        if (paymentRunning) return;
        const idx = Number(index);
        if (idx < 0 || idx >= items.length) return;

        const qty = Math.floor(Number(quantity || 1));
        if (qty <= 0) return;

        items[idx].quantita = qty;
        if (price !== null && typeof price !== "undefined" && Number.isFinite(Number(price))) {
            items[idx].prezzo = roundMoney(price);
        }
        if (items[idx].tipo === "P") items[idx].pezzi = qty;
        recalc();
    }

    function duplicateItem(index, count) {
        const item = items[Number(index)];
        if (!item) return;
        setItemValues(index, count, item.prezzo);
    }

    function addDiscount(value, percentMode) {
        if (paymentRunning) return;
        const entered = Math.abs(Number(value || 0));
        if (entered <= 0) return;

        const amount = percentMode
            ? roundMoney(total * entered / 100)
            : roundMoney(entered);
        if (amount <= 0) return;

        items.push({
            nome: percentMode ? "SCONTO " + String(entered).replace(".", ",") + "%" : "SCONTO",
            prezzo: -amount,
            prezzobase: -amount,
            quantita: 1,
            tipo: "S",
            sconto: true
        });
        recalc();
    }

    function reset() {
        items = [];
        total = 0;
        prepared = false;
        paymentRunning = false;
        emit("change", getState());
        emit("reset", {});
    }

    function localDateParts(date) {
        const yyyy = String(date.getFullYear());
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        const hh = String(date.getHours()).padStart(2, "0");
        const mi = String(date.getMinutes()).padStart(2, "0");
        const ss = String(date.getSeconds()).padStart(2, "0");
        return {
            anno: yyyy,
            mese: yyyy + mm,
            giorno: yyyy + mm + dd,
            data: dd + "/" + mm + "/" + yyyy,
            ora: hh + ":" + mi,
            idPrefix: yyyy + mm + dd + hh + mi + ss + "00"
        };
    }

    async function buildReceipt(tipo) {
        const now = new Date();
        const parts = localDateParts(now);
        const device = await DB.getDeviceConfig();
        const superConnect = Number(device.superConnect || 1);
        const numero = await DB.nextReceiptNumber(superConnect);
        const righe = clone(items);

        const totServizi = roundMoney(righe
            .filter(r => r.tipo === "S" && !r.sconto)
            .reduce((sum, r) => sum + Number(r.prezzo || 0) * quantityOf(r), 0));
        const totProdotti = roundMoney(righe
            .filter(r => r.tipo === "P")
            .reduce((sum, r) => sum + Number(r.prezzo || 0) * quantityOf(r), 0));
        const totSconto = roundMoney(righe
            .filter(r => r.sconto || Number(r.prezzo || 0) < 0)
            .reduce((sum, r) => sum + Math.abs(Number(r.prezzo || 0) * quantityOf(r)), 0));

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
            superConnect: superConnect,
            fiscalStatus: "PENDING",
            printStatus: "PENDING",
            annullata: false,
            lastFiscalError: "",
            lastFiscalTry: "",
            lastPrintError: "",
            lastPrintTry: ""
        };
    }

    function errorMessage(error) {
        return error && error.message ? error.message : String(error || "Errore")
    }

    async function fiscalizeStoredReceipt(receipt) {
        if (!receipt || receipt.fiscalStatus === "OK") {
            return { receipt: receipt, error: null }
        }

        const receiptId = String(receipt._id || "")
        if (receiptId && fiscalLocks.has(receiptId))
            return fiscalLocks.get(receiptId)

        const work = (async () => {
            receipt.fiscalStatus = "PENDING"
            receipt.lastFiscalTry = new Date().toISOString()
            receipt.lastFiscalError = ""
            receipt = await DB.saveReceipt(receipt)

            try {
                const fiscal = await Fiscal.fiscalizeIT(receipt)
                receipt.fiscal = fiscal
                receipt.rCode = fiscal.numero || ""
                receipt.fiscalStatus = "OK"
                receipt.lastFiscalError = ""
                receipt = await DB.saveReceipt(receipt)

                return { receipt: receipt, error: null }
            } catch (error) {
                receipt.fiscalStatus = "ERROR"
                receipt.lastFiscalError = errorMessage(error)
                receipt = await DB.saveReceipt(receipt)

                return { receipt: receipt, error: error }
            }
        })()

        if (receiptId) fiscalLocks.set(receiptId, work)

        try {
            return await work
        } finally {
            if (receiptId) fiscalLocks.delete(receiptId)
        }
    }

    async function printStoredReceipt(receipt) {
        if (!receipt) return { receipt: receipt, error: new Error("Ricevuta non disponibile") }

        receipt.printStatus = "PENDING"
        receipt.lastPrintTry = new Date().toISOString()
        receipt.lastPrintError = ""
        receipt = await DB.saveReceipt(receipt)

        try {
            const device = await DB.getDeviceConfig()
            const printData = renderReceiptIT(Object.assign({}, receipt, {
                data: receipt.data,
                ora: receipt.ora
            }))

            await Bridge.exec("print", {
                lines: printData,
                paperWidthMm: Number(device.paperWidthMm || Config.paperWidthMm || 80)
            }, Config.printTimeoutMs || 60000)

            receipt.printStatus = "OK"
            receipt.lastPrintError = ""
            receipt = await DB.saveReceipt(receipt)

            return { receipt: receipt, error: null }
        } catch (error) {
            receipt.printStatus = "ERROR"
            receipt.lastPrintError = errorMessage(error)
            receipt = await DB.saveReceipt(receipt)

            return { receipt: receipt, error: error }
        }
    }

    async function retryReceipt(id) {
        let receipt = await DB.getReceipt(id)
        if (!receipt || receipt.annullata === true) return receipt

        if (receipt.fiscalStatus !== "OK") {
            const fiscalResult = await fiscalizeStoredReceipt(receipt)
            receipt = fiscalResult.receipt
        }

        const printResult = await printStoredReceipt(receipt)
        return printResult.receipt
    }

    async function cancelReceipt(id) {
        let receipt = await DB.getReceipt(id)
        receipt.annullata = true
        receipt.annullataAt = new Date().toISOString()
        return DB.saveReceipt(receipt)
    }

    async function retryPendingFiscalization() {
        if (recoveryRunning) return
        recoveryRunning = true

        try {
            const pending = await DB.getPendingFiscalReceipts()

            for (const pendingReceipt of pending) {
                const result = await fiscalizeStoredReceipt(pendingReceipt)

                if (!result.error && result.receipt && result.receipt.fiscalStatus === "OK") {
                    await printStoredReceipt(result.receipt)
                }
            }
        } finally {
            recoveryRunning = false
        }
    }

    function startRecovery() {
        if (recoveryTimer) return

        setTimeout(() => {
            retryPendingFiscalization().catch(() => {})
        }, 3000)

        recoveryTimer = setInterval(() => {
            retryPendingFiscalization().catch(() => {})
        }, 60000)
    }

    async function pay(tipo) {
        if (!items.length) {
            emit("payment:empty", {});
            return null;
        }
        if (paymentRunning) return null;

        paymentRunning = true;
        emit("change", getState());
        emit("payment:start", { tipo: tipo, total: total });

        try {
            let receipt = await buildReceipt(tipo);

            receipt = await DB.saveReceipt(receipt);
            emit("receipt:saved", { receipt: receipt });

            emit("fiscal:start", { receipt: receipt });
            const fiscalResult = await fiscalizeStoredReceipt(receipt);
            receipt = fiscalResult.receipt;
            emit("fiscal:end", {
                receipt: receipt,
                error: fiscalResult.error ? errorMessage(fiscalResult.error) : ""
            });

            emit("print:start", { receipt: receipt });
            const printResult = await printStoredReceipt(receipt);
            receipt = printResult.receipt;

            if (printResult.error) {
                emit("print:error", {
                    receipt: receipt,
                    message: errorMessage(printResult.error)
                });
            } else {
                emit("print:end", { receipt: receipt });
            }

            emit("payment:end", {
                receipt: receipt,
                fiscalError: !!fiscalResult.error,
                printError: !!printResult.error
            });

            reset();
            return receipt;
        } catch (error) {
            paymentRunning = false;
            emit("change", getState());
            emit("error", { message: errorMessage(error) });
            throw error;
        }
    }

    return {
        on: on,
        getState: getState,
        addArticle: addArticle,
        removeItem: removeItem,
        setPrice: setPrice,
        setItemValues: setItemValues,
        duplicateItem: duplicateItem,
        addDiscount: addDiscount,
        reset: reset,
        pay: pay,
        retryReceipt: retryReceipt,
        cancelReceipt: cancelReceipt,
        retryPendingFiscalization: retryPendingFiscalization,
        startRecovery: startRecovery
    };
})();
