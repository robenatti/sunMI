// Copyright AltraConsulenza Snc
// Compatibilita' net.Socket/Buffer per il trasporto TCP della WebView Android.
// La logica del Protocollo 17 resta nel modulo protocollo17-nexi.js.
(function () {
    "use strict";

    class AndroidBuffer extends Uint8Array {
        static from(data) {
            if (typeof data === "string") {
                const out = new AndroidBuffer(data.length);
                for (let i = 0; i < data.length; i++) out[i] = data.charCodeAt(i) & 255;
                return out;
            }
            return new AndroidBuffer(data);
        }
        static alloc(size) { return new AndroidBuffer(size); }
        static concat(parts) {
            const out = new AndroidBuffer(parts.reduce((n, x) => n + x.length, 0));
            let offset = 0;
            parts.forEach(x => { out.set(x, offset); offset += x.length; });
            return out;
        }
        copy(dest, offset) {
            const start = Number(offset || 0);
            const data = this.subarray(0, Math.max(0, dest.length - start));
            dest.set(data, start);
            return data.length;
        }
        toString(encoding) {
            if (encoding === "hex") return Array.from(this, b => b.toString(16).padStart(2, "0")).join("");
            return Array.from(this, b => String.fromCharCode(encoding === "ascii" ? b & 127 : b)).join("");
        }
    }
    if (typeof window.Buffer === "undefined") window.Buffer = AndroidBuffer;

    function encodeBase64(bytes) {
        let str = "";
        for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
        return btoa(str);
    }
    function decodeBase64(text) {
        const str = atob(text);
        const bytes = Buffer.alloc(str.length);
        for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
        return bytes;
    }

    const sockets = new Map();
    let nextId = 0;

    class Socket {
        constructor() {
            this.socketId = "tcp-" + Date.now() + "-" + (++nextId);
            this.listeners = new Map();
            this.connected = false;
            this.ended = false;
            this.readTimeoutMs = 65000;
            this.pending = [];
            sockets.set(this.socketId, this);
        }
        on(name, handler) {
            if (!this.listeners.has(name)) this.listeners.set(name, []);
            this.listeners.get(name).push(handler);
            return this;
        }
        emit(name, arg) {
            (this.listeners.get(name) || []).forEach(fn => {
                try { fn(arg); } catch (e) { console.error("TCP callback", e); }
            });
        }
        setTimeout(ms) {
            this.readTimeoutMs = Number(ms) || 65000;
            return this;
        }
        connect(port, host, callback) {
            if (typeof callback === "function") this.on("connect", callback);
            Bridge.exec("socket_connect", {
                socketId: this.socketId,
                host: String(host || ""),
                port: Number(port),
                readTimeoutMs: this.readTimeoutMs
            }, 15000).then(() => {
                if (this.ended) {
                    Bridge.exec("socket_close", {socketId: this.socketId}).catch(() => {});
                    return;
                }
                this.connected = true;
                this.emit("connect");
                this.pending.splice(0).forEach(e => this.accept(e));
            }).catch(error => {
                if (this.ended) return;
                this.ended = true;
                sockets.delete(this.socketId);
                this.emit("error", error);
            });
            return this;
        }
        write(data, callback) {
            if (this.ended) {
                this.emit("error", new Error("Socket chiuso"));
                return false;
            }
            Bridge.exec("socket_write", {
                socketId: this.socketId,
                dataBase64: encodeBase64(data)
            }, 15000).then(() => {
                if (typeof callback === "function") callback();
            }).catch(error => {
                if (!this.ended) this.emit("error", error);
            });
            return true;
        }
        end() {
            if (this.ended) return this;
            this.ended = true;
            sockets.delete(this.socketId);
            Bridge.exec("socket_close", {socketId: this.socketId}, 5000).catch(() => {});
            return this;
        }
        accept(event) {
            if (this.ended) return;
            if (!this.connected) {
                this.pending.push(event);
                return;
            }
            if (event.type === "data") this.emit("data", decodeBase64(event.dataBase64 || ""));
            else if (event.type === "timeout") this.emit("timeout");
            else if (event.type === "error" || event.type === "close") {
                this.ended = true;
                sockets.delete(this.socketId);
                this.emit("error", new Error(event.message || "Connessione TCP terminata"));
            }
        }
    }

    window.onNativeSocketEvent = function (raw) {
        try {
            const event = JSON.parse(raw);
            const socket = sockets.get(event.socketId);
            if (socket) socket.accept(event);
        } catch (e) {
            console.error("Evento TCP Android non valido", e);
        }
    };
    window.AndroidNet = {Socket};
})();
