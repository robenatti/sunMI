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
        meta.textContent = receipt.data + " " + receipt.ora + " · Cassa " + (receipt.superConnect || 1) + " · " + receipt.mp
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

        if (receipt.fiscal && receipt.fiscal.numero) {
            const fiscal = document.createElement("div")
            fiscal.className = "detail-fiscal"
            fiscal.textContent = "Fiscale: " + receipt.fiscal.numero
            box.appendChild(fiscal)
        }
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

            ;[
                receipt.ora || "",
                String(receipt.superConnect || 1),
                receipt.mp || "",
                money(receipt.totale)
            ].forEach(value => {
                const td = document.createElement("td")
                td.textContent = value
                tr.appendChild(td)
            })

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
        AppAPI.getCasse().forEach(cassa => {
            const label = document.createElement("label")
            label.className = "cash-check-label"

            const input = document.createElement("input")
            input.type = "checkbox"
            input.className = "cash-check"
            input.value = cassa.id
            input.checked = true
            input.addEventListener("change", refresh)

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
