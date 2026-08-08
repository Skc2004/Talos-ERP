package com.sapclone.inventory.controller;

import com.sapclone.inventory.model.TimeEntry;
import com.sapclone.inventory.repository.TimeEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/operations")
@RequiredArgsConstructor
public class OperationsController {

    private final TimeEntryRepository timeEntryRepository;

    /** Log time worked on a project. */
    @PostMapping("/projects/{projectId}/time")
    public ResponseEntity<TimeEntry> logTime(@PathVariable UUID projectId, @RequestBody TimeEntry entry) {
        entry.setProjectId(projectId);
        return ResponseEntity.ok(timeEntryRepository.save(entry));
    }

    /** Get all time entries for a project. */
    @GetMapping("/projects/{projectId}/time")
    public ResponseEntity<List<TimeEntry>> getProjectTimeEntries(@PathVariable UUID projectId) {
        return ResponseEntity.ok(timeEntryRepository.findByProjectIdOrderByLoggedAtDesc(projectId));
    }

    /** Get workload summary by employee (total hours per employee). */
    @GetMapping("/workload")
    public ResponseEntity<List<Map<String, Object>>> getWorkload() {
        return ResponseEntity.ok(timeEntryRepository.getWorkloadByEmployee());
    }
}
