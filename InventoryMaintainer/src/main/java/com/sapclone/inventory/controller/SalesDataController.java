package com.sapclone.inventory.controller;

import com.sapclone.inventory.model.SalesOrder;
import com.sapclone.inventory.repository.SalesOrderRepository;
import com.sapclone.inventory.service.SalesDataService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/sales")
@RequiredArgsConstructor
public class SalesDataController {

    private final SalesDataService salesDataService;
    private final SalesOrderRepository salesOrderRepository;

    /** JSON API: Ingest a single sales order with validation. */
    @PostMapping("/ingest")
    public ResponseEntity<?> ingestSingle(@RequestBody SalesOrder order) {
        try {
            return ResponseEntity.ok(salesDataService.ingestSingle(order));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", e.getMessage(),
                "type", "VALIDATION_ERROR"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "error", e.getClass().getSimpleName() + ": " + e.getMessage()
            ));
        }
    }

    /** CSV Upload: Parse and bulk-import sales data with validation. */
    @PostMapping("/upload-csv")
    public ResponseEntity<Map<String, Object>> uploadCsv(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }
        try {
            return ResponseEntity.ok(salesDataService.ingestCsv(file));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                "error", e.getClass().getSimpleName() + ": " + e.getMessage()
            ));
        }
    }

    /** List all sales orders. */
    @GetMapping
    public ResponseEntity<List<SalesOrder>> getAllSales() {
        return ResponseEntity.ok(salesOrderRepository.findAll());
    }

    /** Get count and stats. */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(Map.of(
            "totalOrders", salesOrderRepository.count(),
            "completedOrders", salesOrderRepository.countByStatus("COMPLETED"),
            "totalRevenue", salesOrderRepository.getTotalRevenue()
        ));
    }
}
