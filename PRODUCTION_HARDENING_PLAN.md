# InvoChain Production Hardening Plan

## Executive Summary

This document provides a comprehensive, prescriptive plan to transform the InvoChain B2B Invoice Reconciliation & GST Filing System from a functional prototype into a production-grade, enterprise-ready platform. The system currently operates as a microservices architecture (Node.js/TypeScript, PostgreSQL, Redis, MinIO, message broker) handling automated invoice reconciliation, inventory management, and GST compliance for Indian B2B merchants.

**Current State**: Functional prototype with basic transaction handling, manual compensating transactions, shared database architecture, and minimal observability.

**Target State**: Resilient, secure, auditable, and scalable production system with idempotent APIs, distributed transaction management (Saga pattern), comprehensive monitoring, automated testing, infrastructure-as-code, and enterprise-grade security.

**Risk Mitigation**: Prioritized action items address critical data integrity risks (duplicate invoice processing, inventory race conditions), security vulnerabilities (secrets in code, missing encryption), and operational blind spots (no metrics, manual incident response).

**Rollout Strategy**: Phased migration using canary deployments → blue/green cutover with automated health checks and instant rollback capabilities.

---

## 1. High-Level Hardening Plan (Prioritized)

### Top 15 Action Items (Ranked by Risk & ROI)

| Priority | Action Item | Justification | Effort | Risk Mitigation |
|----------|-------------|---------------|--------|-----------------|
| **P0-1** | **Implement Idempotency for POST /invoices** | Prevents duplicate invoice creation and double inventory deduction. Critical data integrity risk. | M | Eliminates duplicate charges, inventory corruption |
| **P0-2** | **Add Distributed Locking for Inventory Operations** | Prevents race conditions in concurrent inventory reserve/commit/release. | M | Prevents overselling, stock corruption |
| **P0-3** | **Implement Saga Pattern for Invoice Creation** | Ensures reliable compensation if any step fails (inventory, DB, audit). | L | Guarantees eventual consistency |
| **P0-4** | **Secrets Management (Vault/AWS Secrets Manager)** | Remove hardcoded secrets from code/env files. Critical security risk. | S | Prevents credential leaks, enables rotation |
| **P0-5** | **Add Prometheus Metrics + Grafana Dashboards** | Zero observability = blind operations. Essential for production. | M | Enables proactive monitoring, SLA tracking |
| **P1-6** | **Implement Circuit Breakers for Service Calls** | Prevents cascade failures when inventory/audit services are down. | S | Improves resilience, faster failure detection |
| **P1-7** | **Add Request Rate Limiting** | Protects against DoS attacks and abusive clients. | S | Prevents service degradation |
| **P1-8** | **Database Connection Pooling Optimization** | Current pool has no limits; can exhaust connections under load. | S | Prevents connection exhaustion |
| **P1-9** | **Implement Dead Letter Queue (DLQ)** | Failed compensation transactions currently lost. | M | Ensures no silent failures |
| **P1-10** | **Add OpenTelemetry Distributed Tracing** | Essential for debugging cross-service issues in production. | M | Reduces MTTR for incidents |
| **P2-11** | **Implement RBAC Middleware** | Current auth is basic; no fine-grained permissions. | M | Prevents unauthorized actions |
| **P2-12** | **Add Database Read Replicas** | Reduces load on primary; enables zero-downtime migrations. | M | Improves read scalability |
| **P2-13** | **Implement Automated Backup & DR** | No backup strategy = catastrophic data loss risk. | M | Enables recovery from disasters |
| **P2-14** | **Add Contract Tests (PACT)** | Prevents breaking changes between services. | M | Reduces integration bugs |
| **P2-15** | **Implement Field-Level Encryption for GSTIN** | Compliance requirement for sensitive tax data. | M | Meets data protection regulations |

**Effort Legend**: S (Small: 1-3 days), M (Medium: 4-7 days), L (Large: 8-15 days)

### Migration Rollout Plan

#### Phase 1: Foundation (Week 1-2)
- **Canary**: Deploy idempotency middleware to 10% of traffic
- **Validation**: Monitor duplicate detection metrics, error rates
- **Rollback**: Instant rollback if error rate > 0.5%
- **Full Rollout**: Blue/green deployment after 48h canary success

#### Phase 2: Reliability (Week 3-4)
- **Canary**: Deploy Saga orchestration + circuit breakers to 25% traffic
- **Validation**: Monitor compensation transaction success rate, circuit breaker trips
- **Rollback**: Automated rollback if compensation failures > 1%
- **Full Rollout**: Progressive rollout 25% → 50% → 100% over 72h

