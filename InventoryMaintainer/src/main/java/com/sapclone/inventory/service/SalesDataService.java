package com.sapclone.inventory.service;

import com.sapclone.inventory.model.SalesOrder;
import com.sapclone.inventory.model.StockLedger;
import com.sapclone.inventory.model.TransactionType;
import com.sapclone.inventory.repository.SalesOrderRepository;
import com.sapclone.inventory.repository.SkuMasterRepository;
import com.sapclone.inventory.repository.StockLedgerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SalesDataService {

    private final SalesOrderRepository salesOrderRepository;
    private final SkuMasterRepository skuMasterRepository;
    private final StockLedgerRepository stockLedgerRepository;

    /**
     * Ingest a single sales order from the REST API (JSON body).
     */
    @Transactional
    public SalesOrder ingestSingle(SalesOrder order) {
        if (order.getOrderDate() == null) order.setOrderDate(ZonedDateTime.now());
        if (order.getChannel() == null) order.setChannel("API");
        order = salesOrderRepository.save(order);

        // Also book a STOCK_ISSUE against the stock ledger for inventory adjustment
        if (order.getSkuId() != null) {
            bookStockIssue(order);
        }

        log.info("Ingested sales order {} via API", order.getOrderNumber());
        return order;
    }

    /**
     * Parse a CSV file and bulk-insert sales orders.
     * Expected CSV columns: order_number, order_date, customer_name, sku_code, quantity, unit_price, discount
     */
    @Transactional
    public Map<String, Object> ingestCsv(MultipartFile file) {
        int successCount = 0;
        int errorCount = 0;
        List<String> errors = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
             CSVParser parser = CSVFormat.DEFAULT
                     .builder()
                     .setHeader()
                     .setSkipHeaderRecord(true)
                     .setIgnoreHeaderCase(true)
                     .setTrim(true)
                     .build()
                     .parse(reader)) {

            for (CSVRecord record : parser) {
                try {
                    SalesOrder order = new SalesOrder();
                    order.setOrderNumber(record.get("order_number"));

                    // Try multiple date formats
                    String dateStr = record.get("order_date");
                    order.setOrderDate(parseFlexibleDate(dateStr));

                    order.setCustomerName(record.isMapped("customer_name") ? record.get("customer_name") : "CSV Import");

                    // Look up SKU by code
                    String skuCode = record.get("sku_code");
                    var sku = skuMasterRepository.findBySkuCode(skuCode);
                    if (sku != null) {
                        order.setSkuId(sku.getId());
                    }

                    order.setQuantity(Integer.parseInt(record.get("quantity")));
                    order.setUnitPrice(new BigDecimal(record.get("unit_price")));

                    if (record.isMapped("discount")) {
                        String disc = record.get("discount");
                        order.setDiscountAmount(disc.isEmpty() ? BigDecimal.ZERO : new BigDecimal(disc));
                    }

                    order.setChannel("MANUAL_CSV");
                    order.setStatus("COMPLETED");

                    salesOrderRepository.save(order);

                    // Book stock issue for inventory tracking
                    if (sku != null) {
                        bookStockIssue(order);
                    }

                    successCount++;
                } catch (Exception ex) {
                    errorCount++;
                    errors.add("Row " + record.getRecordNumber() + ": " + ex.getMessage());
                    log.warn("CSV row {} failed: {}", record.getRecordNumber(), ex.getMessage());
                }
            }
        } catch (Exception ex) {
            log.error("CSV parsing failed", ex);
            return Map.of("error", "Could not parse CSV: " + ex.getMessage());
        }

        log.info("CSV import complete: {} success, {} errors", successCount, errorCount);
        return Map.of(
                "imported", successCount,
                "errors", errorCount,
                "errorDetails", errors
        );
    }

    /**
     * Book a STOCK_ISSUE to the stock ledger when a sale is completed.
     * This decrements inventory by the quantity sold.
     */
    private void bookStockIssue(SalesOrder order) {
        StockLedger entry = new StockLedger();
        var sku = skuMasterRepository.findById(order.getSkuId()).orElse(null);
        if (sku == null) return;

        entry.setSku(sku);
        entry.setTransactionType(TransactionType.STOCK_ISSUE);
        entry.setQuantity(-Math.abs(order.getQuantity())); // Negative = issue
        entry.setReferenceId("SALE-" + order.getOrderNumber());
        entry.setLocation("WAREHOUSE-A");
        stockLedgerRepository.save(entry);
    }

    private ZonedDateTime parseFlexibleDate(String dateStr) {
        // Try ISO format first, then common formats
        String[] patterns = {
                "yyyy-MM-dd'T'HH:mm:ssXXX",
                "yyyy-MM-dd'T'HH:mm:ss",
                "yyyy-MM-dd",
                "MM/dd/yyyy",
                "dd-MM-yyyy"
        };

        for (String pattern : patterns) {
            try {
                if (pattern.contains("T")) {
                    return ZonedDateTime.parse(dateStr, DateTimeFormatter.ofPattern(pattern));
                } else {
                    return java.time.LocalDate.parse(dateStr, DateTimeFormatter.ofPattern(pattern))
                            .atStartOfDay(java.time.ZoneOffset.UTC);
                }
            } catch (DateTimeParseException ignored) {}
        }
        // Fallback to now
        log.warn("Could not parse date '{}', defaulting to now", dateStr);
        return ZonedDateTime.now();
    }
}
