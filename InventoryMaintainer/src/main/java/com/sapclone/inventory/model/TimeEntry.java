package com.sapclone.inventory.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "time_entries")
public class TimeEntry {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "employee_id")
    private UUID employeeId;

    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal hours;

    private String description;

    @Column(name = "logged_at", updatable = false)
    private ZonedDateTime loggedAt;

    @PrePersist
    protected void onCreate() {
        loggedAt = ZonedDateTime.now();
    }
}