#### Phase 3: Observability (Week 5)
- **Direct Deploy**: Metrics, tracing, logging (non-breaking changes)
- **Validation**: Verify metric collection, dashboard functionality
- **No Rollback Needed**: Observability is additive

#### Phase 4: Security & Compliance (Week 6-7)
- **Canary**: Deploy secrets management, encryption, RBAC to staging first
- **Validation**: Security audit, penetration testing
- **Rollback**: Manual rollback if auth failures detected
- **Full Rollout**: Blue/green deployment after security sign-off

#### Phase 5: Infrastructure (Week 8-9)
- **Progressive**: Add read replicas, optimize connection pools
- **Validation**: Monitor query latency, connection pool metrics
- **Rollback**: DNS-based rollback to old infrastructure
- **Full Rollout**: Gradual traffic shift over 1 week

---

## 2. Architecture & Design Changes

### Updated Component Diagram (Hardened)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL CLIENTS                             │
│                    (Merchants, Buyers, GSTN)                         │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS/TLS 1.3
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE / WAF (Optional)                      │
│  - DDoS Protection  - Rate Limiting  - Bot Detection                │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       LOAD BALANCER (Nginx/ALB)                      │
│  - SSL Termination  - Health Checks  - Sticky Sessions              │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  API Gateway    │    │  API Gateway    │    │  API Gateway    │
│  (Instance 1)   │    │  (Instance 2)   │    │  (Instance 3)   │
│  Port: 3000     │    │  Port: 3000     │    │  Port: 3000     │
│                 │    │                 │    │                 │
│ + Rate Limiter  │    │ + Rate Limiter  │    │ + Rate Limiter  │
│ + JWT Validator │    │ + JWT Validator │    │ + JWT Validator │
│ + CORS/HSTS     │    │ + CORS/HSTS     │    │ + CORS/HSTS     │
│ + Metrics       │    │ + Metrics       │    │ + Metrics       │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                       │
         └──────────────────────┼───────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Auth Service   │    │ Invoice Service │    │Inventory Service│
│  (Clustered)    │    │  (Clustered)    │    │  (Clustered)    │
│  Port: 3011     │    │  Port: 3002     │    │  Port: 3013     │
│                 │    │                 │    │                 │
│ + OIDC/JWT      │    │ + Idempotency   │    │ + Dist. Locks   │
│ + Bcrypt (12)   │    │ + Saga Orch.    │    │ + Optimistic    │
│ + Token Rotate  │    │ + Circuit Break │    │   Concurrency   │
│ + Metrics       │    │ + Metrics       │    │ + Metrics       │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                       │
         │                      ▼                       │
         │             ┌─────────────────┐              │
         │             │  Audit Service  │              │
         │             │  (Clustered)    │              │
         │             │  Port: 3014     │              │
         │             │                 │              │
         │             │ + Event Sourcing│              │
         │             │ + Append-Only   │              │
         │             └────────┬────────┘              │
         │                      │                       │
         └──────────────────────┼───────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      MESSAGE BROKER (Kafka Cluster)                  │
│  - 3 Brokers (HA)  - Replication Factor: 3  - Min ISR: 2            │
│  - Topics: invoice.events, inventory.events, audit.events, dlq      │
│  - Consumer Groups: invoice-consumer, inventory-consumer            │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  GST Service    │    │ Payment Service │    │ Reconciliation  │
│  (Clustered)    │    │  (Clustered)    │    │    Service      │
│  Port: 3008     │    │  Port: 3010     │    │  Port: 3006     │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                       │
         └──────────────────────┼───────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL PRIMARY (Leader)                       │
