// Copyright AltraConsulenza Snc
// inizio file secondoSchermo.js
// Incluso nel bundle POS SolX durante la build. Bridge e' quello del bundle POS.

window.SecondoSchermo = (function () {
    var richiestaRicevuta = false;

    function displayReceipt(ricevuta, finale) {
        richiestaRicevuta = true;

        var config = typeof Config !== "undefined" && Config ? Config : {};
        var intestazione = config.intestazione || {};

        // Il secondo display e' facoltativo e non deve interrompere la vendita.
        return Bridge.exec("display_receipt", {
            ricevuta: ricevuta || { righe: [], totale: 0, lordo: 0 },
            finale: finale === true,
            intestazione: String(intestazione.riga1 || "")
        }, 3000).catch(function () {
            return { available: false };
        });
    }

    function welcome() {
        if (!richiestaRicevuta) {
            displayReceipt({ righe: [], totale: 0, lordo: 0 }, false);
        }
    }

    // Mostra automaticamente il nome del salone anche prima della prima vendita.
    if (document.readyState === "complete") welcome();
    else window.addEventListener("load", welcome, { once: true });

    return {
        displayReceipt: displayReceipt
    };
})();

// fine file secondoSchermo.js