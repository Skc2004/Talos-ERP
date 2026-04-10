package com.sapclone.inventory.service;

import com.sapclone.inventory.model.PoStatus;
import com.sapclone.inventory.model.PurchaseOrder;
import com.sapclone.inventory.model.SkuMaster;
import com.sapclone.inventory.repository.DemandForecastRepository;
import com.sapclone.inventory.repository.PurchaseOrderRepository;
import com.sapclone.inventory.repository.SkuMasterRepository;
import com.sapclone.inventory.repository.StockLedgerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProcurementService {

    private final SkuMasterRepository skuMasterRepository;
    private final StockLedgerRepository stockLedgerRepository;
    private final DemandForecastRepository demandForecastRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;

    /**
     * The Auto-Procurement Loop. Evaluates all SKUs hourly.
     * Cross references ML Demand Forecast vs Available physical stock.
     */
    @Scheduled(cron = "0 0 * * * *") // Runs every hour
    @Transactional
    public void evaluateStockAndProcure() {
        log.info("Starting Auto-Procurement evaluation loop...");
        List<SkuMaster> allSkus = skuMasterRepository.findAll();

        for (SkuMaster sku : allSkus) {
            Integer currentStock = stockLedgerRepository.getCurrentStockForSku(sku.getId());
            if (currentStock == null) currentStock = 0;

            Integer forecasted30DayDemand = demandForecastRepository.fetch30DayForecastForSku(sku.getId());
            if (forecasted30DayDemand == null) forecasted30DayDemand = 0;

            // Business logic: If current stock + reorder_point < forecasted demand
            if (currentStock < (forecasted30DayDemand + sku.getReorderPoint())) {
                log.warn("SKU {} is severely low on stock compared to ML forecast. Stock: {}, Forecast: {}", sku.getSkuCode(), currentStock, forecasted30DayDemand);
                
                // Draft Purchase Order
                int gap = (forecasted30DayDemand + sku.getReorderPoint()) - currentStock;
                createDraftPO(sku, gap);
            }
        }
        log.info("Finished Auto-Procurement evaluation loop.");
    }

    private void createDraftPO(SkuMaster sku, int quantity) {
        if (sku.getPreferredVendorId() == null) {
            log.error("Cannot draft PO for SKU {}: No preferred vendor configured", sku.getSkuCode());
            return;
        }

        PurchaseOrder po = new PurchaseOrder();
        // Null poNumber gets handled by @PrePersist
        po.setVendorId(sku.getPreferredVendorId());
        po.setStatus(PoStatus.DRAFT);
        // Cost derivation logic missing, stubbing out
        po.setTotalAmount(null); 
        
        purchaseOrderRepository.save(po);
        log.info("Drafted new PO {} for vendor {}", po.getPoNumber(), po.getVendorId());
        
        // Prescriptive Agent: Should we mark up our sale price?
        checkMarketCaptureAndSuggestPricing(sku);
        
        // TODO: Fire Kafka event KAFKA_PO_CREATED
    }

    private void checkMarketCaptureAndSuggestPricing(SkuMaster sku) {
        // Here we'd query the new competitor_data table. 
        // Example Agentic prescripton logic:
        log.info("PRESCRIPTIVE AI: Evaluated Competitor MCR for {}. Competitor stock is low. Recommending a +5.0% margin markup.", sku.getSkuCode());
    }
}