│  - Version: 15  - Synchronous Replication  - WAL Archiving          │
│  - Connection Pool: Max 100  - Statement Timeout: 30s               │
│  - Encrypted at Rest (LUKS/AWS EBS Encryption)                      │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Read Replica 1 │    │  Read Replica 2 │    │  Standby (DR)   │
│  (Async Replic) │    │  (Async Replic) │    │  (Sync Replic)  │
│  - Analytics    │    │  - Reporting    │    │  - Failover     │
└─────────────────┘    └─────────────────┘    └─────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         REDIS CLUSTER (Sentinel)                     │
│  - 3 Masters + 3 Replicas  - Use Cases: Cache, Locks, Sessions      │
│  - Eviction: LRU  - Persistence: AOF + RDB                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    MINIO / S3 (Object Storage)                       │
│  - Versioning Enabled  - Server-Side Encryption (SSE-S3)            │
│  - Lifecycle: Archive to Glacier after 90 days                      │
│  - Use Cases: Invoice PDFs, Audit Logs, Backups                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                   SECRETS MANAGEMENT (Vault/AWS SM)                  │
│  - Dynamic Secrets  - Auto-Rotation (30 days)  - Audit Logging      │
│  - Secrets: DB Creds, JWT Keys, API Keys, Encryption Keys           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                  OBSERVABILITY STACK                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │   Prometheus    │  │     Grafana     │  │      Jaeger     │    │
│  │  (Metrics)      │  │  (Dashboards)   │  │  (Tracing)      │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Loki / ELK (Centralized Logging)               │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Correctness Patterns

#### Pattern 1: Saga Pattern for Invoice Creation (Orchestration-Based)

**Flow**:
```
1. API Gateway receives POST /invoices
2. Saga Orchestrator starts transaction
3. Step 1: Reserve Inventory (Inventory Service)
   - Success → Step 2
   - Failure → Abort, return error
4. Step 2: Create Invoice (Invoice Service DB)
   - Success → Step 3
   - Failure → Compensate: Release Inventory → Abort
5. Step 3: Log Audit Event (Audit Service)
   - Success → Commit, return success
   - Failure → Compensate: Delete Invoice, Release Inventory → Abort
6. Publish invoice.created event to Kafka
```

**Compensation Logic**:
- Each step has a compensating transaction
- Compensations execute in reverse order
- Failed compensations go to DLQ for manual intervention

#### Pattern 2: Idempotency for POST /invoices

**Implementation**:
- Client sends `Idempotency-Key` header (UUID)
- Middleware checks Redis cache: `idempotency:{key}`
- If exists: Return cached response (200 OK)
- If not exists: Process request, cache response for 24h
- Use distributed lock to prevent race conditions

#### Pattern 3: Distributed Locking for Inventory

**Implementation**:
- Use Redis Redlock algorithm
- Lock key: `inventory:lock:{merchant_id}:{sku}`
- TTL: 5 seconds (auto-release if service crashes)
- Retry: 3 attempts with exponential backoff
- Prevents concurrent reserve/commit/release on same SKU

#### Pattern 4: Optimistic Concurrency Control

**Implementation**:
- Add `version` column to `inventory` table
- On update: `UPDATE inventory SET quantity = $1, version = version + 1 WHERE id = $2 AND version = $3`
- If affected rows = 0: Retry transaction
- Max retries: 3

#### Pattern 5: Event Sourcing for Audit Logs

**Implementation**:
- Append-only `audit_logs` table
- Never UPDATE or DELETE
- Each event has `prev_hash` linking to previous event
- Blockchain-style hash chain for tamper detection
- Periodic snapshots for query performance

---

## 3. Reliability & Consistency

### Network Partition Handling

**Strategy**: Eventual Consistency with Conflict Resolution

**Scenario 1: Inventory Service Unreachable**
- Circuit breaker opens after 5 failures
- Invoice creation fails fast with 503 Service Unavailable
- Client retries with exponential backoff
- No partial state created

**Scenario 2: Database Partition (Split-Brain)**
- Use PostgreSQL synchronous replication with `synchronous_commit = remote_apply`
- Standby cannot accept writes (read-only mode)
- Primary waits for standby acknowledgment before commit
- If standby unreachable: Primary blocks writes (safety over availability)

**Scenario 3: Kafka Partition**
- Producer: `acks=all` (wait for all in-sync replicas)
- Consumer: Manual offset commit after processing
- Idempotent producer enabled
- Transactional writes for exactly-once semantics

### Conflict Resolution

**Invoice Duplicate Detection**:
- Unique constraint: `(seller_merchant_id, invoice_number)`
- If conflict: Return 409 Conflict with existing invoice ID
- Client can use idempotency key to safely retry

**Inventory Race Conditions**:
- Pessimistic locking with `FOR UPDATE` in transactions
- Distributed locks for cross-service coordination
- Optimistic concurrency as fallback

### Database Transaction Boundaries

**Rule**: One transaction per aggregate root

