// Copyright AltraConsulenza Snc
// Riepiloghi indipendenti dalla UI.

const Reports = (() => {
    async function daily(giorno, selectedCasse) {
        let receipts = await DB.getReceiptsByDay(giorno)

        if (Array.isArray(selectedCasse)) {
            const selected = selectedCasse.map(String)
            receipts = selected.length
                ? receipts.filter(r => selected.includes(String(r.superConnect || 1)))
                : []
        }

        receipts.sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")))

        const result = {
            totale: 0,
            contanti: 0,
            pos: 0,
            servizi: 0,
            prodotti: 0,
            documenti: receipts.length,
            receipts: receipts
        }

        receipts.forEach(r => {
            const totale = Number(r.totale || 0)
            result.totale += totale
            result.servizi += Number(r.totServizi || 0)
            result.prodotti += Number(r.totProdotti || 0)

            if (r.mp === "CC") result.pos += totale
            else result.contanti += totale
        })

        ;["totale", "contanti", "pos", "servizi", "prodotti"].forEach(key => {
            result[key] = Math.round(result[key] * 100) / 100
        })

        return result
    }

    return { daily }
})()
