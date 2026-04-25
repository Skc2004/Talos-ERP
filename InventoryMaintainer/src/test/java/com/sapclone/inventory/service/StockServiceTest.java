package com.sapclone.inventory.service;

import com.sapclone.inventory.model.SkuMaster;
import com.sapclone.inventory.repository.SkuMasterRepository;
import com.sapclone.inventory.repository.StockLedgerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("StockService — Rebalancing Mathematics Validation")
class StockServiceTest {

    @Mock
    private SkuMasterRepository skuMasterRepository;

    @Mock
    private StockLedgerRepository stockLedgerRepository;

    @InjectMocks
    private StockService stockService;

    private SkuMaster testSku;

    @BeforeEach
    void setUp() {
        testSku = new SkuMaster();
        testSku.setId(UUID.fromString("11111111-1111-1111-1111-111111111111"));
        testSku.setSkuCode("TEST-SKU-001");
        testSku.setDescription("Unit Test Widget");
        testSku.setLeadTimeDays(5);
        testSku.setReorderPoint(20);
    }

    @Nested
    @DisplayName("Safety Stock Calculation: SS = Z × σ × √L")
    class SafetyStockTests {

        @Test
        @DisplayName("Standard case: σ=4.2, L=5 → SS = ceil(1.645 × 4.2 × √5) = 16")
        void standardSafetyStock() {
            when(skuMasterRepository.findBySkuCode("TEST-SKU-001")).thenReturn(testSku);
            when(stockLedgerRepository.getAvgDailyDemand60Days(any())).thenReturn(15.5);
            when(stockLedgerRepository.getStdDevDailyDemand60Days(any())).thenReturn(4.2);
            when(stockLedgerRepository.getCurrentStockForSku(any())).thenReturn(250);

            Map<String, Object> result = stockService.calculateRebalancingMetrics("TEST-SKU-001", null, null, null, null);

            // SS = ceil(1.645 × 4.2 × √5) = ceil(1.645 × 4.2 × 2.2360679...) = ceil(15.449...) = 16
            assertEquals(16, result.get("safetyStock_SS"));
        }

        @Test
        @DisplayName("Zero deviation: σ=0 → SS = 0 (perfectly predictable demand)")
        void zeroDeviationSafetyStock() {
            when(skuMasterRepository.findBySkuCode("TEST-SKU-001")).thenReturn(testSku);
            when(stockLedgerRepository.getAvgDailyDemand60Days(any())).thenReturn(10.0);
            when(stockLedgerRepository.getStdDevDailyDemand60Days(any())).thenReturn(0.0);
            when(stockLedgerRepository.getCurrentStockForSku(any())).thenReturn(100);

            Map<String, Object> result = stockService.calculateRebalancingMetrics("TEST-SKU-001", null, null, null, null);

            assertEquals(0, result.get("safetyStock_SS"));
        }

        @Test
        @DisplayName("High volatility: σ=12.0, L=14 → SS = ceil(1.645 × 12 × √14) = 74")
        void highVolatilitySafetyStock() {
            testSku.setLeadTimeDays(14);
            when(skuMasterRepository.findBySkuCode("TEST-SKU-001")).thenReturn(testSku);
            when(stockLedgerRepository.getAvgDailyDemand60Days(any())).thenReturn(8.0);
            when(stockLedgerRepository.getStdDevDailyDemand60Days(any())).thenReturn(12.0);
            when(stockLedgerRepository.getCurrentStockForSku(any())).thenReturn(50);

            Map<String, Object> result = stockService.calculateRebalancingMetrics("TEST-SKU-001", null, null, null, null);

            int ss = (int) result.get("safetyStock_SS");
            // ceil(1.645 × 12 × 3.7416573...) = ceil(73.86...) = 74
            assertEquals(74, ss);
        }
    }

    @Nested
    @DisplayName("Reorder Point Calculation: ROP = (d × L) + SS")
    class ReorderPointTests {

        @Test
        @DisplayName("Standard case: d=15.5, L=5, SS=16 → ROP = ceil(77.5 + 16) = 94")
        void standardReorderPoint() {
            when(skuMasterRepository.findBySkuCode("TEST-SKU-001")).thenReturn(testSku);
            when(stockLedgerRepository.getAvgDailyDemand60Days(any())).thenReturn(15.5);
            when(stockLedgerRepository.getStdDevDailyDemand60Days(any())).thenReturn(4.2);
            when(stockLedgerRepository.getCurrentStockForSku(any())).thenReturn(250);

            Map<String, Object> result = stockService.calculateRebalancingMetrics("TEST-SKU-001", null, null, null, null);

            int rop = (int) result.get("reorderPoint_ROP");
            // ceil((15.5 × 5) + 16) = ceil(93.5) = 94
            assertEquals(94, rop);
        }
    }

