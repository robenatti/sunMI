
if (true) {

    var Config = Config || {};

    Config.piva = "02881040360";

    Config.dataScadenza = "30/09/2029";

    Config.salone = "solhair-02881040360c"

    Config.secondoPOS = true;
    Config.primoPOSNome = "Nexi"
    //Config.secondoPOSNome="Worldline"
    Config.satisPay = true;
    Config.prIP = "192.168.88.195"

    Config.terminalePOS = {}
    if (0) Config.terminalePOS["B"] = {
        host: "192.168.88.186",
        port: 8080,
        terminalId: "00000000",
        registerId: "00000000"
    }

    Config.terminalePOS["CC"] = {
        file: "c:\\programma\\aa-pos\\pos.ini"
    }

    Config.progressMaxMs = 10000;
    Config.printTimeoutMs = 60000;
    //Config.stampaSoloPreventivi=true;


    if (1) {
        Config.intestazione = Config.intestazione || {}
        Config.intestazione.riga1 = "SOLHAIR DEMO";
        Config.intestazione.riga2 = "AltraConsulenza Snc";
        Config.intestazione.riga3 = "Via Manzoni 8 - Carpi (MO)";
        Config.intestazione.riga4 = "P.Iva 02881040360";
        Config.intestazione.userScade="250aa4c6210a214913c283e65f00489f";
        //Config.intestazione.userScade="6bfb8a18f91c8357615e4c7cd800c9ea"; //RENATO

    }


    Config.listino = [

        // ===== PIEGA =====
        { reparto: 1, posizione: 1, servizio: "Piega Corta", categoria: "PIEGA", prezzo: 1 },
        { reparto: 1, posizione: 2, servizio: "Piega Media", categoria: "PIEGA", prezzo: 2 },
        { reparto: 1, posizione: 3, servizio: "Piega Lunga", categoria: "PIEGA", prezzo: 22 },
        { reparto: 1, posizione: 4, servizio: "Piega Onde", categoria: "PIEGA", prezzo: 20 },
        { reparto: 1, posizione: 5, servizio: "Piega Liscia", categoria: "PIEGA", prezzo: 18 },
        { reparto: 1, posizione: 6, servizio: "Piega Volume", categoria: "PIEGA", prezzo: 20 },

        // ===== TAGLIO =====
        { reparto: 2, posizione: 1, servizio: "Taglio Donna", categoria: "TAGLIO", prezzo: 25 },
        { reparto: 2, posizione: 2, servizio: "Taglio + Piega", categoria: "TAGLIO", prezzo: 35 },
        { reparto: 2, posizione: 3, servizio: "Spuntata", categoria: "TAGLIO", prezzo: 15 },
        { reparto: 2, posizione: 4, servizio: "Taglio Moda", categoria: "TAGLIO", prezzo: 30 },
        { reparto: 2, posizione: 5, servizio: "Taglio Bambina", categoria: "TAGLIO", prezzo: 18 },

        // ===== COLORE =====
        { reparto: 3, posizione: 1, servizio: "Colore Base", categoria: "COLORE", prezzo: 40 },
        { reparto: 3, posizione: 2, servizio: "Colore Senza Ammoniaca", categoria: "COLORE", prezzo: 45 },
        { reparto: 3, posizione: 3, servizio: "Ritocco Ricrescita", categoria: "COLORE", prezzo: 35 },
        { reparto: 3, posizione: 4, servizio: "Tonalizzazione", categoria: "COLORE", prezzo: 25 },
        { reparto: 3, posizione: 5, servizio: "Gloss", categoria: "COLORE", prezzo: 20 },

        // ===== MECHES =====
        { reparto: 4, posizione: 1, servizio: "Meches Corte", categoria: "MECHES", prezzo: 50 },
        { reparto: 4, posizione: 2, servizio: "Meches Medie", categoria: "MECHES", prezzo: 65 },
        { reparto: 4, posizione: 3, servizio: "Meches Lunghe", categoria: "MECHES", prezzo: 80 },
        { reparto: 4, posizione: 4, servizio: "Balayage", categoria: "MECHES", prezzo: 90 },
        { reparto: 4, posizione: 5, servizio: "Shatush", categoria: "MECHES", prezzo: 85 },

        // ===== TRATTAMENTI =====
        { reparto: 5, posizione: 1, servizio: "Maschera Nutriente", categoria: "TRATTAMENTI", prezzo: 10 },
        { reparto: 5, posizione: 2, servizio: "Ricostruzione", categoria: "TRATTAMENTI", prezzo: 30 },
        { reparto: 5, posizione: 3, servizio: "Cheratina", categoria: "TRATTAMENTI", prezzo: 60 },
        { reparto: 5, posizione: 4, servizio: "Botox Capelli", categoria: "TRATTAMENTI", prezzo: 50 },
        { reparto: 5, posizione: 5, servizio: "Trattamento Cute", categoria: "TRATTAMENTI", prezzo: 20 },

        // ===== UOMO =====
        { reparto: 6, posizione: 1, servizio: "Taglio Uomo", categoria: "UOMO", prezzo: 18 },
        { reparto: 6, posizione: 2, servizio: "Taglio + Shampoo", categoria: "UOMO", prezzo: 20 },
        { reparto: 6, posizione: 3, servizio: "Regolazione Barba", categoria: "UOMO", prezzo: 10 },
        { reparto: 6, posizione: 4, servizio: "Rasatura Barba", categoria: "UOMO", prezzo: 15 },
        { reparto: 6, posizione: 5, servizio: "Taglio + Barba", categoria: "UOMO", prezzo: 25 },

        // ===== ALTRO =====
        { reparto: 7, posizione: 1, servizio: "Acconciatura Sera", categoria: "ALTRO", prezzo: 35 },
        { reparto: 7, posizione: 2, servizio: "Acconciatura Sposa", categoria: "ALTRO", prezzo: 120 },
        { reparto: 7, posizione: 3, servizio: "Extension", categoria: "ALTRO", prezzo: 150 },
        { reparto: 7, posizione: 4, servizio: "Permanente", categoria: "ALTRO", prezzo: 70 },
        { reparto: 7, posizione: 5, servizio: "Stiratura", categoria: "ALTRO", prezzo: 80 },

        // ===== PRODOTTI =====
        { reparto: 8, posizione: 1, servizio: "Shampoo", categoria: "PRODOTTI", prezzo: 12 },
        { reparto: 8, posizione: 2, servizio: "Balsamo", categoria: "PRODOTTI", prezzo: 10 },
        { reparto: 8, posizione: 3, servizio: "Maschera", categoria: "PRODOTTI", prezzo: 15 },
        { reparto: 8, posizione: 4, servizio: "Olio Capelli", categoria: "PRODOTTI", prezzo: 18 },
        { reparto: 8, posizione: 5, servizio: "Lacca", categoria: "PRODOTTI", prezzo: 12 }

    ]

    Config.reparti = ["", "PIEGA", "TAGLIO", "COLORE", "MECHES", "TRATTAMENTI", "UOMO", "ALTRO", "PRODOTTI"];
}