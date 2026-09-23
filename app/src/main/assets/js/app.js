// Copyright AltraConsulenza Snc
// Facade pubblica del business: le UI conoscono solo AppAPI.

const AppAPI = (() => {
    const listeners = new Map();
    const posUnsubscribers = [];
    let initialized = false;

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
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
        set.forEach(callback => callback(clone(detail || {})));
    }

    async function init() {
        if (initialized) return;
        await DB.init();
        await Catalog.init();
        ["change", "reset", "payment:start", "payment:empty", "fiscal:start", "fiscal:end", "receipt:saved", "print:start", "print:end", "print:error", "payment:end", "error"].forEach(name => {
            posUnsubscribers.push(POS.on(name, detail => emit("pos:" + name, detail)));
        });
        Barcode.start();
        POS.startRecovery();
        initialized = true;
    }

    function getReparti() {
        return clone(Catalog.getReparti());
    }

    function getRepartoView(id) {
        const reparto = Catalog.getReparto(id);
        if (!reparto) return null;
        if (String(reparto.vista || "BOTTONI").toUpperCase() === "LISTA") {
            return {
                reparto: clone(reparto),
                vista: "LISTA",
                articoli: clone(Catalog.getByReparto(id))
            };
        }
        return {
            reparto: clone(reparto),
            vista: "BOTTONI",
            slots: clone(Catalog.getButtonSlots(id))
        };
    }

    function searchArticoli(reparto, text) {
        return clone(Catalog.search(reparto, text));
    }

    function searchAllArticoli(text) {
        return clone(Catalog.search(null, text));
    }

    function getArticolo(id) {
        const article = Catalog.getById(id);
        return article ? clone(article) : null;
    }

    function addArticolo(id, overridePrice) {
        const article = Catalog.getById(id);
        if (!article) return false;
        POS.addArticle(article, overridePrice);
        return true;
    }

    function scanBarcode(code) {
        const article = Catalog.findBarcode(code);
        if (!article) {
            emit("barcode:notfound", { code: code });
            return false;
        }
        POS.addArticle(article);
        emit("barcode:found", { code: code, article: article });
        return true;
    }

    function getPosState() {
        return POS.getState();
    }

    function removeItem(index) {
        POS.removeItem(index);
    }

    function setItemPrice(index, price) {
        POS.setPrice(index, price);
    }

    function setItemValues(index, quantity, price) {
        POS.setItemValues(index, quantity, price);
    }

    function duplicateItem(index, count) {
        POS.duplicateItem(index, count);
    }

    function addDiscount(value, percentMode) {
        POS.addDiscount(value, percentMode);
    }

    function resetPos() {
        POS.reset();
    }

    function pay(tipo) {
        return POS.pay(tipo);
    }

    async function saveArticle(article) {
        return Catalog.saveArticle(article);
    }

    async function saveReparti(reparti) {
        return Catalog.saveReparti(reparti);
    }

    async function getConfig() {
        const result = await Promise.all([DB.getConfig(), DB.getDeviceConfig()]);
        return { config: clone(result[0]), device: clone(result[1]) };
    }

    async function saveCasse(casse, superConnect, paperWidthMm) {
        await Catalog.saveCasse(casse);
        await DB.saveDeviceConfig({
            superConnect: Number(superConnect || 1),
            paperWidthMm: Number(paperWidthMm || 80) <= 58 ? 58 : 80
        });
        return getConfig();
    }

    async function getDeviceConfig() {
        return clone(await DB.getDeviceConfig());
    }

    async function retryReceipt(id) {
        return POS.retryReceipt(id);
    }

    async function cancelReceipt(id) {
        return POS.cancelReceipt(id);
    }

    function getAccountState() {
        return Account.getState();
    }

    async function saveAccount(changes) {
        return Account.updateAccount(changes);
    }

    function getCasse() {
        return clone(Catalog.getCasse());
    }

    async function getDailySummary(giorno, selectedCasse) {
        return clone(await Reports.daily(giorno, selectedCasse));
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
        setItemValues,
        duplicateItem,
        addDiscount,
        resetPos,
        pay,
        saveArticle,
        saveReparti,
        getConfig,
        saveCasse,
        getCasse,
        getDailySummary,
        getDeviceConfig,
        retryReceipt,
        cancelReceipt,
        getAccountState,
        saveAccount
    };
})();

