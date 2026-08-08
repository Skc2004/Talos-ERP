package com.sapclone.inventory.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "crm_activities")
public class CrmActivity {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(name = "lead_id", nullable = false)
    private UUID leadId;

    @Column(name = "activity_type", nullable = false)
    private String activityType; // CALL, EMAIL, MEETING, NOTE, TASK

    @Column(nullable = false)
    private String description;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "follow_up_date")
    private ZonedDateTime followUpDate;

    @Column(name = "is_completed")
    private Boolean isCompleted = false;

    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = ZonedDateTime.now();
    }
}