**Example: Invoice Creation**
```sql
BEGIN;
  -- Lock inventory rows
  SELECT * FROM inventory WHERE merchant_id = $1 AND sku = ANY($2) FOR UPDATE;
  
  -- Update reserved quantity
  UPDATE inventory SET reserved_quantity = reserved_quantity + $qty WHERE id = $id;
  
  -- Insert invoice
  INSERT INTO invoices (...) VALUES (...);
  
  -- Insert invoice items
  INSERT INTO invoice_items (...) VALUES (...);
  
  -- Insert audit log
  INSERT INTO audit_logs (...) VALUES (...);
COMMIT;
```

**Anti-Pattern**: Cross-service transactions (use Saga instead)

---

## 4. Security & Compliance

### Security Hardening Checklist

| Category | Control | Implementation | Priority |
|----------|---------|----------------|----------|
| **Transport** | TLS 1.3 Everywhere | Nginx SSL config, enforce HTTPS redirect | P0 |
| **Headers** | HSTS | `Strict-Transport-Security: max-age=31536000` | P0 |
| **Headers** | CSP | `Content-Security-Policy: default-src 'self'` | P1 |
| **Headers** | X-Frame-Options | `X-Frame-Options: DENY` | P1 |
| **Auth** | JWT with Rotation | Rotate signing keys every 30 days | P0 |
| **Auth** | Bcrypt Cost Factor | Increase to 12 (currently 10) | P1 |
| **Input** | Validation | Joi schemas on all endpoints | P0 |
| **Input** | Sanitization | DOMPurify for frontend, escape SQL | P0 |
| **SQL** | Parameterized Queries | Already implemented, audit for violations | P0 |
| **RBAC** | Role-Based Access | Middleware to check user.role | P1 |
| **Rate Limit** | API Rate Limiting | 100 req/min per IP, 1000 req/min per user | P0 |
| **Secrets** | Vault Integration | Remove all hardcoded secrets | P0 |
| **Encryption** | DB Encryption at Rest | Enable PostgreSQL pgcrypto + LUKS | P1 |
| **Encryption** | Field-Level (GSTIN) | Encrypt GSTIN column with AES-256 | P2 |
| **Logging** | Audit Logging | Log all auth events, invoice actions | P0 |
| **Compliance** | Data Retention | 7-year retention for tax records | P1 |
| **Compliance** | Right to be Forgotten | Anonymization script for GDPR | P2 |

### GDPR / Indian Data Compliance

**Data Retention Policy**:
- **Tax Records (Invoices, GST Returns)**: 7 years (Indian tax law)
- **User Data (PII)**: Until account deletion + 30 days
- **Audit Logs**: 3 years
- **Backups**: 90 days

**Right to be Forgotten**:
```sql
-- Anonymize user data (keep invoice records for tax compliance)
UPDATE users SET email = 'deleted_' || id || '@example.com', password_hash = 'DELETED' WHERE id = $user_id;
UPDATE merchants SET legal_name = 'DELETED', address = 'DELETED', phone = 'DELETED', email = 'DELETED' WHERE user_id = $user_id;
-- Do NOT delete invoices (tax compliance requirement)
```

**GSTN Integration Compliance**:
- Sign all API requests with HMAC-SHA256
- Log all GSTN API calls with request/response payloads
- Flag invoices with UNREGISTERED GSTIN for manual review
- Validate GSTIN format: 2 digits (state) + 10 digits (PAN) + 1 digit (entity) + 1 letter (Z) + 1 check digit

---

## 5. Observability & Monitoring

### Metrics to Collect (Prometheus)

#### Application Metrics (Per Service)

**Invoice Service**:
- `invoice_created_total` (Counter) - Labels: status (success/failure)
- `invoice_creation_duration_seconds` (Histogram) - Buckets: 0.1, 0.5, 1, 2, 5
- `invoice_action_total` (Counter) - Labels: action (accept/reject), status
- `inventory_reservation_failures_total` (Counter)
- `saga_compensation_total` (Counter) - Labels: step, success/failure

**Inventory Service**:
- `inventory_reserve_total` (Counter) - Labels: status
- `inventory_commit_total` (Counter)
- `inventory_release_total` (Counter)
- `inventory_stock_level` (Gauge) - Labels: merchant_id, sku
- `inventory_lock_wait_seconds` (Histogram)

**Auth Service**:
- `auth_login_total` (Counter) - Labels: status (success/failure)
- `auth_register_total` (Counter)
- `jwt_token_issued_total` (Counter)
- `jwt_validation_failures_total` (Counter)

