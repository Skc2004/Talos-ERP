package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.WorkflowRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface WorkflowRuleRepository extends JpaRepository<WorkflowRule, UUID> {
    List<WorkflowRule> findByIsActiveTrue();
    List<WorkflowRule> findByTriggerEvent(String triggerEvent);
}
