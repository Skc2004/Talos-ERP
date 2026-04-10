package com.sapclone.inventory.service;

import com.sapclone.inventory.model.SkuMaster;
import com.sapclone.inventory.repository.SkuMasterRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class MaintenanceOrchestrator {

    private final SkuMasterRepository skuMasterRepository;

    @Transactional
    public void throttleMachineProduction(String machineId) {
        log.warn("CRITICAL: Executing Hardware Thermal Throttle for Machine {}", machineId);
        
        // In a real database, we'd look up which SKUs are physically attached to this machine
        // Mocking to grab the first SKU and downshift priority
        skuMasterRepository.findAll().stream().findFirst().ifPresent(sku -> {
            sku.setProductionPriority(50); // Downshift to 50 (Throttled)
            skuMasterRepository.save(sku);
            log.warn("Throttled production priority to 50 for SKU {} to save thermal overhead.", sku.getSkuCode());
        });
    }
}
