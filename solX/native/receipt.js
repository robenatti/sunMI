// Copyright AltraConsulenza Snc
// inizio driver SUNMI - collegamento diretto con Kotlin/WebView
// Interfaccia pubblica Receipt: invariata rispetto alla SolX storica.
var SolXSunmiPrinter = (function () {
    "use strict";

    var callbacks = {};
    var sequence = 0;
    var previousResponse = (typeof window.onNativeResponse === "function") ? window.onNativeResponse : null;

    window.onNativeResponse = function (response) {
        var result;
        try {
            result = (typeof response === "string") ? JSON.parse(response) : response;
        } catch (e) {
            if (previousResponse) previousResponse(response);
            return;
        }
        var pending = result && callbacks[result.id];
        if (!pending) {
            if (previousResponse) previousResponse(response);
            return;
        }
        delete callbacks[result.id];
        clearTimeout(pending.timer);
        if (result.success) pending.resolve(result.data);
        else pending.reject(result.error || {message: "Errore stampa SUNMI"});
    };

    function nativeExec(action, payload) {
        if (typeof Bridge !== "undefined" && Bridge && typeof Bridge.exec === "function")
            return Bridge.exec(action, payload, 60000);

        return new Promise(function (resolve, reject) {
            if (!window.Android || typeof Android.exec !== "function") {
                reject(new Error("Bridge Kotlin non disponibile"));
                return;
            }
            var id = "solx-receipt-" + Date.now() + "-" + (++sequence);
            var timer = setTimeout(function () {
                delete callbacks[id];
                reject(new Error("Timeout comunicazione stampante SUNMI"));
            }, 60000);

            callbacks[id] = {resolve: resolve, reject: reject, timer: timer};
            try {
                Android.exec(JSON.stringify({id: id, action: action, payload: payload}));
            } catch (e) {
                clearTimeout(timer);
                delete callbacks[id];
                reject(e);
            }
        });
    }

    function paperWidth() {
        var c = (typeof Config !== "undefined" && Config) || {};
        var requested = Number(c.sunmiPaperWidthMm || c.paperWidthMm || c.scadePaperWidthMm || 0);
        if (requested === 58 || requested === 80) return requested;
        // SolX usa colonneRiga anche per le stampanti termiche legacy.
        var columns = Number(c.colonneRiga || 0);
        return columns >= 43 ? 80 : 58;
    }

    function printLines(lines) {
        if (!Array.isArray(lines) || !lines.length)
            return Promise.reject(new Error("Nessuna riga da stampare"));
        return nativeExec("print", {lines: lines, paperWidthMm: paperWidth()});
    }

    function parseLegacyStream(stream) {
        var out = [];
        String(stream || "").replace(/\r\n/g, "\n").split("\n").forEach(function (raw, i, all) {
            if (i === all.length - 1 && raw === "") return;
            var match = /^([A-Z])-([\s\S]*)$/.exec(raw);
            if (match) {
                var code = match[1];
                var value = match[2];
                var n = Math.max(0, parseInt(value, 10) || 0);

                if (code === "F") { if(n) out.push({newline: Math.min(n, 40)}); return; }
                // La stampante SUNMI integrata non ha taglierina: si avanza la carta.
                if (code === "Z") { out.push({newline: Math.max(3, Math.min(n, 10))}); return; }
                if (code === "6") { if(value) out.push({qrcode: value}); return; }
                if (code === "P" || code === "J" || code === "K" ||
                    code === "X" || code === "Y") return;
                if (code === "T") { out.push({text: value, align: "center", bold: true}); return; }
                if (code === "G") { out.push({text: value, bold: true}); return; }
                if (code === "C") { out.push({text: value, align: "center"}); return; }
                if (code === "D") { out.push({text: value, align: "center"}); return; }
                if (code === "R" || code === "H") { out.push({text: value}); return; }
            }
            if (raw === "") out.push({newline: 1});
            else out.push({text: raw});
        });
        return out;
    }

    return {
        printLines: printLines,
        printStream: function (stream) { return printLines(parseLegacyStream(stream)); }
    };
}());
// fine driver SUNMI

