package com.waitero.app.printer

import com.getcapacitor.JSObject
import org.json.JSONArray
import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class PrinterFormatter {
    private val separator = "========================"
    private val sectionSeparator = "------------------------"
    private val timeFormatter = SimpleDateFormat("HH:mm", Locale.ITALY)

    fun formatKitchenOrder(order: JSObject): FormatResult {
        val orderId = order.optLong("orderId", Long.MIN_VALUE)
        val tableName = order.optString("tableName", "").trim()
        val createdAt = order.optString("createdAt", "").trim()
        val items = order.optJSONArray("items")

        if (orderId == Long.MIN_VALUE || orderId <= 0) {
            return FormatResult.failure("orderId mancante o non valido")
        }
        if (tableName.isBlank()) {
            return FormatResult.failure("tableName mancante")
        }
        if (createdAt.isBlank()) {
            return FormatResult.failure("createdAt mancante")
        }
        if (items == null || items.length() == 0) {
            return FormatResult.failure("items mancanti")
        }

        val parsedItems = parseItems(items)
        if (parsedItems.isEmpty()) {
            return FormatResult.failure("nessuna riga ordine stampabile")
        }

        val notes = parsedItems
            .mapNotNull { it.notes?.trim() }
            .filter { it.isNotBlank() }
        val totalItems = parsedItems.sumOf { it.quantity }

        val lines = mutableListOf(
            separator,
            "WAITERO",
            "NUOVO ORDINE",
            separator,
            "",
            "Tavolo: $tableName",
            "Ordine: #$orderId",
            "Ora: ${formatTime(createdAt)}",
            "",
            sectionSeparator,
            ""
        )

        parsedItems.forEach { item ->
            lines.add("${item.quantity}x ${item.name}")
        }

        if (notes.isNotEmpty()) {
            lines.add("")
            lines.add("NOTE:")
            notes.forEach { note ->
                lines.addAll(wrapLine(note, MAX_LINE_CHARS))
            }
        }

        lines.add("")
        lines.add(sectionSeparator)
        lines.add("")
        lines.add("Totale piatti: $totalItems")
        lines.add("")
        lines.add(separator)
        lines.add("")

        return FormatResult.success(lines.joinToString("\n"))
    }

    private fun parseItems(items: JSONArray): List<PrintableItem> {
        val parsedItems = mutableListOf<PrintableItem>()
        for (index in 0 until items.length()) {
            val item = items.optJSONObject(index) ?: continue
            val quantity = item.optInt("quantity", 0)
            val name = item.optString("name", "").trim()
            val notes = if (item.has("notes") && !item.isNull("notes")) {
                item.optString("notes")
            } else {
                null
            }

            if (quantity > 0 && name.isNotBlank()) {
                parsedItems.add(PrintableItem(quantity, name, notes))
            }
        }
        return parsedItems
    }

    private fun formatTime(value: String): String {
        val parsed = parseDate(value) ?: return value
        return timeFormatter.format(parsed)
    }

    private fun parseDate(value: String): Date? {
        val patterns = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSS",
            "yyyy-MM-dd'T'HH:mm:ss"
        )

        for (pattern in patterns) {
            val parser = SimpleDateFormat(pattern, Locale.US)
            if (pattern.endsWith("'Z'")) {
                parser.timeZone = TimeZone.getTimeZone("UTC")
            }
            try {
                return parser.parse(value)
            } catch (_: ParseException) {
                // Try the next supported timestamp shape.
            }
        }

        return null
    }

    private fun wrapLine(value: String, width: Int): List<String> {
        if (value.length <= width) {
            return listOf(value)
        }

        val words = value.split(Regex("\\s+"))
        val lines = mutableListOf<String>()
        var current = StringBuilder()

        for (word in words) {
            if (word.length > width) {
                if (current.isNotEmpty()) {
                    lines.add(current.toString())
                    current = StringBuilder()
                }
                word.chunked(width).forEach(lines::add)
                continue
            }

            val nextLength = if (current.isEmpty()) word.length else current.length + 1 + word.length
            if (nextLength > width) {
                lines.add(current.toString())
                current = StringBuilder(word)
            } else {
                if (current.isNotEmpty()) {
                    current.append(' ')
                }
                current.append(word)
            }
        }

        if (current.isNotEmpty()) {
            lines.add(current.toString())
        }

        return lines
    }

    data class FormatResult(
        val success: Boolean,
        val ticket: String?,
        val error: String?
    ) {
        companion object {
            fun success(ticket: String): FormatResult = FormatResult(true, ticket, null)
            fun failure(error: String): FormatResult = FormatResult(false, null, error)
        }
    }

    private data class PrintableItem(
        val quantity: Int,
        val name: String,
        val notes: String?
    )

    companion object {
        private const val MAX_LINE_CHARS = 32
    }
}
