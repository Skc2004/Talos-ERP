package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.ProjectMilestone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MilestoneRepository extends JpaRepository<ProjectMilestone, UUID> {
    List<ProjectMilestone> findByProjectIdOrderBySortOrderAsc(UUID projectId);
}
