package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.TimeEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface TimeEntryRepository extends JpaRepository<TimeEntry, UUID> {

    List<TimeEntry> findByProjectIdOrderByLoggedAtDesc(UUID projectId);

    @Query(value = "SELECT employee_id, COALESCE(SUM(hours), 0) AS total_hours FROM time_entries GROUP BY employee_id", nativeQuery = true)
    List<Map<String, Object>> getWorkloadByEmployee();
}
