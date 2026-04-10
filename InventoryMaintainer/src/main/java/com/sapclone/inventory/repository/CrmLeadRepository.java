package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.CrmLead;
import com.sapclone.inventory.model.LeadStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Repository
public interface CrmLeadRepository extends JpaRepository<CrmLead, UUID> {
    Page<CrmLead> findByStatusOrderByAiScoreDesc(LeadStatus status, Pageable pageable);
    Page<CrmLead> findAllByOrderByAiScoreDesc(Pageable pageable);
}
