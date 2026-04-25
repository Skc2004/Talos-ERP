package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.Warehouse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface WarehouseRepository extends JpaRepository<Warehouse, UUID> {
    Warehouse findByCode(String code);
}
