package com.sapclone.inventory.dto;

import com.sapclone.inventory.model.LeadStatus;
import lombok.Data;
import java.math.BigDecimal;
import java.util.UUID;

@Data
public class CrmLeadRequest {
    private String contactName;
    private String contactEmail;
    private String contactPhone;
    private String companyName;
    private BigDecimal potentialValue;
    private LeadStatus status;
    private String source;
    private UUID assignedTo;
    private String notes;
}
