// Copyright AltraConsulenza Snc
// inizio file display.js
// Display cliente: lo stato finale resta visibile per 10 secondi.

(() => {
    const FINALE_MS = 10000;
    const welcome = document.getElementById("welcome");
    const receiptPanel = document.getElementById("receipt");
    const welcomeName = document.getElementById("welcomeName");
    const storeName = document.getElementById("storeName");
    const receiptRows = document.getElementById("receiptRows");
    const total = document.getElementById("total");
    const payment = document.getElementById("payment");
    const money = new Intl.NumberFormat("it-IT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    let finalTimer = null;
    let finalVisible = false;

    function formatMoney(value) {
        return money.format(Number(value || 0)) + " €";
    }

    function showWelcome() {
        finalVisible = false;
        receiptPanel.hidden = true;
        welcome.hidden = false;
    }

    function showRows(rows) {
        receiptRows.replaceChildren();
        rows.forEach(row => {
            const item = document.createElement("div");
            item.className = "receipt-row";

            const name = document.createElement("div");
            name.className = "row-name";
            name.textContent = String(row.nome || "Articolo");

            const qty = Math.max(1, Math.floor(Number(row.quantita || 1)));
            if (qty > 1) {
                const detail = document.createElement("span");
                detail.className = "row-detail";
                detail.textContent = qty + " × " + formatMoney(row.prezzo);
                name.appendChild(detail);
            }

            const price = document.createElement("div");
            price.className = "row-price";
            price.textContent = formatMoney(Number(row.prezzo || 0) * qty);

            item.appendChild(name);
            item.appendChild(price);
            receiptRows.appendChild(item);
        });
        receiptRows.scrollTop = receiptRows.scrollHeight;
    }

    window.displayReceipt = function (data) {
        const payload = data || {};
        const ricevuta = payload.ricevuta || {};
        const rows = Array.isArray(ricevuta.righe) ? ricevuta.righe : [];
        const finale = payload.finale === true;

        const nome = String(payload.intestazione || "").trim() || "AltraCassa";
        welcomeName.textContent = nome;
        storeName.textContent = nome;

        // Il motore POS svuota il carrello subito dopo l'evento finale.
        // Quell'aggiornamento non deve cancellare la ricevuta per 10 secondi.
        if (!finale && finalVisible && rows.length === 0) return;

        if (finalTimer !== null) {
            clearTimeout(finalTimer);
            finalTimer = null;
        }

        if (!finale && rows.length === 0) {
            showWelcome();
            return;
        }

        finalVisible = finale;
        welcome.hidden = true;
        receiptPanel.hidden = false;
        showRows(rows);
        total.textContent = formatMoney(ricevuta.lordo == null ? ricevuta.totale : ricevuta.lordo);

        if (!finale) {
            payment.textContent = "";
        } else if (ricevuta.fiscalStatus === "ERROR" || ricevuta.fiscalStatus === "PENDING") {
            payment.textContent = "IN ATTESA DI FISCALIZZAZIONE";
        } else if (ricevuta.mp === "CC") {
            payment.textContent = "PAGAMENTO ELETTRONICO";
        } else if (ricevuta.mp === "CA") {
            payment.textContent = "PAGAMENTO CONTANTI";
        } else {
            payment.textContent = "";
        }

        if (finale) {
            finalTimer = setTimeout(() => {
                finalTimer = null;
                showWelcome();
            }, FINALE_MS);
        }
    };
})();

// fine file display.js