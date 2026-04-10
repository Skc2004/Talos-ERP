package com.sapclone.inventory.controller;

import com.sapclone.inventory.model.CrmLead;
import com.sapclone.inventory.repository.CrmLeadRepository;
import com.sapclone.inventory.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/crm")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CrmController {

    private final ProjectService projectService;
    private final CrmLeadRepository crmLeadRepository;

    /** Get all leads, sorted by AI score. */
    @GetMapping("/leads")
    public ResponseEntity<List<CrmLead>> getAllLeads() {
        return ResponseEntity.ok(crmLeadRepository.findAllByOrderByAiScoreDesc());
    }

    /** Get a single lead by ID. */
    @GetMapping("/leads/{id}")
    public ResponseEntity<CrmLead> getLead(@PathVariable UUID id) {
        return crmLeadRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Create a new lead. */
    @PostMapping("/leads")
    public ResponseEntity<CrmLead> createLead(@RequestBody CrmLead lead) {
        return ResponseEntity.ok(crmLeadRepository.save(lead));
    }

    /** Update an existing lead (edit fields, change status, etc). */
    @PutMapping("/leads/{id}")
    public ResponseEntity<CrmLead> updateLead(@PathVariable UUID id, @RequestBody CrmLead updated) {
        return crmLeadRepository.findById(id)
                .map(existing -> {
                    if (updated.getContactName() != null) existing.setContactName(updated.getContactName());
                    if (updated.getContactEmail() != null) existing.setContactEmail(updated.getContactEmail());
                    if (updated.getContactPhone() != null) existing.setContactPhone(updated.getContactPhone());
                    if (updated.getCompanyName() != null) existing.setCompanyName(updated.getCompanyName());
                    if (updated.getPotentialValue() != null) existing.setPotentialValue(updated.getPotentialValue());
                    if (updated.getStatus() != null) existing.setStatus(updated.getStatus());
                    if (updated.getSource() != null) existing.setSource(updated.getSource());
                    if (updated.getNotes() != null) existing.setNotes(updated.getNotes());
                    if (updated.getAssignedTo() != null) existing.setAssignedTo(updated.getAssignedTo());
                    return ResponseEntity.ok(crmLeadRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /** Reassign a lead to another employee. */
    @PatchMapping("/leads/{id}/assign")
    public ResponseEntity<CrmLead> reassignLead(
            @PathVariable UUID id,
            @RequestParam UUID employeeId) {
        return crmLeadRepository.findById(id)
                .map(lead -> {
                    lead.setAssignedTo(employeeId);
                    return ResponseEntity.ok(crmLeadRepository.save(lead));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /** Delete a lead. */
    @DeleteMapping("/leads/{id}")
    public ResponseEntity<Map<String, String>> deleteLead(@PathVariable UUID id) {
        if (!crmLeadRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        crmLeadRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("status", "deleted", "id", id.toString()));
    }

    /** Convert a lead into a project + ledger entries atomically. */
    @PostMapping("/leads/{leadId}/convert")
    public ResponseEntity<Map<String, Object>> convertLead(
            @PathVariable UUID leadId,
            @RequestParam String projectName,
            @RequestParam(defaultValue = "80") int estimatedHours) {
        return ResponseEntity.ok(projectService.convertLeadToProject(leadId, projectName, estimatedHours));
    }

    /** Pipeline analytics: total value, conversion rate, status breakdown. */
    @GetMapping("/pipeline")
    public ResponseEntity<Map<String, Object>> getPipeline() {
        return ResponseEntity.ok(projectService.getPipelineAnalytics());
    }

    /** Deadline health for all active projects. */
    @GetMapping("/projects/health")
    public ResponseEntity<List<Map<String, Object>>> getDeadlineHealth() {
        return ResponseEntity.ok(projectService.getDeadlineHealth());
    }

    /** Resource conflict detection. */
    @GetMapping("/projects/conflicts")
    public ResponseEntity<List<Map<String, Object>>> getConflicts() {
        return ResponseEntity.ok(projectService.detectResourceConflicts());
    }
}
