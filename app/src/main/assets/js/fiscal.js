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
        return res.json()
    }

    async function fiscalizeIT(receipt) {
        const payload = {
            totale: receipt.totale.toString().replace(".", ","),
            mp: receipt.mp === "CC" ? "POS" : "CONTANTI",
            servizi: receipt.righe
        }

        const paramS =
            "idc=" + encodeURIComponent(getIdc()) +
            "&receipt=" + encodeURIComponent(JSON.stringify(payload))

        const res = await fetch(urlIT + "?" + paramS)
        const json = await res.json()
        const fisc = json.return && json.return.fiscAL ? json.return.fiscAL : {}

        return {
            numero: fisc.documento_numero || "Servizio Non Disponibile",
            firma: fisc.firma || "",
            link: fisc.link || "",
            data: fisc.data || "",
            ora: fisc.ora || ""
        }
    }

    return {
        prepareIT,
        fiscalizeIT
    }
})()
