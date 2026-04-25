package com.sapclone.inventory.controller;

import com.sapclone.inventory.events.EventPublisher;
import com.sapclone.inventory.events.InventoryEvent;
import com.sapclone.inventory.service.StockService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/inventory")
@RequiredArgsConstructor
@Tag(name = "Inventory Management", description = "Stock rebalancing, ROP/Safety Stock calculations")
public class RebalanceController {

    private final StockService stockService;
    private final EventPublisher eventPublisher;

    /**
     * GET /api/v1/inventory/rebalance/{skuCode}
     * Returns ROP, Safety Stock, Health Score, and Stockout Projection for a single SKU.
     */
    @GetMapping("/rebalance/{skuCode}")
    @Operation(summary = "Get rebalancing metrics for a single SKU",
               description = "Computes ROP, Safety Stock (Z-Score), Health Score, and Stockout Projection")
    public ResponseEntity<Map<String, Object>> getRebalancingMetrics(
            @PathVariable String skuCode,
            @RequestParam(required = false) Double zScore,
            @RequestParam(required = false) Double leadTimeMultiplier,
            @RequestParam(required = false) Double holdingCostPercent,
            @RequestParam(required = false) Double orderCost) {
        Map<String, Object> calculations = stockService.calculateRebalancingMetrics(skuCode, zScore, leadTimeMultiplier, holdingCostPercent, orderCost);
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
    @Operation(summary = "Get rebalancing metrics for all SKUs")
    public ResponseEntity<List<Map<String, Object>>> getAllRebalancingMetrics(
            @RequestParam(required = false) Double zScore,
            @RequestParam(required = false) Double leadTimeMultiplier,
            @RequestParam(required = false) Double holdingCostPercent,
            @RequestParam(required = false) Double orderCost) {
        return ResponseEntity.ok(stockService.calculateAllRebalancing(zScore, leadTimeMultiplier, holdingCostPercent, orderCost));
    }

    /**
     * POST /api/v1/inventory/stock-movement
     * Records a stock movement and publishes an InventoryEvent for Continuous Close.
     */
    @PostMapping("/stock-movement")
    @Operation(summary = "Record a stock movement",
               description = "Publishes an InventoryEvent that triggers automatic ledger entries (Continuous Close)")
    public ResponseEntity<Map<String, String>> recordStockMovement(
            @RequestParam UUID skuId,
            @RequestParam String type,
            @RequestParam int quantity) {

        // Publish event — triggers Continuous Close listener
        eventPublisher.publish(InventoryEvent.of(skuId, type, quantity, "API_USER"));

        return ResponseEntity.ok(Map.of(
                "status", "published",
                "message", "Inventory event published. Ledger entries will be auto-posted."
        ));
    }
}
