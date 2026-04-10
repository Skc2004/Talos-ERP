package com.sapclone.inventory.events;

/**
 * Abstraction for event publishing — swap implementation to use Kafka
 * by creating a KafkaEventPublisher and toggling via @Profile or @ConditionalOnProperty.
 */
public interface EventPublisher {
    void publish(InventoryEvent event);
}
