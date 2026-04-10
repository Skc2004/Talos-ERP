package com.sapclone.inventory.service;

import com.sapclone.inventory.model.SkuMaster;
import com.sapclone.inventory.repository.SkuMasterRepository;
import com.sapclone.inventory.repository.StockLedgerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class StockService {

    private final SkuMasterRepository skuMasterRepository;
    private final StockLedgerRepository stockLedgerRepository;

    @Value("${inventory.zscore:1.645}")
    private double zScore;

    @Value("${inventory.health.optimal:14}")
    private int healthOptimal;

    @Value("${inventory.health.healthy:7}")
    private int healthHealthy;

    @Value("${inventory.health.warning:3}")
    private int healthWarning;

    /**
     * Calculates live rebalancing metrics for a single SKU.
     * All values are derived from real database aggregates — zero hardcoding.
     */
    public Map<String, Object> calculateRebalancingMetrics(String skuCode) {
        SkuMaster sku = skuMasterRepository.findBySkuCode(skuCode);
        if (sku == null) return Map.of("error", "SKU not found: " + skuCode);

        // ---- LIVE DATABASE QUERIES ----
        // Average daily demand over 60-day rolling window
        Double avgDailyDemand = stockLedgerRepository.getAvgDailyDemand60Days(sku.getId());
        if (avgDailyDemand == null || avgDailyDemand == 0) avgDailyDemand = 0.01; // prevent div/0

        // Standard deviation of daily demand over 60-day rolling window
        Double stdDevDemand = stockLedgerRepository.getStdDevDailyDemand60Days(sku.getId());
        if (stdDevDemand == null) stdDevDemand = 0.0;

        // Current physical stock (sum of all ledger entries)
        Integer currentStockRaw = stockLedgerRepository.getCurrentStockForSku(sku.getId());
        int currentStock = currentStockRaw != null ? currentStockRaw : 0;

        int leadTime = sku.getLeadTimeDays();

        // ---- MATHEMATICAL ENGINE ----
        // Safety Stock = Z × σ_d × √L
        double safetyStockRaw = zScore * stdDevDemand * Math.sqrt(leadTime);
        int safetyStock = (int) Math.ceil(safetyStockRaw);

        // Reorder Point = (d_avg × L) + SS
        int reorderPoint = (int) Math.ceil((avgDailyDemand * leadTime) + safetyStock);

        // Inventory Health = (Current Stock − Safety Stock) / Avg Daily Demand
        double healthScore = (double)(currentStock - safetyStock) / avgDailyDemand;

        String healthStatus;
        if (healthScore >= healthOptimal) healthStatus = "OPTIMAL";
        else if (healthScore >= healthHealthy) healthStatus = "HEALTHY";
        else if (healthScore >= healthWarning) healthStatus = "WARNING";
        else healthStatus = "CRITICAL";

        // Stock-Out Projection: days until zero stock
        double daysUntilStockout = currentStock / avgDailyDemand;

        // ---- ASSEMBLE RESPONSE ----
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("sku", skuCode);
        metrics.put("description", sku.getDescription());
        metrics.put("leadTimeDays", leadTime);
        metrics.put("currentStock", currentStock);

        // Formula Inputs (for Logic Debugger transparency)
        metrics.put("avgDailyDemand_d", round(avgDailyDemand));
        metrics.put("stdDevDemand_sigma", round(stdDevDemand));
        metrics.put("zScore", zScore);

        // Formula Outputs
        metrics.put("safetyStock_SS", safetyStock);
        metrics.put("reorderPoint_ROP", reorderPoint);
        metrics.put("healthScoreDays", round(healthScore));
        metrics.put("healthStatus", healthStatus);
        metrics.put("daysUntilStockout", round(daysUntilStockout));

        // Prescriptive Flag
        metrics.put("needsReorder", currentStock <= reorderPoint);

        log.info("Rebalancing computed for {}: ROP={}, SS={}, Health={}",
                skuCode, reorderPoint, safetyStock, healthStatus);

        return metrics;
    }

    /**
     * Calculates rebalancing for ALL active SKUs in the system.
     */
    public List<Map<String, Object>> calculateAllRebalancing() {
        List<Map<String, Object>> results = new ArrayList<>();
        for (SkuMaster sku : skuMasterRepository.findAll()) {
            results.add(calculateRebalancingMetrics(sku.getSkuCode()));
        }
        return results;
    }

    private double round(double val) {
        return Math.round(val * 100.0) / 100.0;
    }
}