// Copyright AltraConsulenza Snc
// Generated on: 2026-04-20 (Europe/Rome)
// inizio file Receipt.js


// ============================================================================
// SCADE
// ============================================================================

var Receipt = (function () {

    var fName = "receipt.txt";
    var messaggioErrore = "Errore sulla stampa fiscale.";

    var ricevuta = {};
    var stream = "";
    var lastNativeLines = null;
    var afterCallBack = null;
    var CallBackParam = 0;
    var colonneRiga = Config.colonneRiga || 47;


    // ===============================
    // RENDER RECEIPT ITALIA
    // ===============================

    var renderReceipt = function(r){
        
        var out = [];

        if(Config.intestazione.logo)
            out.push({ text: "", logo: true });

        if(Config.intestazione.riga1)
            out.push({ text: Config.intestazione.riga1, align: "center", bold: true });

        if(Config.intestazione.riga2)
            out.push({ text: Config.intestazione.riga2, align: "center" });

        if(Config.intestazione.riga3)
            out.push({ text: Config.intestazione.riga3, align: "center" });

        if(Config.intestazione.riga4)
            out.push({ text: Config.intestazione.riga4, align: "center" });

        if(Config.intestazione.riga5)
            out.push({ text: Config.intestazione.riga5, align: "center" });

        out.push({ separator: true });

        out.push({ text: "DOCUMENTO COMMERCIALE", align: "center", bold: true });
        out.push({ text: "di vendita o prestazione", align: "center" });

        out.push({ newline: 1 });

        out.push({
            columns: ["DESCRIZIONE", "IVA", "PREZZO EUR"],
            bold: true
        });

        for(var i = 0; i < r.righe.length; i++){

            var row = r.righe[i];
            var iva = row.iva || Config.ivaS || "22%";

            out.push({
                columns: [row.nome, iva, formattaImporto(row.prezzo)]
            });

            // RESIDUO ABBONAMENTO / CREDITO
            if(row.tipo === "T" && row.prezzo < 0){

                var servizioB = row.serviziob || "";
                var quantiT = row.quantit || "";

                if(servizioB === "Tutti")
                    servizioB = "Credito";

                if(quantiT.toString().indexOf(",") > 0)
                    quantiT = "EURO " + quantiT.toString().substr(1);

                if(servizioB === "BuonoT"){

                    servizioB = "Buono";

                    var nome = row.nome || "";
                    var inizio = nome.toLowerCase().indexOf("utilizzo buono");

                    if(inizio > -1)
                        inizio = inizio + 14;
                    else
                        inizio = 0;

                    quantiT = nome.substr(inizio).trim();
                }

                if(quantiT !== "")
                    out.push({ text: "Residuo: " + quantiT.toString() });
            }
        }

        out.push({ separator: true });

        out.push({
            columns: ["TOTALE COMPLESSIVO EUR", formattaImporto(r.totale)],
            bold: true
        });

        var iva = Config.ivaP || 0.22;
        var ivaTot = formattaImporto(r.totale * iva / (1 + iva));

        out.push({
            columns: ["di cui IVA", ivaTot],
            bold: true
        });

        out.push({ newline: 1 });


        // ===============================
        // PAGAMENTO
        // ===============================

        var tipo = (r.mp === "CC" || r.mp === "B" || r.mp === "SP") ? "PAGAMENTO ELETTRONICO" : "PAGAMENTO CONTANTE";

        out.push({
            columns: [tipo, formattaImporto(r.totale)]
        });

        out.push({
            columns: ["IMPORTO PAGATO EUR", formattaImporto(r.totale)]
        });

        out.push({ newline: 1 });

        out.push({
            text: r.data + " " + r.ora,
            align: "center"
        });

        out.push({ newline: 1 });


        // ===============================
        // DATI FISCALI
        // ===============================

        if(r.fiscal){

            if(r.fiscal.numero)
                out.push({ text: "DOCUMENTO N. " + r.fiscal.numero, align: "center" });

            if(r.fiscal.firma)
                out.push({ text: "FIRMA: " + r.fiscal.firma, align: "center" });

            out.push({ text: "Documento Commerciale Online", align: "center" });

            if(r.fiscal.link){

                out.push({ newline: 1 });
                out.push({ qrcode: r.fiscal.link });
            }
        }

        out.push({ newline: 1 });

        out.push({
            text: "ARRIVEDERCI E GRAZIE",
            align: "center",
            bold: true
        });

        out.push({ cut: 5 });

        return out;
    };


    // ===============================
    // FISCALIZZAZIONE ITALIA
    // ===============================

    var fiscalizeIT = function(receipt){

        Dialoga("Fiscalizzazione ricevuta", 0, 18000);

        var idc = Config.intestazione.userScade || "250aa4c6210a214913c283e65f00489f";
        var url = "http://trbl.it:7811/scAdE";

        var payload = {
            id: receipt._id,
            totale: receipt.totale,
            mp: receipt.mp === "CC" ? "POS" : "CONTANTI",
            righe: receipt.righe,
            sconto: receipt.totSconto
        };

        var paramS = "idc=" + idc + "&receipt=" + encodeURIComponent(JSON.stringify(payload));

        return fetch(url + "?" + paramS)
            .then(function(res){

                return res.json();

            })
            .then(function(json){

                var fisc = (json && json.return && json.return.fiscAL) ? json.return.fiscAL : {};

                if(!fisc.documento_numero){

                    throw {
                        type: "FISCAL_ERROR",
                        message: "Servizio di fiscalizzazione non disponibile, riprovare"
                    };
                }

                Dialoga("Fiscalizzazione OK");

                return {
                    numero: fisc.documento_numero || "",
                    firma: fisc.firma || "",
                    link: fisc.link || "",
                    data: fisc.data || "",
                    ora: fisc.ora || ""
                };

            })
            .catch(function(err){

                alertE(171, err);

                return {
                    ...err,
                    error: true,
                    numero: "SERVIZIO NON DISPONIBILE",
                    firma: "",
                    link: ""
                };
            });
    };


    // ===============================
    // CREA STREAM
    // ===============================

    var creaStream = function(lines){

        lastNativeLines = lines;

        var strCopy = function(s){

            stream += s + "\n";
        };

        var directFeed = function(n){

            if(n > 0)
                stream += "F-" + n + "\n";
        };

        var directCut = function(n){

            if(n <= 0)
                return;

            stream += "Z-" + n.toString() + "\n";
        };

        var directQR = function(s){

            if(!s)
                return;

            stream += "6-" + s + "\n";
        };

        var directLOGO = function(n){

            stream += "P-" + n + "\n";
        };

        var separator = function(){

            stream += "C-" + "-".repeat(colonneRiga) + "\n";
        };

        var formatColumns = function(cols){

            if(cols.length === 3){

                var ivaL = 5;
                var prezzoL = 11;
                var descrizioneL = colonneRiga - ivaL - prezzoL;

                var a = (cols[0] || "").padEnd(descrizioneL, " ").substring(0, descrizioneL);
                var b = (cols[1] || "").padStart(ivaL, " ").substring(0, ivaL);
                var c = (cols[2] || "").padStart(prezzoL, " ").substring(0, prezzoL);

                return a + b + c;
            }

            if(cols.length === 2){

                var valoreL = 16;
                var descrizioneL = colonneRiga - valoreL;

                var a = (cols[0] || "").padEnd(descrizioneL, " ").substring(0, descrizioneL);
                var b = (cols[1] || "").padStart(valoreL, " ").substring(0, valoreL);

                return a + b;
            }

            return cols.join(" ");
        };

        stream = "";

        for(var i = 0; i < lines.length; i++){

            var line = lines[i];

            if(line.logo){

                directLOGO(line.logo);
                continue;
            }

            if(line.qrcode){

                directQR(line.qrcode);
                continue;
            }

            if(line.separator){

                separator();
                continue;
            }

            if(line.newline){

                directFeed(line.newline);
                continue;
            }

            if(line.cut){

                directCut(line.cut);
                continue;
            }

            if(line.columns){

                strCopy(formatColumns(line.columns));
                continue;
            }

            if(line.text){

                var prefix = "";

                if(line.bold && line.align === "center")
                    prefix = "T-";
                else if(line.bold)
                    prefix = "G-";
                else if(line.align === "center")
                    prefix = "C-";

                strCopy(prefix + line.text);
            }
        }
    };


    // ===============================
    // STAMPA EXE SCADE
    // ===============================

    var printReceiptEX = function(valida){

        var lines = lastNativeLines;
        lastNativeLines = null;

        return (lines ? SolXSunmiPrinter.printLines(lines) : SolXSunmiPrinter.printStream(stream))
            .then(function(){
                if(afterCallBack)
                    afterCallBack(!!valida, 0);
                else
                    Dialoga("Stampa inviata alla stampante SUNMI");
            })
            .catch(function(err){
                alertE(279, err);
                if(afterCallBack)
                    afterCallBack(false, -1);
            });
    };

    // Stampa di prova: non genera alcun documento fiscale.
    var testPrint = function(){
        return SolXSunmiPrinter.printLines([
            {text: "SOLX - TEST SUNMI", align: "center", bold: true},
            {separator: true},
            {text: new Date().toLocaleString("it-IT"), align: "center"},
            {text: "Stampa di prova non fiscale", align: "center"},
            {newline: 5}
        ]);
    };



    // ===============================
    // PRINT RECEIPT
    // ===============================

    var printReceipt = function(pRice){

        if(!pRice)
            return false;

        ricevuta = pRice;

        var mp = ricevuta.mp || "";

        // comportamento storico: ricevuta non fiscale / cortesia
        if(mp === "INS" && Config.cortPrinterModel && Receipt.printCortesia)
            return Receipt.printCortesia(pRice);

        var pAfterCallBack = function(esito, codice){

            if(esito){

                try {

                    Fiche.FiscalizzaRicevuta(ricevuta.fiscal);

                } catch(e){

                    alertE(317, e);
                }

            } else {

                try {

                    Fiche.ErroreStampaRicevuta();

                } catch(e){

                    alertE(322, e);
                }
            }

            resetDisplay();
        };

        afterCallBack = pAfterCallBack;
        CallBackParam = 0;

        if(ricevuta.fiscal && ricevuta.fiscal.numero){


            try{
                var lines = renderReceipt(ricevuta);
            }catch(e){
                alertE(486,e)
            }
            

            try{
                creaStream(lines);
            }catch(e){
                alertE(493,e)
            }

            try{
                printReceiptEX(true);
            }catch(e){
                alertE(499,e)
            }

            
            

            return;
        }

        fiscalizeIT(ricevuta)
            .then(function(fiscal){

                ricevuta.fiscal = fiscal;

                var lines = renderReceipt(ricevuta);

                creaStream(lines);
                printReceiptEX(!fiscal.error);

            })
            .catch(function(err){

                if(afterCallBack)
                    afterCallBack(false, 0);
            });
    };


    // ===============================
    // RENDER CLOSE DAY
    // ===============================

    var renderCloseDay = function(r){

        var out = [];

        if(Config.intestazione.logo)
            out.push({ text: "", logo: true });

        if(Config.intestazione.riga1)
            out.push({ text: Config.intestazione.riga1, align: "center", bold: true });

        if(Config.intestazione.riga2)
            out.push({ text: Config.intestazione.riga2, align: "center" });

        if(Config.intestazione.riga3)
            out.push({ text: Config.intestazione.riga3, align: "center" });

        if(Config.intestazione.riga4)
            out.push({ text: Config.intestazione.riga4, align: "center" });

        if(Config.intestazione.riga5)
            out.push({ text: Config.intestazione.riga5, align: "center" });

        out.push({ separator: true });

        out.push({
            text: "CHIUSURA GIORNALIERA",
            align: "center",
            bold: true
        });

        out.push({
            text: r.dataCLO || r.data,
            align: "center",
            bold: true
        });

        out.push({ newline: 2 });

        out.push({
            text: "RIEPILOGO INCASSI",
            align: "center"
        });

        out.push({ newline: 1 });

        out.push({
            columns: ["DESCRIZIONE", "", "IMPORTO"],
            bold: true
        });

        out.push({
            columns: ["Incasso per SERVIZI", formattaImporto(r.totServizi)]
        });

        out.push({
            columns: ["Incasso per PRODOTTI", formattaImporto(r.totProdotti)]
        });

        out.push({ separator: true });

        out.push({
            columns: ["Totale Giornata EUR", formattaImporto(r.totaleGEN)],
            bold: true
        });

        var iva = Config.ivaP || 0.22;
        var ivaTot = formattaImporto(r.totaleGEN * iva / (1 + iva));

        out.push({
            columns: ["di cui IVA", ivaTot],
            bold: true
        });

        out.push({
            columns: ["Numero Scontrini Emessi", formattaNumero(r.numeroRIC)]
        });

        out.push({ newline: 2 });

        out.push({
            text: "RIEPILOGO PAGAMENTI",
            align: "center"
        });

        out.push({ newline: 1 });

        out.push({
            columns: ["TIPO PAGAMENTO", "", "IMPORTO"],
            bold: true
        });

        if(r.postotaleCC){

            out.push({
                columns: ["Elettronico " + (Config.primoPOSNome || "Pos A"), formattaImporto(r.postotaleCC)],
                bold: true
            });
        }

        if(r.postotaleB){

            out.push({
                columns: ["Elettronico " + (Config.secondoPOSNome || "Pos B"), formattaImporto(r.postotaleB)],
                bold: true
            });
        }

        if(r.totaleSP){

            out.push({
                columns: ["Elettronico Satispay", formattaImporto(r.totaleSP)],
                bold: true
            });
        }

        if(r.elettronico)
            out.push({ separator: true });

        out.push({
            columns: ["Totale Pagamento ELETTRONICO", formattaImporto(r.elettronico)],
            bold: true
        });

        out.push({
            columns: ["Totale Pagamento CONTANTI", formattaImporto(r.totaleCON)],
            bold: true
        });

        if(r.altro){

            out.push({
                columns: ["Totale ALTRI PAGAMENTI", formattaImporto(r.altro)],
                bold: true
            });
        }

        out.push({ newline: 2 });

        out.push({
            text: "Stampa del " + r.data + " " + r.ora,
            align: "center"
        });

        out.push({ cut: 10 });

        return out;
    };


    // ===============================
    // REPORT SCADE
    // ===============================

    var reportScade = function(dataClose){

        afterCallBack = null;

        var lines = renderCloseDay(dataClose);

        creaStream(lines);
        printReceiptEX(true);

        return;
    };


    // ===============================
    // STUB
    // verranno sostituiti dal modulo sotto
    // ===============================

    var printCortesia = function(){};
    var printFiche = function(){};


    return {
        printReceipt: printReceipt,
        printReceiptEX: printReceiptEX,
        testPrint: testPrint,
        printCortesia: printCortesia,
        printFiche: printFiche,
        reportScade: reportScade
    };

}());



