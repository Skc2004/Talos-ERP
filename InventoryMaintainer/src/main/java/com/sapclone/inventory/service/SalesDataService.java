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
import java.math.RoundingMode;
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

    // ─── Validation Constants ───
    private static final BigDecimal MAX_UNIT_PRICE = new BigDecimal("999999.99");
    private static final BigDecimal MIN_UNIT_PRICE = new BigDecimal("0.01");
    private static final int MAX_QUANTITY = 100_000;
    private static final int MIN_QUANTITY = 1;

    /**
     * Ingest a single sales order from the REST API (JSON body).
     * Applies the same validation rules as CSV import.
     */
    @Transactional
    public SalesOrder ingestSingle(SalesOrder order) {
        // ── Validate required fields ──
        if (order.getOrderNumber() == null || order.getOrderNumber().isBlank()) {
            throw new IllegalArgumentException("orderNumber is required");
        }
        if (order.getQuantity() == null || order.getQuantity() < MIN_QUANTITY) {
            throw new IllegalArgumentException("quantity must be >= " + MIN_QUANTITY);
        }
        if (order.getQuantity() > MAX_QUANTITY) {
            throw new IllegalArgumentException("quantity exceeds maximum of " + MAX_QUANTITY);
        }
        if (order.getUnitPrice() == null || order.getUnitPrice().compareTo(MIN_UNIT_PRICE) < 0) {
            throw new IllegalArgumentException("unitPrice must be >= " + MIN_UNIT_PRICE);
        }
        if (order.getUnitPrice().compareTo(MAX_UNIT_PRICE) > 0) {
            throw new IllegalArgumentException("unitPrice exceeds maximum of " + MAX_UNIT_PRICE);
        }

        // ── Duplicate check ──
        if (salesOrderRepository.existsByOrderNumber(order.getOrderNumber())) {
            throw new IllegalArgumentException("Duplicate order_number: " + order.getOrderNumber());
        }

        // ── Defaults ──
        if (order.getOrderDate() == null) order.setOrderDate(ZonedDateTime.now());
        if (order.getChannel() == null) order.setChannel("API");
        if (order.getStatus() == null) order.setStatus("COMPLETED");
        if (order.getDiscountAmount() == null) order.setDiscountAmount(BigDecimal.ZERO);

        // ── Discount sanity: cannot exceed gross amount ──
        BigDecimal gross = order.getUnitPrice().multiply(BigDecimal.valueOf(order.getQuantity()));
        if (order.getDiscountAmount().compareTo(gross) > 0) {
            throw new IllegalArgumentException("Discount (" + order.getDiscountAmount() + ") exceeds gross amount (" + gross + ")");
        }

        order = salesOrderRepository.save(order);

        // Book stock issue for inventory tracking
        if (order.getSkuId() != null) {
            bookStockIssue(order);
        }

        log.info("Ingested sales order {} via API (net_revenue computed by DB)", order.getOrderNumber());
        return order;
    }

    /**
     * Parse a CSV file and bulk-insert sales orders.
     * 
     * BUSINESS RULES:
     * 1. order_number must be unique — duplicates are SKIPPED (not crash the batch)
     * 2. sku_code must exist in sku_master — unknown SKUs are logged as warnings
     * 3. quantity must be 1–100,000
     * 4. unit_price must be 0.01–999,999.99
     * 5. discount cannot exceed (quantity × unit_price)
     * 6. net_revenue = (quantity × unit_price) − discount (computed by DB generated column)
     */
    @Transactional
    public Map<String, Object> ingestCsv(MultipartFile file) {
        int successCount = 0;
        int errorCount = 0;
        int skippedDuplicates = 0;
        List<String> errors = new ArrayList<>();
        Set<String> seenOrderNumbers = new HashSet<>();

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
                    String orderNumber = record.get("order_number");

                    // ── Rule 1: Duplicate check (both in-batch and in-DB) ──
                    if (seenOrderNumbers.contains(orderNumber)) {
                        skippedDuplicates++;
                        errors.add("Row " + record.getRecordNumber() + ": Duplicate in batch — " + orderNumber);
                        continue;
                    }
                    if (salesOrderRepository.existsByOrderNumber(orderNumber)) {
                        skippedDuplicates++;
                        errors.add("Row " + record.getRecordNumber() + ": Already exists in DB — " + orderNumber);
                        continue;
                    }
                    seenOrderNumbers.add(orderNumber);

                    SalesOrder order = new SalesOrder();
                    order.setOrderNumber(orderNumber);

                    // ── Parse date flexibly ──
                    String dateStr = record.get("order_date");
                    order.setOrderDate(parseFlexibleDate(dateStr));

                    order.setCustomerName(record.isMapped("customer_name") ? record.get("customer_name") : "CSV Import");

                    // ── Rule 2: SKU validation ──
                    String skuCode = record.get("sku_code");
                    var sku = skuMasterRepository.findBySkuCode(skuCode);
                    if (sku != null) {
                        order.setSkuId(sku.getId());
                    } else {
                        errors.add("Row " + record.getRecordNumber() + ": Unknown SKU '" + skuCode + "' — order saved without SKU link");
                    }

                    // ── Rule 3: Quantity validation ──
                    int qty = Integer.parseInt(record.get("quantity"));
                    if (qty < MIN_QUANTITY || qty > MAX_QUANTITY) {
                        throw new IllegalArgumentException("Quantity " + qty + " out of range [" + MIN_QUANTITY + ", " + MAX_QUANTITY + "]");
                    }
                    order.setQuantity(qty);

                    // ── Rule 4: Price validation ──
                    BigDecimal price = new BigDecimal(record.get("unit_price"));
                    if (price.compareTo(MIN_UNIT_PRICE) < 0 || price.compareTo(MAX_UNIT_PRICE) > 0) {
                        throw new IllegalArgumentException("unit_price " + price + " out of range [" + MIN_UNIT_PRICE + ", " + MAX_UNIT_PRICE + "]");
                    }
                    order.setUnitPrice(price);

                    // ── Rule 5: Discount validation ──
                    BigDecimal discount = BigDecimal.ZERO;
                    if (record.isMapped("discount")) {
                        String disc = record.get("discount");
                        discount = disc.isEmpty() ? BigDecimal.ZERO : new BigDecimal(disc);
                    }
                    BigDecimal grossAmount = price.multiply(BigDecimal.valueOf(qty));
                    if (discount.compareTo(grossAmount) > 0) {
                        throw new IllegalArgumentException("Discount " + discount + " exceeds gross " + grossAmount);
                    }
                    if (discount.compareTo(BigDecimal.ZERO) < 0) {
                        throw new IllegalArgumentException("Discount cannot be negative");
                    }
                    order.setDiscountAmount(discount);

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

        log.info("CSV import complete: {} success, {} errors, {} duplicates skipped", successCount, errorCount, skippedDuplicates);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imported", successCount);
        result.put("errors", errorCount);
        result.put("duplicatesSkipped", skippedDuplicates);
        result.put("errorDetails", errors);

        // Compute and return summary stats for the UI
        BigDecimal totalRevenue = salesOrderRepository.getTotalRevenue();
        long totalOrders = salesOrderRepository.count();
        result.put("totalRevenueAfterImport", totalRevenue);
        result.put("totalOrdersInSystem", totalOrders);

        return result;
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
