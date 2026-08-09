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
@Table(name = "admin_settings")
public class AdminSetting {
    @Id @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(name = "setting_key", nullable = false, unique = true) private String settingKey;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "setting_value", columnDefinition = "jsonb")
    private String settingValue = "{}";

    private String category = "general";

    @Column(name = "updated_at") private ZonedDateTime updatedAt;
    @PrePersist @PreUpdate protected void onUpdate() { updatedAt = ZonedDateTime.now(); }
}
