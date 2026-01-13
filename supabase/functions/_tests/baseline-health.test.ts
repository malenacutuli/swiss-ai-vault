/**
 * SwissBrain.ai Baseline Health Check Tests
 *
 * PURPOSE: Verify all existing functionality works before/after changes
 * RUN: Before AND after every agentic module implementation
 *
 * If ANY test fails after a change, REVERT immediately.
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

// Helper for API calls
async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${SUPABASE_URL}/functions/v1/${endpoint}`;
  return fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

// ============================================
// CRITICAL PATH TESTS - Must ALL pass
// ============================================

Deno.test("CRITICAL: Chat endpoint responds", async () => {
  const response = await apiCall("chat", {
    method: "POST",
    body: JSON.stringify({
      messages: [{ role: "user", content: "test" }],
      stream: false,
    }),
  });
  // Should not return 500 or 404
  assertEquals(response.status !== 500, true, "Chat endpoint should not error");
  assertEquals(response.status !== 404, true, "Chat endpoint should exist");
});

Deno.test("CRITICAL: Ghost inference endpoint responds", async () => {
  const response = await apiCall("ghost-inference", {
    method: "POST",
    body: JSON.stringify({
      prompt: "test",
      mode: "quick",
    }),
  });
  assertEquals(response.status !== 500, true, "Ghost inference should not error");
  assertEquals(response.status !== 404, true, "Ghost inference should exist");
});

Deno.test("CRITICAL: Credits checkout endpoint responds", async () => {
  const response = await apiCall("create-credits-checkout", {
    method: "POST",
    body: JSON.stringify({
      credits: 100,
      successUrl: "https://swissbrain.ai/success",
      cancelUrl: "https://swissbrain.ai/cancel",
    }),
  });
  // 401 is expected without auth, but not 500 or 404
  assertEquals(response.status !== 500, true, "Checkout should not error");
  assertEquals(response.status !== 404, true, "Checkout should exist");
});

Deno.test("CRITICAL: Analytics endpoint responds", async () => {
  const response = await apiCall("analytics", {
    method: "POST",
    body: JSON.stringify({
      event: "test",
      properties: {},
    }),
  });
  assertEquals(response.status !== 500, true, "Analytics should not error");
});

Deno.test("CRITICAL: Audit logs endpoint responds", async () => {
  const response = await apiCall("audit-logs", {
    method: "POST",
    body: JSON.stringify({
      action: "test",
      resource: "test",
    }),
  });
  assertEquals(response.status !== 500, true, "Audit logs should not error");
});

// ============================================
// AGENT ENDPOINTS - Verify existing agent infra
// ============================================

Deno.test("AGENT: agent-execute endpoint exists", async () => {
  const response = await apiCall("agent-execute", {
    method: "POST",
    body: JSON.stringify({
      prompt: "test",
    }),
  });
  assertEquals(response.status !== 404, true, "agent-execute should exist");
});

Deno.test("AGENT: agent-status endpoint exists", async () => {
  const response = await apiCall("agent-status", {
    method: "POST",
    body: JSON.stringify({
      runId: "test-run-id",
    }),
  });
  assertEquals(response.status !== 404, true, "agent-status should exist");
});

Deno.test("AGENT: agent-logs endpoint exists", async () => {
  const response = await apiCall("agent-logs", {
    method: "POST",
    body: JSON.stringify({
      runId: "test-run-id",
    }),
  });
  assertEquals(response.status !== 404, true, "agent-logs should exist");
});

// ============================================
// DATABASE CONNECTIVITY
// ============================================

Deno.test("DATABASE: Can query users table", async () => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id&limit=1`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  assertEquals(response.status, 200, "Users table should be queryable");
});

Deno.test("DATABASE: Can query credit_transactions table", async () => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/credit_transactions?select=id&limit=1`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  // RLS may block, but table should exist (not 404)
  assertEquals(response.status !== 404, true, "credit_transactions table should exist");
});

Deno.test("DATABASE: Can query conversations table", async () => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/conversations?select=id&limit=1`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  assertEquals(response.status !== 404, true, "conversations table should exist");
});

Deno.test("DATABASE: Can query organizations table", async () => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/organizations?select=id&limit=1`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  assertEquals(response.status !== 404, true, "organizations table should exist");
});

Deno.test("DATABASE: Can query connectors table", async () => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/connectors?select=id&limit=1`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  assertEquals(response.status !== 404, true, "connectors table should exist");
});

// ============================================
// DOCUMENT GENERATION
// ============================================

Deno.test("DOCS: generate-document endpoint exists", async () => {
  const response = await apiCall("generate-document", {
    method: "POST",
    body: JSON.stringify({
      type: "pdf",
      content: "test",
    }),
  });
  assertEquals(response.status !== 404, true, "generate-document should exist");
});

Deno.test("DOCS: generate-pptx endpoint exists", async () => {
  const response = await apiCall("generate-pptx", {
    method: "POST",
    body: JSON.stringify({
      title: "test",
      slides: [],
    }),
  });
  assertEquals(response.status !== 404, true, "generate-pptx should exist");
});

Deno.test("DOCS: generate-slides endpoint exists", async () => {
  const response = await apiCall("generate-slides", {
    method: "POST",
    body: JSON.stringify({
      title: "test",
      outline: "test outline",
    }),
  });
  assertEquals(response.status !== 404, true, "generate-slides should exist");
});

// ============================================
// RECENTLY ADDED FEATURES (2026-01)
// ============================================

Deno.test("NEW: scheduler endpoint exists", async () => {
  const response = await apiCall("scheduler?action=list", {
    method: "GET",
  });
  assertEquals(response.status !== 404, true, "scheduler should exist");
});

Deno.test("NEW: stripe endpoint exists", async () => {
  const response = await apiCall("stripe?action=subscription", {
    method: "GET",
  });
  assertEquals(response.status !== 404, true, "stripe should exist");
});

Deno.test("NEW: embeddings endpoint exists", async () => {
  const response = await apiCall("embeddings?action=search", {
    method: "POST",
    body: JSON.stringify({
      query: "test",
    }),
  });
  assertEquals(response.status !== 404, true, "embeddings should exist");
});

Deno.test("NEW: voice endpoint exists", async () => {
  const response = await apiCall("voice?action=speak", {
    method: "POST",
    body: JSON.stringify({
      text: "test",
    }),
  });
  assertEquals(response.status !== 404, true, "voice should exist");
});

Deno.test("NEW: generate-image endpoint exists", async () => {
  const response = await apiCall("generate-image", {
    method: "POST",
    body: JSON.stringify({
      prompt: "test",
    }),
  });
  assertEquals(response.status !== 404, true, "generate-image should exist");
});

// ============================================
// NEW TABLES (Verify schema integrity)
// ============================================

Deno.test("SCHEMA: scheduled_tasks table exists", async () => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/scheduled_tasks?select=id&limit=1`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  assertEquals(response.status !== 404, true, "scheduled_tasks table should exist");
});

Deno.test("SCHEMA: task_executions table exists", async () => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/task_executions?select=id&limit=1`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  assertEquals(response.status !== 404, true, "task_executions table should exist");
});

Deno.test("SCHEMA: stripe_customers table exists", async () => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/stripe_customers?select=id&limit=1`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  assertEquals(response.status !== 404, true, "stripe_customers table should exist");
});

Deno.test("SCHEMA: subscriptions table exists", async () => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?select=id&limit=1`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  assertEquals(response.status !== 404, true, "subscriptions table should exist");
});

Deno.test("SCHEMA: document_chunks table exists", async () => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/document_chunks?select=id&limit=1`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  assertEquals(response.status !== 404, true, "document_chunks table should exist");
});

// ============================================
// OAUTH & INTEGRATIONS
// ============================================

Deno.test("OAUTH: connector_credentials table exists", async () => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/connector_credentials?select=id&limit=1`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  assertEquals(response.status !== 404, true, "connector_credentials table should exist");
});

// ============================================
// SUMMARY
// ============================================

console.log(`
╔══════════════════════════════════════════════════════════════╗
║           SWISSBRAIN.AI BASELINE HEALTH CHECK                ║
╠══════════════════════════════════════════════════════════════╣
║  Run this test suite BEFORE and AFTER every change.          ║
║  If ANY test fails after a change, REVERT immediately.       ║
║                                                              ║
║  Command: deno test --allow-net --allow-env baseline-health  ║
╚══════════════════════════════════════════════════════════════╝
`);
