package com.sapclone.inventory.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "projects")
public class Project {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(name = "lead_id")
    private UUID leadId;

    @Column(name = "project_name", nullable = false)
    private String projectName;

    @Column(name = "client_name")
    private String clientName;

    private ZonedDateTime deadline;

    @Column(columnDefinition = "project_status")
    @Enumerated(EnumType.STRING)
    private ProjectStatus status = ProjectStatus.BACKLOG;

    private Integer priority = 50;

    @Column(name = "estimated_hours", precision = 8, scale = 2)
    private BigDecimal estimatedHours;

    @Column(name = "actual_hours", precision = 8, scale = 2)
    private BigDecimal actualHours = BigDecimal.ZERO;

    @Column(name = "estimated_cost", precision = 15, scale = 2)
    private BigDecimal estimatedCost;

    @Column(name = "machine_id")
    private String machineId;

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
