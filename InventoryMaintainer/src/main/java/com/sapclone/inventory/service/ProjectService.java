package com.sapclone.inventory.service;

import com.sapclone.inventory.model.*;
import com.sapclone.inventory.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectService {

    private final CrmLeadRepository leadRepository;
    private final ProjectRepository projectRepository;
    private final GeneralLedgerRepository ledgerRepository;

    /**
     * ATOMIC Lead-to-Ledger Conversion.
     * In a single @Transactional boundary:
     *   1. Updates lead status to WON
     *   2. Creates a Project record
     *   3. Books "Expected Revenue" in the General Ledger
     * If ANY step fails, the entire transaction rolls back.
     */
    @Transactional
    public Map<String, Object> convertLeadToProject(UUID leadId, String projectName, int estimatedHours) {
        CrmLead lead = leadRepository.findById(leadId)
            .orElseThrow(() -> new RuntimeException("Lead not found: " + leadId));

        if (lead.getConvertedProjectId() != null) {
            throw new RuntimeException("Lead already converted to project: " + lead.getConvertedProjectId());
        }

        // Step 1: Update lead status
        lead.setStatus(LeadStatus.WON);

        // Step 2: Create project
        Project project = new Project();
        project.setLeadId(leadId);
        project.setProjectName(projectName);
        project.setClientName(lead.getCompanyName());
        project.setDeadline(ZonedDateTime.now().plusDays(30));
        project.setStatus(ProjectStatus.PLANNING);
        project.setPriority(20);
        project.setEstimatedHours(BigDecimal.valueOf(estimatedHours));
        project.setEstimatedCost(lead.getPotentialValue().multiply(BigDecimal.valueOf(0.6)));
        project = projectRepository.save(project);

        // Step 3: Link lead to project
        lead.setConvertedProjectId(project.getId());
        leadRepository.save(lead);

        // Step 4: Book expected revenue in General Ledger
        GeneralLedger revenueEntry = new GeneralLedger();
        revenueEntry.setAccountCode("REV-EXPECTED");
        revenueEntry.setCredit(lead.getPotentialValue());
        revenueEntry.setDebit(BigDecimal.ZERO);
        revenueEntry.setDescription("Expected revenue from lead conversion: " + lead.getCompanyName() + " - " + projectName);
        ledgerRepository.save(revenueEntry);

        GeneralLedger costEntry = new GeneralLedger();
        costEntry.setAccountCode("COGS-PROJECTED");
        costEntry.setDebit(project.getEstimatedCost());
        costEntry.setCredit(BigDecimal.ZERO);
        costEntry.setDescription("Projected COGS for project: " + projectName);
        ledgerRepository.save(costEntry);

        log.info("Lead {} converted to Project {}. Revenue: {}, Projected COGS: {}",
                leadId, project.getId(), lead.getPotentialValue(), project.getEstimatedCost());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "converted");
        result.put("leadId", leadId);
        result.put("projectId", project.getId());
        result.put("projectName", projectName);
        result.put("expectedRevenue", lead.getPotentialValue());
        result.put("projectedCost", project.getEstimatedCost());
        result.put("projectedMargin", lead.getPotentialValue().subtract(project.getEstimatedCost()));
        return result;
    }

    /**
     * Calculates deadline slack for all active projects.
     * T_slack = deadline - (now + estimated_production_hours)
     */
    public List<Map<String, Object>> getDeadlineHealth() {
        List<Project> active = projectRepository.findActiveProjects();
        List<Map<String, Object>> health = new ArrayList<>();

        for (Project p : active) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("projectId", p.getId());
            entry.put("projectName", p.getProjectName());
            entry.put("clientName", p.getClientName());
            entry.put("status", p.getStatus());
            entry.put("machineId", p.getMachineId());

            if (p.getDeadline() != null && p.getEstimatedHours() != null) {
                long estimatedMinutes = p.getEstimatedHours().multiply(BigDecimal.valueOf(60)).longValue();
                ZonedDateTime estimatedCompletion = ZonedDateTime.now().plusMinutes(estimatedMinutes);
                double slackHours = ChronoUnit.MINUTES.between(estimatedCompletion, p.getDeadline()) / 60.0;

                entry.put("deadline", p.getDeadline());
                entry.put("slackHours", Math.round(slackHours * 10.0) / 10.0);

                if (slackHours < 0) entry.put("deadlineStatus", "OVERDUE");
                else if (slackHours < 48) entry.put("deadlineStatus", "AT_RISK");
                else entry.put("deadlineStatus", "ON_TRACK");
            } else {
                entry.put("slackHours", null);
                entry.put("deadlineStatus", "NO_DEADLINE");
            }

            health.add(entry);
        }

        return health;
    }

    /**
     * Detects resource conflicts: projects competing for the same machine within 7 days.
     */
    public List<Map<String, Object>> detectResourceConflicts() {
        List<Project> active = projectRepository.findActiveProjects();
        List<Map<String, Object>> conflicts = new ArrayList<>();

        for (int i = 0; i < active.size(); i++) {
            for (int j = i + 1; j < active.size(); j++) {
                Project a = active.get(i);
                Project b = active.get(j);

                if (a.getMachineId() != null && a.getMachineId().equals(b.getMachineId())
                    && a.getDeadline() != null && b.getDeadline() != null) {

                    long daysBetween = Math.abs(ChronoUnit.DAYS.between(a.getDeadline(), b.getDeadline()));
                    if (daysBetween <= 7) {
                        Map<String, Object> conflict = new LinkedHashMap<>();
                        conflict.put("machineId", a.getMachineId());
                        conflict.put("projectA", a.getProjectName());
                        conflict.put("projectB", b.getProjectName());
                        conflict.put("deadlineA", a.getDeadline());
                        conflict.put("deadlineB", b.getDeadline());
                        conflict.put("daysBetween", daysBetween);
                        conflict.put("suggestion", daysBetween == 0
                            ? "CRITICAL: Schedule one project to next week"
                            : "Stagger production runs by " + (7 - daysBetween) + " days");
                        conflicts.add(conflict);
                    }
                }
            }
        }

        return conflicts;
    }

    /**
     * Returns pipeline analytics: total value by status, conversion rate.
     */
    public Map<String, Object> getPipelineAnalytics() {
        List<CrmLead> allLeads = leadRepository.findAll();

        BigDecimal totalPipeline = BigDecimal.ZERO;
        BigDecimal wonValue = BigDecimal.ZERO;
        Map<String, Integer> statusCounts = new LinkedHashMap<>();

        for (CrmLead lead : allLeads) {
            totalPipeline = totalPipeline.add(lead.getPotentialValue() != null ? lead.getPotentialValue() : BigDecimal.ZERO);
            String status = lead.getStatus().name();
            statusCounts.merge(status, 1, Integer::sum);
            if (lead.getStatus() == LeadStatus.WON) {
                wonValue = wonValue.add(lead.getPotentialValue());
            }
        }

        double conversionRate = allLeads.isEmpty() ? 0 :
            (double) statusCounts.getOrDefault("WON", 0) / allLeads.size() * 100;

        Map<String, Object> analytics = new LinkedHashMap<>();
        analytics.put("totalLeads", allLeads.size());
        analytics.put("totalPipelineValue", totalPipeline);
        analytics.put("wonValue", wonValue);
        analytics.put("conversionRate", Math.round(conversionRate * 10.0) / 10.0);
        analytics.put("statusBreakdown", statusCounts);
        return analytics;
    }
}