window.SystemAudit = (() => {
    let running = false;
    let manualCloseHandler = null;

    function messageOf(error) {
        return error && error.message ? error.message : String(error);
    }

    function stackOf(error) {
        return error && error.stack ? error.stack : "";
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function parseExpiry(value) {
        const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!match) throw new Error("Data scadenza non valida");

        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);
        const date = new Date(year, month - 1, day);

        if (
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day
        ) {
            throw new Error("Data scadenza non valida");
        }

        return { day, month, year };
    }

    function expiryStatus() {
        const expiry = parseExpiry(Config.dataScadenza);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const warningStart = new Date(expiry.year, expiry.month - 1, 1);
        const blockDate = new Date(expiry.year, expiry.month, 1);
        const daysRemaining = Math.max(0, Math.ceil((blockDate - today) / 86400000));

        return {
            value: Config.dataScadenza,
            warning: today >= warningStart && today < blockDate,
            blocked: today >= blockDate,
            blockDate,
            daysRemaining
        };
    }

    function formatDate(date) {
        const pad = value => String(value).padStart(2, "0");
        return pad(date.getDate()) + "/" + pad(date.getMonth() + 1) + "/" + date.getFullYear();
    }

    async function runStep(label, fn, options) {
        const opts = options || {};
        try {
            const result = await fn();
            const detail = result && result.detail ? result.detail : "";
            if (result && result.warning) {
                BootTerminal.warn(label + " - " + result.warning, detail);
                return { ok: true, warning: true, result: result };
            }
            BootTerminal.ok(label + (result && result.message ? " - " + result.message : ""), detail);
            return { ok: true, result: result };
        } catch (error) {
            const detail = stackOf(error);
            if (opts.warning) {
                BootTerminal.warn(label + " - " + messageOf(error), detail);
                return { ok: true, warning: true };
            }
            BootTerminal.fail(label + " - " + messageOf(error), detail);
            return { ok: false };
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
        ];
        const missing = required.filter(row => !row[1]).map(row => row[0]);
        if (missing.length) throw new Error("API mancanti: " + missing.join(", "));
        return { message: navigator.userAgent };
    }

    async function auditModules() {
        const required = [
            ["Config", typeof Config !== "undefined"],
            ["Bridge Android", typeof Bridge !== "undefined"],
            ["Account", typeof Account !== "undefined"],
            ["Receipt renderer", typeof renderReceiptIT === "function"],
            ["DB", typeof DB !== "undefined"],
            ["Catalog", typeof Catalog !== "undefined"],
            ["Fiscal", typeof Fiscal !== "undefined"],
            ["POS", typeof POS !== "undefined"],
            ["Reports", typeof Reports !== "undefined"],
            ["Router", typeof Router !== "undefined"],
            ["Barcode", typeof Barcode !== "undefined"]
        ];
        const missing = required.filter(row => !row[1]).map(row => row[0]);
        if (missing.length) throw new Error("Moduli mancanti: " + missing.join(", "));
        return { message: required.length + " moduli caricati" };
    }

    async function auditCatalog() {
        await Catalog.init();
        const reparti = Catalog.getReparti();
        const articoli = Catalog.getAll();
        if (!Array.isArray(reparti)) throw new Error("Reparti non validi");
        if (!Array.isArray(articoli)) throw new Error("Articoli non validi");
        return { message: reparti.length + " reparti / " + articoli.length + " articoli" };
    }

    async function auditHardware() {
        let last = null;
        for (let attempt = 0; attempt < 8; attempt++) {
            last = await Bridge.auditHardware(1200);
            if (last.mock) return { warning: "bridge mock browser - hardware non verificabile" };
            if (last.androidBridge && last.printerService && last.printerDriver) {
                const device = await DB.getDeviceConfig();
                return {
                    message:
                        (last.manufacturer || "SUNMI") + " " + (last.model || "") +
                        " / stampante pronta / " + Number(device.paperWidthMm || 80) + "mm"
                };
            }
            await delay(300);
        }
        if (!last || !last.androidBridge) throw new Error("Bridge Android non disponibile");
        throw new Error("Stampante Sunmi non pronta");
    }

    async function auditViews() {
        const results = await Router.auditAll();
        let failures = 0;
        results.forEach(result => {
            if (result.ok) BootTerminal.ok("VIEW " + result.name.toUpperCase() + " - HTML / CSS / JS / audit");
            else {
                failures++;
                BootTerminal.fail("VIEW " + result.name.toUpperCase() + " - " + result.error, result.detail || "");
            }
        });
        return failures;
    }

    function keepManualDiagnostic(appView) {
        const actions = document.getElementById("bootActions");
        const close = document.getElementById("bootRetry");
        if (actions) actions.classList.add("show");
        if (close) {
            close.textContent = "CHIUDI";
            close.dataset.action = "manual-close";
        }

        if (manualCloseHandler) document.removeEventListener("click", manualCloseHandler, true);
        manualCloseHandler = event => {
            if (!event.target || event.target.id !== "bootRetry" || event.target.dataset.action !== "manual-close") return;
            event.preventDefault();
            event.stopImmediatePropagation();
            BootTerminal.hide();
            if (appView) appView.style.display = "";
            close.textContent = "RIPROVA";
            delete close.dataset.action;
            document.removeEventListener("click", manualCloseHandler, true);
            manualCloseHandler = null;
        };
        document.addEventListener("click", manualCloseHandler, true);
    }

    async function run(options) {
        if (running) return;
        running = true;
        window.__BOOT_STARTED__ = true;

        const opts = options || {};
        const manual = opts.manual === true || (typeof Router !== "undefined" && Router.getCurrent() === "config");
        const appView = document.getElementById("appView");
        if (appView) appView.style.display = "none";

        BootTerminal.show();
        BootTerminal.reset();
        BootTerminal.info("SOLX POS SYSTEM BOOT");
        BootTerminal.info("AltraCassa V " + String(Config.version || "?"));
        BootTerminal.info("Audit completo sistema");

        const earlyErrors = BootTerminal.getRuntimeErrorCount();
        if (earlyErrors) BootTerminal.warn("Rilevati " + earlyErrors + " errore/i JavaScript prima dell'audit - vedere DETTAGLI");
        let failures = 0;
        let step = await runStep("JavaScript runtime", auditRuntime);
        if (!step.ok) failures++;
        step = await runStep("Moduli applicativi", auditModules);
        if (!step.ok) failures++;
        step = await runStep("PouchDB library", async () => {
            if (typeof PouchDB === "undefined") throw new Error("PouchDB non caricato");
            return { message: "v" + (PouchDB.version || "?") + " locale" };
        });
        if (!step.ok) failures++;

        let accountResult = null;
        step = await runStep("Account locale", async () => {
            accountResult = await Account.init();
            const state = Account.getState();

            if (accountResult.warning) {
                return {
                    warning:
                        (state.account ? "cache locale attiva" : "nessun account locale") +
                        " - " + accountResult.warning
                };
            }

            return {
                message:
                    (state.account && state.account.salone ? state.account.salone : "fallback locale") +
                    (state.lastAccountUpdate ? " - aggiornato " + state.lastAccountUpdate : "")
            };
        });
        if (!step.ok) failures++;

        if (accountResult && accountResult.changed) {
            BootTerminal.ready("CONFIGURAZIONE ACCOUNT AGGIORNATA - RIAVVIO");
            running = false;
            window.location.reload();
            return;
        }

        step = await runStep("Device ID", async () => {
            const state = Account.getState();
            if (!state.deviceId) throw new Error("Device ID non disponibile");
            return { message: state.deviceId };
        });
        if (!step.ok) failures++;

        await runStep("Server account", () => Account.checkServer(), { warning: true });

        let expiryWarning = "";
        let expiryBlocked = false;

        try {
            const status = expiryStatus();

            if (status.blocked) {
                expiryBlocked = true;
                BootTerminal.fail("IL PROGRAMMA È SCADUTO");
                BootTerminal.fail("CONTATTARE IL FORNITORE");
            } else if (status.warning) {
                expiryWarning =
                    "IL PROGRAMMA È IN SCADENZA\n" +
                    "SCADENZA: " + status.value + "\n" +
                    status.daysRemaining + " GIORNI AL BLOCCO";

                BootTerminal.warn("IL PROGRAMMA È IN SCADENZA");
                BootTerminal.warn(
                    "SCADENZA: " + status.value +
                    " - " + status.daysRemaining + " GIORNI AL BLOCCO"
                );
            } else {
                BootTerminal.ok(
                    "Scadenza software - " +
                    status.value +
                    " - " +
                    status.daysRemaining +
                    " giorni al blocco"
                );
            }
        } catch (error) {
            BootTerminal.fail("Scadenza software - " + messageOf(error), stackOf(error));
            failures++;
        }

        step = await runStep("Salone database", async () => {
            const salone = String(Config.salone || "").trim();
            if (!salone) throw new Error("Config.salone non disponibile");
            return { message: salone };
        });
        if (!step.ok) failures++;

        step = await runStep("DB locale bootstrap", () => Account.auditLocalDatabase());
        if (!step.ok) failures++;

        let dbReady = false;
        step = await runStep("Database locale R/W", async () => {
            await DB.init();
            const result = await DB.audit();
            dbReady = true;
            return result;
        });
        if (!step.ok) failures++;

        if (dbReady) {
            step = await runStep("DB locale magazzino", () => DB.auditLocalDatabase("magazzino"));
            if (!step.ok) failures++;
            step = await runStep("DB locale config", () => DB.auditLocalDatabase("config"));
            if (!step.ok) failures++;
            step = await runStep("DB locale ricevute", () => DB.auditLocalDatabase("receipt"));
            if (!step.ok) failures++;

            step = await runStep("DB remoto magazzino", () => DB.auditRemoteDatabase("magazzino"));
            if (!step.ok) failures++;
            step = await runStep("DB remoto config", () => DB.auditRemoteDatabase("config"));
            if (!step.ok) failures++;
            step = await runStep("DB remoto ricevute", () => DB.auditRemoteDatabase("receipt"));
            if (!step.ok) failures++;

            await runStep("Replica magazzino", () => DB.auditReplication("magazzino"), { warning: true });
            await runStep("Replica configurazione", () => DB.auditReplication("config"), { warning: true });
            await runStep("Replica ricevute", () => DB.auditReplication("receipt"), { warning: true });
        } else {
            BootTerminal.warn("Database locali - non verificati perché il DB non è disponibile");
            BootTerminal.warn("Database remoti - non verificati perché il DB locale non è disponibile");
            BootTerminal.warn("Repliche - non verificate perché il DB locale non è disponibile");
        }

        step = await runStep("Configurazione POS", async () => {
            if (!dbReady) throw new Error("Database non disponibile");
            const config = await DB.getConfig();
            if (!config || !Array.isArray(config.reparti)) throw new Error("Configurazione reparti non valida");
            return { message: config.reparti.length + " reparti configurati" };
        });
        if (!step.ok) failures++;
        step = await runStep("Catalogo articoli", auditCatalog);
        if (!step.ok) failures++;
        step = await runStep("Motore POS", async () => {
            const posState = POS.getState();
            if (!posState || !Array.isArray(posState.items) || typeof posState.total !== "number") throw new Error("Stato POS non valido");
            return { message: "motore pronto" };
        });
        if (!step.ok) failures++;
        step = await runStep("Renderer ricevuta", async () => {
            const rows = renderReceiptIT({ righe: [], totale: 0, mp: "CA", data: "01/01/2000", ora: "00:00", fiscal: {} });
            if (!Array.isArray(rows) || !rows.length) throw new Error("Il renderer non produce righe di stampa");
            return { message: rows.length + " comandi generati" };
        });
        if (!step.ok) failures++;
        step = await runStep("Report giornalieri", async () => {
            if (typeof Reports.daily !== "function") throw new Error("Reports.daily non disponibile");
            return { message: "riepiloghi disponibili" };
        });
        if (!step.ok) failures++;
        await runStep("Interfaccia fiscale", async () => {
            if (typeof Fiscal.prepareIT !== "function" || typeof Fiscal.fiscalizeIT !== "function") throw new Error("Interfaccia fiscale incompleta");
            if (!Config.intestazione || !Config.intestazione.userScade) return { warning: "identificativo fiscale non configurato" };
            return { message: "interfaccia configurata" };
        }, { warning: true });
        step = await runStep("Bridge Android / stampante", auditHardware);
        if (!step.ok) failures++;
        step = await runStep("Barcode HID", async () => {
            Barcode.start();
            return { message: "listener tastiera attivo" };
        });
        if (!step.ok) failures++;
        failures += await auditViews();

        if (failures === 0 && expiryBlocked) {
            const expiredMessage =
                "IL PROGRAMMA È SCADUTO\n" +
                "CONTATTARE IL FORNITORE";

            BootTerminal.blockedSummary(expiredMessage);
            alert(expiredMessage);
            running = false;
            return;
        }

        if (failures === 0 && expiryWarning) {
            BootTerminal.warningSummary(expiryWarning);
            alert(expiryWarning);
        }

        if (failures === 0) {
            step = await runStep("AppAPI", async () => {
                await AppAPI.init();
                return { message: "business inizializzato" };
            });
            if (!step.ok) failures++;
        }

        if (failures === 0 && !manual) {
            step = await runStep("Interfaccia cassa", async () => {
                await Router.open("cassa");
                return { message: "mount completato" };
            });
            if (!step.ok) failures++;
        }

        if (failures === 0) {
            BootTerminal.ready(manual ? "DIAGNOSTICA COMPLETATA" : "SYSTEM READY - avvio cassa");
            if (manual) keepManualDiagnostic(appView);
            else {
                if (appView) appView.style.display = "";
                setTimeout(() => BootTerminal.hide(), 450);
            }
        } else {
            BootTerminal.failed(failures);
            BootTerminal.setTechnical();
            if (manual) keepManualDiagnostic(appView);
        }

        running = false;
    }

    return { run };
})();

window.addEventListener("DOMContentLoaded", () => {
    SystemAudit.run();
});