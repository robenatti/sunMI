// Desktop-only adapter loaded by NW.js before the original index.html scripts.
// Original Android files (including interfaceKotlin.js) remain unchanged.
(function () {
    'use strict';

    var fs = require('fs');
    var os = require('os');
    var path = require('path');
    var crypto = require('crypto');
    var child = require('child_process');

    function command(file, args) {
        try {
            return String(child.execFileSync(file, args, {
                encoding: 'utf8',
                timeout: 5000,
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'ignore']
            }) || '').trim();
        } catch (e) {
            return '';
        }
    }

    function validHardware(value) {
        var s = String(value || '').trim();
        return s &&
            !/^(0+|f+|unknown|none|null|default string|to be filled by o\.e\.m\.)$/i.test(s.replace(/[-{}\s]/g, '')) &&
            !/^0{8}-0{4}-0{4}-0{4}-0{12}$/i.test(s) &&
            !/^f{8}-f{4}-f{4}-f{4}-f{12}$/i.test(s) &&
            s.length >= 8 ? s : '';
    }

    function hardwareIdentifier() {
        var value = '';
        if (process.platform === 'win32') {
            value = command('powershell.exe', [
                '-NoProfile', '-NonInteractive', '-Command',
                '(Get-CimInstance Win32_ComputerSystemProduct -ErrorAction Stop).UUID'
            ]);
            value = validHardware(value);
            if (!value) {
                var result = command('reg.exe', [
                    'query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'
                ]);
                var match = result.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i);
                value = match ? validHardware(match[1]) : '';
            }
        } else if (process.platform === 'darwin') {
            var mac = command('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice']);
            var macMatch = mac.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
            value = macMatch ? validHardware(macMatch[1]) : '';
        } else if (process.platform === 'linux') {
            try { value = validHardware(fs.readFileSync('/etc/machine-id', 'utf8')); } catch (e) {}
            if (!value) {
                try { value = validHardware(fs.readFileSync('/var/lib/dbus/machine-id', 'utf8')); } catch (e) {}
            }
        }
        return value;
    }

    function deviceId() {
        var dataDir = (typeof nw !== 'undefined' && nw.App && nw.App.dataPath)
            ? nw.App.dataPath
            : path.join(os.homedir(), '.solx-pos-desktop');
        fs.mkdirSync(dataDir, { recursive: true });
        var file = path.join(dataDir, 'desktop-device-id.txt');
        try {
            var existing = String(fs.readFileSync(file, 'utf8')).trim();
            if (/^pc-[a-f0-9]{32}$/i.test(existing)) {
                var normalized = existing.toLowerCase();
                if (existing !== normalized) fs.writeFileSync(file, normalized + '\n', { mode: 0o600 });
                return normalized;
            }
        } catch (e) {}

        var hardware = hardwareIdentifier();
        var id = hardware
            ? 'pc-' + crypto.createHash('sha256').update('solx-pos-desktop/v1|' + hardware.toLowerCase()).digest('hex').slice(0, 32)
            : 'pc-' + crypto.randomBytes(16).toString('hex');
        // Persist the assigned ID so it remains stable across app updates.
        fs.writeFileSync(file, id + '\n', { flag: 'w', mode: 0o600 });
        return id;
    }

    var id = deviceId();

    // Chromium can reject fetch() for file:// pages: load bundled views locally.
    var originalFetch = window.fetch.bind(window);
    window.fetch = function (resource, options) {
        if (typeof resource === 'string' &&
            /^views\/(cassa|config|riepilogo)\/[a-zA-Z0-9._-]+\.(html|css)$/.test(resource)) {
            return fs.promises.readFile(path.join(nw.App.startPath, resource)).then(function (contents) {
                return new Response(contents, {
                    status: 200,
                    headers: { 'Content-Type': resource.endsWith('.css') ? 'text/css' : 'text/html' }
                });
            }).catch(function () {
                return new Response('File non trovato: ' + resource, { status: 404 });
            });
        }
        return originalFetch(resource, options);
    };

    // Same asynchronous request/response contract as the Android native bridge.
    // No fake print success: unsupported hardware operations return an error.
    window.Android = {
        exec: function (json) {
            var request = JSON.parse(json);
            var response = { id: request.id, success: false };
            if (request.action === 'hardware_status') {
                response.success = true;
                response.data = {
                    mock: true,
                    androidBridge: false,
                    printerService: false,
                    printerDriver: false,
                    manufacturer: process.platform.toUpperCase(),
                    model: os.hostname(),
                    deviceId: id
                };
            } else if (request.action === 'pdf_exists') {
                response.success = true;
                response.data = {
                    fileName: request.payload && request.payload.fileName || '',
                    exists: false
                };
            } else {
                response.error = {
                    message: 'Funzione nativa non disponibile su NW.js: ' + request.action,
                    code: 'DESKTOP_NATIVE_UNAVAILABLE'
                };
            }
            setTimeout(function () {
                if (typeof window.onNativeResponse === 'function') {
                    window.onNativeResponse(JSON.stringify(response));
                }
            }, 0);
        }
    };
})();
