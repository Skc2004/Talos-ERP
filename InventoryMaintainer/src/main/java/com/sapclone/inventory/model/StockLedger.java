package com.sapclone.inventory.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "stock_ledger")
public class StockLedger {
    
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sku_id", nullable = false)
    private SkuMaster sku;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", nullable = false)
    private TransactionType transactionType;
    
    @Column(nullable = false)
    private Integer quantity;
    
    private String location;
    
    @Column(name = "reference_id")
    private String referenceId;
    
    @Column(name = "user_id")
    private UUID userId;
    
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = ZonedDateTime.now();
    }
}
