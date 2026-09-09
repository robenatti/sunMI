// Copyright AltraConsulenza Snc
// Catalogo articoli e reparti. Nessuna dipendenza dalla UI.

const Catalog = (() => {
    let articles = []
    let config = null
    let barcodeIndex = new Map()

    function parseNumber(value) {
        if (typeof value === "number") return value
        const n = Number(String(value || "0").replace(",", "."))
        return Number.isFinite(n) ? n : 0
    }

    function normalize(doc) {
        const oldType = doc.tipo
        const isPosType = oldType === "P" || oldType === "S"

        return Object.assign({}, doc, {
            tipo: isPosType ? oldType : "P",
            tipoProdotto: isPosType ? (doc.tipoProdotto || "") : (oldType || doc.tipoProdotto || ""),
            nome: doc.nome || doc.prodotto || doc.servizio || "Articolo",
            prezzo: parseNumber(
                typeof doc.prezzo !== "undefined"
                    ? doc.prezzo
                    : doc.valoreV
            ),
            prezzobase: parseNumber(
                typeof doc.prezzobase !== "undefined"
                    ? doc.prezzobase
                    : (typeof doc.prezzo !== "undefined" ? doc.prezzo : doc.valoreV)
            ),
            reparto: Number(doc.reparto || 1),
            posizione: Number(doc.posizione || 1),
            barcode: String(doc.barcode || ""),
            categoria: doc.categoria || "",
            marca: doc.marca || "",
            fornitore: doc.fornitore || "",
            attivo: doc.attivo !== false
        })
    }

    async function init() {
        await refresh()
    }

    async function refresh() {
        const result = await Promise.all([
            DB.getAllArticles(),
            DB.getConfig()
        ])

        articles = result[0].map(normalize)
        config = result[1]

        barcodeIndex = new Map()

        articles.forEach(article => {
            if (article.barcode) {
                barcodeIndex.set(article.barcode, article)
            }
        })
    }

    function getReparti() {
        return (config && config.reparti || [])
            .slice()
            .sort((a, b) => Number(a.id) - Number(b.id))
    }

    function getReparto(id) {
        return getReparti().find(r => Number(r.id) === Number(id)) || null
    }

    function getAll() {
        return articles
            .filter(a => a.attivo !== false)
            .slice()
            .sort(compareArticles)
    }

    function getById(id) {
        return articles.find(a => a._id === id) || null
    }

    function compareArticles(a, b) {
        const pos = Number(a.posizione || 0) - Number(b.posizione || 0)
        if (pos !== 0) return pos
        return String(a.nome || "").localeCompare(String(b.nome || ""), "it")
    }

    function getByReparto(reparto) {
        return articles
            .filter(a => a.attivo !== false && Number(a.reparto) === Number(reparto))
            .slice()
            .sort(compareArticles)
    }

    function getButtonSlots(reparto) {
        const slots = new Array(16).fill(null)
        const list = getByReparto(reparto)

        list.forEach(article => {
            let index = Math.max(0, Math.min(15, Number(article.posizione || 1) - 1))

            while (index < 16 && slots[index]) {
                index++
            }

            if (index < 16) {
                slots[index] = article
            }
        })

        return slots
    }

    function search(reparto, text) {
        const q = String(text || "").trim().toLowerCase()
        const source = reparto == null ? getAll() : getByReparto(reparto)

        if (!q) return source

        return source.filter(article => {
            const haystack = [
                article.nome,
                article.barcode,
                article.categoria,
                article.marca,
                article.fornitore,
                article.tipoProdotto,
                article.tipo
            ].join(" ").toLowerCase()

            return haystack.includes(q)
        })
    }

    function findBarcode(barcode) {
        return barcodeIndex.get(String(barcode || "").trim()) || null
    }

    async function saveArticle(article) {
        const saved = await DB.saveArticle(normalize(article))
        await refresh()
        return getById(saved._id)
    }

    async function saveReparti(reparti) {
        config = await DB.saveConfig({ reparti: reparti })
        return getReparti()
    }

    async function saveCasse(casse) {
        config = await DB.saveConfig({ casse: casse })
        return (config.casse || []).slice()
    }

    function getCasse() {
        return (config && config.casse || []).slice()
    }

    return {
        init,
        refresh,
        getReparti,
        getReparto,
        getAll,
        getById,
        getByReparto,
        getButtonSlots,
        search,
        findBarcode,
        saveArticle,
        saveReparti,
        saveCasse,
        getCasse
    }
})()
