package com.waitero.app.printer

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "WaiteroPrinter")
public class WaiteroPrinterPlugin : Plugin() {
    private val formatter = PrinterFormatter()
    private var sunmiPrinterManager: SunmiPrinterManager? = null

    @PluginMethod
    public fun printKitchenOrder(call: PluginCall) {
        val order = call.getObject("order") ?: call.data
        if (order == null) {
            call.resolve(result(false, "Payload ordine mancante"))
            return
        }

        val formatted = formatter.formatKitchenOrder(order)
        if (!formatted.success || formatted.ticket == null) {
            call.resolve(result(false, formatted.error ?: "Payload ordine non valido"))
            return
        }

        execute {
            try {
                val manager = sunmiPrinterManager ?: SunmiPrinterManager(context.applicationContext).also {
                    sunmiPrinterManager = it
                }

                val printResult = manager.printText(formatted.ticket)
                call.resolve(result(printResult.success, printResult.error))
            } catch (exception: Exception) {
                call.resolve(result(false, "Errore inizializzazione stampa SUNMI: ${exception.message ?: "errore sconosciuto"}"))
            }
        }
    }

    private fun result(success: Boolean, error: String?): JSObject {
        val response = JSObject()
        response.put("success", success)
        if (!success && !error.isNullOrBlank()) {
            response.put("error", error)
        }
        return response
    }
}
