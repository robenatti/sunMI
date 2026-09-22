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
        const res = await fetch(urlIT + "?" + paramS)
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

    return {
        prepareIT,
        fiscalizeIT
    }
})()
