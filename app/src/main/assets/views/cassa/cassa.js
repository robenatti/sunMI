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

    function formatMoney(value) {
        return Number(value || 0).toLocaleString("it-IT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + " €";
    }

    function formatMoneyCompact(value) {
        return Number(value || 0).toLocaleString("it-IT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function parseAmount(value) {
        if (!value) return null;
        const number = Number(String(value).replace(",", "."));
        return Number.isFinite(number) ? number : null;
    }

    function getSelectedItem() {
        const state = AppAPI.getPosState();
        return selectedIndex >= 0 && selectedIndex < state.items.length
            ? state.items[selectedIndex]
            : null;
    }

    function resetCancel() {
        cancelCount = 0;
        if (cancelTimer) clearTimeout(cancelTimer);
        cancelTimer = null;
        const counter = document.getElementById("cancelCount");
        if (counter) counter.textContent = "";
    }

    function clearInputState(showCurrent) {
        quantityBuffer = "";
        amountBuffer = "";
        activeInput = "quantity";
        percentMode = false;
        renderSelected(showCurrent !== false);
    }

    function renderSelected(showCurrent) {
        const quantityDisplay = document.getElementById("quantityDisplay");
        const priceDisplay = document.getElementById("selectedPrice");
        const quantityBox = document.getElementById("quantityBox");
        const amountBox = document.getElementById("amountBox");
        if (!quantityDisplay || !priceDisplay) return;

        const item = getSelectedItem();
        const quantity = item ? Number(item.quantita || 1) : 0;
        const price = item ? Number(item.prezzo || 0) : 0;

        quantityDisplay.textContent = quantityBuffer || (showCurrent ? String(quantity) : "0");
        priceDisplay.textContent = amountBuffer
            ? amountBuffer + (percentMode ? " %" : " €")
            : (showCurrent ? formatMoney(price) : "0,00 €");

        if (quantityBox) quantityBox.classList.toggle("active", activeInput === "quantity");
        if (amountBox) amountBox.classList.toggle("active", activeInput === "amount");
    }

    function normalizeSelection(state) {
        const count = state.items.length;

        if (count === 0) {
            selectedIndex = -1;
        } else if (count > lastItemCount) {
            selectedIndex = count - 1;
        } else if (selectedIndex < 0 || selectedIndex >= count) {
            selectedIndex = count - 1;
        }

        lastItemCount = count;
    }

    function createCartRow(item, index) {
        const quantity = Number(item.quantita || 1);
        const unitPrice = Number(item.prezzo || 0);
        const row = document.createElement("button");
        row.type = "button";
        row.className = "cart-row";
        row.style.display = "grid";
        row.style.gridTemplateColumns = "minmax(0, 1fr) auto minmax(5.5rem, 1fr)";
        row.style.columnGap = "0.65rem";

        if (index === selectedIndex) row.classList.add("selected");

        const name = document.createElement("span");
        name.textContent = item.nome;
        name.style.minWidth = "0";
        name.style.overflow = "hidden";
        name.style.textOverflow = "ellipsis";
        name.style.whiteSpace = "nowrap";
        name.style.textAlign = "left";
        row.appendChild(name);

        if (quantity > 1) {
            const calculation = document.createElement("span");
            calculation.textContent = quantity + " × " + formatMoneyCompact(unitPrice);
            calculation.style.gridColumn = "2";
            calculation.style.justifySelf = "center";
            calculation.style.fontSize = "0.72rem";
            calculation.style.opacity = "0.7";
            calculation.style.whiteSpace = "nowrap";
            row.appendChild(calculation);
        }

        const total = document.createElement("span");
        total.textContent = formatMoney(unitPrice * quantity);
        total.style.gridColumn = "3";
        total.style.justifySelf = "end";
        total.style.fontWeight = "600";
        total.style.whiteSpace = "nowrap";
        row.appendChild(total);

        row.addEventListener("click", () => {
            resetCancel();
            selectedIndex = index;
            clearInputState(true);
            renderCart();
        });

        return row;
    }

    function renderCart() {
        const container = document.getElementById("carrello");
        if (!container) return;

        const state = AppAPI.getPosState();
        normalizeSelection(state);
        container.innerHTML = "";

        state.items.forEach((item, index) => {
            container.appendChild(createCartRow(item, index));
        });

        const articleCount = state.items
            .filter(item => !item.sconto)
            .reduce((sum, item) => sum + Number(item.quantita || 1), 0);

        document.getElementById("articleCount").textContent = String(articleCount);
        document.getElementById("totalValue").textContent = formatMoney(state.total);

        document.querySelectorAll(".pos-app button").forEach(button => {
            if (!button.classList.contains("reparto-button") && !button.classList.contains("tool")) {
                button.disabled = state.paymentRunning || button.classList.contains("empty");
            }
        });

        renderSelected(true);

        if (selectedIndex === state.items.length - 1 && selectedIndex >= 0) {
            container.scrollTop = container.scrollHeight;
        }
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

        const name = document.createElement("div");
        name.className = "article-name";
        name.textContent = article.nome;

        const price = document.createElement("div");
        price.className = "article-price";
        price.textContent = formatMoney(article.prezzo);

        button.appendChild(name);
        button.appendChild(price);
        button.addEventListener("click", () => addArticle(article._id));

        return button;
    }

    function addArticle(id) {
        resetCancel();
        AppAPI.addArticolo(id, null);
        clearInputState(true);
    }

    function renderListArticles(text) {
        const container = document.getElementById("articoliLista");
        if (!container) return;

        const list = AppAPI.searchArticoli(activeReparto, text || "");
        container.innerHTML = "";

        list.forEach(article => {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "article-list-row";

            const name = document.createElement("span");
            name.textContent = article.nome;

            const price = document.createElement("span");
            price.textContent = formatMoney(article.prezzo);

            row.appendChild(name);
            row.appendChild(price);
            row.addEventListener("click", () => addArticle(article._id));
            container.appendChild(row);
        });
    }

    function setActiveReparto(id) {
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
            renderListArticles("");
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
            button.addEventListener("click", () => setActiveReparto(reparto.id));
            container.appendChild(button);
        });

        if (reparti.length) setActiveReparto(reparti[0].id);
    }

    function selectInput(name) {
        resetCancel();
        activeInput = name;
        percentMode = false;

        if (name === "quantity") quantityBuffer = "";
        if (name === "amount") amountBuffer = "";

        renderSelected(true);
    }

    function appendKey(key) {
        resetCancel();

        if (activeInput === "quantity") {
            if (key === ",") return;
            quantityBuffer = quantityBuffer === "0" ? key : quantityBuffer + key;
        } else if (key === ",") {
            if (!amountBuffer.includes(",")) amountBuffer = (amountBuffer || "0") + ",";
        } else {
            amountBuffer = amountBuffer === "0" ? key : amountBuffer + key;
        }

        renderSelected(true);
    }

    function multiply() {
        resetCancel();
        const item = getSelectedItem();
        if (!item) return;

        const quantity = quantityBuffer
            ? Math.floor(Number(quantityBuffer))
            : Number(item.quantita || 1);

        if (!Number.isFinite(quantity) || quantity <= 0) return;

        activeInput = "amount";
        amountBuffer = "";
        percentMode = false;
        renderSelected(true);
    }

    function confirm() {
        resetCancel();
        const item = getSelectedItem();
        if (selectedIndex < 0 || !item || percentMode) return;

        const quantity = quantityBuffer
            ? Math.floor(Number(quantityBuffer))
            : Number(item.quantita || 1);
        const price = amountBuffer
            ? parseAmount(amountBuffer)
            : Number(item.prezzo || 0);

        if (!Number.isFinite(quantity) || quantity <= 0 || price == null) return;

        AppAPI.setItemValues(selectedIndex, quantity, price);
        clearInputState(true);
    }

    function discount() {
        resetCancel();
        const value = parseAmount(amountBuffer);
        if (value == null || value <= 0) return;

        AppAPI.addDiscount(value, percentMode);
        clearInputState(true);
    }

    function cancel() {
        quantityBuffer = "";
        amountBuffer = "";
        activeInput = "quantity";
        percentMode = false;
        renderSelected(false);

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
        if (/^[0-9]$/.test(key) || key === ",") {
            appendKey(key);
            return;
        }

        if (key === "X") {
            multiply();
            return;
        }

        if (key === "OK") {
            confirm();
            return;
        }

        if (key === "%") {
            resetCancel();
            activeInput = "amount";
            amountBuffer = "";
            percentMode = true;
            renderSelected(true);
        }
    }

    function bindKeypad() {
        document.getElementById("quantityBox").addEventListener("click", () => selectInput("quantity"));
        document.getElementById("amountBox").addEventListener("click", () => selectInput("amount"));

        document.querySelectorAll("#keypad .key").forEach(button => {
            button.addEventListener("click", () => {
                handleKey(button.dataset.key || button.textContent.trim());
            });
        });
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

    function hideProgress() {
        const popup = document.getElementById("progressPopup");
        if (!popup) return;
        popup.classList.remove("show", "error");
    }

    function bindActions() {
        document.getElementById("articleSearch").addEventListener("input", event => {
            renderListArticles(event.target.value);
        });

        document.getElementById("deleteItem").addEventListener("click", () => {
            if (selectedIndex < 0) return;

            resetCancel();
            const state = AppAPI.getPosState();
            const removedIndex = selectedIndex;

            if (state.items.length <= 1) {
                selectedIndex = -1;
            } else if (removedIndex >= state.items.length - 1) {
                selectedIndex = removedIndex - 1;
            }

            AppAPI.removeItem(removedIndex);
            clearInputState(true);
        });

        document.getElementById("discountItem").addEventListener("click", discount);
        document.getElementById("cancelSale").addEventListener("click", cancel);

        document.getElementById("cashPayment").addEventListener("click", () => {
            resetCancel();
            AppAPI.pay("CA").catch(() => {});
        });

        document.getElementById("cardPayment").addEventListener("click", () => {
            resetCancel();
            AppAPI.pay("CC").catch(() => {});
        });

        document.getElementById("openConfig").addEventListener("click", () => Router.open("config"));
        document.getElementById("openSummary").addEventListener("click", () => Router.open("riepilogo"));
    }

    async function audit(root) {
        const ids = [
            "reparti",
            "articoliBottoni",
            "articoliListaPanel",
            "articleSearch",
            "articoliLista",
            "carrello",
            "articleCount",
            "totalValue",
            "quantityBox",
            "quantityDisplay",
            "amountBox",
            "selectedPrice",
            "keypad",
            "deleteItem",
            "discountItem",
            "cancelSale",
            "openConfig",
            "openSummary",
            "cashPayment",
            "cardPayment",
            "progressPopup"
        ];

        const missing = ids.filter(id => !root.querySelector("#" + id));
        if (missing.length) throw new Error("Elementi DOM mancanti: " + missing.join(", "));

        return { ok: true, elements: ids.length };
    }

    async function mount() {
        lastItemCount = AppAPI.getPosState().items.length;
        selectedIndex = lastItemCount ? lastItemCount - 1 : -1;
        clearInputState(true);

        renderReparti();
        renderCart();
        bindKeypad();
        bindActions();

        unsubscribers.push(AppAPI.on("pos:change", renderCart));
        unsubscribers.push(AppAPI.on("pos:payment:empty", () => alert("Nessun articolo inserito")));
        unsubscribers.push(AppAPI.on("barcode:notfound", detail => alert("Barcode non trovato: " + detail.code)));
        unsubscribers.push(AppAPI.on("pos:payment:start", () => showProgress("Preparazione scontrino...", 10)));
        unsubscribers.push(AppAPI.on("pos:fiscal:start", () => showProgress("Collegamento al cassetto fiscale...", 30)));
        unsubscribers.push(AppAPI.on("pos:fiscal:end", () => showProgress("Documento registrato...", 60)));
        unsubscribers.push(AppAPI.on("pos:print:start", () => showProgress("Stampa in corso...", 80)));
        unsubscribers.push(AppAPI.on("pos:print:end", () => showProgress("Operazione completata", 100)));
        unsubscribers.push(AppAPI.on("pos:print:error", detail => showProgress("Vendita registrata. Errore stampa: " + detail.message, 100, true)));
        unsubscribers.push(AppAPI.on("pos:payment:end", detail => {
            if (!detail.printError) setTimeout(hideProgress, 500);
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
