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
@CrossOrigin(origins = "*")
public class SalesDataController {

    private final SalesDataService salesDataService;
    private final SalesOrderRepository salesOrderRepository;

    /** JSON API: Ingest a single sales order. */
    @PostMapping("/ingest")
    public ResponseEntity<SalesOrder> ingestSingle(@RequestBody SalesOrder order) {
        return ResponseEntity.ok(salesDataService.ingestSingle(order));
    }

    /** CSV Upload: Parse and bulk-import sales data. */
    @PostMapping("/upload-csv")
    public ResponseEntity<Map<String, Object>> uploadCsv(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }
        return ResponseEntity.ok(salesDataService.ingestCsv(file));
    }

    /** List all sales orders. */
    @GetMapping
    public ResponseEntity<List<SalesOrder>> getAllSales() {
        return ResponseEntity.ok(salesOrderRepository.findAll());
    }
}
