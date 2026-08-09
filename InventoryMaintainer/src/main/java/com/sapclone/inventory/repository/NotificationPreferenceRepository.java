package com.sapclone.inventory.repository;

import com.sapclone.inventory.model.NotificationPreference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, UUID> {
    List<NotificationPreference> findByIsEnabledTrue();
    List<NotificationPreference> findByEventType(String eventType);
}
