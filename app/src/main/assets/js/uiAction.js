// Copyright AltraConsulenza Snc
// Generated on: 2026-05-09 (Europe/Rome)
// inizio file uiAction.js

// Funzioni esposte:
// - formatMoney(value): formatta un importo numerico in valuta euro.
// - parseKeypadAmount(): converte keypadBuffer in numero.
// - renderReparti(): aggiorna le etichette dei reparti da Config.reparti.
// - setActiveReparto(reparto): imposta il reparto attivo e aggiorna i pulsanti servizio.
// - setSelectedIndex(index): imposta la riga selezionata.
// - resetKeypadMode(): riporta il tastierino in modalità importo.
// - clearKeypadBuffer(): svuota il valore digitato.
// - appendKeypadChar(char): aggiunge un carattere al valore digitato.
// - backspaceKeypad(): cancella l'ultimo carattere digitato.
// - renderServizi(): disegna i servizi disponibili per il reparto attivo.
// - renderCarrello(): aggiorna lista articoli, numero articoli e totale.
// - renderSelectedDisplay(): aggiorna display operativo.
// - showPopupPagamento(tipo, receipt): mostra il popup conferma pagamento.
// - hidePopupPagamento(): chiude il popup conferma pagamento.
// - openProgressPopup(detail): apre il popup avanzamento stampa.
// - updateProgressPopup(message, percent): aggiorna testo e percentuale avanzamento.
// - completeProgressPopup(): porta la barra al 100% e chiude il popup.
// - failProgressPopup(message): mostra errore nel popup avanzamento.
// - closeProgressPopup(): chiude e resetta il popup avanzamento.
// - bindUIActions(): collega gli eventi della UI.
// - bindKeypadActions(): collega gli eventi del tastierino.
// - bindPosEvents(): collega gli eventi emessi da posFlow.js.
// - initUI(): inizializza interfaccia e stato visuale.

let activeReparto = 1
let selectedIndex = -1
let keypadBuffer = ""
let keypadMode = "amount"

let progressTimer = null
let progressStartedAt = 0
let progressMaxMs = 10000

