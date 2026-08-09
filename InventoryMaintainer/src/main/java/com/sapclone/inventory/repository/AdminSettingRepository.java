package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.AdminSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AdminSettingRepository extends JpaRepository<AdminSetting, UUID> {
    Optional<AdminSetting> findBySettingKey(String settingKey);
    List<AdminSetting> findByCategory(String category);
}
