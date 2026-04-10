package com.sapclone.inventory.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.GenericGenerator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "demand_forecasts")
public class DemandForecast {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sku_id", nullable = false)
    private SkuMaster sku;

    @Column(name = "forecasted_demand")
    private Integer forecastedDemand;

    @Column(name = "confidence_interval")
    private BigDecimal confidenceInterval;

    @Column(name = "target_date")
    private LocalDate targetDate;

    @Column(name = "human_override")
    private Boolean humanOverride = false;

    @Column(name = "override_value")
    private Integer overrideValue;

    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;
}
