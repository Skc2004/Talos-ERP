package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.SlaDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SlaDefinitionRepository extends JpaRepository<SlaDefinition, UUID> {
    List<SlaDefinition> findByIsActiveTrue();
    List<SlaDefinition> findByLeadSourceAndLeadStage(String leadSource, String leadStage);
}
