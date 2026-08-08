package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.CrmActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface CrmActivityRepository extends JpaRepository<CrmActivity, UUID> {

    List<CrmActivity> findByLeadIdOrderByCreatedAtDesc(UUID leadId);

    List<CrmActivity> findByFollowUpDateIsNotNullAndIsCompletedFalseOrderByFollowUpDateAsc();
}
