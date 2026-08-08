package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.QaChecklist;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface QaChecklistRepository extends JpaRepository<QaChecklist, UUID> {
    List<QaChecklist> findByProjectIdOrderByCreatedAtDesc(UUID projectId);
}
