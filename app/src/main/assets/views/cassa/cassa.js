window.AppViews = window.AppViews || {}

AppViews.cassa = (() => {
    let activeReparto = null
    let selectedIndex = -1
    let keypadBuffer = ""
    let keypadMode = "amount"
    let unsubscribers = []

    function formatMoney(value) {
        return Number(value || 0).toLocaleString("it-IT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + " €"
    }

    function parseKeypad() {
        if (!keypadBuffer) return null
        const value = Number(keypadBuffer.replace(",", "."))
        return Number.isFinite(value) ? value : null
    }

    function clearKeypad() {
        keypadBuffer = ""
        keypadMode = "amount"
        renderSelected()
    }

    function renderSelected() {
        const display = document.getElementById("selectedPrice")
        if (!display) return

        if (keypadBuffer) {
            display.textContent = keypadMode === "percent"
                ? keypadBuffer + " %"
                : keypadBuffer + " €"
            return
        }

        const state = AppAPI.getPosState()
        const item = selectedIndex >= 0 ? state.items[selectedIndex] : null

        display.textContent = item ? formatMoney(item.prezzo) : "0,00 €"
    }

    function renderCart() {
        const container = document.getElementById("carrello")
        if (!container) return

        const state = AppAPI.getPosState()
        container.innerHTML = ""

        state.items.forEach((item, index) => {
            const row = document.createElement("button")
            row.type = "button"
            row.className = "cart-row"
            if (index === selectedIndex) row.classList.add("selected")

            const name = document.createElement("span")
            name.textContent = item.nome

            const price = document.createElement("span")
            price.textContent = formatMoney(item.prezzo)

            row.appendChild(name)
            row.appendChild(price)
            row.addEventListener("click", () => {
                selectedIndex = index
                clearKeypad()
                renderCart()
                renderSelected()
            })

            container.appendChild(row)
        })

        document.getElementById("articleCount").textContent = String(state.items.length)
        document.getElementById("totalValue").textContent = formatMoney(state.total)

        if (selectedIndex >= state.items.length) {
            selectedIndex = state.items.length - 1
        }

        document.querySelectorAll(".pos-app button").forEach(button => {
            if (!button.classList.contains("reparto-button") && !button.classList.contains("tool")) {
                button.disabled = state.paymentRunning || button.classList.contains("empty")
            }
        })

        renderSelected()
        container.scrollTop = container.scrollHeight
    }

    function articleButton(article) {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "btn articolo-button"

        if (!article) {
            button.disabled = true
            button.classList.add("empty")
            return button
        }

        const name = document.createElement("div")
        name.className = "article-name"
        name.textContent = article.nome

        const price = document.createElement("div")
        price.className = "article-price"
        price.textContent = formatMoney(article.prezzo)

        button.appendChild(name)
        button.appendChild(price)
        button.addEventListener("click", () => addArticle(article._id))

        return button
    }

    function addArticle(id) {
        const manualPrice = keypadMode === "amount" ? parseKeypad() : null
        AppAPI.addArticolo(id, manualPrice)
        clearKeypad()
    }

    function renderListArticles(text) {
        const container = document.getElementById("articoliLista")
        if (!container) return

        const list = AppAPI.searchArticoli(activeReparto, text || "")
        container.innerHTML = ""

        list.forEach(article => {
            const row = document.createElement("button")
            row.type = "button"
            row.className = "article-list-row"

            const name = document.createElement("span")
            name.textContent = article.nome

            const price = document.createElement("span")
            price.textContent = formatMoney(article.prezzo)

            row.appendChild(name)
            row.appendChild(price)
            row.addEventListener("click", () => addArticle(article._id))
            container.appendChild(row)
        })
    }

    function setActiveReparto(id) {
        activeReparto = Number(id)

        document.querySelectorAll(".reparto-button").forEach(button => {
            button.classList.toggle("active", Number(button.dataset.id) === activeReparto)
        })

        const view = AppAPI.getRepartoView(activeReparto)
        if (!view) return

        const buttons = document.getElementById("articoliBottoni")
        const listPanel = document.getElementById("articoliListaPanel")
        const search = document.getElementById("articleSearch")

        if (view.vista === "LISTA") {
            buttons.classList.add("hidden")
            listPanel.classList.remove("hidden")
            search.value = ""
            renderListArticles("")
        } else {
            listPanel.classList.add("hidden")
            buttons.classList.remove("hidden")
            buttons.innerHTML = ""
            view.slots.forEach(article => buttons.appendChild(articleButton(article)))
        }
    }

    function renderReparti() {
        const container = document.getElementById("reparti")
        const reparti = AppAPI.getReparti()
        container.innerHTML = ""

        reparti.forEach(reparto => {
            const button = document.createElement("button")
            button.type = "button"
            button.className = "btn reparto-button"
            button.dataset.id = reparto.id
            button.textContent = reparto.nome
            button.addEventListener("click", () => setActiveReparto(reparto.id))
            container.appendChild(button)
        })

        if (reparti.length) setActiveReparto(reparti[0].id)
    }

    function bindKeypad() {
        document.querySelectorAll("#keypad .key").forEach(button => {
            button.addEventListener("click", () => {
                const key = button.textContent.trim()

                if (/^[0-9]$/.test(key)) {
                    keypadBuffer = keypadBuffer === "0" ? key : keypadBuffer + key
                } else if (key === ",") {
                    if (!keypadBuffer.includes(",")) keypadBuffer = (keypadBuffer || "0") + ","
                } else if (key === "←") {
                    keypadBuffer = keypadBuffer.slice(0, -1)
                } else if (key === "CL") {
                    clearKeypad()
                    return
                } else if (key === "%") {
                    keypadMode = "percent"
                } else if (key === "OK") {
                    const value = parseKeypad()
                    if (selectedIndex >= 0 && value != null && keypadMode === "amount") {
                        AppAPI.setItemPrice(selectedIndex, value)
                        clearKeypad()
                        return
                    }
                } else if (key === "X") {
                    const value = parseKeypad()
                    if (selectedIndex >= 0 && value != null) {
                        AppAPI.duplicateItem(selectedIndex, value)
                        clearKeypad()
                        return
                    }
                }

                renderSelected()
            })
        })
    }

    function showProgress(message, percent, error) {
        const popup = document.getElementById("progressPopup")
        if (!popup) return

        popup.classList.add("show")
        popup.classList.toggle("error", !!error)
        document.getElementById("progressMessage").textContent = message
        document.getElementById("progressFill").style.width = String(percent) + "%"
        document.getElementById("progressPercent").textContent = String(percent) + "%"
    }

    function hideProgress() {
        const popup = document.getElementById("progressPopup")
        if (!popup) return
        popup.classList.remove("show", "error")
    }

    function bindActions() {
        document.getElementById("articleSearch").addEventListener("input", event => {
            renderListArticles(event.target.value)
        })

        document.getElementById("deleteItem").addEventListener("click", () => {
            if (selectedIndex < 0) return
            AppAPI.removeItem(selectedIndex)
            const state = AppAPI.getPosState()
            if (selectedIndex >= state.items.length) selectedIndex = state.items.length - 1
            clearKeypad()
        })

        document.getElementById("discountItem").addEventListener("click", () => {
            const value = parseKeypad()
            if (value == null || value <= 0) return
            AppAPI.addDiscount(value, keypadMode === "percent")
            clearKeypad()
        })

        document.getElementById("cancelSale").addEventListener("click", () => {
            selectedIndex = -1
            clearKeypad()
            AppAPI.resetPos()
        })

        document.getElementById("cashPayment").addEventListener("click", () => {
            AppAPI.pay("CA").catch(() => {})
        })

        document.getElementById("cardPayment").addEventListener("click", () => {
            AppAPI.pay("CC").catch(() => {})
        })

        document.getElementById("openConfig").addEventListener("click", () => Router.open("config"))
        document.getElementById("openSummary").addEventListener("click", () => Router.open("riepilogo"))
    }

    async function audit(root) {
        const ids = [
            "reparti",
            "articoliBottoni",
            "articoliListaPanel",
            "articleSearch",
            "articoliLista",
            "carrello",
            "articleCount",
            "totalValue",
            "selectedPrice",
            "keypad",
            "openConfig",
            "openSummary",
            "cancelSale",
            "cashPayment",
            "cardPayment",
            "progressPopup"
        ]

        const missing = ids.filter(id => !root.querySelector("#" + id))
        if (missing.length) throw new Error("Elementi DOM mancanti: " + missing.join(", "))

        return { ok: true, elements: ids.length }
    }

    async function mount() {
        renderReparti()
        renderCart()
        bindKeypad()
        bindActions()

        unsubscribers.push(AppAPI.on("pos:change", renderCart))
        unsubscribers.push(AppAPI.on("pos:payment:empty", () => alert("Nessun articolo inserito")))
        unsubscribers.push(AppAPI.on("barcode:notfound", detail => alert("Barcode non trovato: " + detail.code)))
        unsubscribers.push(AppAPI.on("pos:payment:start", () => showProgress("Preparazione scontrino...", 10)))
        unsubscribers.push(AppAPI.on("pos:fiscal:start", () => showProgress("Collegamento al cassetto fiscale...", 30)))
        unsubscribers.push(AppAPI.on("pos:fiscal:end", () => showProgress("Documento registrato...", 60)))
        unsubscribers.push(AppAPI.on("pos:print:start", () => showProgress("Stampa in corso...", 80)))
        unsubscribers.push(AppAPI.on("pos:print:end", () => showProgress("Operazione completata", 100)))
        unsubscribers.push(AppAPI.on("pos:print:error", detail => showProgress("Vendita registrata. Errore stampa: " + detail.message, 100, true)))
        unsubscribers.push(AppAPI.on("pos:payment:end", detail => {
            if (!detail.printError) {
                setTimeout(hideProgress, 500)
            }
        }))
        unsubscribers.push(AppAPI.on("pos:error", detail => showProgress(detail.message || "Errore", 100, true)))
    }

    function unmount() {
        unsubscribers.forEach(fn => fn())
        unsubscribers = []
    }

    return { mount, unmount, audit }
})()
