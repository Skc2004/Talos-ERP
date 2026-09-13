package com.sapclone.inventory.controller;

import com.sapclone.inventory.model.Tenant;
import com.sapclone.inventory.repository.TenantRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/tenant")
@RequiredArgsConstructor
public class TenantController {

    private final TenantRepository tenantRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.service.role.key}")
    private String supabaseServiceRoleKey;

    @PostMapping("/register")
    public ResponseEntity<?> registerTenant(@RequestBody RegisterTenantRequest request) {
        String userId = SecurityContextHolder.getContext().getAuthentication().getName();
        if (userId == null || userId.equals("anonymousUser")) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        // 1. Create Tenant
        String slug = request.getCompanyName().toLowerCase().replaceAll("[^a-z0-9]", "-");
        if (tenantRepository.existsBySlug(slug)) {
            slug = slug + "-" + UUID.randomUUID().toString().substring(0, 4);
        }

        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        tenant.setName(request.getCompanyName());
        tenant.setSlug(slug);
        tenant.setPlan("FREE");
        tenant.setIsActive(true);
        tenant.setCreatedAt(OffsetDateTime.now());
        tenantRepository.save(tenant);

        // 2. Update Supabase User app_metadata via Admin API
        try {
            String adminApiUrl = supabaseUrl + "/auth/v1/admin/users/" + userId;
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);
            headers.set("apikey", supabaseServiceRoleKey);
            headers.set("Content-Type", "application/json");

            // Update app_metadata
            Map<String, Object> payload = Map.of(
                    "app_metadata", Map.of("tenant_id", tenant.getId().toString())
            );

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
            ResponseEntity<String> response = restTemplate.exchange(adminApiUrl, HttpMethod.PUT, entity, String.class);
            
            if (!response.getStatusCode().is2xxSuccessful()) {
                log.error("Failed to update Supabase User: {}", response.getBody());
                return ResponseEntity.status(500).body(Map.of("error", "Failed to link user to tenant"));
            }

        } catch (Exception e) {
            log.error("Exception updating Supabase Admin API", e);
            return ResponseEntity.status(500).body(Map.of("error", "Internal Server Error during tenant assignment"));
        }

        return ResponseEntity.ok(Map.of("status", "success", "tenant_id", tenant.getId()));
    }

    @Data
    public static class RegisterTenantRequest {
        private String companyName;
    }
}
