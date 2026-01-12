# Swiss Agents Enterprise Platform
## Complete Knowledge Base & Implementation Roadmap
### January 8, 2026 - MASTER DOCUMENT

---

# PART 1: CONFIRMED KNOWLEDGE ✅

## 1.1 Infrastructure Architecture (100% Understood)

| Component | Implementation | Status |
|-----------|---------------|--------|
| **Sandbox Persistence** | Hybrid (PVC + S3), checksums, incremental sync | ✅ Complete |
| **GPU Sharing** | NVIDIA MPS, time-slicing, fair-share scheduler | ✅ Complete |
| **Network Isolation** | 6-layer (namespace → NetworkPolicy → CNI → iptables → SELinux → VLAN) | ✅ Complete |
| **Kubernetes** | EKS primary, 150-300 nodes, multi-region, Karpenter | ✅ Complete |
| **Database** | 16-shard hybrid, PgBouncer, Redis L2, 2 replicas/shard | ✅ Complete |
| **Persistent Storage** | S3 versioning, deduplication, point-in-time recovery | ✅ Complete |

## 1.2 LLM Operations (100% Understood)

| Component | Implementation | Status |
|-----------|---------------|--------|
| **Token Counting** | js-tiktoken before/after, 3-tier cache | ✅ Complete |
| **Streaming Errors** | Checkpoint every 10 tokens, exponential backoff | ✅ Complete |
| **Cost Attribution** | Tiered (100%/50%/10%), ledger system | ✅ Complete |
| **Provider Fallback** | Primary → Secondary → Tertiary with health checks | ✅ Complete |

## 1.3 Operations (100% Understood)

| Component | Implementation | Status |
|-----------|---------------|--------|
| **Incident Response** | PagerDuty + Opsgenie, 3-tier escalation | ✅ Complete |
| **Monitoring** | Prometheus + Grafana + AlertManager | ✅ Complete |
| **SLA Tiers** | 99.99%/99.9%/99.5% with response times | ✅ Complete |
| **GPU Compatibility** | Detection service, graceful degradation | ✅ Complete |

---

# PART 2: KEY IMPLEMENTATION CODE (Extracted)

## 2.1 Sandbox Hibernation (From Documentation)

```typescript
// Pre-hibernation checkpoint
async prepareForHibernation(sandboxId: string): Promise<void> {
  // 1. Flush pending file changes
  await this.syncQueue.flush();
  
  // 2. Create checkpoint
  const checkpoint = {
    sandboxId,
    timestamp: new Date(),
    fileManifest: await this.createFileManifest(sandboxId),
    processState: await this.captureProcessState(sandboxId),
    environmentVariables: await this.captureEnv(sandboxId)
  };
  
  // 3. Store checkpoint
  await this.s3.putObject({
    Bucket: 'sandbox-checkpoints',
    Key: `${sandboxId}/checkpoint.json`,
    Body: JSON.stringify(checkpoint)
  }).promise();
  
  // 4. Sync files to S3
  await this.syncAllFiles(sandboxId);
}
```

## 2.2 GPU Fair-Share Scheduler (From Documentation)

```typescript
class FairShareScheduler {
  async requestGPU(request: GPUAllocationRequest): Promise<GPUAllocation> {
    const gpu = this.findBestGPU(request);
    
    if (gpu && gpu.availableMemory >= request.gpuMemoryRequired) {
      return this.allocateGPU(gpu, request);
    }
    
    // Queue if no GPU available
    this.allocationQueue.push(request);
    
    // Try defragmentation
    if (this.isMemoryFragmented()) {
      await this.defragmentMemory();
    }
    
    return this.waitForAllocation(request);
  }
}
```

## 2.3 Network Namespace Isolation (From Documentation)

```bash
# Create isolated network namespace
ip netns add sandbox-${sandboxId}
ip link add veth-${sandboxId} type veth peer name veth-${sandboxId}-peer
ip link set veth-${sandboxId}-peer netns sandbox-${sandboxId}
ip netns exec sandbox-${sandboxId} ip addr add ${ipAddress}/24 dev veth-${sandboxId}-peer
ip netns exec sandbox-${sandboxId} ip route add default via ${gateway}
```

## 2.4 Tiered Cost Attribution (From Documentation)

