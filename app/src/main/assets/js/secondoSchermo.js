// Copyright AltraConsulenza Snc
// inizio file secondoSchermo.js
// Unica primitiva per carrello e ricevuta finale.

const SecondoSchermo = (() => {
    let started = false;

    function displayReceipt(ricevuta, finale = false) {
        const payload = {
            ricevuta: ricevuta || { righe: [], totale: 0, lordo: 0 },
            finale: finale === true,
            intestazione: String((Config.intestazione || {}).riga1 || "")
        };
        // Il secondo display e' opzionale: non puo' bloccare la cassa.
        Bridge.exec("display_receipt", payload, 3000).catch(() => {});
    }

    function init() {
        if (started) return;
        started = true;

        POS.on("change", state => {
            displayReceipt({ righe: state.items, totale: state.total, lordo: state.lordo });
        });
        POS.on("payment:end", detail => {
            if (detail.receipt) displayReceipt(detail.receipt, true);
        });

        displayReceipt({ righe: [], totale: 0, lordo: 0 });
    }

    return { init, displayReceipt };
})();

// fine file secondoSchermo.js