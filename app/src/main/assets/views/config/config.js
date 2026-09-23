window.AppViews = window.AppViews || {}

AppViews.config = (() => {
    let currentArticle = null
    let configData = null

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

    function updateCashDeleteButtons() {
        const current = configData.config.casse || []
        const selected = Number(document.getElementById("currentCash").value || 0)

        document.querySelectorAll(".cash-delete").forEach(button => {
            button.disabled = current.length <= 1 || Number(button.dataset.id) === selected
        })
    }

    function renderCashes() {
        const rows = document.getElementById("cashRows")
        const select = document.getElementById("currentCash")
        rows.innerHTML = ""
        select.innerHTML = ""

        const casse = configData.config.casse || []

        casse.forEach(cassa => {
            const row = document.createElement("div")
            row.className = "cash-row"
            row.dataset.id = cassa.id

            const id = document.createElement("strong")
            id.textContent = String(cassa.id)

            const controls = document.createElement("div")
            controls.style.display = "grid"
            controls.style.gridTemplateColumns = "1fr auto"
            controls.style.gap = "0.6rem"

            const name = document.createElement("input")
            name.className = "cash-name"
            name.value = cassa.nome

            const remove = document.createElement("button")
            remove.type = "button"
            remove.className = "btn cash-delete"
            remove.dataset.id = cassa.id
            remove.textContent = "ELIMINA"
            remove.addEventListener("click", () => deleteCash(cassa.id))

            controls.appendChild(name)
            controls.appendChild(remove)
            row.appendChild(id)
            row.appendChild(controls)
            rows.appendChild(row)

            const option = document.createElement("option")
            option.value = cassa.id
            option.textContent = cassa.id + " - " + cassa.nome
            select.appendChild(option)
        })

        select.value = String(configData.device.superConnect || 1)
        document.getElementById("paperWidthMm").value =
            String(Number(configData.device.paperWidthMm || Config.paperWidthMm || 80) <= 58 ? 58 : 80)
        select.onchange = updateCashDeleteButtons
        document.getElementById("addCash").disabled = Config.allowAddCash !== true
        updateCashDeleteButtons()
    }

    function addCash() {
        if (Config.allowAddCash !== true) return

        const current = configData.config.casse || []
        const max = current.reduce((m, c) => Math.max(m, Number(c.id || 0)), 0)
        current.push({ id: max + 1, nome: "Cassa " + (max + 1) })
        configData.config.casse = current
        renderCashes()
    }

    function deleteCash(id) {
        const current = configData.config.casse || []
        if (current.length <= 1) return

        const cashId = Number(id)
        const selected = Number(document.getElementById("currentCash").value || 0)
        if (!selected || cashId === selected) return

        configData.device.superConnect = selected
        configData.config.casse = current.filter(cassa => Number(cassa.id) !== cashId)
        renderCashes()
    }

    async function saveCashes() {
        const casse = Array.from(document.querySelectorAll(".cash-row")).map(row => ({
            id: Number(row.dataset.id),
            nome: row.querySelector(".cash-name").value.trim() || ("Cassa " + row.dataset.id)
        }))

        configData = await AppAPI.saveCasse(
            casse,
            document.getElementById("currentCash").value,
            document.getElementById("paperWidthMm").value
        )
        renderCashes()
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
        document.getElementById("accountPaperWidthMm").value =
            String(Number(configData.device.paperWidthMm || Config.paperWidthMm || 80) <= 58 ? 58 : 80)

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
            "currentCash",
            "paperWidthMm",
            "cashRows",
            "addCash",
            "saveCashes",
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
            "saveAccountConfig"
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
        renderCashes()
        renderAccount()
        newArticle()

        document.getElementById("backToPos").addEventListener("click", () => Router.open("cassa"))
        document.getElementById("runAudit").addEventListener("click", () => SystemAudit.run())
        document.getElementById("newArticle").addEventListener("click", newArticle)
        document.getElementById("configArticleSearch").addEventListener("input", event => renderArticleList(event.target.value))
        document.getElementById("articleForm").addEventListener("submit", saveArticle)
        document.getElementById("saveDepartments").addEventListener("click", saveDepartments)
        document.getElementById("addCash").addEventListener("click", addCash)
        document.getElementById("saveCashes").addEventListener("click", saveCashes)
        document.getElementById("saveAccountConfig").addEventListener("click", saveAccountConfig)
    }

    function unmount() {}

    return { mount, unmount, audit }
})()
