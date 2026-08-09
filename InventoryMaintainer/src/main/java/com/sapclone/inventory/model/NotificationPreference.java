package com.sapclone.inventory.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "notification_preferences")
public class NotificationPreference {
    @Id @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    private String channel = "IN_APP";

    @Column(name = "is_enabled")
    private Boolean isEnabled = true;

    @Column(name = "created_at")
    private ZonedDateTime createdAt;
    
    @PrePersist protected void onCreate() { createdAt = ZonedDateTime.now(); }
}
