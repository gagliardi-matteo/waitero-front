package com.waitero.app.printer

import android.content.Context
import android.os.RemoteException
import android.util.Log
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterException
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.InnerResultCallback
import com.sunmi.peripheral.printer.SunmiPrinterService
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

class SunmiPrinterManager(private val context: Context) {
    private val appContext = context.applicationContext
    private val printerService = AtomicReference<SunmiPrinterService?>()

    fun printText(ticket: String): PrinterOperationResult {
        if (ticket.isBlank()) {
            return PrinterOperationResult.failure("Ticket vuoto")
        }

        val serviceResult = requirePrinterService()
        if (!serviceResult.success || serviceResult.service == null) {
            return PrinterOperationResult.failure(serviceResult.error ?: "Stampante SUNMI non disponibile")
        }

        val service = serviceResult.service
        val availability = checkAvailability(service)
        if (!availability.success) {
            return availability
        }

        val initResult = runPrinterCommand("inizializzazione stampante") { callback ->
            service.printerInit(callback)
        }
        if (!initResult.success) {
            return initResult
        }

        val printResult = runPrinterCommand("stampa ticket") { callback ->
            service.printTextWithFont(ticket, "", 24f, callback)
        }
        if (!printResult.success) {
            return printResult
        }

        return runPrinterCommand("avanzamento carta") { callback ->
            service.lineWrap(4, callback)
        }
    }

    private fun requirePrinterService(): ServiceResult {
        printerService.get()?.let {
            return ServiceResult.success(it)
        }

        val latch = CountDownLatch(1)
        val error = AtomicReference<String?>()

        try {
            val bindStarted = InnerPrinterManager.getInstance().bindService(appContext, object : InnerPrinterCallback() {
                override fun onConnected(service: SunmiPrinterService) {
                    printerService.set(service)
                    latch.countDown()
                }

                override fun onDisconnected() {
                    printerService.set(null)
                }
            })
            if (!bindStarted) {
                return ServiceResult.failure("Binding servizio stampante SUNMI non avviato")
            }
        } catch (exception: InnerPrinterException) {
            Log.w(TAG, "SUNMI printer SDK unavailable", exception)
            return ServiceResult.failure("SUNMI Printer SDK non disponibile: ${exception.message ?: "errore sconosciuto"}")
        } catch (exception: RuntimeException) {
            Log.w(TAG, "SUNMI printer service bind failed", exception)
            return ServiceResult.failure("Impossibile collegarsi alla stampante SUNMI: ${exception.message ?: "errore sconosciuto"}")
        }

        val connected = latch.await(BIND_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        if (!connected) {
            return ServiceResult.failure("Timeout connessione stampante SUNMI")
        }

        val service = printerService.get()
        if (service == null) {
            return ServiceResult.failure(error.get() ?: "Stampante SUNMI non disponibile")
        }

        return ServiceResult.success(service)
    }

    private fun checkAvailability(service: SunmiPrinterService): PrinterOperationResult {
        return try {
            when (val state = service.updatePrinterState()) {
                1 -> PrinterOperationResult.success()
                2 -> PrinterOperationResult.failure("Stampante in preparazione")
                3 -> PrinterOperationResult.failure("Comunicazione stampante anomala")
                4 -> PrinterOperationResult.failure("Carta stampante esaurita")
                5 -> PrinterOperationResult.failure("Stampante surriscaldata")
                6 -> PrinterOperationResult.failure("Coperchio stampante aperto")
                7 -> PrinterOperationResult.failure("Taglierina stampante anomala")
                8 -> PrinterOperationResult.failure("Taglierina stampante in ripristino")
                9 -> PrinterOperationResult.failure("Black mark non rilevato")
                505 -> PrinterOperationResult.failure("Stampante SUNMI non rilevata")
                else -> PrinterOperationResult.failure("Stato stampante non disponibile: $state")
            }
        } catch (exception: RemoteException) {
            printerService.set(null)
            PrinterOperationResult.failure("Errore comunicazione stampante: ${exception.message ?: "servizio remoto non disponibile"}")
        } catch (exception: RuntimeException) {
            PrinterOperationResult.failure("Errore controllo stampante: ${exception.message ?: "errore sconosciuto"}")
        }
    }

    private fun runPrinterCommand(
        operationName: String,
        command: (InnerResultCallback) -> Unit
    ): PrinterOperationResult {
        val latch = CountDownLatch(1)
        val result = AtomicReference(PrinterOperationResult.success())

        val callback = object : InnerResultCallback() {
            override fun onRunResult(isSuccess: Boolean) {
                if (!isSuccess) {
                    result.set(PrinterOperationResult.failure("Operazione SUNMI non riuscita: $operationName"))
                }
                latch.countDown()
            }

            override fun onReturnString(resultValue: String?) {
                latch.countDown()
            }

            override fun onRaiseException(code: Int, message: String?) {
                result.set(PrinterOperationResult.failure("Errore SUNMI $code durante $operationName: ${message ?: "errore sconosciuto"}"))
                latch.countDown()
            }

            override fun onPrintResult(code: Int, message: String?) {
                if (code != 0) {
                    result.set(PrinterOperationResult.failure("Stampa SUNMI fallita $code: ${message ?: "errore sconosciuto"}"))
                }
                latch.countDown()
            }
        }

        return try {
            command(callback)
            val completed = latch.await(PRINT_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            if (!completed) {
                PrinterOperationResult.failure("Timeout durante $operationName")
            } else {
                result.get()
            }
        } catch (exception: RemoteException) {
            printerService.set(null)
            PrinterOperationResult.failure("Errore remoto durante $operationName: ${exception.message ?: "servizio stampante non disponibile"}")
        } catch (exception: RuntimeException) {
            PrinterOperationResult.failure("Errore durante $operationName: ${exception.message ?: "errore sconosciuto"}")
        }
    }

    data class PrinterOperationResult(
        val success: Boolean,
        val error: String?
    ) {
        companion object {
            fun success(): PrinterOperationResult = PrinterOperationResult(true, null)
            fun failure(error: String): PrinterOperationResult = PrinterOperationResult(false, error)
        }
    }

    private data class ServiceResult(
        val success: Boolean,
        val service: SunmiPrinterService?,
        val error: String?
    ) {
        companion object {
            fun success(service: SunmiPrinterService): ServiceResult = ServiceResult(true, service, null)
            fun failure(error: String): ServiceResult = ServiceResult(false, null, error)
        }
    }

    companion object {
        private const val TAG = "WaiteroSunmiPrinter"
        private const val BIND_TIMEOUT_MS = 2500L
        private const val PRINT_TIMEOUT_MS = 8000L
    }
}