**API Gateway**:
- `http_requests_total` (Counter) - Labels: method, path, status_code
- `http_request_duration_seconds` (Histogram)
- `rate_limit_exceeded_total` (Counter) - Labels: ip, user_id
- `circuit_breaker_state` (Gauge) - Labels: service (0=closed, 1=open, 2=half-open)

#### Infrastructure Metrics

**PostgreSQL**:
- `pg_connections_active` (Gauge)
- `pg_connections_idle` (Gauge)
- `pg_transaction_duration_seconds` (Histogram)
- `pg_deadlocks_total` (Counter)
- `pg_replication_lag_seconds` (Gauge)

**Kafka**:
- `kafka_producer_send_total` (Counter) - Labels: topic, status
- `kafka_consumer_lag` (Gauge) - Labels: topic, consumer_group
- `kafka_broker_online` (Gauge)

**Redis**:
- `redis_connected_clients` (Gauge)
- `redis_used_memory_bytes` (Gauge)
- `redis_evicted_keys_total` (Counter)
- `redis_lock_acquisitions_total` (Counter) - Labels: key, status

### Grafana Dashboard Panels

**Dashboard 1: Invoice Flow Health**

```json
{
  "title": "Invoice Creation Rate",
  "type": "graph",
  "targets": [
    {
      "expr": "rate(invoice_created_total{status=\"success\"}[5m])",
      "legendFormat": "Success"
    },
    {
      "expr": "rate(invoice_created_total{status=\"failure\"}[5m])",
      "legendFormat": "Failure"
    }
  ],
  "yaxes": [{"label": "Invoices/sec"}]
}
```

```json
{
  "title": "Invoice Creation Latency (p50, p95, p99)",
  "type": "graph",
  "targets": [
    {
      "expr": "histogram_quantile(0.50, rate(invoice_creation_duration_seconds_bucket[5m]))",
      "legendFormat": "p50"
    },
    {
      "expr": "histogram_quantile(0.95, rate(invoice_creation_duration_seconds_bucket[5m]))",
      "legendFormat": "p95"
    },
    {
      "expr": "histogram_quantile(0.99, rate(invoice_creation_duration_seconds_bucket[5m]))",
      "legendFormat": "p99"
    }
  ],
  "yaxes": [{"label": "Seconds"}],
  "alert": {
    "conditions": [{"evaluator": {"params": [2], "type": "gt"}, "query": {"params": ["p95"]}}],
    "message": "Invoice creation p95 latency > 2s"
  }
}
```

```json
{
  "title": "Inventory Reservation Failures",
  "type": "singlestat",
  "targets": [
    {
      "expr": "sum(rate(inventory_reservation_failures_total[5m]))"
    }
  ],
  "thresholds": "0.1,1",
  "colors": ["green", "yellow", "red"]
}
```

**Dashboard 2: System Health**

```json
{
  "title": "Circuit Breaker Status",
  "type": "table",
  "targets": [
    {
      "expr": "circuit_breaker_state",
      "format": "table",
      "instant": true
    }
  ],
  "transformations": [
    {"id": "organize", "options": {"renameByName": {"service": "Service", "Value": "State"}}}
  ],
  "valueMaps": [
    {"value": "0", "text": "CLOSED"},
    {"value": "1", "text": "OPEN"},
    {"value": "2", "text": "HALF_OPEN"}
  ]
}
```

```json
{
  "title": "Database Connection Pool",
  "type": "graph",
  "targets": [
    {
      "expr": "pg_connections_active",
      "legendFormat": "Active"
    },
    {
      "expr": "pg_connections_idle",
      "legendFormat": "Idle"
    }
  ],
  "yaxes": [{"label": "Connections", "max": 100}],
  "alert": {
    "conditions": [{"evaluator": {"params": [90], "type": "gt"}, "query": {"params": ["Active"]}}],
    "message": "DB connection pool near exhaustion"
  }
}
```

### Distributed Tracing (OpenTelemetry)

**Instrumentation Points**:

1. **HTTP Requests**: Auto-instrument Express with `@opentelemetry/instrumentation-express`
2. **Database Queries**: Instrument pg with `@opentelemetry/instrumentation-pg`
3. **HTTP Calls**: Instrument axios with `@opentelemetry/instrumentation-http`
4. **Custom Spans**:
   - `invoice.create` (parent span)
     - `inventory.reserve` (child span)
     - `db.insert.invoice` (child span)
     - `audit.log` (child span)

**Trace Context Propagation**:
- Use W3C Trace Context headers: `traceparent`, `tracestate`
- Propagate across all service calls
- Export to Jaeger for visualization

