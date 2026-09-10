// Copyright AltraConsulenza Snc
// Router leggero: ricarica l'HTML della view senza ricaricare il contesto applicativo.

window.AppViews = window.AppViews || {};

const Router = (() => {
    const routes = {
        cassa: {
            html: "views/cassa/cassa.html",
            script: "views/cassa/cassa.js",
            style: "views/cassa/cassa.css"
        },
        riepilogo: {
            html: "views/riepilogo/riepilogo.html",
            script: "views/riepilogo/riepilogo.js",
            style: "views/riepilogo/riepilogo.css"
        },
        config: {
            html: "views/config/config.html",
            script: "views/config/config.js",
            style: "views/config/config.css"
        }
    };

    const loadedScripts = new Set();
    let current = null;

    function loadScript(path) {
        if (loadedScripts.has(path)) return Promise.resolve();

        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = path;
            script.onload = () => {
                loadedScripts.add(path);
                resolve();
            };
            script.onerror = () => reject(new Error("Impossibile caricare " + path));
            document.body.appendChild(script);
        });
    }

    async function fetchText(path) {
        const response = await fetch(path, { cache: "no-store" });

        if (!response.ok && response.status !== 0) {
            throw new Error("Impossibile caricare " + path + " (HTTP " + response.status + ")");
        }

        return response.text();
    }

    async function open(name) {
        const route = routes[name];
        if (!route) throw new Error("View non riconosciuta: " + name);

        if (current && AppViews[current] && typeof AppViews[current].unmount === "function") {
            AppViews[current].unmount();
        }

        const html = await fetchText(route.html);
        document.getElementById("appView").innerHTML = html;

        const style = document.getElementById("viewStyle");
        style.href = route.style;

        await loadScript(route.script);

        current = name;

        if (AppViews[name] && typeof AppViews[name].mount === "function") {
            await AppViews[name].mount(document.getElementById("appView"));
        } else {
            throw new Error("mount() non disponibile per view " + name);
        }
    }

    async function auditView(name) {
        const route = routes[name];
        if (!route) throw new Error("View non riconosciuta: " + name);

        const html = await fetchText(route.html);
        const css = await fetchText(route.style);

        if (!html.trim()) throw new Error("HTML vuoto");
        if (!css.trim()) throw new Error("CSS vuoto");

        await loadScript(route.script);

        const module = AppViews[name];
        if (!module) throw new Error("Modulo JS non registrato");
        if (typeof module.mount !== "function") throw new Error("mount() mancante");
        if (typeof module.unmount !== "function") throw new Error("unmount() mancante");
        if (typeof module.audit !== "function") throw new Error("audit() mancante");

        const sandbox = document.createElement("div");
        sandbox.style.position = "fixed";
        sandbox.style.left = "-10000px";
        sandbox.style.top = "-10000px";
        sandbox.style.width = "1024px";
        sandbox.style.height = "768px";
        sandbox.innerHTML = html;
        document.body.appendChild(sandbox);

        try {
            const result = await module.audit(sandbox);
            return result || { ok: true };
        } finally {
            sandbox.remove();
        }
    }

    async function auditAll() {
        const results = [];

        for (const name of Object.keys(routes)) {
            try {
                const result = await auditView(name);
                results.push({
                    name: name,
                    ok: true,
                    result: result
                });
            } catch (error) {
                results.push({
                    name: name,
                    ok: false,
                    error: error && error.message ? error.message : String(error),
                    detail: error && error.stack ? error.stack : ""
                });
            }
        }

        return results;
    }

    function getCurrent() {
        return current;
    }

    return {
        open: open,
        auditView: auditView,
        auditAll: auditAll,
        getCurrent: getCurrent
    };
})();

window.onAndroidBack = function () {
    if (Router.getCurrent() && Router.getCurrent() !== "cassa") {
        Router.open("cassa").catch(error => {
            console.error("Errore navigazione Back Android", error);
        });
        return true;
    }

    return false;
};
