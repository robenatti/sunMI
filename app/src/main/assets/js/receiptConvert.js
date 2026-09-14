// inizio file receiptConvert.js

function renderReceiptIT(r) {
    const out = [];

    if (Config.intestazione.riga1)
        out.push({ text: Config.intestazione.riga1, align: "center", bold: true, double: true });
    if (Config.intestazione.riga2)
        out.push({ text: Config.intestazione.riga2, align: "center" });
    if (Config.intestazione.riga3)
        out.push({ text: Config.intestazione.riga3, align: "center" });
    if (Config.intestazione.riga4)
        out.push({ text: Config.intestazione.riga4, align: "center" });

    out.push({ separator: true });
    out.push({ text: "DOCUMENTO COMMERCIALE", align: "center", bold: true });
    out.push({ text: "di vendita o prestazione", align: "center" });
    out.push({ newline: 1 });
    out.push({ columns: ["DESCRIZIONE", "IVA", "PREZZO (€)"], bold: true });

    r.righe.forEach(row => {
        const iva = row.iva || Config.iva || "22%";
        const quantita = Number(row.quantita || 1);
        const descrizione = quantita > 1 ? quantita + " x " + row.nome : row.nome;
        const totaleRiga = Number(row.prezzo || 0) * quantita;

        out.push({
            columns: [
                descrizione,
                iva,
                totaleRiga.toFixed(2)
            ]
        });
    });

    out.push({ separator: true });
    out.push({ columns: ["TOTALE COMPLESSIVO", r.totale.toFixed(2)], bold: true });

    const ivaTot = (r.totale * 0.22 / 1.22).toFixed(2);
    out.push({ columns: ["di cui IVA", ivaTot], bold: true });
    out.push({ newline: 1 });

    const tipo = r.mp === "CC" ? "PAGAMENTO ELETTRONICO" : "PAGAMENTO CONTANTE";
    out.push({ columns: [tipo, r.totale.toFixed(2)] });
    out.push({ columns: ["IMPORTO PAGATO", r.totale.toFixed(2)] });
    out.push({ newline: 1 });
    out.push({ text: `${r.data} ${r.ora}`, align: "center" });

    if (r.fiscal && r.fiscal.numero) {
        out.push({ text: `DOCUMENTO N. ${r.fiscal.numero}`, align: "center" });
    }

    out.push({ text: "Documento Commerciale Online", align: "center" });
    out.push({ newline: 1 });
    out.push({ text: "ARRIVEDERCI E GRAZIE", align: "center", bold: true });
    out.push({ newline: 5 });

    return out;
}

function renderReceiptAL(r) {
    const out = [];

    if (Config.intestazione.riga1)
        out.push({ text: Config.intestazione.riga1, align: "center", bold: true, double: true });
    if (Config.intestazione.riga2)
        out.push({ text: Config.intestazione.riga2, align: "center" });
    if (Config.intestazione.riga3)
        out.push({ text: Config.intestazione.riga3, align: "center" });
    if (Config.intestazione.riga4)
        out.push({ text: Config.intestazione.riga4, align: "center" });

    out.push({ separator: true });
    out.push({ text: "KUPON TATIMOR", align: "center", bold: true });
    out.push({ newline: 1 });
    out.push({ columns: ["PERSHKRIM", "TVSH", "CMIM"], bold: true });

    r.righe.forEach(row => {
        const iva = row.iva || Config.iva || "20%";
        const quantita = Number(row.quantita || 1);
        const descrizione = quantita > 1 ? quantita + " x " + row.nome : row.nome;
        const totaleRiga = Number(row.prezzo || 0) * quantita;

        out.push({
            columns: [
                descrizione,
                iva,
                totaleRiga.toFixed(2)
            ]
        });
    });

    out.push({ separator: true });
    out.push({ columns: ["TOTALI", r.totale.toFixed(2)], bold: true });

    const ivaTot = (r.totale * 0.20 / 1.20).toFixed(2);
    out.push({ columns: ["TVSH", ivaTot], bold: true });
    out.push({ newline: 1 });

    const tipo = r.mp === "CC" ? "PAGIM ME KARTË" : "PAGIM CASH";
    out.push({ columns: [tipo, r.totale.toFixed(2)] });
    out.push({ columns: ["SHUMA E PAGUAR", r.totale.toFixed(2)] });
    out.push({ newline: 1 });
    out.push({ text: `${r.data} ${r.ora}`, align: "center" });
    out.push({ newline: 1 });

    if (r.fiscal) {
        if (r.fiscal.numero) {
            out.push({ text: `NIVF: ${r.fiscal.numero}`, align: "center" });
        }
        if (r.fiscal.firma) {
            out.push({ text: `NSLF: ${r.fiscal.firma}`, align: "center" });
        }
        out.push({ newline: 1 });
        if (r.fiscal.link) {
            out.push({ qrcode: r.fiscal.link });
        }
    }

    out.push({ newline: 1 });
    out.push({ text: "FALEMINDERIT!", align: "center", bold: true });
    out.push({ newline: 6 });
    out.push({ text: "", align: "center", bold: true });

    return out;
}

// fine file receiptConvert.js
