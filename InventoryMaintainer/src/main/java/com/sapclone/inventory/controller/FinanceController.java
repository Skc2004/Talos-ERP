package com.sapclone.inventory.controller;

import com.sapclone.inventory.model.FinExpense;
import com.sapclone.inventory.model.GeneralLedger;
import com.sapclone.inventory.repository.FinExpenseRepository;
import com.sapclone.inventory.repository.GeneralLedgerRepository;
import com.sapclone.inventory.repository.HrEmployeeRepository;
import com.sapclone.inventory.service.AccountingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/finance")
@RequiredArgsConstructor
@Tag(name = "Finance & Accounting", description = "P&L, Expenses, Double-Entry Ledger, Journal Entries")
public class FinanceController {

    private final AccountingService accountingService;
    private final FinExpenseRepository finExpenseRepository;
    private final HrEmployeeRepository hrEmployeeRepository;
    private final GeneralLedgerRepository generalLedgerRepository;

    /** Real-time Profit & Loss Statement */
    @GetMapping("/pnl")
    public ResponseEntity<Map<String, Object>> getPnL() {
        return ResponseEntity.ok(accountingService.computePnL());
    }

    /** List all expenses (operational — separate from immutable ledger) */
    @GetMapping("/expenses")
    public ResponseEntity<List<FinExpense>> getExpenses() {
        return ResponseEntity.ok(finExpenseRepository.findAll());
    }

    /** Log a new expense */
    @PostMapping("/expenses")
    public ResponseEntity<FinExpense> addExpense(@RequestBody FinExpense expense) {
        return ResponseEntity.ok(finExpenseRepository.save(expense));
    }

    /** Delete an operational expense (NOT a ledger entry) */
    @DeleteMapping("/expenses/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Map<String, String>> deleteExpense(@PathVariable UUID id) {
        finExpenseRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    /** List all team employees */
    @GetMapping("/team")
    public ResponseEntity<?> getTeam() {
        return ResponseEntity.ok(hrEmployeeRepository.findByIsActiveTrue());
    }

    // ──────────────────────────────────────────────
    // DOUBLE-ENTRY BOOKKEEPING ENDPOINTS
    // ──────────────────────────────────────────────

    /** Post a new journal entry (double-entry: debits == credits) */
    @PostMapping("/journal-entry")
    public ResponseEntity<?> postJournalEntry(@RequestBody List<GeneralLedger> entries) {
        if (entries == null || entries.size() < 2) {
            return ResponseEntity.badRequest().body(Map.of("error", "A journal entry requires at least 2 lines (debit + credit)"));
        }

        // Validate debit == credit balance
        UUID journalId = UUID.randomUUID();
        BigDecimal totalDebit = BigDecimal.ZERO;
        BigDecimal totalCredit = BigDecimal.ZERO;

        for (GeneralLedger entry : entries) {
            entry.setJournalEntryId(journalId);
            entry.setIsReversed(false);
            totalDebit = totalDebit.add(entry.getDebit() != null ? entry.getDebit() : BigDecimal.ZERO);
            totalCredit = totalCredit.add(entry.getCredit() != null ? entry.getCredit() : BigDecimal.ZERO);
        }

        if (totalDebit.compareTo(totalCredit) != 0) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Journal entry is unbalanced",
                    "totalDebit", totalDebit,
                    "totalCredit", totalCredit
            ));
        }

        List<GeneralLedger> saved = generalLedgerRepository.saveAll(entries);
        return ResponseEntity.ok(Map.of("journalEntryId", journalId, "lines", saved));
    }

    /** Reverse a journal entry (the ONLY way to correct immutable ledger records) */
    @PostMapping("/reverse/{journalEntryId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> reverseJournalEntry(@PathVariable UUID journalEntryId) {
        List<GeneralLedger> original = generalLedgerRepository.findByJournalEntryId(journalEntryId);
        if (original.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        if (original.stream().anyMatch(GeneralLedger::getIsReversed)) {
            return ResponseEntity.badRequest().body(Map.of("error", "This journal entry has already been reversed"));
        }

        // Create reversing entries (swap debit/credit)
        UUID reversalId = UUID.randomUUID();

        for (GeneralLedger line : original) {
            GeneralLedger reversal = new GeneralLedger();
            reversal.setJournalEntryId(reversalId);
            reversal.setAccountCode(line.getAccountCode());
            reversal.setDebit(line.getCredit());     // Swap
            reversal.setCredit(line.getDebit());     // Swap
            reversal.setSkuId(line.getSkuId());
            reversal.setDescription("REVERSAL: " + (line.getDescription() != null ? line.getDescription() : ""));
            reversal.setIsReversed(false);
            generalLedgerRepository.save(reversal);
        }

        return ResponseEntity.ok(Map.of("reversalJournalEntryId", reversalId, "originalEntryId", journalEntryId));
    }

    /** Get all active (non-reversed) ledger entries */
    @GetMapping("/ledger")
    public ResponseEntity<List<GeneralLedger>> getLedger() {
        return ResponseEntity.ok(generalLedgerRepository.findByIsReversedFalseOrderByTransactionDateDesc());
    }
}
