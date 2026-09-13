package com.sapclone.inventory.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "tenants")
public class Tenant {
    @Id
    private UUID id;
    private String name;
    private String slug;
    private String plan;
    private Boolean isActive;
    private OffsetDateTime createdAt;
}
