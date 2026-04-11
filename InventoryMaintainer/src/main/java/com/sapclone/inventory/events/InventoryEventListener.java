package com.sapclone.inventory.events;

import com.sapclone.inventory.model.GeneralLedger;
import com.sapclone.inventory.repository.GeneralLedgerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

/**
 * Listens for InventoryEvents and triggers:
 * 1. Forecast retrain in Python AI gateway
 * 2. Continuous Close: auto-posts double-entry journal entries to GeneralLedger
 */
@Slf4j
@Component
@EnableAsync
@RequiredArgsConstructor
public class InventoryEventListener {

    @Value("${python.gateway.url:http://localhost:8000}")
    private String pythonGatewayUrl;

    private final GeneralLedgerRepository generalLedgerRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    @Async
    @EventListener
    public void handleInventoryEvent(InventoryEvent event) {
        log.info("Handling inventory event: {} for SKU {} (qty: {})",
                event.changeType(), event.skuId(), event.quantity());

        // ── 1. Continuous Close: Auto-post journal entries ──
        postLedgerEntries(event);

        // ── 2. Trigger AI forecast retrain ──
        triggerForecastRetrain(event);
    }

    /**
     * Continuous Close: instantly posts double-entry bookkeeping entries
     * based on the type of inventory movement.
     */
    private void postLedgerEntries(InventoryEvent event) {
        try {
            UUID journalId = UUID.randomUUID();
            BigDecimal amount = BigDecimal.valueOf(event.quantity()).abs();

            switch (event.changeType()) {
                case "STOCK_IN", "GOODS_INWARD" -> {
                    // Debit 1200 (Inventory) / Credit 2000 (Accounts Payable)
                    saveLedgerLine(journalId, "1200", amount, BigDecimal.ZERO,
                            "Goods Receipt: " + event.skuId(), event.skuId());
                    saveLedgerLine(journalId, "2000", BigDecimal.ZERO, amount,
                            "AP for Goods Receipt: " + event.skuId(), event.skuId());
                    log.info("📒 Continuous Close: STOCK_IN journal {} posted (₹{})", journalId, amount);
                }
                case "STOCK_OUT", "STOCK_ISSUE" -> {
                    // Debit 5000 (COGS) / Credit 1200 (Inventory)
                    saveLedgerLine(journalId, "5000", amount, BigDecimal.ZERO,
                            "COGS for Stock Issue: " + event.skuId(), event.skuId());
                    saveLedgerLine(journalId, "1200", BigDecimal.ZERO, amount,
                            "Inventory Reduction: " + event.skuId(), event.skuId());
                    log.info("📒 Continuous Close: STOCK_OUT journal {} posted (₹{})", journalId, amount);
                }
                default -> log.debug("No ledger action for event type: {}", event.changeType());
            }
        } catch (Exception e) {
            log.error("Failed to post continuous close entry for SKU {}: {}", event.skuId(), e.getMessage());
        }
    }

    private void saveLedgerLine(UUID journalId, String accountCode, BigDecimal debit, BigDecimal credit,
                                 String description, UUID skuId) {
        GeneralLedger entry = new GeneralLedger();
        entry.setJournalEntryId(journalId);
        entry.setAccountCode(accountCode);
        entry.setDebit(debit);
        entry.setCredit(credit);
        entry.setDescription(description);
        entry.setSkuId(skuId);
        generalLedgerRepository.save(entry);
    }

    private void triggerForecastRetrain(InventoryEvent event) {
        try {
            String retrainUrl = pythonGatewayUrl + "/forecasts/retrain/" + event.skuId();
            restTemplate.postForEntity(retrainUrl, Map.of(
                    "trigger", "inventory_event",
                    "change_type", event.changeType(),
                    "quantity", event.quantity()
            ), String.class);
            log.info("Forecast retrain triggered for SKU {}", event.skuId());
        } catch (Exception e) {
            log.warn("Failed to trigger forecast retrain for SKU {} — AI gateway may be down: {}",
                    event.skuId(), e.getMessage());
        }
    }
}