function formatMoney(value) {
    const n = Number(value || 0)

    return n.toLocaleString("it-IT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + " €"
}

function parseKeypadAmount() {
    if (!keypadBuffer) return null

    const normalized = keypadBuffer.replace(",", ".")
    const value = Number(normalized)

    if (isNaN(value)) return null

    return value
}

function renderReparti() {
    document.querySelectorAll(".reparto").forEach(btn => {
        const reparto = Number(btn.dataset.reparto)

        const label = Config.reparti && Config.reparti[reparto]
            ? Config.reparti[reparto]
            : "R" + reparto

        btn.innerText = label
    })
}

function setActiveReparto(reparto) {
    activeReparto = Number(reparto)

    document.querySelectorAll(".reparto").forEach(btn => {
        btn.classList.toggle("active", Number(btn.dataset.reparto) === activeReparto)
    })

    renderServizi()
}

function setSelectedIndex(index) {
    const items = window.items || []
    const idx = Number(index)

    if (idx < 0 || idx >= items.length) {
        selectedIndex = -1
    } else {
        selectedIndex = idx
    }

    renderCarrello()
    renderSelectedDisplay()
}

function resetKeypadMode() {
    keypadMode = "amount"
}

function clearKeypadBuffer() {
    keypadBuffer = ""
    resetKeypadMode()
    renderSelectedDisplay()
}

function appendKeypadChar(char) {
    if (char === ",") {
        if (keypadBuffer.indexOf(",") >= 0) return
        keypadBuffer = keypadBuffer || "0"
        keypadBuffer += ","
        renderSelectedDisplay()
        return
    }

    if (keypadBuffer === "0") {
        keypadBuffer = char
    } else {
        keypadBuffer += char
    }

    renderSelectedDisplay()
}

function backspaceKeypad() {
    if (!keypadBuffer) return

    keypadBuffer = keypadBuffer.slice(0, -1)

    renderSelectedDisplay()
}

function renderServizi() {
    const buttons = document.querySelectorAll(".servizio")
    const listino = Config.listino || []

    buttons.forEach(btn => {
        const pos = Number(btn.dataset.pos)

        const servizio = listino.find(item => {
            return Number(item.reparto) === activeReparto && Number(item.posizione) === pos
        })

        if (!servizio) {
            btn.innerHTML = ""
            btn.disabled = true
            btn.dataset.nome = ""
            btn.dataset.prezzo = ""
            return
        }

        btn.disabled = false
        btn.dataset.nome = servizio.servizio
        btn.dataset.prezzo = servizio.prezzo

        btn.innerHTML =
            '<div class="s-name">' + servizio.servizio + '</div>' +
            '<div class="s-price">' + formatMoney(servizio.prezzo) + '</div>'
    })
}

function renderCarrello() {
    const lista = document.querySelector(".lista")
    const articoliValue = document.querySelector(".summary .articoli .value")
    const totaleValue = document.querySelector(".summary .totale .value")

    const items = window.items || []
    const total = Number(window.total || 0)

    lista.innerHTML = ""

    items.forEach((item, i) => {
        const row = document.createElement("div")
        row.className = "row"

        if (i === selectedIndex) {
            row.classList.add("selected")
        }

        row.dataset.index = i

        row.innerHTML =
            '<span>' + item.nome + '</span>' +
            '<span>' + formatMoney(item.prezzo) + '</span>'

        row.addEventListener("click", () => {
            clearKeypadBuffer()
            setSelectedIndex(i)
        })

        lista.appendChild(row)
    })

    articoliValue.innerText = items.length
    totaleValue.innerText = formatMoney(total)
}

function scrollListaToBottom() {
    const lista = document.querySelector(".lista")

    if (!lista) return

    lista.scrollTop = lista.scrollHeight
}

function renderSelectedDisplay() {
    const priceEl = document.getElementById("selectedPrice")

    const items = window.items || []
    const item = selectedIndex >= 0 ? items[selectedIndex] : null

    if (!priceEl) return

    if (keypadBuffer) {
        if (keypadMode === "percent") {
            priceEl.innerText = keypadBuffer + " %"
        } else {
            priceEl.innerText = keypadBuffer + " €"
        }
        return
    }

    if (!item) {
        priceEl.innerText = keypadMode === "percent" ? "0 %" : "0,00 €"
        return
    }

    priceEl.innerText = formatMoney(item.prezzo)
}

function showPopupPagamento(tipo, receipt) {

    return new Promise((resolve) => {

        const popup = document.getElementById("popup")
        const importo = document.getElementById("popupImporto")
        const tipoEl = document.getElementById("popupTipo")
        const ok = document.querySelector(".popup-ok")
        const cancel = document.querySelector(".popup-cancel")

        if (!popup || !importo || !tipoEl || !ok || !cancel) {
            resolve(true)
            return
        }

        importo.innerText = formatMoney(receipt && receipt.totale ? receipt.totale : window.total)
        tipoEl.innerText = tipo === "CC" ? "POS" : "CONTANTI"

        popup.classList.add("show")

        ok.onclick = () => {
            hidePopupPagamento()
            resolve(true)
        }

        cancel.onclick = () => {
            hidePopupPagamento()
            resolve(false)
        }
    })
}

function hidePopupPagamento() {
    const popup = document.getElementById("popup")

    if (popup) {
        popup.classList.remove("show")
    }
}

function openProgressPopup(detail) {
    const popup = document.getElementById("progressPopup")

    if (!popup) return

    progressMaxMs = Number(
        detail && detail.timeout
            ? detail.timeout
            : Config.progressMaxMs || 10000
    )

    progressStartedAt = Date.now()

    popup.classList.remove("error")
    popup.classList.add("show")

    updateProgressPopup("Preparazione scontrino...", 5)

    if (progressTimer) {
        clearInterval(progressTimer)
        progressTimer = null
    }

    progressTimer = setInterval(() => {
        const elapsed = Date.now() - progressStartedAt
        const ratio = Math.min(elapsed / progressMaxMs, 1)

        let percent = Math.floor(ratio * 90)
        let message = "Operazione in corso..."

        if (ratio < 0.20) {
            message = "Preparazione scontrino..."
        } else if (ratio < 0.45) {
            message = "Collegamento al cassetto fiscale..."
        } else if (ratio < 0.65) {
            message = "Preparazione stampa..."
        } else if (ratio < 1) {
            message = "Stampa in corso..."
        } else {
            percent = 95
            message = "Attesa completamento operazione..."
        }

        updateProgressPopup(message, percent)

    }, 250)
}

function updateProgressPopup(message, percent) {
    const msg = document.getElementById("progressMessage")
    const fill = document.getElementById("progressFill")
    const pct = document.getElementById("progressPercent")

    const p = Math.max(0, Math.min(100, Number(percent || 0)))

    if (msg) msg.innerText = message || ""
    if (fill) fill.style.width = p + "%"
    if (pct) pct.innerText = Math.round(p) + "%"
}

function completeProgressPopup() {
    if (progressTimer) {
        clearInterval(progressTimer)
        progressTimer = null
    }

    updateProgressPopup("Operazione completata", 100)

    setTimeout(() => {
        closeProgressPopup()
    }, 600)
}

function failProgressPopup(message) {
    if (progressTimer) {
        clearInterval(progressTimer)
        progressTimer = null
    }

    const popup = document.getElementById("progressPopup")

    if (popup) {
        popup.classList.add("error")
        popup.classList.add("show")
    }

    updateProgressPopup(message || "Errore durante l'operazione", 100)
}

function closeProgressPopup() {
    const popup = document.getElementById("progressPopup")
    const fill = document.getElementById("progressFill")
    const pct = document.getElementById("progressPercent")
    const msg = document.getElementById("progressMessage")

    if (progressTimer) {
        clearInterval(progressTimer)
        progressTimer = null
    }

    if (popup) {
        popup.classList.remove("show")
        popup.classList.remove("error")
    }

    if (fill) fill.style.width = "0%"
    if (pct) pct.innerText = "0%"
    if (msg) msg.innerText = "Preparazione operazione..."
}

function bindUIActions() {

    document.querySelectorAll(".reparto").forEach(btn => {
        btn.addEventListener("click", () => {
            setActiveReparto(btn.dataset.reparto)
        })
    })

    document.querySelectorAll(".servizio").forEach(btn => {
        btn.addEventListener("click", () => {
            if (btn.disabled) return

            const nome = btn.dataset.nome
            let prezzo = Number(btn.dataset.prezzo || 0)

            const manualPrice = parseKeypadAmount()

            if (manualPrice !== null && keypadMode === "amount") {
                prezzo = manualPrice
            }

            if (!nome) return

            addService(nome, prezzo)

            clearKeypadBuffer()
        })
    })

    const btnAnnulla = document.querySelector(".action.annulla")
    const btnContanti = document.querySelector(".action.contanti")
    const btnPos = document.querySelector(".action.pos")
    const btnDelete = document.querySelector(".selected-delete")
    const btnDiscount = document.querySelector(".selected-discount")

    if (btnAnnulla) {
        btnAnnulla.addEventListener("click", () => {
            selectedIndex = -1
            keypadBuffer = ""
            resetKeypadMode()
            reset()
            renderSelectedDisplay()
        })
    }

    if (btnContanti) {
        btnContanti.addEventListener("click", () => {
            startPayment("CA")
        })
    }

    if (btnPos) {
        btnPos.addEventListener("click", () => {
            startPayment("CC")
        })
    }

    if (btnDelete) {
        btnDelete.addEventListener("click", () => {
            if (selectedIndex < 0) return

            const oldIndex = selectedIndex

            removeItem(selectedIndex)

            const items = window.items || []

            if (items.length === 0) {
                selectedIndex = -1
            } else if (oldIndex >= items.length) {
                selectedIndex = items.length - 1
            } else {
                selectedIndex = oldIndex
            }

            keypadBuffer = ""
            resetKeypadMode()

            renderCarrello()
            renderSelectedDisplay()
        })
    }

    if (btnDiscount) {
        btnDiscount.addEventListener("click", () => {
            const value = parseKeypadAmount()

            if (value === null || value <= 0) return

            if (keypadMode === "percent") {
                const total = Number(window.total || 0)

                if (total <= 0) return

                const discountAmount = total * value / 100
                addDiscount("SCONTO " + value.toString().replace(".", ",") + "%", discountAmount)
            } else {
                addDiscount("SCONTO", value)
            }

            clearKeypadBuffer()
        })
    }
}

function bindKeypadActions() {
    document.querySelectorAll(".keypad .key").forEach(btn => {
        btn.addEventListener("click", () => {
            const key = btn.innerText.trim()

            if (key >= "0" && key <= "9") {
                appendKeypadChar(key)
                return
            }

            if (key === ",") {
                appendKeypadChar(",")
                return
            }

            if (key === "←") {
                backspaceKeypad()
                return
            }

            if (key === "CL") {
                clearKeypadBuffer()
                return
            }

            if (key === "OK") {
                const value = parseKeypadAmount()

                if (selectedIndex >= 0 && value !== null && keypadMode === "amount") {
                    updateItemPrice(selectedIndex, value)
                    clearKeypadBuffer()
                    renderCarrello()
                    renderSelectedDisplay()
                }

                return
            }

            if (key === "X") {
                const qty = parseKeypadAmount()

                if (selectedIndex >= 0 && qty !== null) {
                    duplicateItem(selectedIndex, Math.floor(qty))
                    clearKeypadBuffer()

                    const items = window.items || []
                    if (items.length > 0) {
                        selectedIndex = items.length - 1
                    }

                    renderCarrello()
                    renderSelectedDisplay()
                }

                return
            }

            if (key === "%") {
                keypadMode = "percent"
                renderSelectedDisplay()
                return
            }
        })
    })
}

function bindPosEvents() {

    document.addEventListener("pos:update", () => {
        const items = window.items || []

        if (items.length === 0) {
            selectedIndex = -1
        } else if (selectedIndex >= items.length) {
            selectedIndex = items.length - 1
        }

        renderCarrello()
        renderSelectedDisplay()
    })

    document.addEventListener("pos:item:add", (ev) => {
        const detail = ev.detail || {}

        if (typeof detail.index !== "undefined") {
            selectedIndex = Number(detail.index)
        }

        renderCarrello()
        renderSelectedDisplay()

        setTimeout(() => {
            scrollListaToBottom()
        }, 0)
    })

    document.addEventListener("pos:item:update", () => {
        renderCarrello()
        renderSelectedDisplay()
    })

    document.addEventListener("pos:item:remove", () => {
        renderCarrello()
        renderSelectedDisplay()
    })

    document.addEventListener("pos:item:duplicate", () => {
        renderCarrello()
        renderSelectedDisplay()
    })

    document.addEventListener("pos:reset", () => {
        selectedIndex = -1
        keypadBuffer = ""
        resetKeypadMode()

        renderCarrello()
        renderSelectedDisplay()
    })

    document.addEventListener("pos:payment:confirm-request", async (ev) => {
        const detail = ev.detail || {}
        const ok = await showPopupPagamento(detail.tipo, detail.receipt)

        if (typeof detail.resolve === "function") {
            detail.resolve(ok)
        }
    })

    document.addEventListener("pos:payment:start", (ev) => {
        openProgressPopup(ev.detail || {})
        updateProgressPopup("Preparazione scontrino...", 5)
    })

    document.addEventListener("pos:fiscal:start", () => {
        updateProgressPopup("Collegamento al cassetto fiscale...", 25)
    })

    document.addEventListener("pos:fiscal:end", () => {
        updateProgressPopup("Documento commerciale registrato...", 55)
    })

    document.addEventListener("pos:print:start", () => {
        updateProgressPopup("Stampa in corso...", 75)
    })

    document.addEventListener("pos:print:end", () => {
        completeProgressPopup()
    })

    document.addEventListener("pos:payment:cancelled", () => {
        closeProgressPopup()
    })

    document.addEventListener("pos:error", (ev) => {
        const detail = ev.detail || {}
        failProgressPopup(detail.message || "Errore durante l'operazione")
    })

    document.addEventListener("pos:payment:empty", () => {
        alert("Nessun servizio inserito")
    })
}

function initUI() {
    window.items = window.items || []
    window.total = Number(window.total || 0)

    bindUIActions()
    bindKeypadActions()
    bindPosEvents()

    renderReparti()
    setActiveReparto(1)
    renderCarrello()
    renderSelectedDisplay()
}

window.addEventListener("load", initUI)

// fine file uiAction.js