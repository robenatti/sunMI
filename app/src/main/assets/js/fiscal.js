// Copyright AltraConsulenza Snc
// Fiscalizzazione separata dal POS e dalla UI.

const Fiscal = (() => {
    const urlIT = "http://trbl.it:7811/scAdE"

    function getIdc() {
        return Config.intestazione && Config.intestazione.userScade
            ? Config.intestazione.userScade
            : (Config.userScade || "250aa4c6210a214913c283e65f00489f")
    }

    async function prepareIT() {
        const paramS = "action=prepare&idc=" + encodeURIComponent(getIdc())
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 6000)
        let res
        try { res = await fetch(urlIT + "?" + paramS, { signal: controller.signal }) }
        finally { clearTimeout(timer) }
        if (!res.ok) throw new Error("HTTP " + res.status)
        return res.json()
    }

    async function fiscalizeIT(receipt) {
        const payload = {
            _id: receipt._id,
            totale: receipt.totale.toString().replace(".", ","),
            mp: receipt.mp === "CC" ? "POS" : "CONTANTI",
            servizi: receipt.righe
        }

        const paramS =
            "idc=" + encodeURIComponent(getIdc()) +
            "&receipt=" + encodeURIComponent(JSON.stringify(payload))

        const res = await fetch(urlIT + "?" + paramS)
        if (!res.ok) throw new Error("HTTP " + res.status)

        const json = await res.json()
        if (!json || json.result !== "OK")
            throw new Error(json && (json.error || json.return) ? String(json.error || json.return) : "Servizio fiscale non disponibile")

        const fisc = json.return && json.return.fiscAL ? json.return.fiscAL : {}
        if (!fisc.documento_numero)
            throw new Error("Risposta fiscale priva di numero documento")
        const fileName = fisc.fileName || ""
        const contentB64 = json.return && json.return.contentB64 ? json.return.contentB64 : ""

        if (fileName && contentB64) {
            try {
                await Bridge.exec("pdf_save", {
                    fileName: fileName,
                    contentB64: contentB64
                }, 15000)
            } catch (e) {
                console.error("ERRORE SALVATAGGIO PDF", e)
            }
        }

        return {
            numero: fisc.documento_numero,
            firma: fisc.firma || "",
            link: fisc.link || "",
            data: fisc.data || "",
            ora: fisc.ora || "",
            fileName: fileName
        }
    }

    async function annullaIT(dcw) {
        const originale = String(dcw || "").trim()
        if (!originale) throw new Error("Numero DCW mancante")

        const paramS = "idc=" + encodeURIComponent(getIdc()) +
            "&action=annulli&dcw=" + encodeURIComponent(originale)

        const res = await fetch(urlIT + "?" + paramS)
        if (!res.ok) throw new Error("HTTP " + res.status)

        const json = await res.json()
        const esito = json && json.return
        if (!json || json.result !== "OK" || !esito || esito.done !== "OK") {
            const errore = json && (json.error || (esito && esito.errorMessage))
            throw new Error(errore ? String(errore) : "Annullo non confermato dal servizio fiscale")
        }

        if (esito.dcw && esito.dcw !== originale)
            throw new Error("DCW della risposta diverso dal documento richiesto")

        const fisc = esito.fiscAL || {}
        const fileName = fisc.fileName || ""
        const contentB64 = esito.contentB64 || ""

        if (fileName && contentB64) {
            try {
                await Bridge.exec("pdf_save", { fileName, contentB64 }, 15000)
            } catch (e) {
                console.error("ERRORE SALVATAGGIO PDF ANNULLO", e)
            }
        }

        return {
            dcw: originale,
            numero: fisc.documento_numero || "",
            data: fisc.data || "",
            ora: fisc.ora || "",
            fileName: fileName
        }
    }

    return {
        prepareIT,
        fiscalizeIT,
        annullaIT
    }
})()
