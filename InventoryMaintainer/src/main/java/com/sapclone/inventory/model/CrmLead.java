package com.sapclone.inventory.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "crm_leads")
public class CrmLead {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(name = "contact_name", nullable = false)
    private String contactName;

    @Column(name = "contact_email")
    private String contactEmail;

    @Column(name = "contact_phone")
    private String contactPhone;

    @Column(name = "company_name")
    private String companyName;

    @Column(name = "potential_value", precision = 15, scale = 2)
    private BigDecimal potentialValue = BigDecimal.ZERO;

    @Column(columnDefinition = "lead_status")
    @Enumerated(EnumType.STRING)
    private LeadStatus status = LeadStatus.NEW;

    private String source;

    @Column(name = "assigned_to")
    private UUID assignedTo;

    @Column(name = "ai_score", precision = 5, scale = 2)
    private BigDecimal aiScore;

    private String notes;

    @Column(name = "converted_project_id")
    private UUID convertedProjectId;

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
