package com.sapclone.inventory.controller;

import com.sapclone.inventory.model.CrmCompany;
import com.sapclone.inventory.model.CrmContact;
import com.sapclone.inventory.repository.CrmCompanyRepository;
import com.sapclone.inventory.repository.CrmContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/contacts")
@RequiredArgsConstructor
public class ContactsController {

    private final CrmCompanyRepository companyRepo;
    private final CrmContactRepository contactRepo;

    // ── Companies ──
    @GetMapping("/companies")
    public ResponseEntity<List<CrmCompany>> getAllCompanies() {
        return ResponseEntity.ok(companyRepo.findAllByOrderByNameAsc());
    }

    @PostMapping("/companies")
    public ResponseEntity<CrmCompany> createCompany(@RequestBody CrmCompany company) {
        return ResponseEntity.ok(companyRepo.save(company));
    }

    @PutMapping("/companies/{id}")
    public ResponseEntity<CrmCompany> updateCompany(@PathVariable UUID id, @RequestBody CrmCompany updated) {
        return companyRepo.findById(id).map(c -> {
            if (updated.getName() != null) c.setName(updated.getName());
            if (updated.getIndustry() != null) c.setIndustry(updated.getIndustry());
            if (updated.getSize() != null) c.setSize(updated.getSize());
            if (updated.getWebsite() != null) c.setWebsite(updated.getWebsite());
            if (updated.getNotes() != null) c.setNotes(updated.getNotes());
            return ResponseEntity.ok(companyRepo.save(c));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/companies/{id}")
    public ResponseEntity<Map<String,String>> deleteCompany(@PathVariable UUID id) {
        companyRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("status","deleted"));
    }

    // ── Contacts ──
    @GetMapping
    public ResponseEntity<List<CrmContact>> getAllContacts() {
        return ResponseEntity.ok(contactRepo.findAllByOrderByNameAsc());
    }

    @GetMapping("/by-company/{companyId}")
    public ResponseEntity<List<CrmContact>> getByCompany(@PathVariable UUID companyId) {
        return ResponseEntity.ok(contactRepo.findByCompanyIdOrderByNameAsc(companyId));
    }

    @PostMapping
    public ResponseEntity<CrmContact> createContact(@RequestBody CrmContact contact) {
        return ResponseEntity.ok(contactRepo.save(contact));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CrmContact> updateContact(@PathVariable UUID id, @RequestBody CrmContact updated) {
        return contactRepo.findById(id).map(c -> {
            if (updated.getName() != null) c.setName(updated.getName());
            if (updated.getEmail() != null) c.setEmail(updated.getEmail());
            if (updated.getPhone() != null) c.setPhone(updated.getPhone());
            if (updated.getDesignation() != null) c.setDesignation(updated.getDesignation());
            if (updated.getCompanyId() != null) c.setCompanyId(updated.getCompanyId());
            if (updated.getNotes() != null) c.setNotes(updated.getNotes());
            return ResponseEntity.ok(contactRepo.save(c));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String,String>> deleteContact(@PathVariable UUID id) {
        contactRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("status","deleted"));
    }
}