```typescript
calculateTieredCost(attempts: ProviderAttempt[]): CostBreakdown {
  let totalCost = 0;
  
  for (const attempt of attempts) {
    let cost = this.calculateProviderCost(attempt);
    
    if (attempt.status === 'success') {
      // Full cost for successful
      totalCost += cost;
    } else if (attempt.status === 'partial') {
      // 50% cost for partial
      totalCost += cost * 0.5;
    } else {
      // 10% cost for failed (infrastructure only)
      totalCost += cost * 0.1;
    }
  }
  
  return { totalCost, attempts };
}
```

---

# PART 3: OUTSTANDING QUESTIONS (70 Total)

## Category A: Templates & Scaffolding (20 Questions) 🔴 CRITICAL

### A1. Template Structure
1. What is the exact directory structure of your template repository?
2. What does template.json metadata schema contain?
3. What hooks are supported (pre-install, post-install)?
4. How are templates versioned and updated?
5. Can users create custom templates?

### A2. Template Selection
6. What AI/logic determines which template to use from user request?
7. Is there an LLM prompt for template classification?
8. Do you use embeddings/vector search for template matching?
9. What's the fallback if no template matches?
10. Share the actual prompt/logic used for template selection.

### A3. Template Initialization
11. What's the complete step-by-step flow of webdev_init_project()?
12. How long does each step take?
13. What's the error handling at each step?
14. What's the rollback strategy on failure?
15. How do you handle dependency conflicts?

### A4. Template Customization
16. How do you handle template parameterization?
17. Do you use AST transformations or string replacement?
18. How do you handle package.json merging?
19. What's the validation step before applying customizations?
20. How do you handle conflicting feature selections?

## Category B: HMR & Dev Server (15 Questions) 🔴 CRITICAL

### B1. Development Server
21. What dev server configuration do you use for each framework?
22. Do you use a unified dev server wrapper?
23. How do you intercept HMR WebSocket connections?
24. What's the latency from file save to browser refresh?
25. How do you handle different HMR protocols?

### B2. Port Tunneling
26. What reverse proxy do you use (nginx/traefik/caddy)?
27. How do you generate preview URLs?
28. How do you handle SSL/TLS for preview URLs?
29. How do you route WebSocket upgrade requests?
30. What happens to URL when sandbox hibernates?

### B3. File Watching
31. What file watching library do you use?
32. What is the complete list of ignored patterns?
33. What's the debouncing configuration?
34. How do you handle large directories (10K+ files)?
35. How do you handle rename vs delete+create?

## Category C: Container Security (10 Questions) 🔴 CRITICAL

### C1. Sandbox Security
36. Beyond Docker, what additional sandboxing (gVisor/Kata)?
37. What system calls are blocked?
38. What seccomp profile do you use?
39. How do you prevent privilege escalation?
40. What capabilities are dropped?

### C2. Resource Limits
41. What are exact resource limits per tier?
42. How do you handle OOM scenarios?
43. What's the CPU throttling behavior?
44. Can users upgrade resources dynamically?
45. How do you monitor resource abuse?

## Category D: AI Agent (10 Questions) 🟡 IMPORTANT

### D1. Agent Tools
46. What is the complete list of agent tools?
47. What are exact parameter schemas for each tool?
48. How does the agent chain multiple tools?
49. How do you handle tool execution failures?
50. What safety rails exist for the agent?

### D2. Agent Planning
51. Do you use ReAct, Tree-of-Thoughts, or another pattern?
52. Is the plan generated all at once or step-by-step?
53. How does the agent track progress (Todo.md format)?
54. How does it handle errors mid-execution?
55. Can you share a real example of a generated plan?

## Category E: IDE & Terminal (10 Questions) 🟡 IMPORTANT

### E1. Editor
56. What editor do you use (Monaco/CodeMirror)?
57. Do you support LSP? For which languages?
58. How do you run language servers?
59. What IDE features are available?
60. Do you support VS Code extensions?

### E2. Terminal
61. What terminal emulator (xterm.js)?
62. What shell is available?
63. How do you handle terminal persistence?
64. Can users install additional CLI tools?
65. How do multiple terminal sessions work?

## Category F: Swiss Compliance (5 Questions) 🔴 CRITICAL

