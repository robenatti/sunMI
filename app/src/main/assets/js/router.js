// Copyright AltraConsulenza Snc
// Router leggero: ricarica l'HTML della view senza ricaricare il contesto applicativo.

window.AppViews = window.AppViews || {}

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
    }

    const loadedScripts = new Set()
    let current = null

    function loadScript(path) {
        if (loadedScripts.has(path)) return Promise.resolve()

        return new Promise((resolve, reject) => {
            const script = document.createElement("script")
            script.src = path
            script.onload = () => {
                loadedScripts.add(path)
                resolve()
            }
            script.onerror = () => reject(new Error("Impossibile caricare " + path))
            document.body.appendChild(script)
        })
    }

    async function open(name) {
        const route = routes[name]
        if (!route) throw new Error("View non riconosciuta: " + name)

        if (current && AppViews[current] && typeof AppViews[current].unmount === "function") {
            AppViews[current].unmount()
        }

        const response = await fetch(route.html, { cache: "no-store" })
        if (!response.ok && response.status !== 0) {
            throw new Error("Impossibile caricare " + route.html)
        }

        const html = await response.text()
        document.getElementById("appView").innerHTML = html

        const style = document.getElementById("viewStyle")
        style.href = route.style

        await loadScript(route.script)

        current = name

        if (AppViews[name] && typeof AppViews[name].mount === "function") {
            await AppViews[name].mount(document.getElementById("appView"))
        }
    }

    function getCurrent() {
        return current
    }

    return {
        open,
        getCurrent
    }
})()
