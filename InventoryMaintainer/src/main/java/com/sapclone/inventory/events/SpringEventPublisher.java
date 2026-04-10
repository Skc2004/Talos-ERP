package com.sapclone.inventory.events;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * Default event publisher using Spring ApplicationEvents.
 * In production, replace with KafkaEventPublisher via @Profile("kafka").
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SpringEventPublisher implements EventPublisher {

    private final ApplicationEventPublisher applicationEventPublisher;

    @Override
    public void publish(InventoryEvent event) {
        log.info("Publishing inventory event: {} for SKU {}", event.changeType(), event.skuId());
        applicationEventPublisher.publishEvent(event);
    }
}
