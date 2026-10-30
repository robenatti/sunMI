// Copyright AltraConsulenza Snc
// Motore POS. Nessuna dipendenza dalla UI.

const POS = (() => {
    let items = [];
    let total = 0;
    let lordo = 0;
    let listeners = new Map();
    let prepared = false;
    let paymentRunning = false;
    let nexiTestRunning = false;
    let recoveryTimer = null;
    let recoveryRunning = false;
    let fiscalLocks = new Map();
    let cancelLocks = new Map();
    let connectionStatus = "STANDBY";
    let connectionAttempt = 0;

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

    // Somma di tutte le righe, comprese le tessere e gli sconti negativi.
    function calculateLordo(righe) {
        return roundMoney(righe.reduce((sum, item) => {
            return sum + Number(item.prezzo || 0) * quantityOf(item);
        }, 0));
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

    function setConnectionStatus(status) {
        connectionStatus = status;
        emit("connection:status", { status });
    }

    function startPrepare() {
        const attempt = ++connectionAttempt;
        setConnectionStatus("STANDBY");
        Fiscal.prepareIT().then(() => {
            if (attempt === connectionAttempt) setConnectionStatus("ONLINE");
        }).catch(() => {
            if (attempt === connectionAttempt) setConnectionStatus("OFFLINE");
        });
    }

    function recalc() {
        lordo = calculateLordo(items);
        total = roundMoney(items.reduce((sum, item) => {
            return item.tessera === true ? sum : sum + Number(item.prezzo || 0) * quantityOf(item);
        }, 0));
        emit("change", getState());
    }

    function getState() {
        return {
            items: clone(items),
            total: total,
            lordo: lordo,
            paymentRunning: paymentRunning,
            connectionStatus: connectionStatus
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
            startPrepare();
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

    function toggleTessera(index) {
        if (paymentRunning) return;
        const item = items[Number(index)];
        if (!item || item.tipo !== "S" || item.sconto === true) return;
        item.tessera = item.tessera !== true;
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
        lordo = 0;
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
        const account = Account.getState();
        const deviceId = String(account.deviceId || device.deviceId || "").toLowerCase();
        if (!deviceId) throw new Error("Device ID non disponibile");
        const superConnect = Number(device.superConnect || 1);
        const numero = await DB.nextReceiptNumber(superConnect);
        const righe = clone(items);

        const totServizi = roundMoney(righe
            .filter(r => r.tipo === "S" && !r.sconto && r.tessera !== true)
            .reduce((sum, r) => sum + Number(r.prezzo || 0) * quantityOf(r), 0));
        const totProdotti = roundMoney(righe
            .filter(r => r.tipo === "P" && r.tessera !== true)
            .reduce((sum, r) => sum + Number(r.prezzo || 0) * quantityOf(r), 0));
        const totSconto = roundMoney(righe
            .filter(r => r.tessera !== true && (r.sconto || Number(r.prezzo || 0) < 0))
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
            lordo: calculateLordo(righe),
            totServizi: totServizi,
            totProdotti: totProdotti,
            superConnect: superConnect,
            deviceId: deviceId,
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

    function belongsToCurrentCash(receipt, device) {
        const account = Account.getState();
        const currentId = String(account.deviceId || device && device.deviceId || "").toLowerCase();
        return !!currentId &&
            String(receipt && receipt.deviceId || "").toLowerCase() === currentId &&
            Number(receipt && receipt.superConnect) === Number(device && device.superConnect || 1);
    }

    async function fiscalizeStoredReceipt(receipt) {
        if (!receipt || receipt.fiscalStatus === "OK") {
            return { receipt: receipt, error: null }
        }

        const receiptId = String(receipt._id || "")
        if (receiptId && fiscalLocks.has(receiptId))
            return fiscalLocks.get(receiptId)

        const attempt = ++connectionAttempt
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
                if (attempt === connectionAttempt) setConnectionStatus("ONLINE")

                return { receipt: receipt, error: null }
            } catch (error) {
                receipt.fiscalStatus = "ERROR"
                receipt.lastFiscalError = errorMessage(error)
                receipt = await DB.saveReceipt(receipt)
                if (attempt === connectionAttempt) setConnectionStatus("OFFLINE")

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

        const device = await DB.getDeviceConfig()
        if (!belongsToCurrentCash(receipt, device))
            return { receipt: receipt, error: new Error("Ricevuta di altro dispositivo o cassa") }

        if (Number(device.paperWidthMm) === 0) {
            if (receipt.printStatus !== "SKIPPED") {
                receipt.printStatus = "SKIPPED"
                receipt.lastPrintError = ""
                receipt = await DB.saveReceipt(receipt)
            }
            return { receipt: receipt, error: null, skipped: true }
        }

        receipt.printStatus = "PENDING"
        receipt.lastPrintTry = new Date().toISOString()
        receipt.lastPrintError = ""
        receipt = await DB.saveReceipt(receipt)

        try {
            const printData = renderReceiptIT(Object.assign({}, receipt, {
                data: receipt.data,
                ora: receipt.ora
            }), { posReceipt: device.posReceipt === true })

            await Bridge.exec("print", {
                lines: printData,
                paperWidthMm: Number(device.paperWidthMm) <= 58 ? 58 : 80
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

    async function retryFiscalAndPrint(id) {
        let receipt = await DB.getReceipt(id)
        const device = await DB.getDeviceConfig()
        if (!belongsToCurrentCash(receipt, device)) throw new Error("Ricevuta di altro dispositivo o cassa")
        if (receipt.annullata === true) throw new Error("Ricevuta annullata")

        const fiscalResult = await fiscalizeStoredReceipt(receipt)
        receipt = fiscalResult.receipt
        if (fiscalResult.error)
            return { receipt: receipt, fiscalError: errorMessage(fiscalResult.error) }

        if (receipt.printStatus === "OK" || receipt.printStatus === "SKIPPED")
            return { receipt: receipt }

        const printResult = await printStoredReceipt(receipt)
        return {
            receipt: printResult.receipt,
            printError: printResult.error ? errorMessage(printResult.error) : ""
        }
    }

    async function printAnyway(id) {
        const receipt = await DB.getReceipt(id)
        const device = await DB.getDeviceConfig()
        if (!belongsToCurrentCash(receipt, device)) throw new Error("Ricevuta di altro dispositivo o cassa")
        if (receipt.annullata === true) throw new Error("Ricevuta annullata")
        if (receipt.printStatus === "OK" || receipt.printStatus === "SKIPPED")
            return { receipt: receipt }

        const result = await printStoredReceipt(receipt)
        return {
            receipt: result.receipt,
            printError: result.error ? errorMessage(result.error) : ""
        }
    }

    async function retryReceipt(id) {
        let receipt = await DB.getReceipt(id)
        const device = await DB.getDeviceConfig()
        if (!belongsToCurrentCash(receipt, device)) throw new Error("Ricevuta di altro dispositivo o cassa")
        if (receipt.annullata === true) return receipt

        if (receipt.fiscalStatus !== "OK") {
            const fiscalResult = await fiscalizeStoredReceipt(receipt)
            receipt = fiscalResult.receipt
            if (fiscalResult.error) return receipt
        }

        const printResult = await printStoredReceipt(receipt)
        return printResult.receipt
    }

    async function cancelReceipt(id) {
        if (cancelLocks.has(id)) return cancelLocks.get(id)

        const work = (async () => {
            // Attende un'eventuale fiscalizzazione già avviata sulla stessa ricevuta.
            if (fiscalLocks.has(id)) await fiscalLocks.get(id)

            let receipt = await DB.getReceipt(id)
            if (receipt.annullata === true) return receipt

            const dcw = String((receipt.fiscal && receipt.fiscal.numero) || receipt.rCode || "").trim()
            if (receipt.fiscalStatus === "OK" || dcw) {
                if (!dcw) throw new Error("DCW mancante: impossibile annullare il documento fiscale")

                try {
                    receipt.annullo = await Fiscal.annullaIT(dcw)
                } catch (e) {
                    throw new Error("Annullo fiscale non confermato per " + dcw +
                        ". Verificare sul portale AdE prima di riprovare. " + errorMessage(e))
                }
            }

            receipt.annullata = true
            receipt.annullataAt = new Date().toISOString()

            try {
                return await DB.saveReceipt(receipt)
            } catch (e) {
                if (receipt.annullo) {
                    throw new Error("Annullo AdE eseguito, ma salvataggio locale fallito. " +
                        "Verificare prima di riprovare. " + errorMessage(e))
                }
                throw e
            }
        })()

        cancelLocks.set(id, work)
        try {
            return await work
        } finally {
            cancelLocks.delete(id)
        }
    }

    async function retryPendingFiscalization() {
        if (recoveryRunning) return
        recoveryRunning = true

        try {
            const device = await DB.getDeviceConfig()
            const account = Account.getState()
            const currentId = String(account.deviceId || device.deviceId || "").toLowerCase()
            const pending = await DB.getPendingFiscalReceipts(currentId, device.superConnect)
            for (const receipt of pending) {
                if (!belongsToCurrentCash(receipt, device)) continue
                await fiscalizeStoredReceipt(receipt)
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

    function validatePos17Config(input) {
        const data = input || {};
        const host = String(data.host == null ? "" : data.host).trim();
        const portText = String(data.port == null ? "" : data.port).trim();
        const terminalId = String(data.terminalId == null ? "" : data.terminalId).trim();
        const registerId = String(data.registerId == null ? "" : data.registerId).trim();

        function invalid(field, message) {
            const error = new Error(message);
            error.field = field;
            throw error;
        }

        const octets = host.split(".");
        if (octets.length !== 4 || !octets.every(value =>
            /^(0|[1-9][0-9]{0,2})$/.test(value) && Number(value) <= 255))
            invalid("host", "IP terminale non valido: inserire un indirizzo IPv4, ad esempio 192.168.1.100.");

        const port = Number(portText);
        if (!/^[0-9]+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535)
            invalid("port", "Porta TCP non valida: inserire un numero da 1 a 65535.");

        if (!/^[0-9]{1,8}$/.test(terminalId))
            invalid("terminalId", "Terminal ID non valido: inserire da 1 a 8 cifre.");

        if (!/^[0-9]{1,8}$/.test(registerId))
            invalid("registerId", "Register ID non valido: inserire da 1 a 8 cifre.");

        // Si passa al modulo Nexi solo una configurazione TCP, senza file INI legacy.
        return { host, port, terminalId, registerId };
    }

    function getPos17Config(device) {
        const remote = Account.getState().device || {};
        const pos17 = Object.assign({}, remote.pos17 || {}, device && device.pos17 || {});
        if (!pos17.registerId) pos17.registerId = "00000000";
        return validatePos17Config(pos17);
    }

    function executeNexiPayment(cfg, amount) {
        return new Promise(resolve => {
            try {
                if (!TerminalePOS.setupPOS(cfg)) {
                    resolve({ status: "UNKNOWN", message: "Impossibile inizializzare la connessione Nexi." });
                    return;
                }
                TerminalePOS.payPOS(null, amount, (ok, data) => {
                    if (ok && data && data.success === true) {
                        resolve({ status: "OK", data });
                    } else if (data && typeof data === "object" && data.result && data.result !== "00") {
                        resolve({ status: "KO", data, message: "Pagamento rifiutato: codice " + data.result });
                    } else {
                        resolve({ status: "UNKNOWN", message: "Esito POS non confermato (" + errorMessage(data) + ")" });
                    }
                }, "X");
            } catch (error) {
                resolve({ status: "UNKNOWN", message: errorMessage(error) });
            }
        });
    }

    async function testNexiPayment(config, amount) {
        const cfg = validatePos17Config(config);
        const cents = Math.round(Number(amount) * 100);
        if (!Number.isFinite(Number(amount)) || cents < 10 || cents > 50 ||
            Math.abs(Number(amount) * 100 - cents) > 0.00001)
            throw new Error("L'importo di prova deve essere compreso fra 0,10 e 0,50 euro.");

        if (paymentRunning || nexiTestRunning)
            throw new Error("Un pagamento POS è già in corso.");

        nexiTestRunning = true;
        try {
            // Addebito vero, indipendente dalla cassa: non salva e non fiscalizza ricevute.
            return await executeNexiPayment(cfg, cents / 100);
        } finally {
            nexiTestRunning = false;
        }
    }

    async function queryNexi(config, operation) {
        const cfg = validatePos17Config(config);
        if (paymentRunning || nexiTestRunning)
            throw new Error("Un'operazione POS è già in corso.");

        if (operation !== "LAST" && operation !== "TOTALS")
            throw new Error("Comando POS non previsto.");

        nexiTestRunning = true;
        try {
            return await new Promise(resolve => {
                try {
                    if (!TerminalePOS.setupPOS(cfg)) {
                        resolve({ status: "UNKNOWN", message: "Impossibile inizializzare il terminale Nexi." });
                        return;
                    }
                    const onResult = (ok, data) => {
                        resolve({
                            status: ok ? "OK" : "KO",
                            data: data && typeof data === "object" ? data : null,
                            message: ok ? "" : (
                                data && typeof data === "object" && data.errorDescription
                                    ? data.errorDescription
                                    : "Nessuna risposta valida dal terminale; riprovare tra qualche secondo."
                            )
                        });
                    };
                    if (operation === "LAST") TerminalePOS.checkLast(null, null, onResult);
                    else TerminalePOS.getTotals(null, null, onResult);
                } catch (error) {
                    resolve({ status: "UNKNOWN", message: errorMessage(error) });
                }
            });
        } finally {
            nexiTestRunning = false;
        }
    }

    function isTerminalAuthorized() {
        return (Account.getState().account || {}).allowPosTerminal === true;
    }

    async function pay(tipo, options) {
        if (!items.length) {
            emit("payment:empty", {});
            return null;
        }
        if (paymentRunning || nexiTestRunning) return null;

        paymentRunning = true;
        emit("change", getState());
        emit("payment:start", { tipo: tipo, total: total });

        try {
            const device = await DB.getDeviceConfig();
            const remoteDevice = Account.getState().device || {};
            const defaultAuto = Object.prototype.hasOwnProperty.call(device, "posEnabled")
                ? device.posEnabled === true : remoteDevice.posEnabled === true;
            const automatic = tipo === "CC" && isTerminalAuthorized() &&
                defaultAuto && !(options && options.manualPos === true);
            const cfg = automatic ? getPos17Config(device) : null;
            let receipt = await buildReceipt(tipo);

            // Con sola tessera si conserva una registrazione non fiscale, senza addebito.
            if (receipt.righe.every(row => row.tessera === true)) {
                receipt.documento = "Tessera";
                receipt.mp = "TESSERA";
                receipt.fiscalStatus = "SKIPPED";
                receipt.printStatus = "SKIPPED";
                receipt = await DB.saveReceipt(receipt);
                emit("payment:end", { receipt, fiscalError: false, printError: false });
                reset();
                return receipt;
            }
            if (receipt.totale <= 0)
                throw new Error("Totale da incassare non valido. Controllare sconti e tessere.");

            if (tipo === "CC" && automatic) {
                receipt.posMode = "AUTO";
                receipt.documento = "Tentativo POS";
                receipt.fiscalStatus = "WAIT_POS";
                receipt.posStatus = "PENDING";
                receipt = await DB.saveReceipt(receipt);

                emit("terminal:connecting", { total: total });
                emit("terminal:waiting", { total: total });
                const payment = await executeNexiPayment(cfg, total);

                receipt.posStatus = payment.status;
                receipt.lastPosError = payment.message || "";
                if (payment.data) receipt.pos17 = payment.data;

                if (payment.status !== "OK") {
                    receipt = await DB.saveReceipt(receipt);
                    emit(payment.status === "KO" ? "terminal:declined" : "terminal:unknown", {
                        message: payment.message || "Pagamento POS non riuscito"
                    });
                    // KO o esito incerto: conservare articoli, sconti, quantita' e totale.
                    paymentRunning = false;
                    emit("change", getState());
                    return null;
                }

                receipt.documento = "Ricevuta";
                receipt.fiscalStatus = "PENDING";
            } else if (tipo === "CC") {
                // Pagamento elettronico effettuato fuori dall'app, senza terminale TCP.
                receipt.posMode = "MANUAL";
                receipt.posStatus = "MANUAL";
            }
            receipt = await DB.saveReceipt(receipt);
            emit("receipt:saved", { receipt: receipt });

            emit("fiscal:start", { receipt: receipt });
            const fiscalResult = await fiscalizeStoredReceipt(receipt);
            receipt = fiscalResult.receipt;
            emit("fiscal:end", {
                receipt: receipt,
                error: fiscalResult.error ? errorMessage(fiscalResult.error) : ""
            });

            let printResult = { receipt: receipt, error: null, skipped: true };
            if (!fiscalResult.error) {
                const noPrint = Number((await DB.getDeviceConfig()).paperWidthMm) === 0;
                if (!noPrint) emit("print:start", { receipt: receipt });
                printResult = await printStoredReceipt(receipt);
                receipt = printResult.receipt;
            }

            if (printResult.error) {
                emit("print:error", {
                    receipt: receipt,
                    message: errorMessage(printResult.error)
                });
            } else {
                emit("print:end", { receipt: receipt, skipped: printResult.skipped === true });
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
        toggleTessera: toggleTessera,
        setPrice: setPrice,
        setItemValues: setItemValues,
        duplicateItem: duplicateItem,
        addDiscount: addDiscount,
        reset: reset,
        pay: pay,
        validatePos17Config: validatePos17Config,
        testNexiPayment: testNexiPayment,
        queryNexi: queryNexi,
        retryReceipt: retryReceipt,
        retryFiscalAndPrint: retryFiscalAndPrint,
        printAnyway: printAnyway,
        cancelReceipt: cancelReceipt,
        retryPendingFiscalization: retryPendingFiscalization,
        startRecovery: startRecovery
    };
})();