// ============================================================================
// MODULO FICHE + CORTESIA
//
// Domani questo blocco può essere tolto dal file e concatenato dopo Receipt.js.
// L'interfaccia del resto del programma non cambia.
// ============================================================================

(function(Receipt){

    var fName = "receipt.txt";

    var ricevuta = {};
    var fiche = {};

    var stream = "";
    var righe = 0;


    // =========================================================================
    // CORTESIA
    // =========================================================================

    var creaStreamCortesia = function(){

        var maxRighe = Config.righeRicevuta || 11;

        var righeIntestazione11 = 0;
        var righeIntestazione12 = 2;
        var righeIntestazione2 = 0;
        var righeNumeroData = Config.righeNumeroData || 1;
        var righeInizio = 1;
        var righeServizi = 3;
        var righeSconto = 1;
        var righeTotale = 1;

        var colonneRiga = Config.colonneRiga || 38;
        var margineRiga = " ";

        var posizionaCut = Config.posizionaCut || 6;
        var aggiustaLunghezza1 = Config.aggiustaLunghezza1 || 80;
        var aggiustaLunghezza2 = Config.aggiustaLunghezza2 || 70;

        var fontGrassetto = "G-";
        var fontGrassettoCentrato = "T-";
        var posCentrato = "C-";
        var fontRighe = "R-";
        var posDataOra = "D-";

        var intestazione = Config.intestazione;


        var strCopy = function(s){

            for(var i = 0; i < s.length; i++)
                stream += s.charAt(i);

            stream += "\n";
        };


        var directFeed = function(n){

            if(n <= 0)
                return;

            var xn = n.toString();
            stream += "F-" + xn + "\n";
        };


        var directStep1 = function(n){

            if(n <= 0)
                return;

            var xn = n.toString();
            stream += "J-" + xn + "\n";
        };


        var directStep2 = function(n){

            if(n <= 0)
                return;
            var xn = n.toString();
            stream += "K-" + xn + "\n";
        };


        var directOffset1 = function(n){

            if(n <= 0)
                return;

            var xn = n.toString();
            stream += "X-" + xn + "\n";
        };


        var directOffset2 = function(n){

            if(n <= 0)
                return;

            var xn = n.toString();
            stream += "Y-" + xn + "\n";
        };


        var directCut = function(n){

            if(n <= 0)
                return;

            var xn = n.toString();
            stream += "Z-" + xn + "\n";
        };


        var directSign = function(){

            var xn = "- - - - - -";
            stream += "H-" + xn + "\n";
        };


        var formattaImportoCortesia = function(pr){

            return pr.toLocaleString('it-IT', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        };


        var formatPrintRow = function(no, pr, inx){

            var mettiIva = false;

            if(!inx || inx === ""){

                inx = fontRighe + margineRiga;
                mettiIva = true;
            }

            var p = formattaImportoCortesia(pr);
            var ml = no.length;
            var sl = inx;
            var dx = ml;

            if(ml > colonneRiga - 9){

                var qj = 0;

                for(; qj < colonneRiga - 14; qj++)
                    sl += no.charAt(qj);

                for(; qj < colonneRiga - 9 && qj < ml && no.charCodeAt(qj) !== 32; qj++)
                    sl += no.charAt(qj);

                if(qj === colonneRiga - 9)
                    sl += "-";

                while(no.charCodeAt(qj) === 32 && qj < ml)
                    qj++;

                sl += "\n";
                righe += 1;
                dx = -1;

                sl += margineRiga;

                for(; qj < ml && dx < colonneRiga - 9; qj++, dx++)
                    sl += no.charAt(qj);

                dx += 1;

            } else {

                sl += no;
            }

            var x = colonneRiga - p.length - dx;
            var y = colonneRiga - 10 - dx;
            var q = 0;

            if(mettiIva){

                for(; q < y; q++)
                    sl += " ";

                sl += "22%";
            }

            for(; q < x; q++)
                sl += " ";

            sl += p;

            return sl;
        };


        stream = "";
        righe = 0;


        // ===============================
        // INTESTAZIONE
        // ===============================

        directOffset1(righeIntestazione11);
        directOffset2(righeIntestazione12);

        strCopy(fontGrassettoCentrato + intestazione.riga1);

        directFeed(righeIntestazione2);

        strCopy(posCentrato + intestazione.riga2);
        strCopy(posCentrato + intestazione.riga3);
        strCopy(posCentrato + intestazione.riga4);


        var mp = ricevuta.mp;

        if(!mp)
            mp = "";


        strCopy(posCentrato + " - - - - - - - - - - - - - - - - - - ");

        strCopy(posCentrato + " DOCUMENTO GESTIONALE ");
        strCopy(posCentrato + " VENDITA O PRESTAZIONE\n");

        strCopy(" DESCRIZIONE " + "             ".substr(0, colonneRiga - 25) + "   IVA PREZZO(E)");


        // ===============================
        // SERVIZI
        // ===============================

        var sommabase = 0;
        var somma = 0;
        var sconto = parseFloat(ricevuta.totSconto);

        for(var k = 0; k < ricevuta.righeL; k++){

            sommabase += ricevuta.righe[k].prezzobase;
            somma += ricevuta.righe[k].prezzo;

            var sl = formatPrintRow("" + ricevuta.righe[k].nome, ricevuta.righe[k].prezzo);

            strCopy(sl);

            righe += 1;
        }


        if(sconto){

            directFeed(righeSconto);

            var pp = formatPrintRow("SCONTO/ACCONTO", ricevuta.totSconto);

            strCopy(pp);

            righe += 2;
            somma -= sconto;
        }


        directFeed(righeTotale);


        var tt = formatPrintRow("TOTALE COMPLESSIVO", somma, fontGrassetto + "  ");

        strCopy(tt);


        tt = formatPrintRow("DI CUI IVA", somma * 0.22 / 1.22, fontGrassetto + "  ");

        strCopy(tt);


        // ===============================
        // NUMERO E DATA
        // ===============================

        directFeed(righeNumeroData);

        strCopy(posCentrato + "Documento del " + ricevuta.data);

        var cliente = (Config.noStampaCliente ? "" : ricevuta.cliente);

        strCopy(posCentrato + ricevuta.cliente);

        directSign();

        directFeed(maxRighe - righe);

        directCut(posizionaCut);

        directStep1(aggiustaLunghezza1);
        directStep2(aggiustaLunghezza2);
    };


    var printCortesia = function(pRice){

        if(!pRice || typeof pRice !== "object")
            return false;

        ricevuta = pRice;
        creaStreamCortesia();

        return SolXSunmiPrinter.printStream(stream)
            .catch(function(err){ alertE(570, err); });
    };



    // =========================================================================
    // FICHE
    // =========================================================================

    var creaStreamFiche = function(){

        var intestazione = Config.intestazione;

        var maxRighe = Config.righeRicevuta || 22;
        var righeIntestazione1 = 2;

        var posizionaCut = 5;

        var aggiustaLunghezza1 = Config.aggiustaLunghezza || 90;
        var aggiustaLunghezza2 = Config.aggiustaLunghezza2 || 10;

        var fontGrassetto = "G-";
        var fontGrassettoCentrato = "T-";
        var posCentrato = "C-";
        var fontRighe = "R-";
        var posDataOra = "D-";


        var strCopy = function(s){

            for(var i = 0; i < s.length; i++)
                stream += s.charAt(i);

            stream += "\n";
        };


        var directFeed = function(n){

            if(n <= 0)
                return;

            var xn = n.toString();
            stream += "F-" + xn + "\n";
        };


        var directStep1 = function(n){

            if(n <= 0)
                return;

            var xn = n.toString();
            stream += "J-" + xn + "\n";
        };


        var directStep2 = function(n){

            if(n <= 0)
                return;

            var xn = n.toString();
            stream += "K-" + xn + "\n";
        };


        var directCut = function(n){

            if(n <= 0)
                return;

            var xn = n.toString();
            stream += "Z-" + xn + "\n";
        };


        var directQR = function(s){

            s = s || "";

            if(!s)
                return "";

            var stR = "6-";

            stR += s.toString();

            return stR;
        };


        stream = "";
        righe = 0;


        // ===============================
        // INTESTAZIONE
        // ===============================

        directFeed(righeIntestazione1);

        strCopy(posCentrato + intestazione.riga1);

        if(Config.ficheStampaAppuntamenti && intestazione.telefono)
            strCopy(posCentrato + "TEL. " + intestazione.telefono);


        // ===============================
        // CLIENTE E DATA
        // ===============================

        if(!Config.ficheStampaAppuntamenti || Config.ficheStampaData)
            strCopy(posCentrato + fiche.data);

        directFeed(1);

        strCopy(fontGrassettoCentrato + fiche.cliente);

        directFeed(1);


        var maxR = 50;
        var tt = fiche.messaggio || "";


        // ===============================
        // MESSAGGIO / BUONO
        // ===============================

        if(tt !== "" && Config.stampaBuono){

            tt += "\n";

            var ttR = tt.split("\n");
            var ttO = "";

            for(var i = 0; i < ttR.length; i++){

                var ttA = ttR[i];
                var j = 0;

                while(ttA.length > 0 && ++j < 100){

                    var yjR = maxR;

                    while(yjR > 35 && ttA.substr(yjR, 1) !== " ")
                        yjR--;

                    var toAdd = ttA.substr(0, yjR) + "\n";

                    strCopy(posCentrato + toAdd.trim() + "\n");

                    ttA = ttA.substr(yjR);
                }
            }

        } else {

            var tt = fiche.abbonamento || "";


            // ===============================
            // ABBONAMENTI
            // ===============================

            if(Config.ficheStampaAbbonamenti && tt !== ""){

                var eti = Config.nomeAbbonamenti || "RESIDUO ABBONAMENTI";

                strCopy(fontGrassettoCentrato + eti);

                directFeed(1);

                strCopy(tt.trim() + "\n");


                tt = fiche.abbonamentoS || "";

                if(tt !== ""){

                    eti = "STORICO MOVIMENTI";

                    strCopy(fontGrassettoCentrato + eti);

                    directFeed(1);

                    strCopy(tt.trim() + "\n");
                }

            } else {


                // ===============================
                // SERVIZI
                // ===============================

                if(Config.ficheStampaServizi){

                    tt = fiche.listino;

                    strCopy(tt + "\n");
                }


                // ===============================
                // COLORE
                // ===============================

                if(Config.ficheStampaColore){

                    var eti = Config.nomeColore || "COLORE";

                    strCopy(fontGrassettoCentrato + eti);

                    directFeed(1);

                    tt = fiche.colore || "";

                    strCopy(tt.trim() + "\n");
                }


                // ===============================
                // CONSIGLI
                // ===============================

                if(Config.ficheStampaConsigli){

                    var eti = Config.nomeConsigli || "CONSIGLI";

                    strCopy(fontGrassettoCentrato + eti);

                    directFeed(1);

                    tt = fiche.consigli || "";

                    strCopy(tt.trim() + "\n");
                }


                // ===============================
                // NOTE
                // ===============================

                if(Config.ficheStampaNote){

                    var eti = Config.nomeNote || "NOTE CASSA";

                    strCopy(fontGrassettoCentrato + eti);

                    directFeed(1);

                    tt = fiche.note || "";

                    strCopy(tt.trim() + "\n");
                }


                // ===============================
                // STORICO
                // ===============================

                if(Config.ficheStampaStorico){

                    strCopy(fontGrassettoCentrato + "STORICO");

                    directFeed(1);

                    tt = fiche.storico || "";

                    strCopy(tt.trim() + "\n");
                }


                // ===============================
                // PRIVACY
                // ===============================

                if(Config.ficheStampaPrivacy){

                    strCopy(fontGrassettoCentrato + Config.schedaPrivacyOggetto || "SCHEDA PRIVACY");

                    directFeed(1);

                    tt = Config.schedaPrivacy || "";

                    strCopy(tt.trim() + "\n");
                }


                // ===============================
                // QR APPUNTAMENTI
                // ===============================

                if(Config.ficheStampaAppuntamenti)
                    if(Config.agendaMemoAppuntamentiQR && fiche.qrapp !== ""){

                        tt = directQR(fiche.qrapp);

                        strCopy(tt + "\n");

                        directFeed(3);
                    }


                // ===============================
                // APPUNTAMENTI
                // ===============================

                if(Config.ficheStampaAppuntamenti){

                    tt = fiche.appuntamenti || "";

                    strCopy(tt.trim() + "\n");
                }
            }
        }


        directFeed(2);

        directCut(posizionaCut);

        // come nel vecchio codice:
        // directStep1(aggiustaLunghezza1);
        // directStep2(aggiustaLunghezza2);
    };


    var printFiche = function(pFiche){

        if(!pFiche || typeof pFiche !== "object")
            return false;

        fiche = pFiche;
        creaStreamFiche();

        return SolXSunmiPrinter.printStream(stream)
            .catch(function(err){ alertE(727, err); });
    };



    // =========================================================================
    // ESTENSIONE DEL RECEIPT PRINCIPALE
    // =========================================================================

    Receipt.printCortesia = printCortesia;
    Receipt.printFiche = printFiche;

}(Receipt));


// fine file Receipt.js

