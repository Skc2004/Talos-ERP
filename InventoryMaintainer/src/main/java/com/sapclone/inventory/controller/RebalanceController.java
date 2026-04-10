package com.sapclone.inventory.controller;

import com.sapclone.inventory.service.StockService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/inventory")
@RequiredArgsConstructor
public class RebalanceController {

    private final StockService stockService;

    /**
     * GET /api/v1/inventory/rebalance/{skuCode}
     * Returns ROP, Safety Stock, Health Score, and Stockout Projection for a single SKU.
     */
    @GetMapping("/rebalance/{skuCode}")
    public ResponseEntity<Map<String, Object>> getRebalancingMetrics(@PathVariable String skuCode) {
        Map<String, Object> calculations = stockService.calculateRebalancingMetrics(skuCode);
        if (calculations.containsKey("error")) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(calculations);
    }

    /**
     * GET /api/v1/inventory/rebalance
     * Returns rebalancing metrics for ALL SKUs. Used by the Executive Dashboard.
     */
    @GetMapping("/rebalance")
    public ResponseEntity<List<Map<String, Object>>> getAllRebalancingMetrics() {
        return ResponseEntity.ok(stockService.calculateAllRebalancing());
    }
}
