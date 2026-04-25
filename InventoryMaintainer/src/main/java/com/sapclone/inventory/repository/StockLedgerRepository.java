package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.StockLedger;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface StockLedgerRepository extends JpaRepository<StockLedger, UUID> {

    @Query("SELECT SUM(s.quantity) FROM StockLedger s WHERE s.sku.id = :skuId")
    Integer getCurrentStockForSku(@Param("skuId") UUID skuId);

    /**
     * Average absolute daily demand over the last 60 days.
     * Groups STOCK_ISSUE transactions by calendar date, averages them.
     */
    @Query(value = """
        SELECT COALESCE(AVG(daily_total), 0) FROM (
            SELECT DATE(created_at) AS d, ABS(SUM(quantity)) AS daily_total
            FROM stock_ledger
            WHERE sku_id = :skuId
              AND transaction_type = 'STOCK_ISSUE'
              AND created_at >= NOW() - INTERVAL '60 days'
            GROUP BY DATE(created_at)
        ) sub
        """, nativeQuery = true)
    Double getAvgDailyDemand60Days(@Param("skuId") UUID skuId);

    /**
     * Standard deviation of absolute daily demand over the last 60 days.
     */
    @Query(value = """
        SELECT COALESCE(STDDEV(daily_total), 0) FROM (
            SELECT DATE(created_at) AS d, ABS(SUM(quantity)) AS daily_total
            FROM stock_ledger
            WHERE sku_id = :skuId
              AND transaction_type = 'STOCK_ISSUE'
              AND created_at >= NOW() - INTERVAL '60 days'
            GROUP BY DATE(created_at)
        ) sub
        """, nativeQuery = true)
    Double getStdDevDailyDemand60Days(@Param("skuId") UUID skuId);

    /**
     * Get total stock per location for warehouse capacity map.
     */
    @Query(value = """
        SELECT location, COALESCE(SUM(quantity), 0) AS total_stock
        FROM stock_ledger
        WHERE location IS NOT NULL
        GROUP BY location
        """, nativeQuery = true)
    java.util.List<Object[]> getStockByLocation();
}
