package com.sapclone.inventory.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Stub controller for work orders — actual data is served directly
 * from Supabase in the frontend (work_orders, maintenance_orders tables).
 * This controller provides supplementary Java-computed endpoints only.
 */
@RestController
@RequestMapping("/api/v1/operations")
@RequiredArgsConstructor
public class WorkOrderController {

    /** Health check for this module. */
    @GetMapping("/work-orders/status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(Map.of(
                "module", "work-orders",
                "dataSource", "supabase-direct",
                "status", "ACTIVE"
        ));
    }
}
