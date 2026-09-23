window.AppViews = window.AppViews || {}

AppViews.riepilogo = (() => {
    function money(value) {
        return Number(value || 0).toLocaleString("it-IT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + " €"
    }

    function todayInput() {
        const d = new Date()
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, "0")
        const day = String(d.getDate()).padStart(2, "0")
        return y + "-" + m + "-" + day
    }

    function paymentLabel(value) {
        if (value === "CA") return "CONTANTI"
        if (value === "CC") return "POS"
        return value || ""
    }

    function selectedCasse() {
        return Array.from(document.querySelectorAll(".cash-check:checked")).map(input => input.value)
    }

    function renderDetail(receipt) {
        const box = document.getElementById("receiptDetail")
        box.innerHTML = ""

        const title = document.createElement("h2")
        title.textContent = "Ricevuta " + (receipt.numero || "") + " - " + money(receipt.totale)
        box.appendChild(title)

        const meta = document.createElement("div")
        meta.className = "detail-meta"
        meta.textContent = receipt.data + " " + receipt.ora + " · Cassa " + (receipt.superConnect || 1) + " · " + paymentLabel(receipt.mp)
        box.appendChild(meta)

        ;(receipt.righe || []).forEach(row => {
            const line = document.createElement("div")
            line.className = "detail-row"

            const name = document.createElement("span")
            name.textContent = row.nome
            const price = document.createElement("span")
            price.textContent = money(row.prezzo)

            line.appendChild(name)
            line.appendChild(price)
            box.appendChild(line)
        })

        const status = document.createElement("div")
        status.className = "detail-fiscal"
        status.textContent =
            "Fiscale: " + (receipt.fiscalStatus === "OK" ? (receipt.fiscal && receipt.fiscal.numero || "OK") : "DA FISCALIZZARE") +
            " · Stampa: " + (receipt.printStatus || "N/D") +
            (receipt.annullata ? " · ANNULLATA" : "")
        box.appendChild(status)
    }

    function addPdfButton(tr, receipt) {
        const td = document.createElement("td")
        const button = document.createElement("button")
        const fileName = receipt.fiscal && receipt.fiscal.fileName
            ? receipt.fiscal.fileName
            : ""

        button.type = "button"
        button.className = "pdf-button"
        button.textContent = "PDF"

        if (!fileName) {
            button.classList.add("pdf-missing")
        } else {
            Bridge.exec("pdf_exists", { fileName: fileName }, 3000)
                .then(result => {
                    if (!result || !result.exists) button.classList.add("pdf-missing")
                })
                .catch(() => button.classList.add("pdf-missing"))
        }

        button.addEventListener("click", event => {
            event.stopPropagation()

            if (!fileName) return

            Bridge.exec("pdf_open", { fileName: fileName }, 5000)
                .catch(() => button.classList.add("pdf-missing"))
        })

        td.appendChild(button)
        tr.appendChild(td)
    }

    function addRetryButton(tr, receipt) {
        const td = document.createElement("td")
        const button = document.createElement("button")

        button.type = "button"
        button.className = "receipt-action-button"
        button.textContent = "↻"
        button.disabled = receipt.annullata === true

        button.addEventListener("click", async event => {
            event.stopPropagation()
            button.disabled = true

            try {
                await AppAPI.retryReceipt(receipt._id)
            } finally {
                await refresh()
            }
        })

        td.appendChild(button)
        tr.appendChild(td)
    }

    function addCancelButton(tr, receipt) {
        const td = document.createElement("td")
        const button = document.createElement("button")

        button.type = "button"
        button.className = "receipt-action-button"
        button.textContent = "X"
        button.disabled = receipt.annullata === true

        button.addEventListener("click", async event => {
            event.stopPropagation()

            if (!confirm("Confermi annullamento ricevuta?")) return

            button.disabled = true

            try {
                await AppAPI.cancelReceipt(receipt._id)
            } finally {
                await refresh()
            }
        })

        td.appendChild(button)
        tr.appendChild(td)
    }

    async function refresh() {
        const day = document.getElementById("summaryDate").value.replace(/-/g, "")
        const data = await AppAPI.getDailySummary(day, selectedCasse())

        document.getElementById("sumTotal").textContent = money(data.totale)
        document.getElementById("sumCash").textContent = money(data.contanti)
        document.getElementById("sumPos").textContent = money(data.pos)
        document.getElementById("sumServices").textContent = money(data.servizi)
        document.getElementById("sumProducts").textContent = money(data.prodotti)
        document.getElementById("sumDocuments").textContent = String(data.documenti)

        const body = document.getElementById("receiptRows")
        body.innerHTML = ""

        data.receipts.forEach(receipt => {
            const tr = document.createElement("tr")

            if (receipt.fiscalStatus !== "OK") tr.classList.add("receipt-fiscal-pending")
            if (receipt.annullata === true) tr.classList.add("receipt-annulled")

            ;[
                receipt.ora || "",
                String(receipt.superConnect || 1),
                paymentLabel(receipt.mp),
                money(receipt.totale)
            ].forEach(value => {
                const td = document.createElement("td")
                td.textContent = value
                tr.appendChild(td)
            })

            addPdfButton(tr, receipt)
            addRetryButton(tr, receipt)
            addCancelButton(tr, receipt)

            tr.addEventListener("click", () => renderDetail(receipt))
            body.appendChild(tr)
        })
    }

    async function audit(root) {
        const ids = [
            "summaryDate",
            "backToPos",
            "cashChecks",
            "sumTotal",
            "sumCash",
            "sumPos",
            "sumServices",
            "sumProducts",
            "sumDocuments",
            "receiptRows",
            "receiptDetail"
        ]

        const missing = ids.filter(id => !root.querySelector("#" + id))
        if (missing.length) throw new Error("Elementi DOM mancanti: " + missing.join(", "))

        return { ok: true, elements: ids.length }
    }

    async function mount() {
        document.getElementById("summaryDate").value = todayInput()
        document.getElementById("backToPos").addEventListener("click", () => Router.open("cassa"))
        document.getElementById("summaryDate").addEventListener("change", refresh)

        const cashChecks = document.getElementById("cashChecks")
        const device = await AppAPI.getDeviceConfig()
        const currentCash = Number(device.superConnect || Config.superConnect || 1)
        const configuredCashes = AppAPI.getCasse()

        ;[1, 2, 3].forEach(id => {
            const cassa = configuredCashes.find(item => Number(item.id) === id) || {
                id: id,
                nome: "Cassa " + id
            }

            const label = document.createElement("label")
            label.className = "cash-check-label " +
                (id === currentCash ? "cash-check-current" : "cash-check-inactive")

            const input = document.createElement("input")
            input.type = "checkbox"
            input.className = "cash-check"
            input.value = cassa.id
            input.checked = id === currentCash
            input.disabled = true

            const text = document.createElement("span")
            text.textContent = cassa.nome

            label.appendChild(input)
            label.appendChild(text)
            cashChecks.appendChild(label)
        })

        await refresh()
    }

    function unmount() {}

    return { mount, unmount, audit }
})()
