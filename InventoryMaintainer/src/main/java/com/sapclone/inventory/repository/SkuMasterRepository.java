package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.SkuMaster;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface SkuMasterRepository extends JpaRepository<SkuMaster, UUID> {
    SkuMaster findBySkuCode(String skuCode);
}
