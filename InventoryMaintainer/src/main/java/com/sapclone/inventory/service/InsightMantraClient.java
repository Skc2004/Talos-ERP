package com.sapclone.inventory.service;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * Gateway to the InsightMantra Python AI service.
 * Protected by Resilience4j Circuit Breaker:
 *   - If InsightMantra is down, calls trip to OPEN state after 5 failures.
 *   - In OPEN state, the fallback method returns safe defaults.
 *   - After 30 seconds, the breaker enters HALF_OPEN to probe recovery.
 */
@Slf4j
@Service
public class InsightMantraClient {

    private final RestTemplate restTemplate;

    @Value("${insight.mantra.url:http://localhost:8000}")
    private String insightMantraUrl;

    public InsightMantraClient() {
        this.restTemplate = new RestTemplate();
    }

    // ─── Prescriptive Cards ───

    @CircuitBreaker(name = "insightMantra", fallbackMethod = "prescriptiveCardsFallback")
    public Map<String, Object> fetchPrescriptiveCards() {
        String url = insightMantraUrl + "/intelligence/prescriptive-cards";
        log.info("Fetching prescriptive cards from InsightMantra: {}", url);
        return restTemplate.getForObject(url, Map.class);
    }

    @SuppressWarnings("unused")
    private Map<String, Object> prescriptiveCardsFallback(Throwable t) {
        log.warn("Circuit Breaker OPEN for InsightMantra prescriptive cards: {}", t.getMessage());
        Map<String, Object> fallback = new LinkedHashMap<>();
        fallback.put("status", "degraded");
        fallback.put("message", "AI service temporarily unavailable. Using cached intelligence.");
        fallback.put("cards", List.of(
            Map.of("type", "SYSTEM_DEGRADED", "severity", "MEDIUM",
                "title", "AI Intelligence Offline",
                "message", "InsightMantra is unreachable. Inventory operating on static thresholds.",
                "action", "FALLBACK_MODE_ACTIVE")
        ));
        return fallback;
    }

    // ─── Sentiment Themes ───

    @CircuitBreaker(name = "insightMantra", fallbackMethod = "sentimentFallback")
    public Map<String, Object> fetchSentimentThemes() {
        String url = insightMantraUrl + "/intelligence/sentiment/latest";
        return restTemplate.getForObject(url, Map.class);
    }

    @SuppressWarnings("unused")
    private Map<String, Object> sentimentFallback(Throwable t) {
        log.warn("Circuit Breaker OPEN for sentiment themes: {}", t.getMessage());
        return Map.of("status", "degraded", "themes", List.of());
    }

    // ─── Machine Health ───

    @CircuitBreaker(name = "insightMantra", fallbackMethod = "machineHealthFallback")
    public Map<String, Object> fetchMachineHealth() {
        String url = insightMantraUrl + "/maintenance/health";
        return restTemplate.getForObject(url, Map.class);
    }

    @SuppressWarnings("unused")
    private Map<String, Object> machineHealthFallback(Throwable t) {
        log.warn("Circuit Breaker OPEN for machine health: {}", t.getMessage());
        return Map.of("status", "degraded", "machines", List.of());
    }

    // ─── Lead Scoring ───

    @CircuitBreaker(name = "insightMantra", fallbackMethod = "leadScoringFallback")
    public Map<String, Object> triggerLeadScoring() {
        String url = insightMantraUrl + "/crm/score-leads";
        return restTemplate.postForObject(url, null, Map.class);
    }

    @SuppressWarnings("unused")
    private Map<String, Object> leadScoringFallback(Throwable t) {
        log.warn("Circuit Breaker OPEN for lead scoring: {}", t.getMessage());
        return Map.of("status", "degraded", "message", "Lead scoring unavailable. Using last known scores.");
    }
}
