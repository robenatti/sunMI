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
        container.innerHTML = ""

        list.forEach(article => {
            const button = document.createElement("button")
            button.type = "button"
            button.className = "config-article-row"

            const name = document.createElement("span")
            name.textContent = article.nome
            const meta = document.createElement("span")
            meta.textContent = article.tipo + " · R" + article.reparto + " · " + money(article.prezzo)

            button.appendChild(name)
            button.appendChild(meta)
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
        document.getElementById("articlePosition").value = "1"
        document.getElementById("articleActive").checked = true
    }

    async function saveArticle(event) {
        event.preventDefault()

        const article = Object.assign({}, currentArticle || {}, {
            _id: document.getElementById("articleId").value || undefined,
            _rev: document.getElementById("articleRev").value || undefined,
            nome: document.getElementById("articleName").value.trim(),
            tipo: document.getElementById("articleType").value,
            prezzo: Number(document.getElementById("articlePrice").value || 0),
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
            const name = document.createElement("input")
            name.className = "cash-name"
            name.value = cassa.nome

            row.appendChild(id)
            row.appendChild(name)
            rows.appendChild(row)

            const option = document.createElement("option")
            option.value = cassa.id
            option.textContent = cassa.id + " - " + cassa.nome
            select.appendChild(option)
        })

        select.value = String(configData.device.superConnect || 1)
    }

    function addCash() {
        const current = configData.config.casse || []
        const max = current.reduce((m, c) => Math.max(m, Number(c.id || 0)), 0)
        current.push({ id: max + 1, nome: "Cassa " + (max + 1) })
        configData.config.casse = current
        renderCashes()
    }

    async function saveCashes() {
        const casse = Array.from(document.querySelectorAll(".cash-row")).map(row => ({
            id: Number(row.dataset.id),
            nome: row.querySelector(".cash-name").value.trim() || ("Cassa " + row.dataset.id)
        }))

        configData = await AppAPI.saveCasse(casse, document.getElementById("currentCash").value)
        renderCashes()
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
            "articleDepartment",
            "articlePosition",
            "departmentRows",
            "saveDepartments",
            "currentCash",
            "cashRows",
            "addCash",
            "saveCashes"
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
        newArticle()

        document.getElementById("backToPos").addEventListener("click", () => Router.open("cassa"))
        document.getElementById("runAudit").addEventListener("click", () => SystemAudit.run())
        document.getElementById("newArticle").addEventListener("click", newArticle)
        document.getElementById("configArticleSearch").addEventListener("input", event => renderArticleList(event.target.value))
        document.getElementById("articleForm").addEventListener("submit", saveArticle)
        document.getElementById("saveDepartments").addEventListener("click", saveDepartments)
        document.getElementById("addCash").addEventListener("click", addCash)
        document.getElementById("saveCashes").addEventListener("click", saveCashes)
    }

    function unmount() {}

    return { mount, unmount, audit }
})()
