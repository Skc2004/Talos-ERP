package com.sapclone.inventory.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "sku_master")
public class SkuMaster {
    
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;
    
    @Column(name = "sku_code", unique = true, nullable = false)
    private String skuCode;
    
    private String description;
    
    @Column(name = "dimensions_cm")
    private String dimensionsCm;
    
    @Column(name = "weight_kg")
    private BigDecimal weightKg;
    
    @Column(name = "lead_time_days")
    private Integer leadTimeDays;
    
    @Column(name = "reorder_point")
    private Integer reorderPoint;
    
    @Column(name = "preferred_vendor_id")
    private UUID preferredVendorId;
    
    @Column(name = "production_priority")
    private Integer productionPriority = 100; // 100 is normal, 50 is throttled due to heat
    
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;
    
    @Column(name = "updated_at")
    private ZonedDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = ZonedDateTime.now();
        updatedAt = ZonedDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = ZonedDateTime.now();
    }
}
