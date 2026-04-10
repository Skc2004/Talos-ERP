package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.HrEmployee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface HrEmployeeRepository extends JpaRepository<HrEmployee, UUID> {
    List<HrEmployee> findByIsActiveTrue();
    List<HrEmployee> findByDepartment(String department);
}
