package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.Project;
import com.sapclone.inventory.model.ProjectStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ProjectRepository extends JpaRepository<Project, UUID> {
    List<Project> findByStatusOrderByPriorityAsc(ProjectStatus status);
    List<Project> findByMachineIdAndStatusIn(String machineId, List<ProjectStatus> statuses);

    @Query("SELECT p FROM Project p WHERE p.status NOT IN ('SHIPPED', 'CANCELLED') ORDER BY p.deadline ASC")
    List<Project> findActiveProjects();
}
