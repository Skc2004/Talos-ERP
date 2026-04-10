package com.sapclone.inventory.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "purchase_orders")
public class PurchaseOrder {
    
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;
    
    @Column(name = "po_number", unique = true, nullable = false)
    private String poNumber;
    
    @Column(name = "vendor_id")
    private UUID vendorId;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = true) // Explicitly allowing null if using Postgres Enum directly, but better to map correctly. Since PostgreSQL creates the enum, let's map it as String for simplicity or let Hibernate handle it.
    private PoStatus status = PoStatus.DRAFT;
    
    @Column(name = "total_amount")
    private BigDecimal totalAmount;
    
    @Column(name = "created_by")
    private UUID createdBy;
    
    @Column(name = "approved_by")
    private UUID approvedBy;
    
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;
    
    @Column(name = "updated_at")
    private ZonedDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = ZonedDateTime.now();
        updatedAt = ZonedDateTime.now();
        if(poNumber == null) {
            poNumber = "PO-" + System.currentTimeMillis();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = ZonedDateTime.now();
    }
}
