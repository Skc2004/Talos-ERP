package com.sapclone.inventory.events;

import java.time.Instant;
import java.util.UUID;

/**
 * Domain event representing an inventory change.
 * Kafka-swappable: this POJO can be serialized to JSON for any message broker.
 */
public record InventoryEvent(
    UUID skuId,
    String changeType,   // STOCK_IN, STOCK_OUT, REORDER, ADJUSTMENT
    int quantity,
    String triggeredBy,  // userId or "SYSTEM"
    Instant timestamp
) {
    public static InventoryEvent of(UUID skuId, String changeType, int quantity, String triggeredBy) {
        return new InventoryEvent(skuId, changeType, quantity, triggeredBy, Instant.now());
    }
}
