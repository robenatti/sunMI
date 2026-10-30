package it.altracassa.solx

import android.util.Base64
import java.net.InetSocketAddress
import java.net.Socket
import java.net.SocketTimeoutException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

class TcpSocketDriver(
    private val event: (String, String, String?, String?) -> Unit
) {
    private val sockets = ConcurrentHashMap<String, Socket>()
    private val workers = Executors.newCachedThreadPool()

    fun connect(id: String, host: String, port: Int, timeoutMs: Int, done: (String?) -> Unit) {
        workers.execute {
            val socket = Socket()
            var connected = false
            try {
                if (host.isBlank() || port !in 1..65535) throw IllegalArgumentException("Host/porta POS non validi")
                socket.connect(InetSocketAddress(host, port), 8000)
                socket.tcpNoDelay = true
                socket.soTimeout = timeoutMs.coerceIn(1000, 120000)
                sockets[id] = socket
                connected = true
                done(null)
                val input = socket.getInputStream()
                val buffer = ByteArray(8192)
                while (!socket.isClosed) {
                    val len = input.read(buffer)
                    if (len < 0) break
                    if (len > 0) event(id, "data", Base64.encodeToString(buffer, 0, len, Base64.NO_WRAP), null)
                }
                if (sockets[id] === socket) event(id, "close", null, "Terminale POS disconnesso")
            } catch (e: SocketTimeoutException) {
                if (connected) event(id, "timeout", null, "Timeout POS")
                else done(e.message ?: "Timeout connessione POS")
            } catch (e: Exception) {
                if (connected) {
                    if (sockets[id] === socket) event(id, "error", null, e.message ?: "Errore TCP")
                } else done(e.message ?: "Connessione POS non riuscita")
            } finally {
                sockets.remove(id, socket)
                try { socket.close() } catch (_: Exception) {}
            }
        }
    }

    fun write(id: String, dataBase64: String, done: (String?) -> Unit) {
        workers.execute {
            try {
                val socket = sockets[id] ?: throw IllegalStateException("Socket POS non connesso")
                val bytes = Base64.decode(dataBase64, Base64.DEFAULT)
                socket.getOutputStream().write(bytes)
                socket.getOutputStream().flush()
                done(null)
            } catch (e: Exception) {
                done(e.message ?: "Scrittura TCP fallita")
            }
        }
    }

    fun close(id: String) {
        val socket = sockets.remove(id) ?: return
        try { socket.close() } catch (_: Exception) {}
    }

    fun closeAll() {
        sockets.keys.toList().forEach { close(it) }
        workers.shutdownNow()
    }
}