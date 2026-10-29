/* 
Copyright AltraConsulenza Snc
Generato: 26/02/2026 16:42 (Europe/Rome)
inizio file protocollo17-nexi.js
*/

const TerminalePOS = (function () {

    var log = function (l1, l2, l3) {
        //console.log(l1||"", l2||"", l3||"")
    }

    var net;
    var fs;
    try {
        net = typeof require === "function" ? require("net") : window.AndroidNet;
        fs = typeof require === "function" ? require("fs") : null;
    } catch (e) { }

    let CFG = null;
    let DEFAULT_PAY = "X";

    // =========================
    // DEBUG CONFIG
    // =========================
    let DEBUG_ENABLED = false;
    let DEBUG_FILE = "pos_debug.log";
    let DEBUG_INTERVAL = 1000;
    let DEBUG_QUEUE_LIMIT = 1000;

    function setDebug(enabled, options) {
        DEBUG_ENABLED = !!enabled;

        if (options) {
            if (options.file) DEBUG_FILE = options.file;
            if (options.interval) DEBUG_INTERVAL = parseInt(options.interval, 10);
            if (options.queueLimit) DEBUG_QUEUE_LIMIT = parseInt(options.queueLimit, 10);
        }
    }

    // =========================
    // Utility
    // =========================
    function calcLRC(buf, start, end) {
        let x = 0x7F;
        for (let i = start; i < end; i++) x ^= buf[i];
        return x & 0x7F;
    }

    function buildFrame(payload) {
        const p = Buffer.from(payload, "ascii");
        const f = Buffer.alloc(p.length + 3);
        f[0] = 0x02;
        p.copy(f, 1);
        f[p.length + 1] = 0x03;
        f[p.length + 2] = calcLRC(f, 0, p.length + 2);
        return f;
    }

    function parseFrame(buf) {
        if (buf[0] !== 0x02) return null;
        const etx = buf.indexOf(0x03);
        if (etx < 0) return null;
        if (buf.length < etx + 2) return null;
        const lrc = buf[etx + 1];
        if (lrc !== calcLRC(buf, 0, etx + 1)) return null;
        return buf.slice(1, etx).toString("ascii");
    }

    function ack() {
        const b = Buffer.from([0x06, 0x03, 0x00]);
        b[2] = calcLRC(b, 0, 2);
        return b;
    }

    function parseNexi17PaymentPayload(amount, payload) {

        if (!payload || payload.length < 71) return null;

        var messageCode = payload.substr(9, 1);
        if (messageCode !== 'E' && messageCode !== 'V')
            return null;

        var result = payload.substr(10, 2);
        var hostRaw = payload.substr(40, 7);

        var hostDate = "";
        var hostTime = "";
        var hostDateTimeISO = "";

        if (hostRaw.length === 7) {
            var ddd = parseInt(hostRaw.substr(0, 3), 10);
            var hh = parseInt(hostRaw.substr(3, 2), 10);
            var mm = parseInt(hostRaw.substr(5, 2), 10);

            if (!isNaN(ddd) && !isNaN(hh) && !isNaN(mm)) {
                var now = new Date();
                var year = now.getFullYear();
                var base = new Date(year, 0, 1);
                base.setDate(base.getDate() + ddd - 1);
                base.setHours(hh);
                base.setMinutes(mm);
                base.setSeconds(0);
                base.setMilliseconds(0);

                var day = base.getDate();
                var month = base.getMonth() + 1;

                hostDate =
                    (day < 10 ? "0" + day : day) + "/" +
                    (month < 10 ? "0" + month : month) + "/" +
                    year;

                hostTime =
                    (hh < 10 ? "0" + hh : hh) + ":" +
                    (mm < 10 ? "0" + mm : mm);

                hostDateTimeISO =
                    year + "-" +
                    (month < 10 ? "0" + month : month) + "-" +
                    (day < 10 ? "0" + day : day) + "T" +
                    hostTime + ":00";
            }
        }

        var panQ = payload.substr(12, 19).replace(/^0+/, "");
        var pan = ""
        if (panQ.length > 4)
            pan = "*".repeat(panQ.length - 4) + panQ.slice(-4)
        else
            pan = "****"

        var out = {
            terminalId: payload.substr(0, 8),
            messageCode: messageCode,
            result: result,
            success: result === "00",
            amount: amount,
            pan: pan,
            transactionType: payload.substr(31, 3),
            authCode: payload.substr(34, 6),
            hostRaw: hostRaw,
            hostDate: hostDate,
            hostTime: hostTime,
            hostDateTimeISO: hostDateTimeISO,
            cardType: payload.substr(47, 1),
            acquirerId: payload.substr(48, 11),
            stan: payload.substr(59, 6),
            idOnline: payload.substr(65, 6),

            // extended section
            extended: false,
            rrn: null,
            aid: null,
            tvr: null,
            tsi: null,
            applicationLabel: null
        };

        // =========================
        // EXTENDED PART
        // =========================
        if (payload.length > 71) {

            var ext = payload.substr(71);

            out.extended = true;

            if (ext.length >= 12)
                out.rrn = ext.substr(0, 12).trim();

            if (ext.length >= 28)
                out.aid = ext.substr(12, 16).trim();

            if (ext.length >= 38)
                out.tvr = ext.substr(28, 10).trim();

            if (ext.length >= 42)
                out.tsi = ext.substr(38, 4).trim();

            if (ext.length >= 58)
                out.applicationLabel = ext.substr(42, 16).trim();
        }

        return out;
    }

    function parseTotalsPayloadT(payload) {
        if (!payload || payload.length < 29) return null;

        var messageCode = payload.substr(9, 1);
        if (messageCode !== "T") return null;

        var result = payload.substr(10, 2);

        var out = {
            terminalId: payload.substr(0, 8),
            messageCode: messageCode,
            result: result,
            eftTotal: null,
            errorDescription: null
        };

        if (result === "00") {

            var eftRaw = payload.substr(12, 16);
            out.eftTotal = (parseInt(eftRaw, 10) || 0) / 100;

        } else if (result === "01") {

            // Specifica T non dettagliata per KO → restituiamo payload grezzo post header
            out.errorDescription = payload.substr(12).trim();
        }

        return out;
    }


    function parseClosePayloadC(payload) {

        if (!payload || payload.length < 12) return null;

        var messageCode = payload.substr(9, 1);
        if (messageCode !== "C") return null;

        var result = payload.substr(10, 2);

        var out = {
            terminalId: payload.substr(0, 8),
            messageCode: messageCode,
            result: result,
            eftTotal: null,
            hostTotal: null,
            errorDescription: null,
            actionCode: null
        };

        if (result === "00") {

            if (payload.length < 44) return null;

            var eftRaw = payload.substr(12, 16);
            var hostRaw = payload.substr(28, 16);

            out.eftTotal = (parseInt(eftRaw, 10) || 0) / 100;
            out.hostTotal = (parseInt(hostRaw, 10) || 0) / 100;

        } else if (result === "01") {

            if (payload.length < 44) return null;

            out.errorDescription = payload.substr(12, 19).replace(/\s+$/, "");
            out.actionCode = payload.substr(31, 3);
        }

        return out;
    }
    // =========================
    // Status Check
    // =========================
    var timeOUT = 60000;
    var margin = 5000;
    var isAlive = false;
    var deadWhen = 0;

    function setAlive(cb) {
        if (deadWhen) clearTimeout(deadWhen);
        deadWhen = setTimeout(function () { isAlive = false; }, timeOUT);
        isAlive = true;
    }

    function resetAlive() {
        if (deadWhen) clearTimeout(deadWhen);
        isAlive = false;
    }

    function delayedAlive() {
        if (deadWhen) clearTimeout(deadWhen);
        deadWhen = setTimeout(function () { isAlive = false; }, 2000);
    }

    // =========================
    // Core TCP exchange
    // =========================
    function exchange(frame, cb, ackOnly) {

        if (isAlive) return cb(false, "STILL_ALIVE");

        const sock = new net.Socket();
        let rx = Buffer.alloc(0);
        let done = false;
        let doneBack = false;

        let debugQueue = [];
        let debugTimer = null;
        let debugStart = null;

        function debugPush(type, buffer, note) {
            if (!DEBUG_ENABLED) return;
            if (!debugStart) debugStart = process.hrtime.bigint();

            let now = process.hrtime.bigint();
            let deltaMs = Number(now - debugStart) / 1000000;

            let entry = {
                t: deltaMs.toFixed(3),
                ev: type,
                len: buffer ? buffer.length : 0,
                txt: buffer ? buffer.toString("ascii") : "",
                hex: buffer ? buffer.toString("hex") : "",
                note: note || ""
            };

            debugQueue.push(entry);

            if (debugQueue.length > DEBUG_QUEUE_LIMIT)
                debugQueue.shift();
        }

        function flushDebug(sync) {
            if (!DEBUG_ENABLED || !debugQueue.length) return;

            let lines = debugQueue.map(e =>
                `[${e.t}ms] ${e.ev} len=${e.len} ${e.note} txt=${e.txt} hex=${e.hex}`
            ).join("\n") + "\n";

            debugQueue = [];

            //console.log(lines)

            try {
                if (!fs) { console.debug(lines); return; }
                if (sync) {
                    fs.appendFileSync(DEBUG_FILE, lines);
                } else {
                    fs.appendFile(DEBUG_FILE, lines, function () { });
                }
            } catch (e) { }
        }

        if (DEBUG_ENABLED) {
            debugTimer = setInterval(function () {
                flushDebug(false);
            }, DEBUG_INTERVAL);
        }

        function finish(ok, payload, graceful) {
            debugPush("FINISH", null, ok ? "OK" : "KO");
            if (debugTimer) clearInterval(debugTimer);
            flushDebug(true);

            delayedAlive();
            if (done) return;
            if (!graceful || ackOnly) {
                try { sock.end(); } catch (e) { }
            }
            done = true;

            function goBackHome() {
                if (doneBack) return;
                doneBack = true;
                cb(ok, payload);
            }

            setTimeout(goBackHome, 200);
        }

        sock.setTimeout(timeOUT + margin);

        sock.on("timeout", function () {
            debugPush("TIMEOUT");
            finish(false, "TIMEOUT", false);
        });

        sock.on("error", function () {
            debugPush("SOCKET_ERROR");
            finish(false, "SOCKET_ERROR", false);
        });

        sock.on("data", d => {

            debugPush("DATA", d);

            if (done) return;
            rx = Buffer.concat([rx, d]);

            while (!done && rx.length > 0) {

                const b0 = rx[0];

                if (b0 === 0x01) {
                    const eot = rx.indexOf(0x04);
                    if (eot < 0) break;
                    debugPush("SOH_PROGRESS");
                    rx = rx.slice(eot + 1);
                    continue;
                }

                if (b0 === 0x06 || b0 === 0x15) {
                    if (rx.length < 3) break;
                    debugPush("ACK_OR_NAK", rx.slice(0, 3));
                    rx = rx.slice(3);
                    if (ackOnly)
                        return finish(b0 === 0x06, null, true);
                    continue;
                }

                if (b0 === 0x02) {
                    const etx = rx.indexOf(0x03);
                    if (etx < 0) break;
                    if (rx.length < etx + 2) break;

                    const frameBuf = rx.slice(0, etx + 2);
                    debugPush("STX_FRAME", frameBuf);

                    const payload = parseFrame(frameBuf);
                    rx = rx.slice(etx + 2);

                    if (!payload) {
                        finish(false, "LRC_FRAME", false);
                        return;
                    }

                    sock.write(ack(), () => {
                        setTimeout(function () {
                            try { sock.end(); } catch (e) { }
                        }, 600);
                    });

                    finish(true, payload, true);
                    return;
                }

                rx = rx.slice(1);
            }
        });

        debugPush("CONNECT");

        sock.connect(CFG.port, CFG.host, () => {
            debugPush("CONNECTED");
            setAlive();
            sock.write(frame);
            debugPush("WRITE", frame);
        });
    }

    function setupPOS(cfg) {

        if (!cfg) return false;

        // =========================
        // Config da file
        // =========================
        if (cfg.file) {

            try {

                const txt = fs.readFileSync(cfg.file, "utf8");

                const lines = txt
                    .split(/\r?\n/)
                    .map(l => l.trim())
                    .filter(l => l.length);

                const map = {};

                for (const line of lines) {

                    const p = line.indexOf("=");
                    if (p < 0) continue;

                    const k = line.substring(0, p).trim().toUpperCase();
                    const v = line.substring(p + 1).trim();

                    map[k] = v;
                }

                CFG = {
                    host: map["HOST"],
                    port: parseInt(map["PORT"], 10),
                    terminalId: map["TERMINALID"],
                    registerId: map["REGISTERID"]
                };

            } catch (e) {
                return false;
            }

        } else {

            if (!cfg.host || !cfg.port || !cfg.terminalId) return false;

            CFG = {
                host: cfg.host,
                port: parseInt(cfg.port, 10),
                terminalId: cfg.terminalId,
                registerId: cfg.registerId || "00000000"
            };
        }

        return CFG;
    }

    function checkPOS(cfg, cb, force) {
        if (cfg) setupPOS(cfg);
        if (!CFG.checkOnline) return cb(true, "SKIP_TEST");
        if (force) resetAlive();
        else if (isAlive) return cb(false, "STILL_ALIVE");

        const payload =
            CFG.terminalId.padStart(8, "0") +
            "0" +
            "s";

        exchange(buildFrame(payload), (ok, p) => {
            if (!ok) return cb(false, p);
            const status = p[30];
            cb(status === "2", status);
        });
    }

    function extendedPOS(cfg, amount, cb) {
        return payPOS(cfg, amount, cb, "X");
    }

    function refundPOS(cfg, stan, cb) {
        if (cfg) setupPOS(cfg);

        const payload =
            CFG.terminalId.padStart(8, "0") +
            "0" +
            "S" +
            CFG.registerId.padStart(8, "0") +
            String(stan || "000000").padStart(6, "0") +
            "0" +  // additional data message not present
            "0";   // reserved

        exchange(buildFrame(payload), (ok, p) => {
            if (!ok) return cb(false, "");
            const res = p.substr(10, 2);
            cb(res === "00", parseNexi17PaymentPayload("", p));

        });
    }

    function payPOS(cfg, amount, cb, type) {
        type = type || DEFAULT_PAY
        if (cfg) setupPOS(cfg);

        if (isAlive) {
            setTimeout(function () {
                if (isAlive) {
                    resetAlive();
                    return cb(false, "STILL_ALIVE");
                }
                payPOS(null, amount, cb, type);
            }, 3000);
            return;
        }

        const cents = Math.round(amount * 100);
        const fAmount = (type === "R" ? -amount : amount).toFixed(2);

        const payload =
            CFG.terminalId.padStart(8, "0") +
            "0" +
            (type) +
            CFG.registerId.padStart(8, "0") +
            "0" +
            "00" +
            "0" +
            "0" +
            String(cents).padStart(8, "0") +
            " ".repeat(128) +
            "00000000";

        exchange(buildFrame(payload), (ok, p) => {
            if (!ok) return cb(false, p || "SOCKET_ERROR");
            const res = p.substr(10, 2);
            cb(res === "00", parseNexi17PaymentPayload(fAmount, p) || { result: res });
        });
    }

    // =========================
    function checkLast(cfg, amount, cb) {

        if (cfg) setupPOS(cfg);

        const payload =
            CFG.terminalId.padStart(8, "0") +
            "0" +
            "G" +
            CFG.registerId.padStart(8, "0") +
            "0" +
            "000";

        exchange(buildFrame(payload), (ok, p) => {
            if (!ok) return cb(false, "");
            const res = p.substr(10, 2);
            cb(res === "00", parseNexi17PaymentPayload("", p));

        });
    }

    function rePrint(cfg, amount, cb) {

        if (cfg) setupPOS(cfg);

        const payload =
            CFG.terminalId.padStart(8, "0") +
            "0" +
            "R" +
            "0" +   // stampa su terminale
            "0" +   // ultimo ticket finanziario
            "0000000000";

        exchange(buildFrame(payload), (ok, p) => {
            if (!ok) return cb(false, "");
            cb(ok, "ACK_ONLY");

        }, true);
    }

    function getTotals(cfg, amount, cb) {

        if (cfg) setupPOS(cfg);

        const payload =
            CFG.terminalId.padStart(8, "0") +
            "0" +
            "T" +
            CFG.registerId.padStart(8, "0") +
            "0" +
            "0000000";

        exchange(buildFrame(payload), (ok, p) => {
            if (!ok) return cb(false, "");
            const res = p.substr(10, 2);
            cb(res === "00", parseTotalsPayloadT(p));

        });
    }

    function closeDay(cfg, amount, cb) {

        if (cfg) setupPOS(cfg);

        const payload =
            CFG.terminalId.padStart(8, "0") +
            "0" +
            "C" +
            CFG.registerId.padStart(8, "0") +
            "0" +
            "0000000";

        exchange(buildFrame(payload), (ok, p) => {
            if (!ok) return cb(false, "");
            const res = p.substr(10, 2);
            cb(res === "00", parseClosePayloadC(p));

        });
    }
    function getTIMEOUT() {
        return timeOUT;
    }

    return { setupPOS, checkPOS, payPOS, extendedPOS, refundPOS, checkLast, getTotals, rePrint, closeDay, getTIMEOUT, setDebug };

})();

/* fine file protocollo17-nexi.js */



if (typeof module !== "undefined" && module.exports) {
    module.exports = TerminalePOS;
}