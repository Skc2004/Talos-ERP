package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.DemandForecast;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;
import java.util.Optional;

@Repository
public interface DemandForecastRepository extends JpaRepository<DemandForecast, UUID> {
    
    // Finds the current month's total forecasted demand for a given SKU
    @Query(value = "SELECT COALESCE(SUM(df.forecasted_demand), 0) FROM demand_forecasts df WHERE df.sku_id = :skuId AND df.target_date > CURRENT_DATE AND df.target_date <= (CURRENT_DATE + interval '30 days')", nativeQuery = true)
    Integer fetch30DayForecastForSku(@Param("skuId") UUID skuId);
}
