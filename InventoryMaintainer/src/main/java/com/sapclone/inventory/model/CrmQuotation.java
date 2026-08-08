package com.sapclone.inventory.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "crm_quotations")
public class CrmQuotation {
    @Id @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(name = "lead_id", nullable = false) private UUID leadId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String items = "[]";

    @Column(precision = 15, scale = 2) private BigDecimal subtotal = BigDecimal.ZERO;
    @Column(name = "tax_rate", precision = 5, scale = 2) private BigDecimal taxRate = new BigDecimal("18.00");
    @Column(precision = 15, scale = 2) private BigDecimal total = BigDecimal.ZERO;
    @Column(name = "valid_until") private LocalDate validUntil;
    private String status = "DRAFT";

    @Column(name = "created_at", updatable = false) private ZonedDateTime createdAt;
    @PrePersist protected void onCreate() { createdAt = ZonedDateTime.now(); }
}
