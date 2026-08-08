package com.sapclone.inventory.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "crm_companies")
public class CrmCompany {
    @Id @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(nullable = false) private String name;
    private String industry;
    private String size;
    private String website;
    private String notes;

    @Column(name = "created_at", updatable = false) private ZonedDateTime createdAt;
    @PrePersist protected void onCreate() { createdAt = ZonedDateTime.now(); }
}
