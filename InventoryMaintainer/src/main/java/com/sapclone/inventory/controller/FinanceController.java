package com.sapclone.inventory.controller;

import com.sapclone.inventory.model.FinExpense;
import com.sapclone.inventory.repository.FinExpenseRepository;
import com.sapclone.inventory.repository.HrEmployeeRepository;
import com.sapclone.inventory.service.AccountingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/finance")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class FinanceController {

    private final AccountingService accountingService;
    private final FinExpenseRepository finExpenseRepository;
    private final HrEmployeeRepository hrEmployeeRepository;

    /** Real-time Profit & Loss Statement */
    @GetMapping("/pnl")
    public ResponseEntity<Map<String, Object>> getPnL() {
        return ResponseEntity.ok(accountingService.computePnL());
    }

    /** List all expenses */
    @GetMapping("/expenses")
    public ResponseEntity<List<FinExpense>> getExpenses() {
        return ResponseEntity.ok(finExpenseRepository.findAll());
    }

    /** Log a new expense */
    @PostMapping("/expenses")
    public ResponseEntity<FinExpense> addExpense(@RequestBody FinExpense expense) {
        return ResponseEntity.ok(finExpenseRepository.save(expense));
    }

    /** Delete an expense */
    @DeleteMapping("/expenses/{id}")
    public ResponseEntity<Map<String, String>> deleteExpense(@PathVariable java.util.UUID id) {
        finExpenseRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    /** List all team employees */
    @GetMapping("/team")
    public ResponseEntity<?> getTeam() {
        return ResponseEntity.ok(hrEmployeeRepository.findByIsActiveTrue());
    }
}
