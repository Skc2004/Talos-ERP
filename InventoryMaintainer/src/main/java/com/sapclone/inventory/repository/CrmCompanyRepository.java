package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.CrmCompany;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface CrmCompanyRepository extends JpaRepository<CrmCompany, UUID> {
    List<CrmCompany> findAllByOrderByNameAsc();
}
