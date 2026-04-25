package com.sapclone.inventory.controller;

import com.sapclone.inventory.model.Warehouse;
import com.sapclone.inventory.repository.WarehouseRepository;
import com.sapclone.inventory.repository.StockLedgerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@RestController
@RequestMapping("/api/v1/warehouses")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class WarehouseController {

    private final WarehouseRepository warehouseRepository;
    private final StockLedgerRepository stockLedgerRepository;

    /**
     * GET /api/v1/warehouses/status
     * Returns all warehouses with live capacity utilization from stock_ledger.
     * Used by the Warehouse Network Map on the Global Pulse dashboard.
     */
    @GetMapping("/status")
    public ResponseEntity<List<Map<String, Object>>> getWarehouseStatus() {
        // Fetch all warehouses
        List<Warehouse> warehouses = warehouseRepository.findAll();

        // Fetch aggregated stock per location from ledger
        Map<String, Long> stockByLocation = new HashMap<>();
        for (Object[] row : stockLedgerRepository.getStockByLocation()) {
            String location = (String) row[0];
            long totalStock = ((Number) row[1]).longValue();
            stockByLocation.put(location, totalStock);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Warehouse wh : warehouses) {
            long currentStock = stockByLocation.getOrDefault(wh.getCode(), 0L);
            // Clamp to 0 minimum (stock can't be negative in display)
            if (currentStock < 0) currentStock = 0;

            double utilization = wh.getMaxCapacity() > 0
                ? (double) currentStock / wh.getMaxCapacity() * 100.0
                : 0.0;

            // Determine health status based on utilization
            String status;
            if (utilization > 90) status = "CRITICAL";       // overloaded
            else if (utilization > 75) status = "HIGH";       // nearing capacity
            else if (utilization > 40) status = "OPTIMAL";    // healthy range
            else if (utilization > 15) status = "LOW";        // low stock
            else status = "UNDERUTILIZED";                    // needs rebalancing

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("code", wh.getCode());
            entry.put("name", wh.getName());
            entry.put("city", wh.getCity());
            entry.put("state", wh.getState());
            entry.put("latitude", wh.getLatitude());
            entry.put("longitude", wh.getLongitude());
            entry.put("maxCapacity", wh.getMaxCapacity());
            entry.put("warehouseType", wh.getWarehouseType());
            entry.put("currentStock", currentStock);
            entry.put("utilization", BigDecimal.valueOf(utilization).setScale(1, RoundingMode.HALF_UP));
            entry.put("status", status);
            entry.put("isActive", wh.getIsActive());

            result.add(entry);
        }

        return ResponseEntity.ok(result);
    }
}
