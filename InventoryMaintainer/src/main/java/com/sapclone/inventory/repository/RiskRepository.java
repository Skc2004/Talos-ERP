package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.ProjectRisk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RiskRepository extends JpaRepository<ProjectRisk, UUID> {
    List<ProjectRisk> findByProjectIdOrderByCreatedAtDesc(UUID projectId);
    List<ProjectRisk> findByStatus(String status);
}
