package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.CrmContact;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface CrmContactRepository extends JpaRepository<CrmContact, UUID> {
    List<CrmContact> findByCompanyIdOrderByNameAsc(UUID companyId);
    List<CrmContact> findAllByOrderByNameAsc();
}
