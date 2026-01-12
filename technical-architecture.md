# SwissBrain AI Platform - Technical Architecture Documentation

## Table of Contents

1. [Multi-Tenant Isolation Schemas](#1-multi-tenant-isolation-schemas)
2. [Observability and Prometheus SLO Rules](#2-observability-and-prometheus-slo-rules)
3. [Chaos Engineering Setup](#3-chaos-engineering-setup)

---

## 1. Multi-Tenant Isolation Schemas

### Overview

The SwissBrain AI Platform implements a **shared database with row-level security (RLS)** approach for multi-tenant isolation. This pattern provides the optimal balance between resource efficiency, operational simplicity, and strong data isolation guarantees. Each tenant's data is logically separated within shared tables using tenant identifiers, with database-level policies enforcing access controls.

### Isolation Strategy

| Isolation Level | Description | Use Case |
|-----------------|-------------|----------|
| **Shared Database, Shared Schema** | All tenants share tables with `tenant_id` column | Default for most data |
| **Logical Isolation** | Row-level security policies enforce tenant boundaries | All tenant-specific queries |
| **Resource Isolation** | Quota enforcement at application layer | API rate limiting, storage limits |

### CREATE TABLE Statements

#### 1.1 Tenants Table

```sql
-- Core tenant registry with organizational metadata
CREATE TABLE tenants (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Tenant identification
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    domain VARCHAR(255),
    
    -- Subscription and billing
    plan_tier ENUM('free', 'starter', 'professional', 'enterprise', 'custom') NOT NULL DEFAULT 'free',
    billing_email VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    subscription_status ENUM('active', 'past_due', 'canceled', 'trialing', 'paused') DEFAULT 'active',
    
    -- Tenant configuration
    settings JSON DEFAULT '{}',
    feature_flags JSON DEFAULT '{}',
    
    -- Security and compliance
    data_residency_region VARCHAR(50) DEFAULT 'eu-west',
    encryption_key_id VARCHAR(255),
    sso_provider ENUM('none', 'saml', 'oidc', 'google', 'microsoft') DEFAULT 'none',
    sso_config JSON,
    
    -- Status and lifecycle
    status ENUM('active', 'suspended', 'pending_deletion', 'deleted') NOT NULL DEFAULT 'active',
    suspended_reason TEXT,
    suspended_at TIMESTAMP NULL,
    
    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- Indexes
    INDEX idx_tenants_slug (slug),
    INDEX idx_tenants_status (status),
    INDEX idx_tenants_plan (plan_tier),
    INDEX idx_tenants_domain (domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tenant members junction table
CREATE TABLE tenant_members (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    
    role ENUM('owner', 'admin', 'member', 'viewer', 'billing') NOT NULL DEFAULT 'member',
    permissions JSON DEFAULT '[]',
    
    invited_by VARCHAR(36),
    invited_at TIMESTAMP,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    status ENUM('active', 'invited', 'suspended', 'removed') DEFAULT 'active',
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_tenant_user (tenant_id, user_id),
    INDEX idx_tenant_members_user (user_id),
    INDEX idx_tenant_members_role (tenant_id, role),
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 1.2 Tenant Quotas Table

```sql
-- Quota definitions and limits per tenant
CREATE TABLE tenant_quotas (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(36) NOT NULL,
    
    -- API Rate Limits (requests per time window)
    api_requests_per_minute INT NOT NULL DEFAULT 60,
    api_requests_per_hour INT NOT NULL DEFAULT 1000,
    api_requests_per_day INT NOT NULL DEFAULT 10000,
    
    -- AI/LLM Usage Limits
    llm_tokens_per_day BIGINT NOT NULL DEFAULT 100000,
    llm_tokens_per_month BIGINT NOT NULL DEFAULT 1000000,
    llm_concurrent_requests INT NOT NULL DEFAULT 5,
    
    -- Agent Limits
    max_agents INT NOT NULL DEFAULT 3,
    max_agent_executions_per_day INT NOT NULL DEFAULT 100,
    max_agent_execution_time_seconds INT NOT NULL DEFAULT 300,
    
    -- Storage Limits (in bytes)
    storage_limit_bytes BIGINT NOT NULL DEFAULT 1073741824, -- 1GB default
    file_upload_max_bytes BIGINT NOT NULL DEFAULT 52428800, -- 50MB default
    
    -- Search Limits
    searches_per_day INT NOT NULL DEFAULT 100,
    search_results_per_query INT NOT NULL DEFAULT 20,
    
    -- Workspace Limits
    max_workspaces INT NOT NULL DEFAULT 5,
    max_documents_per_workspace INT NOT NULL DEFAULT 100,
    max_collaborators_per_workspace INT NOT NULL DEFAULT 10,
    
    -- Data Retention
    data_retention_days INT NOT NULL DEFAULT 90,
    audit_log_retention_days INT NOT NULL DEFAULT 30,
    
    -- Burst allowances (temporary overage)
    burst_multiplier DECIMAL(3,2) DEFAULT 1.50,
    burst_duration_seconds INT DEFAULT 60,
    
    -- Custom overrides (JSON for flexibility)
    custom_limits JSON DEFAULT '{}',
    
    -- Effective dates for quota changes
    effective_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    effective_until TIMESTAMP NULL,
    
    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(36),
    
    UNIQUE KEY uk_tenant_quota_effective (tenant_id, effective_from),
    INDEX idx_quotas_tenant (tenant_id),
    INDEX idx_quotas_effective (effective_from, effective_until),
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Real-time quota usage tracking
CREATE TABLE tenant_quota_usage (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(36) NOT NULL,
    
    -- Time window for aggregation
    window_start TIMESTAMP NOT NULL,
    window_end TIMESTAMP NOT NULL,
    window_type ENUM('minute', 'hour', 'day', 'month') NOT NULL,
    
    -- Usage counters
    api_requests_count INT DEFAULT 0,
    llm_tokens_used BIGINT DEFAULT 0,
    llm_requests_count INT DEFAULT 0,
    agent_executions_count INT DEFAULT 0,
    searches_count INT DEFAULT 0,
    storage_bytes_used BIGINT DEFAULT 0,
    
    -- Cost tracking (in microdollars for precision)
    estimated_cost_microdollars BIGINT DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_usage_window (tenant_id, window_type, window_start),
    INDEX idx_usage_tenant_time (tenant_id, window_start DESC),
    INDEX idx_usage_window_type (window_type, window_start),
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 1.3 Abuse Scores Table

```sql
-- Abuse detection and scoring system
CREATE TABLE abuse_scores (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36),
    
    -- Composite abuse score (0-100, higher = more suspicious)
    overall_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    
    -- Individual risk factors (0-100 each)
    rate_limit_violation_score DECIMAL(5,2) DEFAULT 0.00,
    content_policy_violation_score DECIMAL(5,2) DEFAULT 0.00,
    payment_fraud_score DECIMAL(5,2) DEFAULT 0.00,
    bot_behavior_score DECIMAL(5,2) DEFAULT 0.00,
    credential_stuffing_score DECIMAL(5,2) DEFAULT 0.00,
    data_exfiltration_score DECIMAL(5,2) DEFAULT 0.00,
    prompt_injection_score DECIMAL(5,2) DEFAULT 0.00,
    
    -- Behavioral signals
    requests_per_second_avg DECIMAL(10,4),
    requests_per_second_max DECIMAL(10,4),
    unique_ips_24h INT DEFAULT 0,
    unique_user_agents_24h INT DEFAULT 0,
    failed_auth_attempts_24h INT DEFAULT 0,
    
    -- Pattern detection
    suspicious_patterns JSON DEFAULT '[]',
    flagged_content_hashes JSON DEFAULT '[]',
    
    -- Risk classification
    risk_level ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'low',
    
    -- Automated actions taken
    auto_throttled BOOLEAN DEFAULT FALSE,
    auto_suspended BOOLEAN DEFAULT FALSE,
    captcha_required BOOLEAN DEFAULT FALSE,
    
    -- Manual review
    requires_review BOOLEAN DEFAULT FALSE,
    reviewed_by VARCHAR(36),
    reviewed_at TIMESTAMP NULL,
    review_notes TEXT,
    review_decision ENUM('approved', 'warned', 'suspended', 'banned') NULL,
    
    -- Temporal tracking
    first_violation_at TIMESTAMP NULL,
    last_violation_at TIMESTAMP NULL,
    violation_count INT DEFAULT 0,
    
    -- Score calculation metadata
    score_version VARCHAR(20) DEFAULT 'v1.0',
    score_factors JSON DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_abuse_tenant_user (tenant_id, user_id),
    INDEX idx_abuse_score (overall_score DESC),
    INDEX idx_abuse_risk_level (risk_level),
    INDEX idx_abuse_requires_review (requires_review, created_at),
    INDEX idx_abuse_tenant (tenant_id),
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Abuse events log for detailed tracking
CREATE TABLE abuse_events (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36),
    abuse_score_id VARCHAR(36),
    
    -- Event classification
    event_type ENUM(
        'rate_limit_exceeded',
        'content_policy_violation',
        'suspicious_login',
        'credential_stuffing',
        'bot_detected',
        'prompt_injection',
        'data_scraping',
        'payment_fraud',
        'account_sharing',
        'api_abuse',
        'other'
    ) NOT NULL,
    
    severity ENUM('info', 'warning', 'error', 'critical') NOT NULL DEFAULT 'warning',
    
    -- Event details
    description TEXT,
    metadata JSON DEFAULT '{}',
    
    -- Request context
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_path VARCHAR(500),
    request_method VARCHAR(10),
    
    -- Geolocation (if available)
    geo_country VARCHAR(2),
    geo_region VARCHAR(100),
    geo_city VARCHAR(100),
    
    -- Response taken
    action_taken ENUM('logged', 'warned', 'throttled', 'blocked', 'suspended') DEFAULT 'logged',
    
    -- Timestamps
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_abuse_events_tenant (tenant_id, occurred_at DESC),
    INDEX idx_abuse_events_type (event_type, occurred_at DESC),
    INDEX idx_abuse_events_severity (severity, occurred_at DESC),
    INDEX idx_abuse_events_ip (ip_address, occurred_at DESC),
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (abuse_score_id) REFERENCES abuse_scores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- IP reputation tracking
CREATE TABLE ip_reputation (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    ip_address VARCHAR(45) NOT NULL,
    
    -- Reputation score (-100 to 100, negative = bad)
    reputation_score INT NOT NULL DEFAULT 0,
    
    -- Classification
    is_known_vpn BOOLEAN DEFAULT FALSE,
    is_known_proxy BOOLEAN DEFAULT FALSE,
    is_known_tor BOOLEAN DEFAULT FALSE,
    is_datacenter BOOLEAN DEFAULT FALSE,
    is_residential BOOLEAN DEFAULT TRUE,
    
    -- Threat intelligence
    threat_categories JSON DEFAULT '[]',
    blocklist_matches JSON DEFAULT '[]',
    
    -- Usage statistics
    total_requests BIGINT DEFAULT 0,
    total_violations INT DEFAULT 0,
    associated_tenants INT DEFAULT 0,
    
    -- Temporal data
    first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_violation_at TIMESTAMP NULL,
    
    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_ip_address (ip_address),
    INDEX idx_ip_reputation_score (reputation_score),
    INDEX idx_ip_last_seen (last_seen_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Row-Level Security Implementation

For databases supporting RLS (PostgreSQL), the following policies would be applied:

```sql
-- Enable RLS on tenant-scoped tables
ALTER TABLE tenant_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_quota_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_events ENABLE ROW LEVEL SECURITY;

-- Create policies for tenant isolation
CREATE POLICY tenant_isolation_quotas ON tenant_quotas
    USING (tenant_id = current_setting('app.current_tenant_id')::VARCHAR);

CREATE POLICY tenant_isolation_usage ON tenant_quota_usage
    USING (tenant_id = current_setting('app.current_tenant_id')::VARCHAR);

CREATE POLICY tenant_isolation_abuse ON abuse_scores
    USING (tenant_id = current_setting('app.current_tenant_id')::VARCHAR);

CREATE POLICY tenant_isolation_events ON abuse_events
    USING (tenant_id = current_setting('app.current_tenant_id')::VARCHAR);
```

---

## 2. Observability and Prometheus SLO Rules

### Overview

The SwissBrain AI Platform implements a comprehensive observability stack using Prometheus for metrics collection, with recording rules that pre-compute SLO-related metrics for efficient alerting. The approach follows Google SRE best practices for multi-window, multi-burn-rate alerting.

### Key SLO Definitions

| Service | SLI Type | Target | Error Budget (30 days) |
|---------|----------|--------|------------------------|
| AI Search API | Availability | 99.9% | 43.2 minutes |
| AI Search API | Latency (p99 < 2s) | 99.0% | 7.2 hours |
| Agent Execution | Success Rate | 99.5% | 3.6 hours |
| Agent Execution | Completion Time (< 5min) | 95.0% | 36 hours |
| LLM Gateway | Availability | 99.95% | 21.6 minutes |
| Authentication | Availability | 99.99% | 4.3 minutes |

### Prometheus Recording Rules

```yaml
# prometheus-rules.yaml
# SwissBrain AI Platform - SLO Recording Rules

groups:
  # =============================================================================
  # Agent SLO Recording Rules
  # =============================================================================
  - name: swissbrain_agent_slo_recording_rules
    interval: 30s
    rules:
      # ---------------------------------------------------------------------------
      # Agent Request Rate Metrics
      # ---------------------------------------------------------------------------
      - record: swissbrain:agent_requests:rate5m
        expr: |
          sum(rate(agent_requests_total[5m])) by (tenant_id, agent_type)
        labels:
          slo_domain: "agent"

      - record: swissbrain:agent_requests:rate1h
        expr: |
          sum(rate(agent_requests_total[1h])) by (tenant_id, agent_type)
        labels:
          slo_domain: "agent"

      - record: swissbrain:agent_requests:rate6h
        expr: |
          sum(rate(agent_requests_total[6h])) by (tenant_id, agent_type)
        labels:
          slo_domain: "agent"

      # ---------------------------------------------------------------------------
      # Agent Error Rate Metrics
      # ---------------------------------------------------------------------------
      - record: swissbrain:agent_errors:rate5m
        expr: |
          sum(rate(agent_requests_total{status="error"}[5m])) by (tenant_id, agent_type)
        labels:
          slo_domain: "agent"

      - record: swissbrain:agent_errors:rate1h
        expr: |
          sum(rate(agent_requests_total{status="error"}[1h])) by (tenant_id, agent_type)
        labels:
          slo_domain: "agent"

      - record: swissbrain:agent_errors:rate6h
        expr: |
          sum(rate(agent_requests_total{status="error"}[6h])) by (tenant_id, agent_type)
        labels:
          slo_domain: "agent"

      # ---------------------------------------------------------------------------
      # Agent Error Ratio (SLI)
      # ---------------------------------------------------------------------------
      - record: swissbrain:agent_error_ratio:rate5m
        expr: |
          (
            swissbrain:agent_errors:rate5m
            /
            swissbrain:agent_requests:rate5m
          ) OR on() vector(0)
        labels:
          slo_domain: "agent"
          sli_type: "availability"

      - record: swissbrain:agent_error_ratio:rate1h
        expr: |
          (
            swissbrain:agent_errors:rate1h
            /
            swissbrain:agent_requests:rate1h
          ) OR on() vector(0)
        labels:
          slo_domain: "agent"
          sli_type: "availability"

      - record: swissbrain:agent_error_ratio:rate6h
        expr: |
          (
            swissbrain:agent_errors:rate6h
            /
            swissbrain:agent_requests:rate6h
          ) OR on() vector(0)
        labels:
          slo_domain: "agent"
          sli_type: "availability"

      # ---------------------------------------------------------------------------
      # Agent Latency Metrics (Histogram)
      # ---------------------------------------------------------------------------
      - record: swissbrain:agent_latency_bucket:rate5m
        expr: |
          sum(rate(agent_request_duration_seconds_bucket[5m])) by (tenant_id, agent_type, le)
        labels:
          slo_domain: "agent"

      - record: swissbrain:agent_latency_bucket:rate1h
        expr: |
          sum(rate(agent_request_duration_seconds_bucket[1h])) by (tenant_id, agent_type, le)
        labels:
          slo_domain: "agent"

      # Agent p99 latency
      - record: swissbrain:agent_latency_p99:rate5m
        expr: |
          histogram_quantile(0.99, swissbrain:agent_latency_bucket:rate5m)
        labels:
          slo_domain: "agent"
          quantile: "0.99"

      # Agent latency SLI (% requests under 5s threshold)
      - record: swissbrain:agent_latency_sli:rate5m
        expr: |
          (
            sum(rate(agent_request_duration_seconds_bucket{le="5.0"}[5m])) by (tenant_id, agent_type)
            /
            sum(rate(agent_request_duration_seconds_count[5m])) by (tenant_id, agent_type)
          ) OR on() vector(1)
        labels:
          slo_domain: "agent"
          sli_type: "latency"
          threshold: "5s"

      # ---------------------------------------------------------------------------
      # Agent Execution Success Rate
      # ---------------------------------------------------------------------------
      - record: swissbrain:agent_execution_success:rate5m
        expr: |
          sum(rate(agent_execution_total{result="success"}[5m])) by (tenant_id, agent_type)
          /
          sum(rate(agent_execution_total[5m])) by (tenant_id, agent_type)
        labels:
          slo_domain: "agent"
          sli_type: "success_rate"

      - record: swissbrain:agent_execution_success:rate1h
        expr: |
          sum(rate(agent_execution_total{result="success"}[1h])) by (tenant_id, agent_type)
          /
          sum(rate(agent_execution_total[1h])) by (tenant_id, agent_type)
        labels:
          slo_domain: "agent"
          sli_type: "success_rate"

      # ---------------------------------------------------------------------------
      # Burn Rate Calculations (Multi-Window)
      # ---------------------------------------------------------------------------
      # Burn rate = actual error rate / allowed error rate
      # For 99.5% SLO, allowed error rate = 0.005

      - record: swissbrain:agent_burn_rate:5m
        expr: |
          swissbrain:agent_error_ratio:rate5m / 0.005
        labels:
          slo_domain: "agent"
          slo_target: "99.5"
          window: "5m"

      - record: swissbrain:agent_burn_rate:1h
        expr: |
          swissbrain:agent_error_ratio:rate1h / 0.005
        labels:
          slo_domain: "agent"
          slo_target: "99.5"
          window: "1h"

      - record: swissbrain:agent_burn_rate:6h
        expr: |
          swissbrain:agent_error_ratio:rate6h / 0.005
        labels:
          slo_domain: "agent"
          slo_target: "99.5"
          window: "6h"

  # =============================================================================
  # Search API SLO Recording Rules
  # =============================================================================
  - name: swissbrain_search_slo_recording_rules
    interval: 30s
    rules:
      # ---------------------------------------------------------------------------
      # Search Request Metrics
      # ---------------------------------------------------------------------------
      - record: swissbrain:search_requests:rate5m
        expr: |
          sum(rate(search_requests_total[5m])) by (tenant_id, search_type)

      - record: swissbrain:search_requests:rate1h
        expr: |
          sum(rate(search_requests_total[1h])) by (tenant_id, search_type)

      - record: swissbrain:search_errors:rate5m
        expr: |
          sum(rate(search_requests_total{status=~"5.."}[5m])) by (tenant_id, search_type)

      - record: swissbrain:search_errors:rate1h
        expr: |
          sum(rate(search_requests_total{status=~"5.."}[1h])) by (tenant_id, search_type)

      # ---------------------------------------------------------------------------
      # Search Availability SLI
      # ---------------------------------------------------------------------------
      - record: swissbrain:search_availability:rate5m
        expr: |
          1 - (
            swissbrain:search_errors:rate5m
            /
            swissbrain:search_requests:rate5m
          )
        labels:
          sli_type: "availability"
          slo_target: "99.9"

      - record: swissbrain:search_availability:rate1h
        expr: |
          1 - (
            swissbrain:search_errors:rate1h
            /
            swissbrain:search_requests:rate1h
          )
        labels:
          sli_type: "availability"
          slo_target: "99.9"

      # ---------------------------------------------------------------------------
      # Search Latency SLI (p99 < 2s)
      # ---------------------------------------------------------------------------
      - record: swissbrain:search_latency_bucket:rate5m
        expr: |
          sum(rate(search_request_duration_seconds_bucket[5m])) by (tenant_id, le)

      - record: swissbrain:search_latency_p99:rate5m
        expr: |
          histogram_quantile(0.99, swissbrain:search_latency_bucket:rate5m)

      - record: swissbrain:search_latency_sli:rate5m
        expr: |
          (
            sum(rate(search_request_duration_seconds_bucket{le="2.0"}[5m])) by (tenant_id)
            /
            sum(rate(search_request_duration_seconds_count[5m])) by (tenant_id)
          )
        labels:
          sli_type: "latency"
          threshold: "2s"
          slo_target: "99.0"

      # ---------------------------------------------------------------------------
      # Search Burn Rates
      # ---------------------------------------------------------------------------
      - record: swissbrain:search_burn_rate:5m
        expr: |
          (1 - swissbrain:search_availability:rate5m) / 0.001
        labels:
          slo_target: "99.9"
          window: "5m"

      - record: swissbrain:search_burn_rate:1h
        expr: |
          (1 - swissbrain:search_availability:rate1h) / 0.001
        labels:
          slo_target: "99.9"
          window: "1h"

  # =============================================================================
  # LLM Gateway SLO Recording Rules
  # =============================================================================
  - name: swissbrain_llm_slo_recording_rules
    interval: 30s
    rules:
      # ---------------------------------------------------------------------------
      # LLM Request Metrics
      # ---------------------------------------------------------------------------
      - record: swissbrain:llm_requests:rate5m
        expr: |
          sum(rate(llm_requests_total[5m])) by (tenant_id, model, provider)

      - record: swissbrain:llm_requests:rate1h
        expr: |
          sum(rate(llm_requests_total[1h])) by (tenant_id, model, provider)

      - record: swissbrain:llm_errors:rate5m
        expr: |
          sum(rate(llm_requests_total{status="error"}[5m])) by (tenant_id, model, provider)

      - record: swissbrain:llm_errors:rate1h
        expr: |
          sum(rate(llm_requests_total{status="error"}[1h])) by (tenant_id, model, provider)

      # ---------------------------------------------------------------------------
      # LLM Availability SLI (99.95% target)
      # ---------------------------------------------------------------------------
      - record: swissbrain:llm_availability:rate5m
        expr: |
          1 - (
            swissbrain:llm_errors:rate5m
            /
            swissbrain:llm_requests:rate5m
          )
        labels:
          sli_type: "availability"
          slo_target: "99.95"

      # ---------------------------------------------------------------------------
      # LLM Token Throughput
      # ---------------------------------------------------------------------------
      - record: swissbrain:llm_tokens:rate5m
        expr: |
          sum(rate(llm_tokens_total[5m])) by (tenant_id, token_type)

      - record: swissbrain:llm_tokens_per_request:rate5m
        expr: |
          swissbrain:llm_tokens:rate5m / swissbrain:llm_requests:rate5m

      # ---------------------------------------------------------------------------
      # LLM Time to First Token (TTFT) SLI
      # ---------------------------------------------------------------------------
      - record: swissbrain:llm_ttft_bucket:rate5m
        expr: |
          sum(rate(llm_time_to_first_token_seconds_bucket[5m])) by (tenant_id, model, le)

      - record: swissbrain:llm_ttft_p95:rate5m
        expr: |
          histogram_quantile(0.95, swissbrain:llm_ttft_bucket:rate5m)

      # ---------------------------------------------------------------------------
      # LLM Burn Rate
      # ---------------------------------------------------------------------------
      - record: swissbrain:llm_burn_rate:5m
        expr: |
          (1 - swissbrain:llm_availability:rate5m) / 0.0005
        labels:
          slo_target: "99.95"
          window: "5m"

  # =============================================================================
  # Multi-Tenant Resource Usage Recording Rules
  # =============================================================================
  - name: swissbrain_tenant_usage_recording_rules
    interval: 60s
    rules:
      # ---------------------------------------------------------------------------
      # Per-Tenant Request Volume
      # ---------------------------------------------------------------------------
      - record: swissbrain:tenant_requests:rate1h
        expr: |
          sum(rate(http_requests_total[1h])) by (tenant_id)

      - record: swissbrain:tenant_requests:rate24h
        expr: |
          sum(rate(http_requests_total[24h])) by (tenant_id)

      # ---------------------------------------------------------------------------
      # Per-Tenant Error Budget Consumption
      # ---------------------------------------------------------------------------
      - record: swissbrain:tenant_error_budget_consumed:1h
        expr: |
          (
            sum(increase(http_requests_total{status=~"5.."}[1h])) by (tenant_id)
            /
            (sum(increase(http_requests_total[1h])) by (tenant_id) * 0.001)
          ) * 100
        labels:
          window: "1h"
          description: "Percentage of hourly error budget consumed"

      - record: swissbrain:tenant_error_budget_consumed:24h
        expr: |
          (
            sum(increase(http_requests_total{status=~"5.."}[24h])) by (tenant_id)
            /
            (sum(increase(http_requests_total[24h])) by (tenant_id) * 0.001)
          ) * 100
        labels:
          window: "24h"
          description: "Percentage of daily error budget consumed"

      # ---------------------------------------------------------------------------
      # Per-Tenant Quota Utilization
      # ---------------------------------------------------------------------------
      - record: swissbrain:tenant_quota_utilization:api_requests
        expr: |
          (
            sum(increase(http_requests_total[1h])) by (tenant_id)
            /
            on(tenant_id) group_left()
            tenant_quota_limit{quota_type="api_requests_per_hour"}
          ) * 100

      - record: swissbrain:tenant_quota_utilization:llm_tokens
        expr: |
          (
            sum(increase(llm_tokens_total[24h])) by (tenant_id)
            /
            on(tenant_id) group_left()
            tenant_quota_limit{quota_type="llm_tokens_per_day"}
          ) * 100

  # =============================================================================
  # Error Budget Tracking Rules
  # =============================================================================
  - name: swissbrain_error_budget_rules
    interval: 60s
    rules:
      # ---------------------------------------------------------------------------
      # 30-Day Error Budget Remaining
      # ---------------------------------------------------------------------------
      - record: swissbrain:error_budget_remaining:agent
        expr: |
          1 - (
            sum(increase(agent_requests_total{status="error"}[30d]))
            /
            (sum(increase(agent_requests_total[30d])) * 0.005)
          )
        labels:
          service: "agent"
          slo_target: "99.5"

      - record: swissbrain:error_budget_remaining:search
        expr: |
          1 - (
            sum(increase(search_requests_total{status=~"5.."}[30d]))
            /
            (sum(increase(search_requests_total[30d])) * 0.001)
          )
        labels:
          service: "search"
          slo_target: "99.9"

      - record: swissbrain:error_budget_remaining:llm
        expr: |
          1 - (
            sum(increase(llm_requests_total{status="error"}[30d]))
            /
            (sum(increase(llm_requests_total[30d])) * 0.0005)
          )
        labels:
          service: "llm"
          slo_target: "99.95"
```

### Alerting Rules

```yaml
# prometheus-alerts.yaml
# SwissBrain AI Platform - SLO Alerting Rules

groups:
  # =============================================================================
  # Multi-Window, Multi-Burn-Rate Alerts
  # =============================================================================
  - name: swissbrain_slo_alerts
    rules:
      # ---------------------------------------------------------------------------
      # Agent Service Alerts
      # ---------------------------------------------------------------------------
      # Page: High burn rate over short window (14.4x burn = 2% budget in 1h)
      - alert: AgentHighErrorBurnRate
        expr: |
          swissbrain:agent_burn_rate:5m > 14.4
          AND
          swissbrain:agent_burn_rate:1h > 14.4
        for: 2m
        labels:
          severity: critical
          service: agent
          slo: availability
        annotations:
          summary: "Agent service burning error budget too fast"
          description: |
            Agent service is consuming error budget at {{ $value | printf "%.1f" }}x 
            the sustainable rate. At this rate, the 30-day error budget will be 
            exhausted in {{ printf "%.1f" (div 720 $value) }} hours.
          runbook_url: "https://wiki.swissbrain.ai/runbooks/agent-high-error-rate"

      # Ticket: Moderate burn rate over longer window (6x burn = 5% budget in 6h)
      - alert: AgentElevatedErrorRate
        expr: |
          swissbrain:agent_burn_rate:1h > 6
          AND
          swissbrain:agent_burn_rate:6h > 6
        for: 5m
        labels:
          severity: warning
          service: agent
          slo: availability
        annotations:
          summary: "Agent service error rate elevated"
          description: |
            Agent service error rate is elevated at {{ $value | printf "%.1f" }}x 
            the sustainable burn rate.

      # ---------------------------------------------------------------------------
      # Search Service Alerts
      # ---------------------------------------------------------------------------
      - alert: SearchHighErrorBurnRate
        expr: |
          swissbrain:search_burn_rate:5m > 14.4
          AND
          swissbrain:search_burn_rate:1h > 14.4
        for: 2m
        labels:
          severity: critical
          service: search
          slo: availability
        annotations:
          summary: "Search API burning error budget too fast"
          description: |
            Search API is consuming error budget at {{ $value | printf "%.1f" }}x 
            the sustainable rate.

      - alert: SearchLatencyDegraded
        expr: |
          swissbrain:search_latency_p99:rate5m > 2.0
        for: 5m
        labels:
          severity: warning
          service: search
          slo: latency
        annotations:
          summary: "Search API p99 latency exceeds 2s threshold"
          description: |
            Search API p99 latency is {{ $value | printf "%.2f" }}s, 
            exceeding the 2s SLO threshold.

      # ---------------------------------------------------------------------------
      # LLM Gateway Alerts
      # ---------------------------------------------------------------------------
      - alert: LLMGatewayHighErrorRate
        expr: |
          swissbrain:llm_burn_rate:5m > 14.4
        for: 1m
        labels:
          severity: critical
          service: llm
          slo: availability
        annotations:
          summary: "LLM Gateway experiencing high error rate"
          description: |
            LLM Gateway availability is degraded. Current availability: 
            {{ printf "%.3f" (mul (index $labels "swissbrain:llm_availability:rate5m") 100) }}%

      # ---------------------------------------------------------------------------
      # Error Budget Alerts
      # ---------------------------------------------------------------------------
      - alert: ErrorBudgetNearlyExhausted
        expr: |
          swissbrain:error_budget_remaining:agent < 0.1
          OR
          swissbrain:error_budget_remaining:search < 0.1
          OR
          swissbrain:error_budget_remaining:llm < 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Error budget nearly exhausted for {{ $labels.service }}"
          description: |
            Only {{ $value | printf "%.1f" }}% of the 30-day error budget 
            remains for {{ $labels.service }} service.

      - alert: ErrorBudgetLow
        expr: |
          swissbrain:error_budget_remaining:agent < 0.25
          OR
          swissbrain:error_budget_remaining:search < 0.25
          OR
          swissbrain:error_budget_remaining:llm < 0.25
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Error budget running low for {{ $labels.service }}"
          description: |
            {{ $value | printf "%.1f" }}% of the 30-day error budget 
            remains for {{ $labels.service }} service.

      # ---------------------------------------------------------------------------
      # Tenant Quota Alerts
      # ---------------------------------------------------------------------------
      - alert: TenantQuotaNearLimit
        expr: |
          swissbrain:tenant_quota_utilization:api_requests > 80
          OR
          swissbrain:tenant_quota_utilization:llm_tokens > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Tenant {{ $labels.tenant_id }} approaching quota limit"
          description: |
            Tenant {{ $labels.tenant_id }} has used {{ $value | printf "%.1f" }}% 
            of their quota allocation.

      - alert: TenantQuotaExceeded
        expr: |
          swissbrain:tenant_quota_utilization:api_requests > 100
          OR
          swissbrain:tenant_quota_utilization:llm_tokens > 100
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Tenant {{ $labels.tenant_id }} exceeded quota"
          description: |
            Tenant {{ $labels.tenant_id }} has exceeded their quota allocation 
            at {{ $value | printf "%.1f" }}% utilization.
```

---

## 3. Chaos Engineering Setup

### Overview

The SwissBrain AI Platform employs chaos engineering practices to proactively identify weaknesses in the system before they cause production incidents. The setup uses **LitmusChaos** as the primary chaos engineering platform, integrated with Kubernetes for orchestration and Prometheus for observability.

### Chaos Engineering Principles

| Principle | Implementation |
|-----------|----------------|
| **Build a Hypothesis** | Define expected behavior before each experiment |
| **Vary Real-World Events** | Simulate actual failure modes observed in production |
| **Run in Production** | Execute experiments in production with safeguards |
| **Automate Experiments** | Integrate chaos tests into CI/CD pipelines |
| **Minimize Blast Radius** | Start small, gradually increase scope |

### Infrastructure Setup

#### 3.1 LitmusChaos Installation

```yaml
# litmus-installation.yaml
# Helm-based installation of LitmusChaos

# Step 1: Add Helm repository
# helm repo add litmuschaos https://litmuschaos.github.io/litmus-helm/

# Step 2: Create namespace
apiVersion: v1
kind: Namespace
metadata:
  name: litmus
  labels:
    app.kubernetes.io/name: litmus
    app.kubernetes.io/component: chaos-engineering

---
# Step 3: Install via Helm
# helm install chaos litmuschaos/litmus --namespace=litmus \
#   --set portal.frontend.service.type=ClusterIP \
#   --set mongodb.persistence.enabled=true \
#   --set mongodb.persistence.size=10Gi

---
# Custom values for SwissBrain deployment
# litmus-values.yaml
portal:
  frontend:
    service:
      type: ClusterIP
    resources:
      requests:
        memory: "256Mi"
        cpu: "100m"
      limits:
        memory: "512Mi"
        cpu: "500m"
  
  server:
    graphqlServer:
      resources:
        requests:
          memory: "512Mi"
          cpu: "250m"
        limits:
          memory: "1Gi"
          cpu: "1000m"
      
      genericEnv:
        CHAOS_CENTER_UI_ENDPOINT: "https://chaos.swissbrain.internal"
        SUBSCRIBER_IMAGE: "litmuschaos/litmusportal-subscriber:3.23.0"
        EVENT_TRACKER_IMAGE: "litmuschaos/litmusportal-event-tracker:3.23.0"

mongodb:
  persistence:
    enabled: true
    size: 20Gi
  auth:
    enabled: true
    rootPassword: "${MONGODB_ROOT_PASSWORD}"
  
  resources:
    requests:
      memory: "512Mi"
      cpu: "250m"
    limits:
      memory: "2Gi"
      cpu: "1000m"
```

#### 3.2 Chaos Infrastructure Configuration

```yaml
# chaos-infrastructure.yaml
# Chaos infrastructure for SwissBrain environments

apiVersion: litmuschaos.io/v1alpha1
kind: ChaosInfrastructure
metadata:
  name: swissbrain-production
  namespace: litmus
spec:
  # Infrastructure scope
  infraScope: cluster
  
  # Service account for chaos experiments
  serviceAccountName: litmus-admin
  
  # Node selector for chaos components
  nodeSelector:
    chaos-enabled: "true"
  
  # Tolerations for dedicated chaos nodes
  tolerations:
    - key: "dedicated"
      operator: "Equal"
      value: "chaos"
      effect: "NoSchedule"
  
  # Environment configuration
  platformName: "swissbrain-production"
  
  # Skip SSL verification for internal services
  skipSsl: false

---
# Service account and RBAC for chaos experiments
apiVersion: v1
kind: ServiceAccount
metadata:
  name: litmus-admin
  namespace: litmus
  labels:
    app.kubernetes.io/name: litmus

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: litmus-admin
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "pods/exec", "events", "configmaps", "secrets", "services"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets", "replicasets", "daemonsets"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["litmuschaos.io"]
    resources: ["*"]
    verbs: ["*"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: litmus-admin
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: litmus-admin
subjects:
  - kind: ServiceAccount
    name: litmus-admin
    namespace: litmus
```

### Chaos Experiments

#### 3.3 Pod Failure Experiments

```yaml
# experiments/pod-delete-experiment.yaml
# Simulate pod failures in agent service

apiVersion: litmuschaos.io/v1alpha1
kind: ChaosExperiment
metadata:
  name: swissbrain-agent-pod-delete
  namespace: swissbrain
spec:
  definition:
    scope: Namespaced
    permissions:
      - apiGroups: [""]
        resources: ["pods"]
        verbs: ["delete", "list", "get"]
    
    image: "litmuschaos/go-runner:3.23.0"
    imagePullPolicy: Always
    
    args:
      - -c
      - ./experiments -name pod-delete
    
    command:
      - /bin/bash
    
    env:
      - name: TOTAL_CHAOS_DURATION
        value: "30"
      - name: CHAOS_INTERVAL
        value: "10"
      - name: FORCE
        value: "false"
      - name: TARGET_PODS
        value: ""
      - name: PODS_AFFECTED_PERC
        value: "50"
      - name: RAMP_TIME
        value: ""
      - name: SEQUENCE
        value: "parallel"

    labels:
      name: pod-delete
      app.kubernetes.io/part-of: litmus
      app.kubernetes.io/component: experiment-job
      experiment: swissbrain-agent-pod-delete

---
# ChaosEngine to run the experiment
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: swissbrain-agent-chaos
  namespace: swissbrain
spec:
  engineState: "active"
  appinfo:
    appns: "swissbrain"
    applabel: "app=agent-service"
    appkind: "deployment"
  
  chaosServiceAccount: litmus-admin
  
  experiments:
    - name: pod-delete
      spec:
        components:
          env:
            - name: TOTAL_CHAOS_DURATION
              value: "60"
            - name: CHAOS_INTERVAL
              value: "15"
            - name: PODS_AFFECTED_PERC
              value: "30"
        
        probe:
          - name: "agent-health-check"
            type: "httpProbe"
            mode: "Continuous"
            runProperties:
              probeTimeout: 5
              retry: 3
              interval: 5
              probePollingInterval: 2
            httpProbe/inputs:
              url: "http://agent-service.swissbrain.svc.cluster.local:8080/health"
              insecureSkipVerify: false
              method:
                get:
                  criteria: "=="
                  responseCode: "200"
```

#### 3.4 Network Chaos Experiments

```yaml
# experiments/network-chaos-experiment.yaml
# Simulate network latency and packet loss

apiVersion: litmuschaos.io/v1alpha1
kind: ChaosExperiment
metadata:
  name: swissbrain-network-latency
  namespace: swissbrain
spec:
  definition:
    scope: Namespaced
    permissions:
      - apiGroups: [""]
        resources: ["pods"]
        verbs: ["get", "list", "watch"]
    
    image: "litmuschaos/go-runner:3.23.0"
    imagePullPolicy: Always
    
    args:
      - -c
      - ./experiments -name pod-network-latency
    
    command:
      - /bin/bash
    
    env:
      - name: NETWORK_INTERFACE
        value: "eth0"
      - name: NETWORK_LATENCY
        value: "200"  # milliseconds
      - name: JITTER
        value: "50"   # milliseconds
      - name: TOTAL_CHAOS_DURATION
        value: "120"
      - name: TARGET_CONTAINER
        value: ""
      - name: DESTINATION_IPS
        value: ""
      - name: DESTINATION_HOSTS
        value: ""

---
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: swissbrain-llm-network-chaos
  namespace: swissbrain
spec:
  engineState: "active"
  appinfo:
    appns: "swissbrain"
    applabel: "app=llm-gateway"
    appkind: "deployment"
  
  chaosServiceAccount: litmus-admin
  
  experiments:
    - name: pod-network-latency
      spec:
        components:
          env:
            - name: NETWORK_LATENCY
              value: "500"
            - name: JITTER
              value: "100"
            - name: TOTAL_CHAOS_DURATION
              value: "180"
            - name: DESTINATION_HOSTS
              value: "api.openai.com,api.anthropic.com"
        
        probe:
          - name: "llm-response-time"
            type: "cmdProbe"
            mode: "Edge"
            runProperties:
              probeTimeout: 30
              retry: 2
              interval: 10
            cmdProbe/inputs:
              command: |
                curl -s -o /dev/null -w '%{time_total}' \
                  http://llm-gateway.swissbrain.svc.cluster.local:8080/health
              comparator:
                type: "float"
                criteria: "<="
                value: "5.0"
```

#### 3.5 Resource Stress Experiments

```yaml
# experiments/resource-stress-experiment.yaml
# Simulate CPU and memory pressure

apiVersion: litmuschaos.io/v1alpha1
kind: ChaosExperiment
metadata:
  name: swissbrain-cpu-stress
  namespace: swissbrain
spec:
  definition:
    scope: Namespaced
    
    image: "litmuschaos/go-runner:3.23.0"
    imagePullPolicy: Always
    
    args:
      - -c
      - ./experiments -name pod-cpu-hog
    
    command:
      - /bin/bash
    
    env:
      - name: CPU_CORES
        value: "2"
      - name: CPU_LOAD
        value: "80"
      - name: TOTAL_CHAOS_DURATION
        value: "120"
      - name: PODS_AFFECTED_PERC
        value: "50"

---
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosExperiment
metadata:
  name: swissbrain-memory-stress
  namespace: swissbrain
spec:
  definition:
    scope: Namespaced
    
    image: "litmuschaos/go-runner:3.23.0"
    imagePullPolicy: Always
    
    args:
      - -c
      - ./experiments -name pod-memory-hog
    
    command:
      - /bin/bash
    
    env:
      - name: MEMORY_CONSUMPTION
        value: "500"  # MB
      - name: NUMBER_OF_WORKERS
        value: "4"
      - name: TOTAL_CHAOS_DURATION
        value: "120"
      - name: PODS_AFFECTED_PERC
        value: "30"

---
# Combined resource stress engine
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: swissbrain-search-resource-chaos
  namespace: swissbrain
spec:
  engineState: "active"
  appinfo:
    appns: "swissbrain"
    applabel: "app=search-service"
    appkind: "deployment"
  
  chaosServiceAccount: litmus-admin
  
  experiments:
    - name: pod-cpu-hog
      spec:
        components:
          env:
            - name: CPU_CORES
              value: "2"
            - name: CPU_LOAD
              value: "90"
            - name: TOTAL_CHAOS_DURATION
              value: "180"
        
        probe:
          - name: "search-latency-slo"
            type: "promProbe"
            mode: "Continuous"
            runProperties:
              probeTimeout: 10
              retry: 3
              interval: 15
            promProbe/inputs:
              endpoint: "http://prometheus.monitoring.svc.cluster.local:9090"
              query: "swissbrain:search_latency_p99:rate5m"
              comparator:
                type: "float"
                criteria: "<="
                value: "2.0"
    
    - name: pod-memory-hog
      spec:
        components:
          env:
            - name: MEMORY_CONSUMPTION
              value: "1000"
            - name: TOTAL_CHAOS_DURATION
              value: "120"
```

#### 3.6 Database Chaos Experiments

```yaml
# experiments/database-chaos-experiment.yaml
# Simulate database failures and latency

apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: swissbrain-database-chaos
  namespace: swissbrain
spec:
  engineState: "active"
  appinfo:
    appns: "swissbrain"
    applabel: "app=mysql"
    appkind: "statefulset"
  
  chaosServiceAccount: litmus-admin
  
  experiments:
    # Simulate database connection failures
    - name: pod-network-loss
      spec:
        components:
          env:
            - name: NETWORK_INTERFACE
              value: "eth0"
            - name: NETWORK_PACKET_LOSS_PERCENTAGE
              value: "30"
            - name: TOTAL_CHAOS_DURATION
              value: "60"
        
        probe:
          - name: "app-database-connectivity"
            type: "cmdProbe"
            mode: "Continuous"
            runProperties:
              probeTimeout: 10
              retry: 5
              interval: 10
            cmdProbe/inputs:
              command: |
                mysql -h mysql.swissbrain.svc.cluster.local -u probe -p${PROBE_PASSWORD} \
                  -e "SELECT 1" 2>/dev/null && echo "connected" || echo "failed"
              comparator:
                type: "string"
                criteria: "contains"
                value: "connected"

---
# Disk I/O stress for database
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: swissbrain-database-io-chaos
  namespace: swissbrain
spec:
  engineState: "active"
  appinfo:
    appns: "swissbrain"
    applabel: "app=mysql"
    appkind: "statefulset"
  
  chaosServiceAccount: litmus-admin
  
  experiments:
    - name: disk-fill
      spec:
        components:
          env:
            - name: FILL_PERCENTAGE
              value: "80"
            - name: TOTAL_CHAOS_DURATION
              value: "120"
            - name: CONTAINER_PATH
              value: "/var/lib/mysql"
        
        probe:
          - name: "database-query-performance"
            type: "promProbe"
            mode: "Continuous"
            runProperties:
              probeTimeout: 15
              retry: 3
              interval: 20
            promProbe/inputs:
              endpoint: "http://prometheus.monitoring.svc.cluster.local:9090"
              query: |
                histogram_quantile(0.99, 
                  sum(rate(mysql_query_duration_seconds_bucket[5m])) by (le)
                )
              comparator:
                type: "float"
                criteria: "<="
                value: "1.0"
```

### Chaos Experiment Schedule

```yaml
# chaos-schedule.yaml
# Automated chaos experiment scheduling

apiVersion: litmuschaos.io/v1alpha1
kind: ChaosSchedule
metadata:
  name: swissbrain-weekly-chaos
  namespace: litmus
spec:
  schedule:
    # Run every Tuesday at 2 AM UTC (low traffic period)
    now: false
    once:
      executionTime: ""
    repeat:
      timeRange:
        startTime: "2025-01-01T00:00:00Z"
        endTime: "2026-12-31T23:59:59Z"
      properties:
        minChaosInterval: "168h"  # Weekly
      workDays:
        includedDays: "Tue"
      workHours:
        includedHours: "02:00-04:00"
  
  engineTemplateSpec:
    engineState: "active"
    appinfo:
      appns: "swissbrain"
      applabel: "app=agent-service"
      appkind: "deployment"
    
    chaosServiceAccount: litmus-admin
    
    experiments:
      - name: pod-delete
        spec:
          components:
            env:
              - name: TOTAL_CHAOS_DURATION
                value: "60"
              - name: PODS_AFFECTED_PERC
                value: "25"
          
          probe:
            - name: "slo-compliance"
              type: "promProbe"
              mode: "EOT"
              runProperties:
                probeTimeout: 30
                retry: 3
              promProbe/inputs:
                endpoint: "http://prometheus.monitoring.svc.cluster.local:9090"
                query: "swissbrain:error_budget_remaining:agent"
                comparator:
                  type: "float"
                  criteria: ">="
                  value: "0.9"

---
# GameDay chaos schedule (monthly comprehensive test)
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosSchedule
metadata:
  name: swissbrain-monthly-gameday
  namespace: litmus
spec:
  schedule:
    now: false
    repeat:
      properties:
        minChaosInterval: "720h"  # Monthly
      workDays:
        includedDays: "Sat"
      workHours:
        includedHours: "10:00-14:00"
  
  engineTemplateSpec:
    engineState: "active"
    
    # Multi-service chaos for GameDay
    experiments:
      - name: pod-delete
      - name: pod-network-latency
      - name: pod-cpu-hog
```

### Chaos Engineering Runbook

| Experiment Type | Target Service | Hypothesis | Success Criteria | Rollback Plan |
|-----------------|----------------|------------|------------------|---------------|
| Pod Delete | Agent Service | System recovers within 30s | Error rate < 1% during recovery | Auto-scaling triggers replacement |
| Network Latency | LLM Gateway | Timeouts handled gracefully | Fallback responses served | Circuit breaker activates |
| CPU Stress | Search Service | Autoscaling responds | Latency stays < 3s p99 | HPA scales up pods |
| Memory Stress | All Services | OOM handled without cascade | No cascading failures | Pod restart with limits |
| Database Failure | MySQL | Connection pooling handles | App serves cached data | Failover to replica |

### Observability Integration

```yaml
# chaos-observability.yaml
# Prometheus ServiceMonitor for chaos metrics

apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: litmus-chaos-metrics
  namespace: monitoring
  labels:
    app: litmus
spec:
  selector:
    matchLabels:
      app: chaos-exporter
  namespaceSelector:
    matchNames:
      - litmus
  endpoints:
    - port: tcp
      interval: 30s
      path: /metrics

---
# Grafana dashboard ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: chaos-engineering-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  chaos-dashboard.json: |
    {
      "title": "SwissBrain Chaos Engineering",
      "panels": [
        {
          "title": "Active Chaos Experiments",
          "type": "stat",
          "targets": [
            {
              "expr": "count(litmuschaos_experiment_verdict{verdict=\"Pass\"})"
            }
          ]
        },
        {
          "title": "Experiment Success Rate",
          "type": "gauge",
          "targets": [
            {
              "expr": "sum(litmuschaos_experiment_verdict{verdict=\"Pass\"}) / sum(litmuschaos_experiment_verdict) * 100"
            }
          ]
        },
        {
          "title": "Error Budget Impact",
          "type": "timeseries",
          "targets": [
            {
              "expr": "swissbrain:error_budget_remaining:agent",
              "legendFormat": "Agent"
            },
            {
              "expr": "swissbrain:error_budget_remaining:search",
              "legendFormat": "Search"
            },
            {
              "expr": "swissbrain:error_budget_remaining:llm",
              "legendFormat": "LLM"
            }
          ]
        }
      ]
    }
```

---

## Appendix: Quick Reference

### Multi-Tenant Tables Summary

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `tenants` | Tenant registry | id, slug, plan_tier, status |
| `tenant_members` | User-tenant mapping | tenant_id, user_id, role |
| `tenant_quotas` | Resource limits | tenant_id, api_requests_*, llm_tokens_* |
| `tenant_quota_usage` | Usage tracking | tenant_id, window_*, *_count |
| `abuse_scores` | Threat scoring | tenant_id, overall_score, risk_level |
| `abuse_events` | Incident log | tenant_id, event_type, severity |
| `ip_reputation` | IP intelligence | ip_address, reputation_score |

### SLO Targets Summary

| Service | Availability | Latency | Error Budget (30d) |
|---------|--------------|---------|-------------------|
| Search API | 99.9% | p99 < 2s | 43.2 min |
| Agent Service | 99.5% | p99 < 5s | 3.6 hours |
| LLM Gateway | 99.95% | TTFT p95 < 1s | 21.6 min |
| Authentication | 99.99% | p99 < 500ms | 4.3 min |

### Chaos Experiment Types

| Type | Tool | Use Case |
|------|------|----------|
| Pod Failure | LitmusChaos | Test pod recovery and scaling |
| Network Chaos | LitmusChaos | Test timeout handling and retries |
| Resource Stress | LitmusChaos | Test autoscaling and resource limits |
| Database Chaos | LitmusChaos | Test connection pooling and failover |

---

*Document Version: 1.0*  
*Last Updated: January 2026*  
*Author: SwissBrain Platform Team*
