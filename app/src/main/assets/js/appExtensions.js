const CloseDay = (() => {
    function formatAmount(value) {
        return Number(value || 0).toFixed(2).replace(".", ",");
    }

    function formatDate(value) {
        const text = String(value || "");
        if (/^\d{8}$/.test(text)) {
            return text.substring(6, 8) + "/" + text.substring(4, 6) + "/" + text.substring(0, 4);
        }
        return text;
    }

    function nowDateTime() {
        const now = new Date();
        const d = String(now.getDate()).padStart(2, "0");
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const y = now.getFullYear();
        const h = String(now.getHours()).padStart(2, "0");
        const min = String(now.getMinutes()).padStart(2, "0");
        return {
            data: d + "/" + m + "/" + y,
            ora: h + ":" + min
        };
    }

    function render(summary, giorno) {
        const out = [];
        const intestazione = Config.intestazione || {};
        const stampata = nowDateTime();
        const iva = Number(Config.ivaP || 0.22);
        const ivaTot = Number(summary.totale || 0) * iva / (1 + iva);

        if (intestazione.logo) {
            out.push({ text: "", logo: true });
        }

        ["riga1", "riga2", "riga3", "riga4", "riga5"].forEach((key, index) => {
            if (!intestazione[key]) return;
            out.push({
                text: intestazione[key],
                align: "center",
                bold: index === 0
            });
        });

        out.push({ separator: true });
        out.push({ text: "CHIUSURA GIORNALIERA", align: "center", bold: true });
        out.push({ text: formatDate(giorno), align: "center", bold: true });
        out.push({ newline: 2 });
        out.push({ text: "RIEPILOGO INCASSI", align: "center" });
        out.push({ newline: 1 });
        out.push({ columns: ["DESCRIZIONE", "", "IMPORTO"], bold: true });
        out.push({ columns: ["Incasso per SERVIZI", formatAmount(summary.servizi)] });
        out.push({ columns: ["Incasso per PRODOTTI", formatAmount(summary.prodotti)] });
        out.push({ separator: true });
        out.push({ columns: ["Totale Giornata EUR", formatAmount(summary.totale)], bold: true });
        out.push({ columns: ["di cui IVA", formatAmount(ivaTot)], bold: true });
        out.push({ columns: ["Numero Scontrini Emessi", String(summary.documenti || 0)] });
        out.push({ newline: 2 });
        out.push({ text: "RIEPILOGO PAGAMENTI", align: "center" });
        out.push({ newline: 1 });
        out.push({ columns: ["TIPO PAGAMENTO", "", "IMPORTO"], bold: true });
        out.push({ columns: ["Totale Pagamento ELETTRONICO", formatAmount(summary.pos)], bold: true });
        out.push({ columns: ["Totale Pagamento CONTANTI", formatAmount(summary.contanti)], bold: true });
        out.push({ newline: 2 });
        out.push({ text: "Stampa del " + stampata.data + " " + stampata.ora, align: "center" });
        out.push({ cut: 10 });

        return out;
    }

    async function print(giorno, selectedCasse) {
        const summary = await AppAPI.getDailySummary(giorno, selectedCasse);
        const payload = render(summary, giorno);
        await Bridge.exec("print", payload, 15000);
        return summary;
    }

    return {
        render: render,
        print: print
    };
})();

const baseSearchArticoli = AppAPI.searchArticoli;

AppAPI.searchArticoli = function (reparto, text) {
    return baseSearchArticoli(reparto, text)
        .slice()
        .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "it", { sensitivity: "base" }));
};

AppAPI.printDailyClose = CloseDay.print;

document.addEventListener("click", async event => {
    const button = event.target.closest("#closeDayPrint");
    if (!button) return;

    const dateInput = document.getElementById("summaryDate");
    if (!dateInput || !dateInput.value) return;

    const giorno = dateInput.value.replace(/-/g, "");
    const selectedCasse = Array.from(document.querySelectorAll(".cash-check:checked"))
        .map(input => input.value);

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "STAMPA...";

    try {
        await AppAPI.printDailyClose(giorno, selectedCasse);
    } catch (error) {
        alert("Errore stampa chiusura: " + (error && error.message ? error.message : String(error)));
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
});
