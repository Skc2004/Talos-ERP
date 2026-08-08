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
@Table(name = "qa_checklists")
public class QaChecklist {
    @Id @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(name = "project_id", nullable = false) private UUID projectId;
    @Column(name = "template_id") private UUID templateId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String items = "[]";

    @Column(name = "completed_at") private ZonedDateTime completedAt;
    @Column(name = "created_at", updatable = false) private ZonedDateTime createdAt;
    @PrePersist protected void onCreate() { createdAt = ZonedDateTime.now(); }
}
