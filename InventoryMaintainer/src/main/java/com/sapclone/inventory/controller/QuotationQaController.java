package com.sapclone.inventory.controller;

import com.sapclone.inventory.model.CrmQuotation;
import com.sapclone.inventory.model.QaChecklist;
import com.sapclone.inventory.repository.CrmQuotationRepository;
import com.sapclone.inventory.repository.QaChecklistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class QuotationQaController {

    private final CrmQuotationRepository quotationRepo;
    private final QaChecklistRepository qaRepo;

    // ── Quotations ──
    @GetMapping("/crm/leads/{leadId}/quotations")
    public ResponseEntity<List<CrmQuotation>> getQuotations(@PathVariable UUID leadId) {
        return ResponseEntity.ok(quotationRepo.findByLeadIdOrderByCreatedAtDesc(leadId));
    }

    @PostMapping("/crm/leads/{leadId}/quotations")
    public ResponseEntity<CrmQuotation> createQuotation(@PathVariable UUID leadId, @RequestBody CrmQuotation q) {
        q.setLeadId(leadId);
        return ResponseEntity.ok(quotationRepo.save(q));
    }

    @PutMapping("/crm/quotations/{id}")
    public ResponseEntity<CrmQuotation> updateQuotation(@PathVariable UUID id, @RequestBody CrmQuotation updated) {
        return quotationRepo.findById(id).map(q -> {
            if (updated.getItems() != null) q.setItems(updated.getItems());
            if (updated.getSubtotal() != null) q.setSubtotal(updated.getSubtotal());
            if (updated.getTaxRate() != null) q.setTaxRate(updated.getTaxRate());
            if (updated.getTotal() != null) q.setTotal(updated.getTotal());
            if (updated.getValidUntil() != null) q.setValidUntil(updated.getValidUntil());
            if (updated.getStatus() != null) q.setStatus(updated.getStatus());
            return ResponseEntity.ok(quotationRepo.save(q));
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── QA Checklists ──
    @GetMapping("/operations/projects/{projectId}/qa")
    public ResponseEntity<List<QaChecklist>> getProjectQa(@PathVariable UUID projectId) {
        return ResponseEntity.ok(qaRepo.findByProjectIdOrderByCreatedAtDesc(projectId));
    }

    @PostMapping("/operations/projects/{projectId}/qa")
    public ResponseEntity<QaChecklist> createQaChecklist(@PathVariable UUID projectId, @RequestBody QaChecklist qa) {
        qa.setProjectId(projectId);
        return ResponseEntity.ok(qaRepo.save(qa));
    }

    @PutMapping("/operations/qa/{id}")
    public ResponseEntity<QaChecklist> updateQaChecklist(@PathVariable UUID id, @RequestBody QaChecklist updated) {
        return qaRepo.findById(id).map(qa -> {
            if (updated.getItems() != null) qa.setItems(updated.getItems());
            if (updated.getCompletedAt() != null) qa.setCompletedAt(updated.getCompletedAt());
            return ResponseEntity.ok(qaRepo.save(qa));
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── QA Templates (for admin) ──
    @GetMapping("/operations/qa-templates")
    public ResponseEntity<List<Map<String,Object>>> getQaTemplates() {
        // Use Supabase direct read via native query alternative — just read from repo
        // For simplicity, use a native approach
        return ResponseEntity.ok(List.of());
    }
}
