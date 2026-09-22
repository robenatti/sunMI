window.AppViews = window.AppViews || {};

AppViews.cassa = (() => {
    let activeReparto = null;
    let selectedIndex = -1;
    let quantityBuffer = "";
    let amountBuffer = "";
    let activeInput = "quantity";
    let percentMode = false;
    let cancelCount = 0;
    let cancelTimer = null;
    let unsubscribers = [];
    let lastItemCount = 0;

    function money(value, euro) {
        const text = Number(value || 0).toLocaleString("it-IT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return euro === false ? text : text + " €";
    }

    function parseAmount(value) {
        if (!value) return null;
        const n = Number(String(value).replace(",", "."));
        return Number.isFinite(n) ? n : null;
    }

    function state() {
        return AppAPI.getPosState();
    }

    function selectedItem() {
        const items = state().items;
        return selectedIndex >= 0 && selectedIndex < items.length ? items[selectedIndex] : null;
    }

    function resetCancel() {
        cancelCount = 0;
        if (cancelTimer) clearTimeout(cancelTimer);
        cancelTimer = null;
        const box = document.getElementById("cancelCount");
        if (box) box.textContent = "";
    }

    function renderDisplays(showCurrent) {
        const qBox = document.getElementById("quantityDisplay");
        const pBox = document.getElementById("selectedPrice");
        const qButton = document.getElementById("quantityBox");
        const pButton = document.getElementById("amountBox");
        if (!qBox || !pBox) return;

        const item = selectedItem();
        const q = item ? Number(item.quantita || 1) : 0;
        const p = item ? Number(item.prezzo || 0) : 0;

        qBox.textContent = quantityBuffer || (showCurrent ? String(q) : "0");
        if (percentMode) {
            pBox.textContent = (amountBuffer || "0") + " %";
        } else if (amountBuffer) {
            pBox.textContent = amountBuffer + " €";
        } else {
            pBox.textContent = showCurrent ? money(p) : "0,00 €";
        }

        qButton.classList.toggle("active", activeInput === "quantity");
        pButton.classList.toggle("active", activeInput === "amount");
    }

    function clearInput(showCurrent) {
        quantityBuffer = "";
        amountBuffer = "";
        activeInput = "quantity";
        percentMode = false;
        renderDisplays(showCurrent !== false);
    }

    function normalizeSelection(posState) {
        const count = posState.items.length;
        if (!count) selectedIndex = -1;
        else if (count > lastItemCount) selectedIndex = count - 1;
        else if (selectedIndex < 0 || selectedIndex >= count) selectedIndex = count - 1;
        lastItemCount = count;
    }

    function cartRow(item, index) {
        const q = Number(item.quantita || 1);
        const p = Number(item.prezzo || 0);
        const row = document.createElement("button");
        row.type = "button";
        row.className = "cart-row" + (index === selectedIndex ? " selected" : "");
        row.style.display = "grid";
        row.style.gridTemplateColumns = "minmax(0,1fr) auto minmax(5.5rem,1fr)";
        row.style.columnGap = "0.65rem";

        const name = document.createElement("span");
        name.textContent = item.nome;
        name.style.overflow = "hidden";
        name.style.textOverflow = "ellipsis";
        name.style.whiteSpace = "nowrap";
        name.style.textAlign = "left";
        row.appendChild(name);

        if (q > 1) {
            const calc = document.createElement("span");
            calc.textContent = q + " × " + money(p, false);
            calc.style.gridColumn = "2";
            calc.style.justifySelf = "center";
            calc.style.fontSize = "0.72rem";
            calc.style.opacity = "0.7";
            calc.style.whiteSpace = "nowrap";
            row.appendChild(calc);
        }

        const total = document.createElement("span");
        total.textContent = money(p * q);
        total.style.gridColumn = "3";
        total.style.justifySelf = "end";
        total.style.fontWeight = "600";
        total.style.whiteSpace = "nowrap";
        row.appendChild(total);

        row.addEventListener("click", () => {
            resetCancel();
            selectedIndex = index;
            clearInput(true);
            renderCart();
        });
        return row;
    }

    function renderCart() {
        const container = document.getElementById("carrello");
        if (!container) return;
        const posState = state();
        normalizeSelection(posState);
        container.innerHTML = "";
        posState.items.forEach((item, index) => container.appendChild(cartRow(item, index)));

        const articles = posState.items
            .filter(item => !item.sconto)
            .reduce((sum, item) => sum + Number(item.quantita || 1), 0);
        document.getElementById("lineCount").textContent = String(posState.items.length);
        document.getElementById("articleCount").textContent = String(articles);
        document.getElementById("totalValue").textContent = money(posState.total);

        document.querySelectorAll(".pos-app button").forEach(button => {
            if (!button.classList.contains("reparto-button") && !button.classList.contains("tool")) {
                button.disabled = posState.paymentRunning || button.classList.contains("empty");
            }
        });
        renderDisplays(true);
        if (selectedIndex === posState.items.length - 1 && selectedIndex >= 0) container.scrollTop = container.scrollHeight;
    }

    function addArticle(id) {
        resetCancel();
        AppAPI.addArticolo(id, null);
        clearInput(true);
    }

    function articleButton(article) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn articolo-button";
        if (!article) {
            button.disabled = true;
            button.classList.add("empty");
            return button;
        }
        button.innerHTML = "";
        const name = document.createElement("div");
        name.className = "article-name";
        name.textContent = article.nome;
        const price = document.createElement("div");
        price.className = "article-price";
        price.textContent = money(article.prezzo);
        button.appendChild(name);
        button.appendChild(price);
        button.addEventListener("click", () => addArticle(article._id));
        return button;
    }

    function renderList(text) {
        const container = document.getElementById("articoliLista");
        container.innerHTML = "";
        AppAPI.searchArticoli(activeReparto, text || "").forEach(article => {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "article-list-row";
            const name = document.createElement("span");
            name.textContent = article.nome;
            const price = document.createElement("span");
            price.textContent = money(article.prezzo);
            row.appendChild(name);
            row.appendChild(price);
            row.addEventListener("click", () => addArticle(article._id));
            container.appendChild(row);
        });
    }

    function setReparto(id) {
        activeReparto = Number(id);
        document.querySelectorAll(".reparto-button").forEach(button => {
            button.classList.toggle("active", Number(button.dataset.id) === activeReparto);
        });
        const view = AppAPI.getRepartoView(activeReparto);
        if (!view) return;
        const buttons = document.getElementById("articoliBottoni");
        const listPanel = document.getElementById("articoliListaPanel");
        const search = document.getElementById("articleSearch");
        if (view.vista === "LISTA") {
            buttons.classList.add("hidden");
            listPanel.classList.remove("hidden");
            search.value = "";
            renderList("");
        } else {
            listPanel.classList.add("hidden");
            buttons.classList.remove("hidden");
            buttons.innerHTML = "";
            view.slots.forEach(article => buttons.appendChild(articleButton(article)));
        }
    }

    function renderReparti() {
        const container = document.getElementById("reparti");
        const reparti = AppAPI.getReparti();
        container.innerHTML = "";
        reparti.forEach(reparto => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn reparto-button";
            button.dataset.id = reparto.id;
            button.textContent = reparto.nome;
            button.addEventListener("click", () => setReparto(reparto.id));
            container.appendChild(button);
        });
        if (reparti.length) setReparto(reparti[0].id);
    }

    function selectInput(name) {
        resetCancel();
        activeInput = name;
        percentMode = false;
        if (name === "quantity") quantityBuffer = "";
        else amountBuffer = "";
        renderDisplays(true);
    }

    function appendKey(key) {
        resetCancel();
        if (activeInput === "quantity") {
            if (key === "." || key === ",") return;
            quantityBuffer = quantityBuffer === "0" ? key : quantityBuffer + key;
        } else if (key === "." || key === ",") {
            if (amountBuffer.includes(".") || amountBuffer.includes(",")) return;
            amountBuffer = (amountBuffer || "0") + ".";
        } else {
            amountBuffer = amountBuffer === "0" ? key : amountBuffer + key;
        }
        renderDisplays(true);
    }

    function multiply() {
        resetCancel();
        const item = selectedItem();
        if (!item || selectedIndex < 0) return;
        const q = quantityBuffer ? Math.floor(Number(quantityBuffer)) : Number(item.quantita || 1);
        if (!Number.isFinite(q) || q <= 0) return;
        quantityBuffer = "";
        amountBuffer = "";
        activeInput = "amount";
        percentMode = false;
        AppAPI.setItemValues(selectedIndex, q, Number(item.prezzo || 0));
    }

    function confirm() {
        resetCancel();
        const item = selectedItem();
        if (!item || selectedIndex < 0 || percentMode) return;
        const q = quantityBuffer ? Math.floor(Number(quantityBuffer)) : Number(item.quantita || 1);
        const p = amountBuffer ? parseAmount(amountBuffer) : Number(item.prezzo || 0);
        if (!Number.isFinite(q) || q <= 0 || p == null) return;
        AppAPI.setItemValues(selectedIndex, q, p);
        clearInput(true);
    }

    function discount() {
        resetCancel();
        const value = parseAmount(amountBuffer);
        if (value == null || value <= 0) return;
        AppAPI.addDiscount(value, percentMode);
        clearInput(true);
    }

    function cancel() {
        quantityBuffer = "";
        amountBuffer = "";
        activeInput = "quantity";
        percentMode = false;
        renderDisplays(false);
        cancelCount++;
        const counter = document.getElementById("cancelCount");
        if (counter && cancelCount < 3) counter.textContent = cancelCount + "/3";
        if (cancelTimer) clearTimeout(cancelTimer);
        if (cancelCount >= 3) {
            resetCancel();
            selectedIndex = -1;
            lastItemCount = 0;
            AppAPI.resetPos();
            return;
        }
        cancelTimer = setTimeout(resetCancel, 2500);
    }

    function handleKey(key) {
        if (/^[0-9]$/.test(key) || key === "." || key === ",") appendKey(key);
        else if (key === "X") multiply();
        else if (key === "OK") confirm();
        else if (key === "%") {
            resetCancel();
            quantityBuffer = "";
            amountBuffer = "";
            activeInput = "amount";
            percentMode = true;
            renderDisplays(true);
        }
    }

    function showProgress(message, percent, error) {
        const popup = document.getElementById("progressPopup");
        if (!popup) return;
        popup.classList.add("show");
        popup.classList.toggle("error", !!error);
        document.getElementById("progressMessage").textContent = message;
        document.getElementById("progressFill").style.width = String(percent) + "%";
        document.getElementById("progressPercent").textContent = String(percent) + "%";
    }

    function bind() {
        document.getElementById("quantityBox").addEventListener("click", () => selectInput("quantity"));
        document.getElementById("amountBox").addEventListener("click", () => selectInput("amount"));
        document.querySelectorAll("#keypad .key").forEach(button => {
            button.addEventListener("click", () => handleKey(button.dataset.key || button.textContent.trim()));
        });
        document.getElementById("articleSearch").addEventListener("input", event => renderList(event.target.value));
        document.getElementById("deleteItem").addEventListener("click", () => {
            if (selectedIndex < 0) return;
            resetCancel();
            const count = state().items.length;
            const removed = selectedIndex;
            if (count <= 1) selectedIndex = -1;
            else if (removed >= count - 1) selectedIndex = removed - 1;
            AppAPI.removeItem(removed);
            clearInput(true);
        });
        document.getElementById("discountItem").addEventListener("click", discount);
        document.getElementById("cancelSale").addEventListener("click", cancel);
        document.getElementById("cashPayment").addEventListener("click", () => AppAPI.pay("CA").catch(() => {}));
        document.getElementById("cardPayment").addEventListener("click", () => AppAPI.pay("CC").catch(() => {}));
        document.getElementById("openConfig").addEventListener("click", () => Router.open("config"));
        document.getElementById("openSummary").addEventListener("click", () => Router.open("riepilogo"));
    }

    async function audit(root) {
        const ids = ["reparti", "articoliBottoni", "articoliListaPanel", "articleSearch", "articoliLista", "carrello", "lineCount", "articleCount", "totalValue", "quantityBox", "quantityDisplay", "amountBox", "selectedPrice", "keypad", "deleteItem", "discountItem", "cancelSale", "openConfig", "openSummary", "cashPayment", "cardPayment", "progressPopup", "appVersion"];
        const missing = ids.filter(id => !root.querySelector("#" + id));
        if (missing.length) throw new Error("Elementi DOM mancanti: " + missing.join(", "));
        return { ok: true, elements: ids.length };
    }

    async function mount() {
        lastItemCount = state().items.length;
        selectedIndex = lastItemCount ? lastItemCount - 1 : -1;
        clearInput(true);
        document.getElementById("appVersion").textContent = "V " + String(Config.version || "?");
        renderReparti();
        renderCart();
        bind();
        unsubscribers.push(AppAPI.on("pos:change", renderCart));
        unsubscribers.push(AppAPI.on("pos:payment:empty", () => alert("Nessun articolo inserito")));
        unsubscribers.push(AppAPI.on("barcode:notfound", detail => alert("Barcode non trovato: " + detail.code)));
        unsubscribers.push(AppAPI.on("pos:payment:start", () => showProgress("Preparazione scontrino...", 10)));
        unsubscribers.push(AppAPI.on("pos:fiscal:start", () => showProgress("Collegamento al cassetto fiscale...", 30)));
        unsubscribers.push(AppAPI.on("pos:fiscal:end", detail => {
            if (detail && detail.error) {
                showProgress("Fiscalizzazione non disponibile. Stampa documento provvisorio...", 60, true);
            } else {
                showProgress("Documento registrato...", 60);
            }
        }));
        unsubscribers.push(AppAPI.on("pos:print:start", () => showProgress("Stampa in corso...", 80)));
        unsubscribers.push(AppAPI.on("pos:print:end", () => showProgress("Operazione completata", 100)));
        unsubscribers.push(AppAPI.on("pos:print:error", detail => showProgress("Vendita registrata. Errore stampa: " + detail.message, 100, true)));
        unsubscribers.push(AppAPI.on("pos:payment:end", detail => {
            if (detail.fiscalError) {
                showProgress("Ricevuta salvata. Fiscalizzazione in attesa: nuovo tentativo automatico.", 100, true);

                setTimeout(() => {
                    document.getElementById("progressPopup").classList.remove("show", "error");
                }, 1500);

                return;
            }

            if (!detail.printError)
                setTimeout(() => document.getElementById("progressPopup").classList.remove("show", "error"), 500);
        }));
        unsubscribers.push(AppAPI.on("pos:error", detail => showProgress(detail.message || "Errore", 100, true)));
    }

    function unmount() {
        unsubscribers.forEach(fn => fn());
        unsubscribers = [];
        if (cancelTimer) clearTimeout(cancelTimer);
        cancelTimer = null;
    }

    return { mount, unmount, audit };
})();