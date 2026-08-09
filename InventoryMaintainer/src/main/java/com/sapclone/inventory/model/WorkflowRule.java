package com.sapclone.inventory.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "workflow_rules")
public class WorkflowRule {
    @Id @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "trigger_event", nullable = false)
    private String triggerEvent;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "condition_json", columnDefinition = "jsonb", nullable = false)
    private String conditionJson = "{}";

    @Column(name = "action_type", nullable = false)
    private String actionType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "action_config", columnDefinition = "jsonb", nullable = false)
    private String actionConfig = "{}";

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at")
    private ZonedDateTime createdAt;
    
    @PrePersist protected void onCreate() { createdAt = ZonedDateTime.now(); }
}
