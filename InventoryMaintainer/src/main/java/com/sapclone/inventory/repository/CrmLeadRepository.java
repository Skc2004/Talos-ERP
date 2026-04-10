package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.CrmLead;
import com.sapclone.inventory.model.LeadStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CrmLeadRepository extends JpaRepository<CrmLead, UUID> {
    List<CrmLead> findByStatusOrderByAiScoreDesc(LeadStatus status);
    List<CrmLead> findAllByOrderByAiScoreDesc();
}
