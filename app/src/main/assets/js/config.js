
if (true) {

    var Config = Config || {};

    Config.version = "2.5";
    Config.couchdbBaseUrl = "https://db.solopro.it:6518";
    Config.accountServerUrl = "http://trbl.it:7811";
    Config.accountTimeoutMs = 2000;
    Config.paperWidthMm = 80;
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
        Config.intestazione.riga5 = "";
        Config.intestazione.userScade="250aa4c6210a214913c283e65f00489f";
        //Config.intestazione.userScade="6bfb8a18f91c8357615e4c7cd800c9ea"; //RENATO

    }


    Config.seedDemo = {
        listino: [

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

    ],
        reparti: ["", "PIEGA", "TAGLIO", "COLORE", "MECHES", "TRATTAMENTI", "UOMO", "ALTRO", "PRODOTTI"]
    }

    Config.seedBio = {
        reparti: ["", "TUTTI", "BIONAIF KIT", "BIONAIF PLANTARI", "GOODLOOK", "PEDISALUS", "MY MOBILITAS", "ZEN", "VARIE"],
        listino: [
        { codice: "975071085", barcode: "8055519880010", prodotto: "KIT EQUILIBRIO BIONAIF: BG N°43-48 / KG 96-105 + RG N°43-48", prezzo: 99, iva: 22, tipo: "P", reparto: 2, posizione: 1, categoria: "BIONAIF KIT", marca: "BIONAIF" },
        { codice: "975071073", barcode: "8055519880027", prodotto: "KIT EQUILIBRIO BIONAIF: BM N°39-42 / KG 71-80 + RM N°39-42", prezzo: 99, iva: 22, tipo: "P", reparto: 2, posizione: 2, categoria: "BIONAIF KIT", marca: "BIONAIF" },
        { codice: "975071061", barcode: "8055519880034", prodotto: "KIT EQUILIBRIO BIONAIF: BP N°34-38 / KG 53-58 + RP N°34-38", prezzo: 99, iva: 22, tipo: "P", reparto: 2, posizione: 3, categoria: "BIONAIF KIT", marca: "BIONAIF" },
        { codice: "975071123", barcode: "8055519880041", prodotto: "KIT EQUILIBRIO BIONAIF: NG N°43-48 / KG >105 + RG N°43-48", prezzo: 99, iva: 22, tipo: "P", reparto: 2, posizione: 4, categoria: "BIONAIF KIT", marca: "BIONAIF" },
        { codice: "975071111", barcode: "8055519880058", prodotto: "KIT EQUILIBRIO BIONAIF: NM N°39-42 / KG >80 + RM N°39-42", prezzo: 99, iva: 22, tipo: "P", reparto: 2, posizione: 5, categoria: "BIONAIF KIT", marca: "BIONAIF" },
        { codice: "975071097", barcode: "8055519880065", prodotto: "KIT EQUILIBRIO BIONAIF: NP N°34-38 / KG >58 + RP N°34-38", prezzo: 99, iva: 22, tipo: "P", reparto: 2, posizione: 6, categoria: "BIONAIF KIT", marca: "BIONAIF" },
        { codice: "975071059", barcode: "8055519880072", prodotto: "KIT EQUILIBRIO BIONAIF: VG N°43-48 / KG", prezzo: 99, iva: 22, tipo: "P", reparto: 2, posizione: 7, categoria: "BIONAIF KIT", marca: "BIONAIF" },
        { codice: "975071046", barcode: "8055519880089", prodotto: "KIT EQUILIBRIO BIONAIF: VM N°39-42 / KG", prezzo: 99, iva: 22, tipo: "P", reparto: 2, posizione: 8, categoria: "BIONAIF KIT", marca: "BIONAIF" },
        { codice: "975071022", barcode: "8055519880096", prodotto: "KIT EQUILIBRIO BIONAIF: VP N°34-38 / KG", prezzo: 99, iva: 22, tipo: "P", reparto: 2, posizione: 9, categoria: "BIONAIF KIT", marca: "BIONAIF" },
        { codice: "913176234", barcode: "8055519880102", prodotto: "PLANTARE ATTIVO BIONAIF BG. KG 96-105 - N°43-48 - BLU GRANDE", prezzo: 59, iva: 22, tipo: "P", reparto: 3, posizione: 1, categoria: "BIONAIF PLANTARI", marca: "BIONAIF" },
        { codice: "913176222", barcode: "8055519880119", prodotto: "PLANTARE ATTIVO BIONAIF BM. KG 71-80 - N°39-42 - BLU MEDIO", prezzo: 59, iva: 22, tipo: "P", reparto: 3, posizione: 2, categoria: "BIONAIF PLANTARI", marca: "BIONAIF" },
        { codice: "913176210", barcode: "8055519880126", prodotto: "PLANTARE ATTIVO BIONAIF BP. KG 53-58 - N°34-38 - BLU PICCOLO", prezzo: 59, iva: 22, tipo: "P", reparto: 3, posizione: 3, categoria: "BIONAIF PLANTARI", marca: "BIONAIF" },
        { codice: "926642669", barcode: "8055519880195", prodotto: "PLANTARE ATTIVO BIONAIF BS. KG 26-30 - N°29-33 - BLU SMALL", prezzo: 59, iva: 22, tipo: "P", reparto: 3, posizione: 4, categoria: "BIONAIF PLANTARI", marca: "BIONAIF" },
        { codice: "913176208", barcode: "8055519880133", prodotto: "PLANTARE ATTIVO BIONAIF NG. KG >105 - N°43-48 - NEUTRO GRANDE", prezzo: 59, iva: 22, tipo: "P", reparto: 3, posizione: 5, categoria: "BIONAIF PLANTARI", marca: "BIONAIF" },
        { codice: "913176196", barcode: "8055519880140", prodotto: "PLANTARE ATTIVO BIONAIF NM. KG >80 - N°39-42 - NEUTRO MEDIO", prezzo: 59, iva: 22, tipo: "P", reparto: 3, posizione: 6, categoria: "BIONAIF PLANTARI", marca: "BIONAIF" },
        { codice: "913176184", barcode: "8055519880157", prodotto: "PLANTARE ATTIVO BIONAIF NP. KG >58 - N°34-38 - NEUTRO PICCOLO", prezzo: 59, iva: 22, tipo: "P", reparto: 3, posizione: 7, categoria: "BIONAIF PLANTARI", marca: "BIONAIF" },
        { codice: "926642671", barcode: "8055519880201", prodotto: "PLANTARE ATTIVO BIONAIF NS. KG >30 - N°29-33 - NEUTRO SMALL", prezzo: 59, iva: 22, tipo: "P", reparto: 3, posizione: 8, categoria: "BIONAIF PLANTARI", marca: "BIONAIF" },
        { codice: "913176261", barcode: "8055519880225", prodotto: "PLANTARE ATTIVO BIONAIF VG. KG", prezzo: 59, iva: 22, tipo: "P", reparto: 3, posizione: 9, categoria: "BIONAIF PLANTARI", marca: "BIONAIF" },
        { codice: "913176172", barcode: "8055519880232", prodotto: "PLANTARE ATTIVO BIONAIF VM. KG", prezzo: 59, iva: 22, tipo: "P", reparto: 3, posizione: 10, categoria: "BIONAIF PLANTARI", marca: "BIONAIF" },
        { codice: "913176246", barcode: "8055519880249", prodotto: "PLANTARE ATTIVO BIONAIF VP. KG", prezzo: 59, iva: 22, tipo: "P", reparto: 3, posizione: 11, categoria: "BIONAIF PLANTARI", marca: "BIONAIF" },
        { codice: "926642683", barcode: "8055519880218", prodotto: "PLANTARE ATTIVO BIONAIF VS. KG", prezzo: 59, iva: 22, tipo: "P", reparto: 3, posizione: 12, categoria: "BIONAIF PLANTARI", marca: "BIONAIF" },
        { codice: "974989042", barcode: "8055519880188", prodotto: "PLANTARE ATTIVO BIONAIF RG. N°43-48 - RELAX GRANDE", prezzo: 59, iva: 22, tipo: "P", reparto: 3, posizione: 13, categoria: "BIONAIF PLANTARI", marca: "BIONAIF" },
        { codice: "974989030", barcode: "8055519880171", prodotto: "PLANTARE ATTIVO BIONAIF RM. N°39-42 - RELAX MEDIO", prezzo: 59, iva: 22, tipo: "P", reparto: 3, posizione: 14, categoria: "BIONAIF PLANTARI", marca: "BIONAIF" },
        { codice: "974989028", barcode: "8055519880164", prodotto: "PLANTARE ATTIVO BIONAIF RP. N°34-38 - RELAX PICCOLO", prezzo: 59, iva: 22, tipo: "P", reparto: 3, posizione: 15, categoria: "BIONAIF PLANTARI", marca: "BIONAIF" },
        { codice: "971992336", barcode: "8055519880287", prodotto: "OCCHIALE GOODLOOK MOD. CRONO", prezzo: 45, iva: 22, tipo: "P", reparto: 4, posizione: 1, categoria: "GOODLOOK", marca: "GOODLOOK" },
        { codice: "971992348", barcode: "8055519880294", prodotto: "OCCHIALE GOODLOOK MOD. GEA", prezzo: 45, iva: 22, tipo: "P", reparto: 4, posizione: 2, categoria: "GOODLOOK", marca: "GOODLOOK" },
        { codice: "971091210", barcode: "8055519880300", prodotto: "OCCHIALE GOODLOOK MOD. GIOVE", prezzo: 45, iva: 22, tipo: "P", reparto: 4, posizione: 3, categoria: "GOODLOOK", marca: "GOODLOOK" },
        { codice: "972260309", barcode: "8055519880317", prodotto: "OCCHIALE GOODLOOK MOD. LUNA COLORATO", prezzo: 45, iva: 22, tipo: "P", reparto: 4, posizione: 4, categoria: "GOODLOOK", marca: "GOODLOOK" },
        { codice: "921689360", barcode: "8055519880324", prodotto: "OCCHIALE GOODLOOK MOD. MERCURIO", prezzo: 45, iva: 22, tipo: "P", reparto: 4, posizione: 5, categoria: "GOODLOOK", marca: "GOODLOOK" },
        { codice: "971091222", barcode: "8055519880331", prodotto: "OCCHIALE GOODLOOK MOD. SOLE NERO", prezzo: 45, iva: 22, tipo: "P", reparto: 4, posizione: 6, categoria: "GOODLOOK", marca: "GOODLOOK" },
        { codice: "971223603", barcode: "8055519880256", prodotto: "PEDISALUS CREMA PIEDI 75 ML", prezzo: 20, iva: 22, tipo: "P", reparto: 5, posizione: 1, categoria: "PEDISALUS", marca: "PEDISALUS" },
        { codice: "PEDI+PIETRA", barcode: "8055519883455", prodotto: "KIT PEDISALUS 75 ML + PIETRA ESFOLIANTE", prezzo: 20, iva: 22, tipo: "P", reparto: 5, posizione: 2, categoria: "PEDISALUS", marca: "PEDISALUS" },
        { codice: "927288706", barcode: "9120011541840", prodotto: "GEL 125 ML - MY MOBILITAS", prezzo: 15, iva: 22, tipo: "P", reparto: 6, posizione: 1, categoria: "MY MOBILITAS", marca: "MY MOBILITAS" },
        { codice: "04214000", barcode: "8055519882847", prodotto: "10 ML ZEN MINT SPIRIT OIL 2.0 - DISTILLATO PURO DI MENTA", prezzo: 20, iva: 22, tipo: "P", reparto: 7, posizione: 1, categoria: "ZEN", marca: "ZEN" },
        { codice: "04214001", barcode: "8055519882854", prodotto: "50 ML ZEN MINT SPIRIT OIL 2.0 - DISTILLATO PURO DI MENTA", prezzo: 30, iva: 22, tipo: "P", reparto: 7, posizione: 2, categoria: "ZEN", marca: "ZEN" },
        { codice: "04214002", barcode: "8055519882861", prodotto: "100 ML ZEN MINT SPIRIT OIL 2.0 - DISTILLATO PURO DI MENTA", prezzo: 40, iva: 22, tipo: "P", reparto: 7, posizione: 3, categoria: "ZEN", marca: "ZEN" },
        { codice: "04214100", barcode: "8055519882953", prodotto: "IO ZEN - DIFFUSORE PORTATILE OLI ESSENZIALI AD ULTRASUONI", prezzo: 45, iva: 22, tipo: "P", reparto: 7, posizione: 4, categoria: "ZEN", marca: "ZEN" },
        { codice: "04214000A", barcode: "8055519883363", prodotto: "KIT1 - 2 PZ 10 ML ZEN MINT SPIRIT OIL 2.0", prezzo: 30, iva: 22, tipo: "P", reparto: 7, posizione: 5, categoria: "ZEN", marca: "ZEN" },
        { codice: "04214001A", barcode: "8055519883370", prodotto: "KIT2 - 1 PZ 50 ML ZEN + 1 PZ CREMA CORPO", prezzo: 35, iva: 22, tipo: "P", reparto: 7, posizione: 6, categoria: "ZEN", marca: "ZEN" },
        { codice: "04214001B", barcode: "8055519883387", prodotto: "KIT3 - 1 PZ 50 ML ZEN + 1 PZ OLEOGEL", prezzo: 35, iva: 22, tipo: "P", reparto: 7, posizione: 7, categoria: "ZEN", marca: "ZEN" },
        { codice: "04214002A", barcode: "8055519883394", prodotto: "KIT4 - 1 PZ 100 ML ZEN + 1 PZ 10 ML ZEN", prezzo: 50, iva: 22, tipo: "P", reparto: 7, posizione: 8, categoria: "ZEN", marca: "ZEN" },
        { codice: "04214002B", barcode: "8055519883400", prodotto: "KIT5 - 1 PZ 100 ML ZEN + 1 PZ 10 ML ZEN + 1 PZ CREMA CORPO", prezzo: 55, iva: 22, tipo: "P", reparto: 7, posizione: 9, categoria: "ZEN", marca: "ZEN" },
        { codice: "04214002C", barcode: "8055519883417", prodotto: "KIT6 - 1 PZ 100 ML ZEN + 1 PZ 10 ML ZEN + 1 PZ OLEOGEL", prezzo: 55, iva: 22, tipo: "P", reparto: 7, posizione: 10, categoria: "ZEN", marca: "ZEN" },
        { codice: "04214002D", barcode: "8055519883424", prodotto: "KIT7 - 1 PZ 100 ML ZEN + 1 PZ 10 ML ZEN + 1 PZ CREMA CORPO + 1 PZ DIFFUSORE", prezzo: 90, iva: 22, tipo: "P", reparto: 7, posizione: 11, categoria: "ZEN", marca: "ZEN" },
        { codice: "04214002E", barcode: "8055519883431", prodotto: "KIT8 - 1 PZ 100 ML ZEN + 1 PZ 10 ML ZEN + 1 PZ OLEOGEL + 1 PZ DIFFUSORE", prezzo: 90, iva: 22, tipo: "P", reparto: 7, posizione: 12, categoria: "ZEN", marca: "ZEN" },
        { codice: "04214002F", barcode: "8055519883448", prodotto: "KIT9 - 1 PZ 100 ML ZEN + 2 PZ 10 ML ZEN + 1 PZ DIFFUSORE", prezzo: 90, iva: 22, tipo: "P", reparto: 7, posizione: 13, categoria: "ZEN", marca: "ZEN" },
        { codice: "13214200", barcode: "8055519882977", prodotto: "200 ML ZEN CREMA CORPO NUTRITE' BURRO DI KARITE'", prezzo: 15, iva: 22, tipo: "P", reparto: 7, posizione: 14, categoria: "ZEN", marca: "ZEN" }
        ]
    }

    // Setup provvisorio: sui database nuovi il seed attivo è BIO.
    // Il seed DEMO resta disponibile in Config.seedDemo.
    Config.listino = Config.seedBio.listino
    Config.reparti = Config.seedBio.reparti;

}