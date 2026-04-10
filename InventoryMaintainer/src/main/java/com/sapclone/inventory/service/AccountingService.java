package com.sapclone.inventory.service;

import com.sapclone.inventory.repository.FinExpenseRepository;
import com.sapclone.inventory.repository.GeneralLedgerRepository;
import com.sapclone.inventory.repository.SalesOrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AccountingService {

    private final SalesOrderRepository salesOrderRepository;
    private final FinExpenseRepository finExpenseRepository;
    private final GeneralLedgerRepository generalLedgerRepository;

    // Default tax rate for P&L computation (configurable later)
    private static final BigDecimal TAX_RATE = new BigDecimal("0.18"); // 18% GST

    /**
     * Compute a full real-time Profit & Loss statement.
     *
     * Net Profit = Gross Revenue
     *            - Cost of Goods Sold (from general_ledger COGS entries)
     *            - Operating Expenses (from fin_expenses)
     *            - Estimated Tax Burden
     */
    public Map<String, Object> computePnL() {
        // 1. Gross Revenue = sum of all completed sales
        BigDecimal grossRevenue = salesOrderRepository.getTotalRevenue();
        long totalOrders = salesOrderRepository.count();

        // 2. COGS = sum of debit entries in the general ledger with COGS account codes
        BigDecimal cogs = generalLedgerRepository.findAll().stream()
                .filter(e -> e.getAccountCode() != null && e.getAccountCode().startsWith("COGS"))
                .map(e -> e.getDebit() != null ? e.getDebit() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 3. Gross Profit
        BigDecimal grossProfit = grossRevenue.subtract(cogs);

        // 4. Operating Expenses
        BigDecimal operatingExpenses = finExpenseRepository.getTotalExpenses();
        List<Object[]> expenseBreakdown = finExpenseRepository.getExpensesByCategory();

        // 5. EBITDA (Earnings Before Interest, Tax, Depreciation & Amortization)
        BigDecimal ebitda = grossProfit.subtract(operatingExpenses);

        // 6. Estimated Tax
        BigDecimal estimatedTax = ebitda.compareTo(BigDecimal.ZERO) > 0
                ? ebitda.multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // 7. Net Profit
        BigDecimal netProfit = ebitda.subtract(estimatedTax);

        // 8. Profit Margin
        BigDecimal profitMargin = grossRevenue.compareTo(BigDecimal.ZERO) > 0
                ? netProfit.divide(grossRevenue, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;

        // Build response
        Map<String, Object> pnl = new LinkedHashMap<>();
        pnl.put("grossRevenue", grossRevenue);
        pnl.put("totalOrders", totalOrders);
        pnl.put("costOfGoodsSold", cogs);
        pnl.put("grossProfit", grossProfit);
        pnl.put("operatingExpenses", operatingExpenses);
        pnl.put("ebitda", ebitda);
        pnl.put("estimatedTax", estimatedTax);
        pnl.put("taxRate", TAX_RATE);
        pnl.put("netProfit", netProfit);
        pnl.put("profitMarginPercent", profitMargin);

        // Waterfall data for the chart
        List<Map<String, Object>> waterfall = new ArrayList<>();
        waterfall.add(Map.of("label", "Gross Revenue", "value", grossRevenue, "type", "income"));
        waterfall.add(Map.of("label", "COGS", "value", cogs.negate(), "type", "expense"));
        waterfall.add(Map.of("label", "Gross Profit", "value", grossProfit, "type", "subtotal"));
        // Add each expense category
        for (Object[] cat : expenseBreakdown) {
            waterfall.add(Map.of("label", cat[0].toString(), "value", ((BigDecimal)cat[1]).negate(), "type", "expense"));
        }
        waterfall.add(Map.of("label", "EBITDA", "value", ebitda, "type", "subtotal"));
        waterfall.add(Map.of("label", "Tax (" + TAX_RATE.multiply(new BigDecimal("100")).intValue() + "%)", "value", estimatedTax.negate(), "type", "expense"));
        waterfall.add(Map.of("label", "Net Profit", "value", netProfit, "type", "total"));

        pnl.put("waterfall", waterfall);

        log.info("P&L computed: Revenue={}, COGS={}, Expenses={}, Net={}", grossRevenue, cogs, operatingExpenses, netProfit);
        return pnl;
    }
}
