package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.CrmQuotation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface CrmQuotationRepository extends JpaRepository<CrmQuotation, UUID> {
    List<CrmQuotation> findByLeadIdOrderByCreatedAtDesc(UUID leadId);
}
