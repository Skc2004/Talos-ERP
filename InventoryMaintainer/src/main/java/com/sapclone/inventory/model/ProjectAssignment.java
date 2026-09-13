package com.sapclone.inventory.model;

import org.hibernate.annotations.TenantId;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "project_assignments")
public class ProjectAssignment {

    @TenantId
    private java.util.UUID tenantId;


    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "employee_name", nullable = false)
    private String employeeName;

    @Column(name = "role")
    private String role;

    @Column(name = "allocated_hours", precision = 10, scale = 2)
    private BigDecimal allocatedHours;

    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = ZonedDateTime.now();
    }
}
