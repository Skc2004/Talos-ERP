package com.sapclone.inventory.service;

import com.sapclone.inventory.model.GeneralLedger;
import com.sapclone.inventory.model.SkuMaster;
import com.sapclone.inventory.model.StockLedger;
import com.sapclone.inventory.model.TransactionType;
import com.sapclone.inventory.repository.GeneralLedgerRepository;
import com.sapclone.inventory.repository.SkuMasterRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Slf4j
@Service
@RequiredArgsConstructor
public class FinanceService {

    private final GeneralLedgerRepository generalLedgerRepository;
    private final SkuMasterRepository skuMasterRepository;

    // Hardcoded example variables (these would dynamically pull from BOM/Electricity API)
    private final BigDecimal ENERGY_RATE_KWH = new BigDecimal("4.50");
    private final BigDecimal LABOR_RATE_HR = new BigDecimal("15.00");

    @Transactional
    public void recordStockTransactionCost(StockLedger transaction) {
        if (transaction.getTransactionType() != TransactionType.FINISHED_GOODS_ENTRY) {
            return; // We only compute COGS on finished goods for this module
        }

        // 1. Fetch Master Data
        SkuMaster sku = skuMasterRepository.findById(transaction.getSku().getId()).orElseThrow();
        
        // 2. Compute the Value Formula
        // C_unit = ( C_raw + C_labor*T + C_energy*E ) / N
        BigDecimal rawMaterialCost = new BigDecimal("50.00"); // Standard price lookup mock
        BigDecimal laborTimeHours = new BigDecimal("0.5"); // Mock manufacturing time
        BigDecimal energyKwh = new BigDecimal("1.2"); // Mock energy from IoT aggregate
        
        BigDecimal totalCost = rawMaterialCost
            .add(laborTimeHours.multiply(LABOR_RATE_HR))
            .add(energyKwh.multiply(ENERGY_RATE_KWH));

        BigDecimal cogsAssigned = totalCost.multiply(new BigDecimal(transaction.getQuantity()));

        // 3. Draft FICO Ledger Entry
        GeneralLedger entry = new GeneralLedger();
        entry.setAccountCode("COGS-1004"); // Inventory account
        entry.setDebit(cogsAssigned);
        entry.setSkuId(sku.getId());
        entry.setReferenceTransactionId(transaction.getId());
        entry.setDescription("Finished Good COGS Capitalization - " + transaction.getQuantity() + " units");

        generalLedgerRepository.save(entry);
        log.info("Capitalized ${} to General Ledger for {}", cogsAssigned, sku.getSkuCode());
    }
}
