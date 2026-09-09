// Copyright AltraConsulenza Snc
// Lettore barcode HID / emulazione tastiera.

const Barcode = (() => {
    let buffer = ""
    let lastKeyAt = 0
    let timer = null
    let started = false

    function isEditableTarget(target) {
        if (!target) return false
        const tag = String(target.tagName || "").toLowerCase()
        return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable
    }

    function reset() {
        buffer = ""
        lastKeyAt = 0
        if (timer) {
            clearTimeout(timer)
            timer = null
        }
    }

    function onKeyDown(event) {
        if (Router.getCurrent() !== "cassa") return
        if (isEditableTarget(event.target)) return

        const now = Date.now()

        if (event.key === "Enter") {
            if (buffer.length >= 4) {
                event.preventDefault()
                const code = buffer
                reset()
                AppAPI.scanBarcode(code)
            } else {
                reset()
            }
            return
        }

        if (event.key.length !== 1) return

        if (lastKeyAt && now - lastKeyAt > 120) {
            buffer = ""
        }

        buffer += event.key
        lastKeyAt = now

        if (timer) clearTimeout(timer)
        timer = setTimeout(reset, 250)
    }

    function start() {
        if (started) return
        started = true
        document.addEventListener("keydown", onKeyDown, true)
    }

    return { start }
})()
