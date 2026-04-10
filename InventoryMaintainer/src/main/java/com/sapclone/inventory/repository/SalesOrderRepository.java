package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.SalesOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.UUID;

@Repository
public interface SalesOrderRepository extends JpaRepository<SalesOrder, UUID> {

    @Query("SELECT COALESCE(SUM(s.netRevenue), 0) FROM SalesOrder s WHERE s.status = 'COMPLETED'")
    BigDecimal getTotalRevenue();

    long countByStatus(String status);
}
