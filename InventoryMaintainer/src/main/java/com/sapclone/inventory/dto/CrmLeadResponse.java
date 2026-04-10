package com.sapclone.inventory.dto;

import com.sapclone.inventory.model.LeadStatus;
import lombok.Data;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
public class CrmLeadResponse {
    private UUID id;
    private String contactName;
    private String contactEmail;
    private String contactPhone;
    private String companyName;
    private BigDecimal potentialValue;
    private LeadStatus status;
    private String source;
    private UUID assignedTo;
    private BigDecimal aiScore;
    private String notes;
    private UUID convertedProjectId;
    private ZonedDateTime createdAt;
    private ZonedDateTime updatedAt;
}
