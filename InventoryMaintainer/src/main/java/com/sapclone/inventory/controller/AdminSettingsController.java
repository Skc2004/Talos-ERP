package com.sapclone.inventory.controller;

import com.sapclone.inventory.model.AdminSetting;
import com.sapclone.inventory.model.NotificationPreference;
import com.sapclone.inventory.model.SlaDefinition;
import com.sapclone.inventory.model.WorkflowRule;
import com.sapclone.inventory.repository.AdminSettingRepository;
import com.sapclone.inventory.repository.NotificationPreferenceRepository;
import com.sapclone.inventory.repository.SlaDefinitionRepository;
import com.sapclone.inventory.repository.WorkflowRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminSettingsController {

    private final AdminSettingRepository adminSettingRepository;
    private final SlaDefinitionRepository slaDefinitionRepository;
    private final WorkflowRuleRepository workflowRuleRepository;
    private final NotificationPreferenceRepository notificationPreferenceRepository;

    @GetMapping("/settings")
    public ResponseEntity<List<AdminSetting>> getAllSettings() {
        return ResponseEntity.ok(adminSettingRepository.findAll());
    }

    @GetMapping("/settings/{key}")
    public ResponseEntity<AdminSetting> getSettingByKey(@PathVariable String key) {
        return adminSettingRepository.findBySettingKey(key)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/settings/{key}")
    public ResponseEntity<AdminSetting> upsertSetting(@PathVariable String key, @RequestBody AdminSetting settingInput) {
        AdminSetting setting = adminSettingRepository.findBySettingKey(key).orElse(new AdminSetting());
        setting.setSettingKey(key);
        if(settingInput.getSettingValue() != null) setting.setSettingValue(settingInput.getSettingValue());
        if(settingInput.getCategory() != null) setting.setCategory(settingInput.getCategory());
        return ResponseEntity.ok(adminSettingRepository.save(setting));
    }

    @GetMapping("/sla")
    public ResponseEntity<List<SlaDefinition>> getAllSlas() {
        return ResponseEntity.ok(slaDefinitionRepository.findAll());
    }

    @PostMapping("/sla")
    public ResponseEntity<SlaDefinition> createSla(@RequestBody SlaDefinition sla) {
        return ResponseEntity.ok(slaDefinitionRepository.save(sla));
    }

    @PutMapping("/sla/{id}")
    public ResponseEntity<SlaDefinition> updateSla(@PathVariable UUID id, @RequestBody SlaDefinition sla) {
        if(!slaDefinitionRepository.existsById(id)) return ResponseEntity.notFound().build();
        sla.setId(id);
        return ResponseEntity.ok(slaDefinitionRepository.save(sla));
    }

    @DeleteMapping("/sla/{id}")
    public ResponseEntity<Void> deleteSla(@PathVariable UUID id) {
        if(!slaDefinitionRepository.existsById(id)) return ResponseEntity.notFound().build();
        slaDefinitionRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/workflow-rules")
    public ResponseEntity<List<WorkflowRule>> getAllWorkflowRules() {
        return ResponseEntity.ok(workflowRuleRepository.findAll());
    }

    @PostMapping("/workflow-rules")
    public ResponseEntity<WorkflowRule> createWorkflowRule(@RequestBody WorkflowRule rule) {
        return ResponseEntity.ok(workflowRuleRepository.save(rule));
    }

    @PutMapping("/workflow-rules/{id}")
    public ResponseEntity<WorkflowRule> updateWorkflowRule(@PathVariable UUID id, @RequestBody WorkflowRule rule) {
        if(!workflowRuleRepository.existsById(id)) return ResponseEntity.notFound().build();
        rule.setId(id);
        return ResponseEntity.ok(workflowRuleRepository.save(rule));
    }

    @PutMapping("/workflow-rules/{id}/toggle")
    public ResponseEntity<WorkflowRule> toggleWorkflowRule(@PathVariable UUID id) {
        return workflowRuleRepository.findById(id).map(rule -> {
            rule.setIsActive(!rule.getIsActive());
            return ResponseEntity.ok(workflowRuleRepository.save(rule));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/workflow-rules/{id}")
    public ResponseEntity<Void> deleteWorkflowRule(@PathVariable UUID id) {
        if(!workflowRuleRepository.existsById(id)) return ResponseEntity.notFound().build();
        workflowRuleRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/notifications")
    public ResponseEntity<List<NotificationPreference>> getAllNotificationPreferences() {
        return ResponseEntity.ok(notificationPreferenceRepository.findAll());
    }

    @PutMapping("/notifications/{id}")
    public ResponseEntity<NotificationPreference> updateNotificationPreference(@PathVariable UUID id, @RequestBody NotificationPreference pref) {
        if(!notificationPreferenceRepository.existsById(id)) return ResponseEntity.notFound().build();
        pref.setId(id);
        return ResponseEntity.ok(notificationPreferenceRepository.save(pref));
    }
}