### Structured Logging Format

**JSON Log Format**:
```json
{
  "timestamp": "2025-11-26T00:25:50.123Z",
  "level": "info",
  "service": "invoice-service",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "message": "Invoice created successfully",
  "invoiceId": "550e8400-e29b-41d4-a716-446655440000",
  "merchantId": "660e8400-e29b-41d4-a716-446655440001",
  "totalAmount": 15000.00,
  "duration_ms": 245
}
```

**Log Levels**:
- **ERROR**: Service failures, unhandled exceptions
- **WARN**: Retries, circuit breaker opens, high latency
- **INFO**: Business events (invoice created, accepted, rejected)
- **DEBUG**: Detailed flow (disabled in production)

**Retention**:
- Hot storage (Loki/ELK): 30 days
- Cold storage (S3): 90 days
- Audit logs: 3 years

---

## 6. Resilience & Operational Controls

### Circuit Breaker Pattern

**Configuration** (using `opossum` library):
```javascript
const circuitBreakerOptions = {
  timeout: 3000,              // Timeout after 3s
  errorThresholdPercentage: 50, // Open if 50% of requests fail
  resetTimeout: 30000,        // Try again after 30s
  rollingCountTimeout: 10000, // 10s rolling window
  rollingCountBuckets: 10,    // 10 buckets
  name: 'inventory-service'
};
```

**Fallback Strategies**:
- **Inventory Service Down**: Reject invoice creation with 503, suggest retry
- **Audit Service Down**: Log locally to DLQ, async retry
- **Payment Service Down**: Cache payment status, reconcile later

### Retry Policy with Exponential Backoff

**Configuration**:
```javascript
const retryConfig = {
  retries: 3,
  factor: 2,              // Exponential factor
  minTimeout: 1000,       // 1s initial delay
  maxTimeout: 10000,      // 10s max delay
  randomize: true,        // Add jitter
  retryableErrors: [     // Only retry these
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND'
  ],
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
};
```

**Retry Schedule**:
- Attempt 1: Immediate
- Attempt 2: 1s + jitter
- Attempt 3: 2s + jitter
- Attempt 4: 4s + jitter
- Fail: Send to DLQ

### Dead Letter Queue (DLQ) Pattern

**Kafka Topics**:
- `invoice.events` (main topic)
- `invoice.events.dlq` (dead letter queue)

**DLQ Consumer Logic**:
```javascript
// After 3 failed retries, send to DLQ
if (retryCount >= 3) {
  await producer.send({
    topic: 'invoice.events.dlq',
    messages: [{
      key: message.key,
      value: JSON.stringify({
        originalMessage: message.value,
        error: error.message,
        retryCount: retryCount,
        failedAt: new Date().toISOString()
      })
    }]
  });
}
```

**DLQ Monitoring**:
- Alert if DLQ depth > 10 messages
- Daily review of DLQ messages
- Manual replay after fixing root cause

### Backpressure Handling

**Strategy 1: Queue Depth Monitoring**
```javascript
if (kafkaConsumerLag > 10000) {
  // Slow down producer
  await sleep(100);
}
```

**Strategy 2: Rate Limit Headers**
```javascript
res.setHeader('X-RateLimit-Limit', '100');
res.setHeader('X-RateLimit-Remaining', remaining);
res.setHeader('X-RateLimit-Reset', resetTime);
if (remaining === 0) {
  res.setHeader('Retry-After', '60');
  return res.status(429).json({ error: 'Rate limit exceeded' });
}
```

### Chaos Testing Checklist

**Experiment 1: Database Replica Lag**
- Inject 5s replication lag on read replica
- Verify: Stale data detection, fallback to primary
- Success Criteria: No data inconsistencies

**Experiment 2: Kafka Broker Outage**
- Kill 1 of 3 Kafka brokers
- Verify: Producer/consumer continue, no message loss
- Success Criteria: Zero downtime, automatic failover

**Experiment 3: Inventory Service Latency**
- Inject 10s latency in inventory service
- Verify: Circuit breaker opens, fast failure
- Success Criteria: Invoice creation fails fast (< 5s)

**Experiment 4: Network Partition**
- Partition API Gateway from Invoice Service
- Verify: Timeout, retry, eventual success
- Success Criteria: No duplicate invoices

---

## 7. Testing Strategy & Test Artifacts

### Test Pyramid