66. How would you adapt for Swiss data residency (eu-central-2)?
67. What compliance certifications are needed?
68. How do you handle CDN while maintaining Swiss residency?
69. How would you implement E2E encryption for sandboxes?
70. How do you handle audit logging for Swiss compliance?

---

# PART 4: SWISS AGENTS COMPETITIVE ADVANTAGES

## 4.1 What Manus CANNOT Do (SwissVault Moat)

| Feature | SwissVault | Manus |
|---------|------------|-------|
| Zero-Knowledge Encryption | ✅ AES-256-GCM client-side | ❌ Not available |
| Swiss Data Residency | ✅ eu-central-2 Zurich | ❌ US-only |
| Production Fine-Tuning | ✅ 5/6 jobs completed | ❌ On roadmap |
| Privacy-Preserving RAG | ✅ Local embeddings | ❌ Server-side only |
| FINMA Compliance Ready | ✅ Architecture designed | ❌ Not designed for |
| User-Controlled Keys | ✅ IndexedDB storage | ❌ Server-held keys |

## 4.2 Swiss Agents Unique Positioning

```
"The only enterprise development platform that combines 
Manus-level agentic capabilities with Swiss-grade privacy."

Target Markets:
- Swiss Banks (FINMA compliance)
- Swiss Law Firms (Attorney-client privilege)
- Swiss Healthcare (Data protection)
- European Enterprises (GDPR++)
- UHNWIs (Privacy-conscious)
```

---

# PART 5: IMPLEMENTATION ROADMAP

## Phase 1: Foundation (Week 1-2)
- [ ] Template repository structure
- [ ] Template metadata schema (TypeScript interfaces)
- [ ] Base Docker image for sandboxes
- [ ] Kubernetes pod specifications
- [ ] Basic file operations

## Phase 2: Container Infrastructure (Week 2-3)
- [ ] Sandbox lifecycle management
- [ ] Hibernation/resume system
- [ ] Resource limits and security
- [ ] GPU sharing (if applicable)

## Phase 3: Dev Server & HMR (Week 3-4)
- [ ] Framework-specific dev server configs
- [ ] Port tunneling (nginx/traefik)
- [ ] HMR WebSocket proxying
- [ ] File watching system

## Phase 4: AI Agent (Week 4-5)
- [ ] Tool definitions and implementations
- [ ] Planning system (ReAct or similar)
- [ ] Execution engine
- [ ] Error handling and recovery

## Phase 5: Swiss Compliance (Week 5-6)
- [ ] Data residency verification
- [ ] E2E encryption for sandbox files
- [ ] Audit logging implementation
- [ ] Compliance documentation

## Phase 6: Polish & Launch (Week 6-8)
- [ ] IDE features (Monaco + LSP)
- [ ] Terminal implementation
- [ ] Billing and metering
- [ ] Documentation
- [ ] Beta testing

---

# PART 6: QUESTIONS FOR MANUS.IM CALL

## Priority 1: Must Answer (Blocks Development)
1. Template structure and initialization flow
2. Dev server and HMR architecture
3. Port tunneling implementation
4. Agent tool definitions

## Priority 2: Important (Affects Quality)
5. Container security configuration
6. File watching implementation
7. IDE/editor configuration
8. Terminal implementation

## Priority 3: Nice to Have (Optimization)
9. Performance benchmarks
10. Scaling configurations
11. Pricing tier details

---

# APPENDIX: FILES CREATED THIS SESSION

1. `/home/claude/MANUS_ADDITIONAL_QUESTIONS_FOR_SWISS_AGENTS.md`
   - 70 questions across 12 categories
   - Priority rankings
   - Format specifications

2. `/home/claude/SWISS_AGENTS_DEEP_IMPLEMENTATION_QUESTIONS.md`
   - Deep-dive technical questions
   - Code examples expected
   - Schema specifications

3. `/home/claude/SWISS_AGENTS_MASTER_KNOWLEDGE_BASE.md` (this file)
   - Consolidated knowledge
   - Implementation roadmap
   - Competitive advantages

---

*Document Version: 1.0*
*Created: January 8, 2026*
*Purpose: Complete knowledge base for Swiss Agents enterprise development platform*
*Next Steps: Schedule call with Manus.im to answer outstanding questions*
