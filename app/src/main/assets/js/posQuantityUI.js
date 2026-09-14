// Copyright AltraConsulenza Snc
// Estensione UI quantità/importo. La view continua a usare solo AppAPI.

AppAPI.setItemValues = function (index, quantity, price) {
    POS.setItemValues(index, quantity, price);
};

const PosQuantityUI = (() => {
    let activeInput = "quantity";
    let quantityBuffer = "";
    let amountBuffer = "";
    let percentMode = false;
    let cancelCount = 0;
    let cancelTimer = null;

    function money(value) {
        return Number(value || 0).toLocaleString("it-IT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + " €";
    }

    function moneyCompact(value) {
        return Number(value || 0).toLocaleString("it-IT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function selectedIndex() {
        return Array.from(document.querySelectorAll("#carrello .cart-row"))
            .findIndex(row => row.classList.contains("selected"));
    }

    function selectedItem() {
        const index = selectedIndex();
        const state = AppAPI.getPosState();
        return index >= 0 ? state.items[index] : null;
    }

    function parse(value) {
        if (!value) return null;
        const n = Number(String(value).replace(",", "."));
        return Number.isFinite(n) ? n : null;
    }

    function resetCancel() {
        cancelCount = 0;
        if (cancelTimer) clearTimeout(cancelTimer);
        cancelTimer = null;
        const counter = document.getElementById("cancelCount");
        if (counter) counter.textContent = "";
    }

    function clearBuffers(showCurrent) {
        quantityBuffer = "";
        amountBuffer = "";
        percentMode = false;
        activeInput = "quantity";
        renderDisplays(showCurrent !== false);
    }

    function renderDisplays(showCurrent) {
        const quantity = document.getElementById("quantityDisplay");
        const amount = document.getElementById("selectedPrice");
        const quantityBox = document.getElementById("quantityBox");
        const amountBox = document.getElementById("amountBox");
        if (!quantity || !amount) return;

        const item = selectedItem();
        const q = item ? Number(item.quantita || 1) : 0;
        const p = item ? Number(item.prezzo || 0) : 0;

        quantity.textContent = quantityBuffer || (showCurrent ? String(q) : "0");
        amount.textContent = amountBuffer
            ? amountBuffer + (percentMode ? " %" : " €")
            : (showCurrent ? money(p) : "0,00 €");

        if (quantityBox) quantityBox.classList.toggle("active", activeInput === "quantity");
        if (amountBox) amountBox.classList.toggle("active", activeInput === "amount");
    }

    function enhanceCart() {
        const state = AppAPI.getPosState();
        const rows = document.querySelectorAll("#carrello .cart-row");

        rows.forEach((row, index) => {
            const item = state.items[index];
            if (!item) return;

            const q = Number(item.quantita || 1);
            const unitPrice = Number(item.prezzo || 0);

            row.innerHTML = "";
            row.style.display = "grid";
            row.style.gridTemplateColumns = "minmax(0, 1fr) auto minmax(5.5rem, 1fr)";
            row.style.columnGap = "0.65rem";

            const name = document.createElement("span");
            name.textContent = item.nome;
            name.style.minWidth = "0";
            name.style.overflow = "hidden";
            name.style.textOverflow = "ellipsis";
            name.style.whiteSpace = "nowrap";
            name.style.textAlign = "left";
            row.appendChild(name);

            if (q > 1) {
                const calculation = document.createElement("span");
                calculation.textContent = q + " × " + moneyCompact(unitPrice);
                calculation.style.gridColumn = "2";
                calculation.style.justifySelf = "center";
                calculation.style.fontSize = "0.72rem";
                calculation.style.opacity = "0.7";
                calculation.style.whiteSpace = "nowrap";
                row.appendChild(calculation);
            }

            const total = document.createElement("span");
            total.textContent = money(unitPrice * q);
            total.style.gridColumn = "3";
            total.style.justifySelf = "end";
            total.style.fontWeight = "600";
            total.style.whiteSpace = "nowrap";
            row.appendChild(total);
        });

        const count = state.items
            .filter(item => !item.sconto)
            .reduce((sum, item) => sum + Number(item.quantita || 1), 0);
        const countBox = document.getElementById("articleCount");
        if (countBox) countBox.textContent = String(count);
    }

    function selectInput(name) {
        resetCancel();
        activeInput = name;
        if (name === "quantity") quantityBuffer = "";
        if (name === "amount") amountBuffer = "";
        renderDisplays(true);
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

        renderDisplays(true);
    }

    function multiply() {
        resetCancel();
        const item = selectedItem();
        if (!item) return;

        const q = quantityBuffer ? Math.floor(Number(quantityBuffer)) : Number(item.quantita || 1);
        if (!Number.isFinite(q) || q <= 0) return;

        activeInput = "amount";
        amountBuffer = "";
        renderDisplays(true);
    }

    function confirm() {
        resetCancel();
        const index = selectedIndex();
        const item = selectedItem();
        if (index < 0 || !item) return;

        const q = quantityBuffer ? Math.floor(Number(quantityBuffer)) : Number(item.quantita || 1);
        const p = amountBuffer ? parse(amountBuffer) : Number(item.prezzo || 0);
        if (!Number.isFinite(q) || q <= 0 || p == null) return;

        AppAPI.setItemValues(index, q, p);
        clearBuffers(true);
    }

    function discount() {
        resetCancel();
        const value = parse(amountBuffer);
        if (value == null || value <= 0) return;
        AppAPI.addDiscount(value, percentMode);
        clearBuffers(true);
    }

    function cancel() {
        quantityBuffer = "";
        amountBuffer = "";
        percentMode = false;
        activeInput = "quantity";
        renderDisplays(false);

        cancelCount++;
        const counter = document.getElementById("cancelCount");
        if (counter && cancelCount < 3) counter.textContent = cancelCount + "/3";

        if (cancelTimer) clearTimeout(cancelTimer);
        if (cancelCount >= 3) {
            resetCancel();
            AppAPI.resetPos();
            return;
        }
        cancelTimer = setTimeout(resetCancel, 2500);
    }

    function capture(event) {
        const target = event.target.closest("button");
        if (!target || !document.getElementById("keypad")) return;

        if (target.id === "quantityBox") {
            event.stopImmediatePropagation();
            selectInput("quantity");
            return;
        }
        if (target.id === "amountBox") {
            event.stopImmediatePropagation();
            selectInput("amount");
            return;
        }
        if (target.id === "cancelSale") {
            event.stopImmediatePropagation();
            cancel();
            return;
        }
        if (target.id === "discountItem") {
            event.stopImmediatePropagation();
            discount();
            return;
        }

        if (!target.classList.contains("key")) return;
        event.stopImmediatePropagation();
        const key = target.dataset.key || target.textContent.trim();

        if (/^[0-9]$/.test(key) || key === ",") appendKey(key);
        else if (key === "X") multiply();
        else if (key === "OK") confirm();
        else if (key === "%") {
            resetCancel();
            activeInput = "amount";
            percentMode = true;
            amountBuffer = "";
            renderDisplays(true);
        }
    }

    document.addEventListener("click", capture, true);
    document.addEventListener("click", event => {
        if (event.target.closest("#carrello .cart-row")) {
            setTimeout(() => {
                resetCancel();
                clearBuffers(true);
                enhanceCart();
            }, 0);
        }
    });

    AppAPI.on("pos:change", () => {
        setTimeout(() => {
            enhanceCart();
            clearBuffers(true);
        }, 0);
    });

    return { enhanceCart: enhanceCart };
})();
