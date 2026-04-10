package com.sapclone.inventory.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.Immutable;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

/**
 * Immutable General Ledger entity — double-entry bookkeeping.
 * Records cannot be updated or deleted via JPA (enforced both here and via DB triggers).
 * Corrections are made exclusively via reversing journal entries.
 */
@Data
@Entity
@Immutable  // Hibernate will reject any UPDATE attempts at ORM level
@Table(name = "general_ledger")
public class GeneralLedger {
    
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;
    
    @Column(name = "journal_entry_id")
    private UUID journalEntryId;
    
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
    
    @Column(name = "is_reversed")
    private Boolean isReversed = false;
    
    @Column(name = "reversed_by_entry_id")
    private UUID reversedByEntryId;
    
    @Column(name = "posted_by")
    private UUID postedBy;

    @PrePersist
    protected void onCreate() {
        if (transactionDate == null) {
            transactionDate = ZonedDateTime.now();
        }
        if (journalEntryId == null) {
            journalEntryId = UUID.randomUUID();
        }
    }
}
