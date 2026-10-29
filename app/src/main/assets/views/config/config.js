window.AppViews = window.AppViews || {}

AppViews.config = (() => {
    let currentArticle = null
    let configData = null
    let nexiBusy = false

    function money(value) {
        return Number(value || 0).toLocaleString("it-IT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })
    }

    function renderArticleList(text) {
        const container = document.getElementById("configArticleList")
        const list = AppAPI.searchAllArticoli(text || "")
            .slice()
            .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "it"))
        container.innerHTML = ""

        list.forEach(article => {
            const button = document.createElement("button")
            button.type = "button"
            button.className = "config-article-row"

            const reparto = document.createElement("span")
            reparto.className = "config-article-department"
            reparto.textContent = "R" + article.reparto

            const name = document.createElement("span")
            name.className = "config-article-name"
            name.textContent = article.nome

            const tipo = document.createElement("span")
            tipo.className = "config-article-type"
            tipo.textContent = article.tipo

            const price = document.createElement("span")
            price.className = "config-article-price"
            price.textContent = money(article.prezzo)

            button.appendChild(reparto)
            button.appendChild(name)
            button.appendChild(tipo)
            button.appendChild(price)
            button.addEventListener("click", () => editArticle(article._id))
            container.appendChild(button)
        })
    }

    function fillDepartmentSelect() {
        const select = document.getElementById("articleDepartment")
        select.innerHTML = ""

        AppAPI.getReparti().forEach(reparto => {
            const option = document.createElement("option")
            option.value = reparto.id
            option.textContent = reparto.id + " - " + reparto.nome
            select.appendChild(option)
        })
    }

    function editArticle(id) {
        const article = AppAPI.getArticolo(id)
        if (!article) return

        currentArticle = article
        document.getElementById("articleId").value = article._id || ""
        document.getElementById("articleRev").value = article._rev || ""
        document.getElementById("articleName").value = article.nome || ""
        document.getElementById("articleType").value = article.tipo || "S"
        document.getElementById("articlePrice").value = Number(article.prezzo || 0)
        document.getElementById("articleVat").value =
            article.iva === "" || typeof article.iva === "undefined" || article.iva === null
                ? 22
                : Number(article.iva)
        document.getElementById("articleDepartment").value = Number(article.reparto || 1)
        document.getElementById("articlePosition").value = Number(article.posizione || 1)
        document.getElementById("articleBarcode").value = article.barcode || ""
        document.getElementById("articleCategory").value = article.categoria || ""
        document.getElementById("articleBrand").value = article.marca || ""
        document.getElementById("articleActive").checked = article.attivo !== false
    }

    function newArticle() {
        currentArticle = null
        document.getElementById("articleForm").reset()
        document.getElementById("articleId").value = ""
        document.getElementById("articleRev").value = ""
        document.getElementById("articleType").value = "P"
        document.getElementById("articleVat").value = "22"
        document.getElementById("articlePosition").value = "1"
        document.getElementById("articleActive").checked = true
    }

    async function saveArticle(event) {
        event.preventDefault()

        const ivaValue = document.getElementById("articleVat").value.trim()

        const article = Object.assign({}, currentArticle || {}, {
            _id: document.getElementById("articleId").value || undefined,
            _rev: document.getElementById("articleRev").value || undefined,
            nome: document.getElementById("articleName").value.trim(),
            tipo: document.getElementById("articleType").value,
            prezzo: Number(document.getElementById("articlePrice").value || 0),
            iva: ivaValue === "" ? 22 : Number(ivaValue),
            prezzobase: currentArticle && typeof currentArticle.prezzobase !== "undefined"
                ? Number(currentArticle.prezzobase)
                : Number(document.getElementById("articlePrice").value || 0),
            reparto: Number(document.getElementById("articleDepartment").value || 1),
            posizione: Number(document.getElementById("articlePosition").value || 1),
            barcode: document.getElementById("articleBarcode").value.trim(),
            categoria: document.getElementById("articleCategory").value.trim(),
            marca: document.getElementById("articleBrand").value.trim(),
            attivo: document.getElementById("articleActive").checked
        })

        if (!article._id) delete article._id
        if (!article._rev) delete article._rev

        const saved = await AppAPI.saveArticle(article)
        editArticle(saved._id)
        renderArticleList(document.getElementById("configArticleSearch").value)
    }

    function renderDepartments() {
        const container = document.getElementById("departmentRows")
        container.innerHTML = ""

        AppAPI.getReparti().forEach(reparto => {
            const row = document.createElement("div")
            row.className = "department-row"
            row.dataset.id = reparto.id

            const id = document.createElement("strong")
            id.textContent = String(reparto.id)

            const name = document.createElement("input")
            name.className = "department-name"
            name.value = reparto.nome

            const view = document.createElement("select")
            view.className = "department-view"
            ;["BOTTONI", "LISTA"].forEach(value => {
                const option = document.createElement("option")
                option.value = value
                option.textContent = value
                option.selected = String(reparto.vista || "BOTTONI").toUpperCase() === value
                view.appendChild(option)
            })

            row.appendChild(id)
            row.appendChild(name)
            row.appendChild(view)
            container.appendChild(row)
        })
    }

    async function saveDepartments() {
        const reparti = Array.from(document.querySelectorAll(".department-row")).map(row => ({
            id: Number(row.dataset.id),
            nome: row.querySelector(".department-name").value.trim() || ("R" + row.dataset.id),
            vista: row.querySelector(".department-view").value
        }))

        await AppAPI.saveReparti(reparti)
        fillDepartmentSelect()
        renderDepartments()
    }

    function renderAccount() {
        const state = AppAPI.getAccountState()
        const account = state.account || {}
        const intestazione = account.intestazione || Config.intestazione || {}
        const allowHeader = account.allowChangeIntestazione === true
        const allowUser = account.allowChangeUsername === true

        document.getElementById("accountHeader1").value = intestazione.riga1 || ""
        document.getElementById("accountHeader2").value = intestazione.riga2 || ""
        document.getElementById("accountHeader3").value = intestazione.riga3 || ""
        document.getElementById("accountHeader4").value = intestazione.riga4 || ""
        document.getElementById("accountHeader5").value = intestazione.riga5 || ""

        document.getElementById("accountCf").value = account.cf || ""
        document.getElementById("accountPiva").value = account.piva || ""
        document.getElementById("accountPin").value = account.pin || ""
        document.getElementById("accountPwd").value = account.pwd || ""

        document.getElementById("accountCash").value =
            String(Number(configData.device.superConnect || 1))
        const width = Number(configData.device.paperWidthMm != null
            ? configData.device.paperWidthMm : Config.paperWidthMm)
        document.getElementById("accountPaperWidthMm").value =
            String(width === 0 ? 0 : width <= 58 ? 58 : 80)

        ;["accountHeader1", "accountHeader2", "accountHeader3", "accountHeader4", "accountHeader5"].forEach(id => {
            document.getElementById(id).disabled = !allowHeader
        })

        ;["accountCf", "accountPiva", "accountPin"].forEach(id => {
            document.getElementById(id).disabled = !allowUser
        })

        document.getElementById("accountPwd").disabled = false
        document.getElementById("accountCash").disabled = !allowUser
        document.getElementById("accountPaperWidthMm").disabled = !allowUser

        document.getElementById("headerPermission").textContent =
            allowHeader ? "DATI INTESTAZIONE MODIFICABILI" : "DATI INTESTAZIONE NON MODIFICABILI"
        document.getElementById("userPermission").textContent =
            allowUser ? "DATI UTENTE MODIFICABILI" : "DATI UTENTE IN SOLA LETTURA"
        document.getElementById("devicePermission").textContent =
            allowUser ? "CONFIGURAZIONE DISPOSITIVO MODIFICABILE" : "CONFIGURAZIONE DISPOSITIVO IN SOLA LETTURA"
    }

    async function saveAccountConfig() {
        const state = AppAPI.getAccountState()
        const account = state.account || {}
        const changes = {}

        if (account.allowChangeIntestazione === true) {
            changes.intestazione = {
                riga1: document.getElementById("accountHeader1").value.trim(),
                riga2: document.getElementById("accountHeader2").value.trim(),
                riga3: document.getElementById("accountHeader3").value.trim(),
                riga4: document.getElementById("accountHeader4").value.trim(),
                riga5: document.getElementById("accountHeader5").value.trim()
            }
        }

        if (account.allowChangeUsername === true) {
            changes.cf = document.getElementById("accountCf").value.trim()
            changes.piva = document.getElementById("accountPiva").value.trim()
            changes.pin = document.getElementById("accountPin").value.trim()
        }

        const pwd = document.getElementById("accountPwd").value
        if (pwd) changes.pwd = pwd

        try {
            await AppAPI.saveAccount(changes)

            if (account.allowChangeUsername === true) {
                const existingCashes = configData.config.casse || []
                const casse = [1, 2, 3].map(id => {
                    return existingCashes.find(cassa => Number(cassa.id) === id) || {
                        id: id,
                        nome: "Cassa " + id
                    }
                })

                configData = await AppAPI.saveCasse(
                    casse,
                    document.getElementById("accountCash").value,
                    document.getElementById("accountPaperWidthMm").value
                )
            }

            window.location.reload()
        } catch (error) {
            alert("ERRORE SALVATAGGIO ACCOUNT: " + (error && error.message ? error.message : String(error)))
        }
    }



    function renderReceiptNotes() {
        const state = AppAPI.getAccountState()
        const account = state.account || {}
        const allowUser = account.allowChangeUsername === true
        const textarea = document.getElementById("receiptNotes")
        const saveButton = document.getElementById("saveReceiptNotes")

        textarea.value = String(configData.device.noteScontrino || "")
        textarea.disabled = !allowUser
        saveButton.disabled = !allowUser

        document.getElementById("receiptNotesPermission").textContent =
            allowUser ? "NOTE SCONTRINO MODIFICABILI" : "NOTE SCONTRINO IN SOLA LETTURA"
    }

    async function saveReceiptNotes() {
        const state = AppAPI.getAccountState()
        const account = state.account || {}
        if (account.allowChangeUsername !== true) return

        const noteScontrino = document.getElementById("receiptNotes").value

        configData = await AppAPI.saveDeviceConfig({
            noteScontrino: noteScontrino
        })

        Config.noteScontrino = noteScontrino
        renderReceiptNotes()
    }


    function renderNexiConfig() {
        const remote = AppAPI.getAccountState().device || {};
        const local = configData.device || {};
        const cfg = Object.assign({}, remote.pos17 || {}, local.pos17 || {});
        document.getElementById("nexiHost").value = String(cfg.host || "");
        document.getElementById("nexiPort").value = String(cfg.port || "");
        document.getElementById("nexiTerminalId").value = String(cfg.terminalId || "");
        document.getElementById("nexiRegisterId").value = String(cfg.registerId || "00000000");
        const savedReceiptFlag = Object.prototype.hasOwnProperty.call(local, "posReceipt")
            ? local.posReceipt : remote.posReceipt;
        document.getElementById("nexiReceiptEnabled").checked = savedReceiptFlag === true;
    }

    function readNexiForm() {
        return {
            host: document.getElementById("nexiHost").value,
            port: document.getElementById("nexiPort").value,
            terminalId: document.getElementById("nexiTerminalId").value,
            registerId: document.getElementById("nexiRegisterId").value
        };
    }

    function appendNexiLog(message) {
        const log = document.getElementById("nexiLog");
        const time = new Date().toLocaleTimeString("it-IT", { hour12: false });
        const lines = (log.textContent || "").split("\n").filter(Boolean);
        String(message || "").split("\n").forEach(line => lines.push("[" + time + "] " + line));
        log.textContent = lines.slice(-100).join("\n");
        log.scrollTop = log.scrollHeight;
    }

    function validatedNexiForm() {
        try {
            return AppAPI.validatePos17Config(readNexiForm());
        } catch (error) {
            const fields = {
                host: "nexiHost",
                port: "nexiPort",
                terminalId: "nexiTerminalId",
                registerId: "nexiRegisterId"
            };
            const element = document.getElementById(fields[error.field] || "nexiHost");
            if (element) element.focus();
            appendNexiLog("CONFIGURAZIONE ERRATA - " + (error.message || String(error)));
            return null;
        }
    }

    function setNexiBusy(busy) {
        nexiBusy = busy;
        ["testNexiConfig", "nexiLastTransaction", "nexiTotals", "saveNexiConfig"].forEach(id => {
            document.getElementById(id).disabled = busy;
        });
    }

    function logNexiFields(data) {
        if (!data || typeof data !== "object") return;
        const fields = [
            ["Esito", "result"],
            ["Terminal ID", "terminalId"],
            ["Importo", "amount"],
            ["Carta", "pan"],
            ["Autorizzazione", "authCode"],
            ["STAN", "stan"],
            ["ID online", "idOnline"],
            ["RRN", "rrn"],
            ["Data host", "hostDate"],
            ["Ora host", "hostTime"],
            ["Totale EFT", "eftTotal"],
            ["Descrizione errore", "errorDescription"]
        ];
        fields.forEach(([label, key]) => {
            const val = data[key];
            if (val === null || typeof val === "undefined" || val === "") return;
            const display = key === "eftTotal" ? money(val) + " €" : String(val);
            appendNexiLog(label + ": " + display);
        });
    }

    async function saveNexiConfig() {
        if (nexiBusy) return;
        const pos17 = validatedNexiForm();
        if (!pos17) return;
        try {
            configData = await AppAPI.saveDeviceConfig({
                pos17,
                posReceipt: document.getElementById("nexiReceiptEnabled").checked
            });
            renderNexiConfig();
            appendNexiLog("Configurazione Nexi salvata. Ricevuta POS: " +
                (configData.device.posReceipt === true ? "SI" : "NO"));
        } catch (error) {
            appendNexiLog("ERRORE SALVATAGGIO - " + (error.message || String(error)));
        }
    }

    async function tryNexiConfig() {
        if (nexiBusy) return;
        const cfg = validatedNexiForm();
        if (!cfg) return;

        const cents = 10 + Math.floor(Math.random() * 41);
        const amount = cents / 100;
        const amountLabel = money(amount) + " €";
        setNexiBusy(true);
        appendNexiLog("PROVA - ADDEBITO REALE " + amountLabel + " - invio al terminale...");
        try {
            const result = await AppAPI.testNexiPayment(cfg, amount);
            if (result.status === "OK")
                appendNexiLog("PROVA APPROVATA - " + amountLabel);
            else if (result.status === "KO")
                appendNexiLog("PROVA RIFIUTATA - " + (result.message || "Pagamento non approvato."));
            else
                appendNexiLog("ESITO INCERTO - " + (result.message || "Risposta non confermata.") +
                    " Verificare il POS prima di ripetere la prova.");
            logNexiFields(result.data);
        } catch (error) {
            appendNexiLog("ERRORE PROVA - " + (error.message || String(error)));
        } finally {
            setNexiBusy(false);
        }
    }

    async function queryNexi(operation) {
        if (nexiBusy) return;
        const cfg = validatedNexiForm();
        if (!cfg) return;

        setNexiBusy(true);
        appendNexiLog(operation === "LAST" ? "ULTIMA TRANSAZIONE - richiesta..." : "TOTALI EFT - richiesta...");
        try {
            const result = await AppAPI.queryNexi(cfg, operation);
            if (result.status === "OK")
                appendNexiLog(operation === "LAST" ? "ULTIMA TRANSAZIONE - risposta ricevuta" : "TOTALI - risposta ricevuta");
            else
                appendNexiLog("RISPOSTA NEGATIVA - " + (result.message || "Operazione non completata."));
            logNexiFields(result.data);
        } catch (error) {
            appendNexiLog("ERRORE OPERAZIONE - " + (error.message || String(error)));
        } finally {
            setNexiBusy(false);
        }
    }

    function bindTabs() {
        document.querySelectorAll(".config-tab").forEach(button => {
            button.addEventListener("click", () => {
                document.querySelectorAll(".config-tab").forEach(b => b.classList.remove("active"))
                document.querySelectorAll(".config-panel").forEach(p => p.classList.remove("active"))
                button.classList.add("active")
                document.getElementById(button.dataset.panel).classList.add("active")
            })
        })
    }

    async function audit(root) {
        const ids = [
            "backToPos",
            "runAudit",
            "configArticleSearch",
            "newArticle",
            "configArticleList",
            "articleForm",
            "articleName",
            "articleType",
            "articlePrice",
            "articleVat",
            "articleDepartment",
            "articlePosition",
            "departmentRows",
            "saveDepartments",
            "receiptNotes",
            "receiptNotesPermission",
            "saveReceiptNotes",
            "accountHeader1",
            "accountHeader2",
            "accountHeader3",
            "accountHeader4",
            "accountHeader5",
            "accountCf",
            "accountPiva",
            "accountPin",
            "accountPwd",
            "accountCash",
            "accountPaperWidthMm",
            "saveAccountConfig",
            "nexiHost", "nexiPort", "nexiTerminalId", "nexiRegisterId", "saveNexiConfig",
            "nexiReceiptEnabled", "testNexiConfig", "nexiLastTransaction", "nexiTotals", "nexiLog"
        ]

        const missing = ids.filter(id => !root.querySelector("#" + id))
        if (missing.length) throw new Error("Elementi DOM mancanti: " + missing.join(", "))

        return { ok: true, elements: ids.length }
    }

    async function mount() {
        configData = await AppAPI.getConfig()
        bindTabs()
        fillDepartmentSelect()
        renderArticleList("")
        renderDepartments()
        renderReceiptNotes()
        renderAccount()
        renderNexiConfig()
        newArticle()

        document.getElementById("backToPos").addEventListener("click", () => Router.open("cassa"))
        document.getElementById("runAudit").addEventListener("click", () => SystemAudit.run())
        document.getElementById("newArticle").addEventListener("click", newArticle)
        document.getElementById("configArticleSearch").addEventListener("input", event => renderArticleList(event.target.value))
        document.getElementById("articleForm").addEventListener("submit", saveArticle)
        document.getElementById("saveDepartments").addEventListener("click", saveDepartments)
        document.getElementById("saveReceiptNotes").addEventListener("click", saveReceiptNotes)
        document.getElementById("saveAccountConfig").addEventListener("click", saveAccountConfig)
        document.getElementById("saveNexiConfig").addEventListener("click", saveNexiConfig)
        document.getElementById("testNexiConfig").addEventListener("click", tryNexiConfig)
        document.getElementById("nexiLastTransaction").addEventListener("click", () => queryNexi("LAST"))
        document.getElementById("nexiTotals").addEventListener("click", () => queryNexi("TOTALS"))
    }

    function unmount() {}

    return { mount, unmount, audit }
})()
