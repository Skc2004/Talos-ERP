package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.GeneralLedger;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface GeneralLedgerRepository extends JpaRepository<GeneralLedger, UUID> {
}
