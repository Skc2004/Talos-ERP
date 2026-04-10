package com.sapclone.inventory.events;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Listens for InventoryEvents and triggers downstream actions asynchronously.
 * For example: retrain demand forecast models when stock levels change.
 */
@Slf4j
@Component
@EnableAsync
public class InventoryEventListener {

    @Value("${python.gateway.url:http://localhost:8000}")
    private String pythonGatewayUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    @Async
    @EventListener
    public void handleInventoryEvent(InventoryEvent event) {
        log.info("Handling inventory event: {} for SKU {} (qty: {})",
                event.changeType(), event.skuId(), event.quantity());

        try {
            // Trigger forecast retrain in Python AI gateway
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
