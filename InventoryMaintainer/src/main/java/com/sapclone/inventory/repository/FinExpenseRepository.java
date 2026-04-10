package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.FinExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Repository
public interface FinExpenseRepository extends JpaRepository<FinExpense, UUID> {

    List<FinExpense> findByCategoryOrderByExpenseDateDesc(String category);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM FinExpense e")
    BigDecimal getTotalExpenses();

    @Query("SELECT e.category, COALESCE(SUM(e.amount), 0) FROM FinExpense e GROUP BY e.category ORDER BY SUM(e.amount) DESC")
    List<Object[]> getExpensesByCategory();
}
