package com.sapclone.inventory.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "general_ledger")
public class GeneralLedger {
    
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;
    
    @Column(name = "transaction_date")
    private ZonedDateTime transactionDate;
    
    @Column(name = "account_code", nullable = false)
    private String accountCode;
    
    @Column(precision = 15, scale = 2)
    private BigDecimal debit = BigDecimal.ZERO;
    
    @Column(precision = 15, scale = 2)
    private BigDecimal credit = BigDecimal.ZERO;
    
    @Column(name = "sku_id")
    private UUID skuId;
    
    @Column(name = "reference_transaction_id")
    private UUID referenceTransactionId;
    
    private String description;

    @PrePersist
    protected void onCreate() {
        if(transactionDate == null) {
            transactionDate = ZonedDateTime.now();
        }
    }
}
