package com.sapclone.inventory.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "crm_contacts")
public class CrmContact {
    @Id @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(name = "company_id") private UUID companyId;
    @Column(nullable = false) private String name;
    private String email;
    private String phone;
    private String designation;
    private String notes;

    @Column(name = "created_at", updatable = false) private ZonedDateTime createdAt;
    @PrePersist protected void onCreate() { createdAt = ZonedDateTime.now(); }
}
