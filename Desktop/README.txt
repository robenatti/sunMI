SUNMI / SOLX POS -- BUILDER NW.JS WINDOWS
======================================

Layout coerente con CTUSuite: cartella package.nw, nessuno ZIP dell'app
all'avvio, nessun EXE concatenato, runtime NW.js nella cartella dist.

Prerequisiti: Windows x64, PowerShell 5.1+, Git nel PATH, connessione
Internet per il primo download. Non occorre Node/npm: PouchDB e nel repo.

Esecuzione (PowerShell, dalla cartella Desktop):
    powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1

Runtime NW.js predefinito: 0.116.0, Windows x64.
Se hai gia il runtime CTUSuite estratto con nw.exe:
    powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1 -RuntimeDirectory "C:\percorso\nwjs-v0.116.0-win-x64"

Il builder scarica SEMPRE il ramo main di robenatti/sunMI, copia soltanto
app/src/main/assets in dist/package.nw, aggiunge package.json e un
adapter NW.js esterno agli script originari. Mantiene la cache del runtime
sotto .cache e ricrea .build e dist a ogni esecuzione.

Output:
    Desktop\dist\SolXPOS.exe
    Desktop\dist\package.nw\index.html
    Desktop\dist\package.nw\package.json
    Desktop\dist\package.nw\platform\nw-bridge.js
    Desktop\dist\package.nw\js\, css\, views\, ecc.
    Desktop\dist\(tutte le DLL e risorse del runtime NW.js)

DeviceID:
- Per un PC nuovo prova a leggere UUID firmware Windows; altrimenti
  MachineGuid di Windows. Il dato grezzo non viene mandato al server:
  viene trasformato con SHA-256 e prefisso PC-.
- Se non disponibile usa un ID casuale, persistito nel profilo NW.js.
- L'ID resta salvato in desktop-device-id.txt nella cartella dati utente
  gestita da NW.js. La logica Account dell'app lo memorizza inoltre nel
  database PouchDB solx-bootstrap e lo conserva agli avvii successivi.
- Non si puo garantire l'unicita assoluta di UUID seriali, specialmente
  su hardware clonati/VM. Non cancellare il profilo dati dell'applicazione.
- Il nuovo PC va associato all'account sul server, altrimenti potrebbe
  partire con la configurazione di fallback prevista dall'app.

NOTA: nessun file Android/JS applicativo e modificato. La stampa e i PDF
nativi su Windows non sono implementati e l'adapter restituisce errore
per queste azioni. Fiscalizzazione e recupero automatico restano invariati;
NW.js puo comunque contattare gli endpoint configurati dal codice originale.
Accesso agli endpoint remoti dipende dalla loro raggiungibilita e CORS.

Questo pacchetto contiene il BUILDER, non i binari/runtime NW.js.
Il runtime completo viene scaricato dalla distribuzione ufficiale durante
la build. Non e stata eseguita una build su Windows.
