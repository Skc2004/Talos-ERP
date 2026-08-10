package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.ProjectAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AssignmentRepository extends JpaRepository<ProjectAssignment, UUID> {
    List<ProjectAssignment> findByProjectId(UUID projectId);
    List<ProjectAssignment> findByEmployeeName(String employeeName);

    @Query("SELECT a.employeeName, SUM(a.allocatedHours) FROM ProjectAssignment a GROUP BY a.employeeName")
    List<Object[]> getWorkloadSummary();
}