```
        ┌─────────────┐
        │   E2E (5%)  │  ← Load Tests, Chaos Tests
        └─────────────┘
       ┌───────────────┐
       │ Contract (15%)│  ← PACT Tests
       └───────────────┘
      ┌─────────────────┐
      │Integration (30%)│  ← API Tests, DB Tests
      └─────────────────┘
     ┌───────────────────┐
     │    Unit (50%)     │  ← Business Logic, Utils
     └───────────────────┘
```

### Performance Targets

- **Invoice Creation**: < 500ms (p95)
- **Invoice Acceptance**: < 300ms (p95)
- **GST Return Generation**: < 2s (p95)
- **Throughput**: 100 invoices/sec sustained
- **Availability**: 99.9% (8.76h downtime/year)

---

## 8. Data Integrity & Reconciliation

### Duplicate Detection Algorithm

**Strategy**: Multi-Layer Defense

**Layer 1: Idempotency Key (API Level)**
- Client sends `Idempotency-Key` header
- Cache in Redis for 24h
- Prevents duplicate API calls

**Layer 2: Unique Constraint (DB Level)**
- `UNIQUE(seller_merchant_id, invoice_number)`
- Prevents duplicate invoice numbers per merchant

**Layer 3: Distributed Lock (Service Level)**
- Lock key: `invoice:create:{merchant_id}:{invoice_number}`
- Prevents race conditions

### Reconciliation Job Design

**Frequency**: Daily at 2 AM IST

**SQL Queries**:

```sql
-- Find invoices without corresponding inventory events
SELECT i.id, i.invoice_number, i.total_amount
FROM invoices i
LEFT JOIN inventory_events ie ON ie.invoice_id = i.id
WHERE i.status = 'ACCEPTED'
  AND ie.id IS NULL
  AND i.created_at > NOW() - INTERVAL '7 days';

-- Find inventory events without invoices
SELECT ie.id, ie.invoice_id, ie.quantity_change
FROM inventory_events ie
LEFT JOIN invoices i ON i.id = ie.invoice_id
WHERE ie.event_type IN ('RESERVE', 'COMMIT')
  AND i.id IS NULL
  AND ie.created_at > NOW() - INTERVAL '7 days';

-- Find invoices with mismatched amounts
SELECT i.id, i.invoice_number, i.total_amount,
       SUM(ii.total_item_amount) AS calculated_total
FROM invoices i
JOIN invoice_items ii ON ii.invoice_id = i.id
GROUP BY i.id
HAVING i.total_amount != SUM(ii.total_item_amount);
```

**Reconciliation Report Schema**:
```sql
CREATE TABLE reconciliation_reports (
  id UUID PRIMARY KEY,
  report_date DATE NOT NULL,
  total_invoices INTEGER,
  matched_invoices INTEGER,
  discrepancies_count INTEGER,
  discrepancy_types JSONB, -- {"missing_inventory": 5, "amount_mismatch": 2}
  status VARCHAR(20), -- PENDING, REVIEWED, RESOLVED
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Alerting Thresholds**:
- Discrepancy rate > 1%: WARNING
- Discrepancy rate > 5%: CRITICAL
- Missing inventory events: CRITICAL (immediate alert)

---

## 9. Backup, DR & Migrations

### Backup Schedule

**PostgreSQL**:
- **Full Backup**: Daily at 1 AM IST (pg_dump)
- **Incremental Backup**: WAL archiving every 5 minutes
- **Retention**: 30 daily, 12 weekly, 12 monthly
- **Storage**: S3 with versioning enabled

**MinIO/S3**:
- **Versioning**: Enabled (keep last 10 versions)
- **Replication**: Cross-region replication to DR site
- **Lifecycle**: Archive to Glacier after 90 days

**Redis**:
- **RDB Snapshot**: Every 6 hours
- **AOF**: Append-only file with fsync every second
- **Retention**: 7 days

### Disaster Recovery Runbook

**RTO (Recovery Time Objective)**: 4 hours  
**RPO (Recovery Point Objective)**: 5 minutes (WAL archiving interval)

**DR Procedure**:

1. **Detect Disaster** (Automated)
   - Health checks fail for > 5 minutes
   - PagerDuty alert to on-call engineer

2. **Assess Impact** (5 minutes)
   - Check: Database, Kafka, Services
   - Decision: Failover or Fix-in-place

3. **Failover to DR Site** (30 minutes)
   ```bash
   # Promote standby to primary
   pg_ctl promote -D /var/lib/postgresql/data
   
   # Update DNS to point to DR site
   aws route53 change-resource-record-sets --hosted-zone-id Z123 \
     --change-batch file://failover-dns.json
   
   # Restart services with DR config
   kubectl apply -f k8s/dr-config.yaml
   ```

4. **Verify Services** (15 minutes)
   - Run smoke tests
   - Check metrics dashboards
   - Verify invoice creation flow

5. **Communicate** (10 minutes)
   - Update status page
   - Notify stakeholders

6. **Post-Mortem** (Within 48 hours)
   - Root cause analysis
   - Action items to prevent recurrence

### Automated Restore Playbook

**PostgreSQL Restore**:
```bash
#!/bin/bash
# restore-postgres.sh