    @Nested
    @DisplayName("Inventory Health Score: (Current − SS) / d")
    class HealthScoreTests {

        @Test
        @DisplayName("Healthy: stock=250, SS=16, d=15.5 → health=15.1 → OPTIMAL")
        void healthyStock() {
            when(skuMasterRepository.findBySkuCode("TEST-SKU-001")).thenReturn(testSku);
            when(stockLedgerRepository.getAvgDailyDemand60Days(any())).thenReturn(15.5);
            when(stockLedgerRepository.getStdDevDailyDemand60Days(any())).thenReturn(4.2);
            when(stockLedgerRepository.getCurrentStockForSku(any())).thenReturn(250);

            Map<String, Object> result = stockService.calculateRebalancingMetrics("TEST-SKU-001", null, null, null, null);

            assertEquals("OPTIMAL", result.get("healthStatus"));
        }

        @Test
        @DisplayName("Critical: stock=8, SS=16, d=15.5 → health=-0.5 → CRITICAL")
        void criticalStock() {
            when(skuMasterRepository.findBySkuCode("TEST-SKU-001")).thenReturn(testSku);
            when(stockLedgerRepository.getAvgDailyDemand60Days(any())).thenReturn(15.5);
            when(stockLedgerRepository.getStdDevDailyDemand60Days(any())).thenReturn(4.2);
            when(stockLedgerRepository.getCurrentStockForSku(any())).thenReturn(8);

            Map<String, Object> result = stockService.calculateRebalancingMetrics("TEST-SKU-001", null, null, null, null);

            assertEquals("CRITICAL", result.get("healthStatus"));
            assertTrue((boolean) result.get("needsReorder"));
        }

        @Test
        @DisplayName("Warning zone: stock=60, SS=16, d=15.5 → health=2.8 → CRITICAL edge")
        void warningZone() {
            when(skuMasterRepository.findBySkuCode("TEST-SKU-001")).thenReturn(testSku);
            when(stockLedgerRepository.getAvgDailyDemand60Days(any())).thenReturn(15.5);
            when(stockLedgerRepository.getStdDevDailyDemand60Days(any())).thenReturn(4.2);
            when(stockLedgerRepository.getCurrentStockForSku(any())).thenReturn(60);

            Map<String, Object> result = stockService.calculateRebalancingMetrics("TEST-SKU-001", null, null, null, null);

            String status = (String) result.get("healthStatus");
            assertTrue(status.equals("WARNING") || status.equals("CRITICAL"));
        }
    }

    @Nested
    @DisplayName("Edge Cases & Guard Rails")
    class EdgeCaseTests {

        @Test
        @DisplayName("Unknown SKU returns error map")
        void unknownSku() {
            when(skuMasterRepository.findBySkuCode("INVALID")).thenReturn(null);

            Map<String, Object> result = stockService.calculateRebalancingMetrics("INVALID", null, null, null, null);

            assertTrue(result.containsKey("error"));
        }

        @Test
        @DisplayName("Null stock returns 0, not NPE")
        void nullCurrentStock() {
            when(skuMasterRepository.findBySkuCode("TEST-SKU-001")).thenReturn(testSku);
            when(stockLedgerRepository.getAvgDailyDemand60Days(any())).thenReturn(5.0);
            when(stockLedgerRepository.getStdDevDailyDemand60Days(any())).thenReturn(2.0);
            when(stockLedgerRepository.getCurrentStockForSku(any())).thenReturn(null);

            assertDoesNotThrow(() -> {
                Map<String, Object> result = stockService.calculateRebalancingMetrics("TEST-SKU-001", null, null, null, null);
                assertEquals(0, result.get("currentStock"));
            });
        }

        @Test
        @DisplayName("Null avg demand defaults to 0.01 to prevent division by zero")
        void nullDemandPreventsDiv0() {
            when(skuMasterRepository.findBySkuCode("TEST-SKU-001")).thenReturn(testSku);
            when(stockLedgerRepository.getAvgDailyDemand60Days(any())).thenReturn(null);
            when(stockLedgerRepository.getStdDevDailyDemand60Days(any())).thenReturn(null);
            when(stockLedgerRepository.getCurrentStockForSku(any())).thenReturn(100);

            assertDoesNotThrow(() -> {
                Map<String, Object> result = stockService.calculateRebalancingMetrics("TEST-SKU-001", null, null, null, null);
                assertNotNull(result.get("healthScoreDays"));
            });
        }
    }
}
