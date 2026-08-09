package com.sapclone.inventory.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "sla_definitions")
public class SlaDefinition {
    @Id @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "lead_source")
    private String leadSource;

    @Column(name = "lead_stage")
    private String leadStage;

    @Column(name = "response_hours", nullable = false)
    private Integer responseHours = 24;

    @Column(name = "escalation_hours", nullable = false)
    private Integer escalationHours = 48;

    private String priority = "MEDIUM";

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at")
    private ZonedDateTime createdAt;
    
    @PrePersist protected void onCreate() { createdAt = ZonedDateTime.now(); }
}