BACKUP_DATE=$1  # Format: YYYY-MM-DD
BACKUP_FILE="s3://invochain-backups/postgres/invochain-${BACKUP_DATE}.sql.gz"

# Download backup
aws s3 cp $BACKUP_FILE /tmp/backup.sql.gz

# Stop services
kubectl scale deployment invoice-service --replicas=0

# Drop and recreate database
psql -U admin -c "DROP DATABASE invochain;"
psql -U admin -c "CREATE DATABASE invochain;"

# Restore
gunzip -c /tmp/backup.sql.gz | psql -U admin invochain

# Restart services
kubectl scale deployment invoice-service --replicas=3

echo "Restore complete. Verify data integrity."
```

### Zero-Downtime Migration Pattern

**Strategy**: Expand-Contract Pattern

**Phase 1: Expand (Add New Column)**
```sql
-- Migration 001: Add new column
ALTER TABLE invoices ADD COLUMN new_status VARCHAR(20);

-- Backfill existing data
UPDATE invoices SET new_status = status WHERE new_status IS NULL;
```

**Phase 2: Dual Write (Application Code)**
```javascript
// Write to both old and new columns
await client.query(
  'UPDATE invoices SET status = $1, new_status = $1 WHERE id = $2',
  [newStatus, invoiceId]
);
```

**Phase 3: Feature Flag Rollout**
```javascript
if (featureFlags.useNewStatusColumn) {
  // Read from new column
  const status = invoice.new_status;
} else {
  // Read from old column
  const status = invoice.status;
}
```

**Phase 4: Contract (Remove Old Column)**
```sql
-- Migration 002: Drop old column (after 100% rollout)
ALTER TABLE invoices DROP COLUMN status;
ALTER TABLE invoices RENAME COLUMN new_status TO status;
```

---

## 10. Infrastructure as Code & CI/CD

### Rollback Procedures

**Application Rollback** (Kubernetes):
```bash
# Rollback to previous deployment
kubectl rollout undo deployment/invoice-service

# Rollback to specific revision
kubectl rollout undo deployment/invoice-service --to-revision=5

# Verify rollback
kubectl rollout status deployment/invoice-service
```

**Database Migration Rollback**:
```bash
# Revert last migration
npm run migrate:down

# Verify schema
psql -U admin invochain -c "\d invoices"
```

**Infrastructure Rollback** (Terraform):
```bash
# Revert to previous state
terraform apply -target=module.database -var-file=previous-state.tfvars

# Or restore from state backup
cp terraform.tfstate.backup terraform.tfstate
terraform apply
```

**DNS Rollback** (Route53):
```bash
# Revert to old load balancer
aws route53 change-resource-record-sets --hosted-zone-id Z123 \
  --change-batch file://rollback-dns.json
```

**Rollback Decision Matrix**:

| Issue | Rollback Strategy | Time to Rollback |
|-------|-------------------|------------------|
| High error rate (> 5%) | Immediate automatic rollback | < 1 minute |
| Latency spike (p95 > 2s) | Automatic rollback after 5 min | < 1 minute |
| Data corruption | Manual rollback + DB restore | 30 minutes |
| Security vulnerability | Immediate manual rollback | < 5 minutes |

---

## Next Steps

1. **Review & Approval**: Stakeholder review of this plan (1 week)
2. **Team Training**: Onboard engineers on new patterns (1 week)
3. **Staging Deployment**: Deploy all changes to staging (2 weeks)
4. **Load Testing**: Run k6 tests, chaos experiments (1 week)
5. **Production Rollout**: Phased rollout per migration plan (9 weeks)
6. **Monitoring & Iteration**: Continuous improvement based on metrics

**Total Timeline**: 14 weeks (3.5 months) to full production hardening

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-26  
**Owner**: Engineering Leadership  
**Status**: Draft - Awaiting Approval
