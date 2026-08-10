package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface ProjectRepository extends JpaRepository<Project, UUID> {
    List<Project> findAllByOrderByDeadlineAsc();
    List<Project> findByStatus(String status);
    List<Project> findByStatusIn(Collection<String> statuses);
}
