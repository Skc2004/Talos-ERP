package com.sapclone.inventory.controller;

import com.sapclone.inventory.model.*;
import com.sapclone.inventory.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/v1/operations")
@RequiredArgsConstructor
public class OperationsController {

    private final TimeEntryRepository timeEntryRepository;
    private final ProjectRepository projectRepository;
    private final MilestoneRepository milestoneRepository;
    private final AssignmentRepository assignmentRepository;
    private final RiskRepository riskRepository;

    // ─────────────────────────────────────────────
    // PROJECT CRUD
    // ─────────────────────────────────────────────

    @GetMapping("/projects")
    public ResponseEntity<List<Project>> getAllProjects() {
        return ResponseEntity.ok(projectRepository.findAllByOrderByDeadlineAsc());
    }

    @GetMapping("/projects/{id}")
    public ResponseEntity<Project> getProject(@PathVariable UUID id) {
        return projectRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/projects")
    public ResponseEntity<Project> createProject(@RequestBody Project project) {
        project.setId(null); // ensure DB generates it
        return ResponseEntity.ok(projectRepository.save(project));
    }

    @PutMapping("/projects/{id}")
    public ResponseEntity<Project> updateProject(@PathVariable UUID id, @RequestBody Project updated) {
        return projectRepository.findById(id).map(existing -> {
            if (updated.getProjectName() != null) existing.setProjectName(updated.getProjectName());
            if (updated.getClientName() != null) existing.setClientName(updated.getClientName());
            if (updated.getStatus() != null) existing.setStatus(updated.getStatus());
            if (updated.getPriority() != null) existing.setPriority(updated.getPriority());
            if (updated.getDeadline() != null) existing.setDeadline(updated.getDeadline());
            if (updated.getEstimatedHours() != null) existing.setEstimatedHours(updated.getEstimatedHours());
            if (updated.getBudget() != null) existing.setBudget(updated.getBudget());
            if (updated.getHourlyRate() != null) existing.setHourlyRate(updated.getHourlyRate());
            if (updated.getDescription() != null) existing.setDescription(updated.getDescription());
            if (updated.getMachineId() != null) existing.setMachineId(updated.getMachineId());
            if (updated.getTags() != null) existing.setTags(updated.getTags());
            return ResponseEntity.ok(projectRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/projects/{id}")
    public ResponseEntity<Map<String, String>> deleteProject(@PathVariable UUID id) {
        if (!projectRepository.existsById(id)) return ResponseEntity.notFound().build();
        projectRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("status", "deleted", "id", id.toString()));
    }

    // ─────────────────────────────────────────────
    // MILESTONE CRUD
    // ─────────────────────────────────────────────

    @GetMapping("/projects/{projectId}/milestones")
    public ResponseEntity<List<ProjectMilestone>> getMilestones(@PathVariable UUID projectId) {
        return ResponseEntity.ok(milestoneRepository.findByProjectIdOrderBySortOrderAsc(projectId));
    }

    @PostMapping("/projects/{projectId}/milestones")
    public ResponseEntity<ProjectMilestone> createMilestone(@PathVariable UUID projectId,
                                                             @RequestBody ProjectMilestone milestone) {
        milestone.setProjectId(projectId);
        milestone.setIsCompleted(false);
        return ResponseEntity.ok(milestoneRepository.save(milestone));
    }

    @PatchMapping("/milestones/{id}/toggle")
    public ResponseEntity<ProjectMilestone> toggleMilestone(@PathVariable UUID id) {
        return milestoneRepository.findById(id).map(m -> {
            m.setIsCompleted(!Boolean.TRUE.equals(m.getIsCompleted()));
            return ResponseEntity.ok(milestoneRepository.save(m));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/milestones/{id}")
    public ResponseEntity<Map<String, String>> deleteMilestone(@PathVariable UUID id) {
        if (!milestoneRepository.existsById(id)) return ResponseEntity.notFound().build();
        milestoneRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    // ─────────────────────────────────────────────
    // RESOURCE ASSIGNMENTS
    // ─────────────────────────────────────────────

    @GetMapping("/assignments")
    public ResponseEntity<List<ProjectAssignment>> getAllAssignments() {
        return ResponseEntity.ok(assignmentRepository.findAll());
    }

    @GetMapping("/projects/{projectId}/assignments")
    public ResponseEntity<List<ProjectAssignment>> getProjectAssignments(@PathVariable UUID projectId) {
        return ResponseEntity.ok(assignmentRepository.findByProjectId(projectId));
    }

    @PostMapping("/assignments")
    public ResponseEntity<ProjectAssignment> createAssignment(@RequestBody ProjectAssignment assignment) {
        return ResponseEntity.ok(assignmentRepository.save(assignment));
    }

    @DeleteMapping("/assignments/{id}")
    public ResponseEntity<Map<String, String>> deleteAssignment(@PathVariable UUID id) {
        if (!assignmentRepository.existsById(id)) return ResponseEntity.notFound().build();
        assignmentRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    @GetMapping("/workload/matrix")
    public ResponseEntity<List<Map<String, Object>>> getWorkloadMatrix() {
        List<Object[]> rows = assignmentRepository.getWorkloadSummary();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : rows) {
            result.add(Map.of("employeeName", row[0], "totalAllocatedHours", row[1]));
        }
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────
    // RISK REGISTER
    // ─────────────────────────────────────────────

    @GetMapping("/projects/{projectId}/risks")
    public ResponseEntity<List<ProjectRisk>> getProjectRisks(@PathVariable UUID projectId) {
        return ResponseEntity.ok(riskRepository.findByProjectIdOrderByCreatedAtDesc(projectId));
    }

    @PostMapping("/projects/{projectId}/risks")
    public ResponseEntity<ProjectRisk> createRisk(@PathVariable UUID projectId, @RequestBody ProjectRisk risk) {
        risk.setProjectId(projectId);
        if (risk.getStatus() == null) risk.setStatus("OPEN");
        return ResponseEntity.ok(riskRepository.save(risk));
    }

    @PutMapping("/risks/{id}")
    public ResponseEntity<ProjectRisk> updateRisk(@PathVariable UUID id, @RequestBody ProjectRisk updated) {
        return riskRepository.findById(id).map(existing -> {
            if (updated.getTitle() != null) existing.setTitle(updated.getTitle());
            if (updated.getDescription() != null) existing.setDescription(updated.getDescription());
            if (updated.getProbability() != null) existing.setProbability(updated.getProbability());
            if (updated.getImpact() != null) existing.setImpact(updated.getImpact());
            if (updated.getMitigation() != null) existing.setMitigation(updated.getMitigation());
            if (updated.getOwner() != null) existing.setOwner(updated.getOwner());
            if (updated.getStatus() != null) existing.setStatus(updated.getStatus());
            return ResponseEntity.ok(riskRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/risks/{id}")
    public ResponseEntity<Map<String, String>> deleteRisk(@PathVariable UUID id) {
        if (!riskRepository.existsById(id)) return ResponseEntity.notFound().build();
        riskRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    // ─────────────────────────────────────────────
    // TIME TRACKING (existing + enhanced)
    // ─────────────────────────────────────────────

    @PostMapping("/projects/{projectId}/time")
    public ResponseEntity<TimeEntry> logTime(@PathVariable UUID projectId, @RequestBody TimeEntry entry) {
        entry.setProjectId(projectId);
        return ResponseEntity.ok(timeEntryRepository.save(entry));
    }

    @GetMapping("/projects/{projectId}/time")
    public ResponseEntity<List<TimeEntry>> getProjectTimeEntries(@PathVariable UUID projectId) {
        return ResponseEntity.ok(timeEntryRepository.findByProjectIdOrderByLoggedAtDesc(projectId));
    }

    @GetMapping("/workload")
    public ResponseEntity<List<Map<String, Object>>> getWorkload() {
        return ResponseEntity.ok(timeEntryRepository.getWorkloadByEmployee());
    }

    // ─────────────────────────────────────────────
    // PROJECT COST SUMMARY
    // ─────────────────────────────────────────────

    @GetMapping("/projects/{projectId}/cost-summary")
    public ResponseEntity<Map<String, Object>> getCostSummary(@PathVariable UUID projectId) {
        return projectRepository.findById(projectId).map(project -> {
            // Labor cost from time entries
            List<TimeEntry> entries = timeEntryRepository.findByProjectIdOrderByLoggedAtDesc(projectId);
            double totalHours = entries.stream().mapToDouble(e -> e.getHours() != null ? e.getHours().doubleValue() : 0).sum();
            double rate = project.getHourlyRate() != null ? project.getHourlyRate().doubleValue() : 150.0;
            double laborCost = totalHours * rate;
            double budget = project.getBudget() != null ? project.getBudget().doubleValue() : 0;
            double variance = budget > 0 ? ((laborCost - budget) / budget) * 100 : 0;
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("projectId", projectId);
            summary.put("projectName", project.getProjectName());
            summary.put("budget", budget);
            summary.put("hourlyRate", rate);
            summary.put("totalHoursLogged", totalHours);
            summary.put("laborCost", laborCost);
            summary.put("variancePct", Math.round(variance * 10.0) / 10.0);
            summary.put("budgetStatus", variance < -10 ? "UNDER_BUDGET" : variance > 10 ? "OVER_BUDGET" : "ON_TRACK");
            return ResponseEntity.ok(summary);
        }).orElse(ResponseEntity.notFound().build());
    }

    // ─────────────────────────────────────────────
    // QA CHECKLIST (existing)
    // ─────────────────────────────────────────────

    @GetMapping("/operations/projects/{projectId}/qa")
    public ResponseEntity<?> getQa(@PathVariable UUID projectId) {
        return ResponseEntity.ok(Map.of("projectId", projectId));
    }

    @PostMapping("/operations/projects/{projectId}/qa")
    public ResponseEntity<?> saveQa(@PathVariable UUID projectId, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(Map.of("status", "saved", "projectId", projectId));
    }
}
