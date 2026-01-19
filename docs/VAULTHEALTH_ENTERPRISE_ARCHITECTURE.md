# VaultHealth Enterprise Architecture Proposal

## Executive Summary

This document outlines an enterprise-grade architecture for VaultHealth, designed to support thousands of concurrent users while maintaining HIPAA-compliant security, seamless UX, and integration with existing SwissBrain.ai infrastructure.

---

## 1. Current State Analysis

### Existing Components (Already Implemented)
- `src/lib/health/health-storage.ts` - Basic encrypted storage (3 retention modes)
- `src/hooks/useHealthStorage.ts` - React hook for conversation state
- `src/components/vault-health/HealthSidebar.tsx` - Basic sidebar UI
- `src/pages/vault/VaultHealth.tsx` - Main chat interface
- `supabase/functions/healthcare-query/` - Claude-powered AI backend with tool use

### Missing Features (Per User Request)
1. **Project/Folder Organization** - Group conversations into projects
2. **Conversation Continuity** - Resume conversations, not create new ones
3. **File Upload & Persistence** - Store reference documents per project
4. **Memory Integration** - Connect to Ghost/Memory system
5. **Search** - Search across folders and conversations
6. **Task Type Flexibility** - Change task types within conversations
7. **Encryption Display** - Show encryption protocol like VaultChat
8. **Export/Download** - Export analysis for use in other areas
9. **Studio Link** - Connect to /Studio for artifact creation

---

## 2. Proposed Architecture

### 2.1 Data Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER (from Supabase Auth)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    HEALTH PROJECTS                        │    │
│  │  - id, name, description                                  │    │
│  │  - instructions (custom system prompt)                    │    │
│  │  - retentionMode, memoryEnabled                          │    │
│  │  - documents[] (reference files)                          │    │
│  │  - createdAt, updatedAt                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  HEALTH CONVERSATIONS                     │    │
│  │  - id, projectId, title                                   │    │
│  │  - taskType (can change during conversation)             │    │
│  │  - messages[], documents[]                                │    │
│  │  - memoryEnabled, retentionMode                          │    │
│  │  - createdAt, updatedAt, expiresAt                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    HEALTH MESSAGES                        │    │
│  │  - id, role, content                                      │    │
│  │  - taskType (at time of message)                          │    │
│  │  - toolCalls[], citations[]                               │    │
│  │  - modelUsed, latencyMs                                   │    │
│  │  - timestamp                                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 MEMORY INTEGRATION                        │    │
│  │  - Sync conversations to Ghost/Memory                     │    │
│  │  - Source: 'health-chat'                                  │    │
│  │  - aiPlatform: 'swissvault-health'                       │    │
│  │  - projectIds: [healthProjectId]                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Storage Architecture (Two-Tier Venice Pattern)

**Matching Ghost Chat's proven architecture:**

```typescript
// TIER 1: Hot Storage (In-Memory)
class HealthStorageManager {
  private hotProjects: Map<string, HealthProject> = new Map();
  private hotConversations: Map<string, HealthConversation> = new Map();
  // All UI reads/writes go here first - instant access
}

// TIER 2: Cold Storage (IndexedDB + Supabase)
// IndexedDB Stores:
// - 'health-projects' - Encrypted project data
// - 'health-conversations' - Encrypted conversations
// - 'health-settings' - User preferences

// Supabase Tables (for enterprise features):
// - healthcare_projects - Project metadata + sharing
// - healthcare_documents - Reference files (S3/R2)
// - healthcare_audit_log - Compliance logging
```

### 2.3 TypeScript Interfaces

```typescript
// Project (New)
export interface HealthProject {
  id: string;
  name: string;
  description?: string;
  instructions?: string;         // Custom system prompt
  color?: string;
  icon?: string;

  // Settings
  defaultTaskType: TaskType;
  retentionMode: RetentionMode;
  memoryEnabled: boolean;

  // Documents
  documents: ProjectDocument[];

  // Metadata
  conversationIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ProjectDocument {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;           // S3/R2 key or IndexedDB ref
  extractedText?: string;
  uploadedAt: number;
}

// Enhanced Conversation
export interface HealthConversation {
  id: string;
  projectId: string | null;     // Can be standalone
  title: string;

  // Task type per message (history preserved)
  currentTaskType: TaskType;

  // Messages with task type tracking
  messages: HealthMessage[];

  // Attachments for this conversation
  documents: AttachedDocument[];

  // Settings
  retentionMode: RetentionMode;
  memoryEnabled: boolean;
  memoryLastSynced?: number;

  // Metadata
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;

  // Encryption
  keyHash: string;
  encryptionVersion: number;
}

// Enhanced Message
export interface HealthMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  taskType: TaskType;           // Task type when sent

  // AI Response Metadata
  toolCalls?: ToolCall[];
  citations?: Citation[];
  modelUsed?: string;
  latencyMs?: number;

  // Export
  canExport: boolean;
  exportedTo?: string[];        // Studio artifact IDs

  timestamp: number;
}
```

---

## 3. Feature Implementation Plan

### 3.1 Project/Folder Organization

**UI Changes:**
```
┌──────────────────────────────────────────────────────────────┐
│ Health Assistant                              [+] New Project │
├──────────────────────────────────────────────────────────────┤
│ 📁 Diabetes Management                        (3 convos)     │
│    └─ Initial Assessment                      2h ago         │
│    └─ Medication Review                       1d ago         │
│    └─ Lab Results Discussion                  3d ago         │
│                                                               │
│ 📁 Cardiology Cases                           (5 convos)     │
│    └─ Patient A - Hypertension               1h ago         │
│    └─ Patient B - Arrhythmia                 4h ago         │
│    └─ ...                                                     │
│                                                               │
│ 📄 Standalone Conversations                                   │
│    └─ Quick ICD-10 Lookup                    30m ago         │
└──────────────────────────────────────────────────────────────┘
```

**Files to Create/Modify:**
- `src/components/vault-health/HealthProjectSidebar.tsx` - Project list
- `src/components/vault-health/ProjectSettingsDialog.tsx` - Project config
- `src/hooks/useHealthProjects.ts` - Project CRUD operations
- Update `src/lib/health/health-storage.ts` - Add project support

### 3.2 Conversation Continuity

**Current Flow (Broken):**
```
User clicks sidebar → New conversation created → Previous lost
```

**Fixed Flow:**
```
User clicks sidebar conversation → Load existing → Continue chat
User clicks [+ New] → Create new conversation → Add to project
```

**Key Changes:**
- `VaultHealth.tsx`: Load conversation on select, don't auto-create
- `useHealthStorage.ts`: Add `loadConversation(id)` method
- `HealthSidebar.tsx`: Show "Continue" vs "New" actions

### 3.3 File Upload & Persistence

**Per-Project Documents:**
```typescript
// Upload to project (reference files)
await healthStorage.addProjectDocument(projectId, file);
// Stored in IndexedDB/S3, available across all conversations in project

// Attach to conversation (temporary context)
await healthStorage.attachDocument(conversationId, file);
// Sent to Claude as context for that conversation only
```

**Storage Strategy:**
- Small files (<5MB): IndexedDB encrypted
- Large files (>5MB): Supabase Storage / Cloudflare R2
- Text extracted for search indexing

### 3.4 Memory Integration

**Connect to Ghost/Memory:**
```typescript
// In useHealthStorage.ts
const syncToMemory = async (conversationId: string) => {
  const conv = getConversation(conversationId);
  if (!conv.memoryEnabled) return;

  const memory = await getMemoryManager();

  for (const msg of conv.messages) {
    await memory.addItem({
      content: msg.content,
      metadata: {
        source: 'chat',
        aiPlatform: 'swissvault-health',
        conversationId: conv.id,
        projectIds: conv.projectId ? [conv.projectId] : [],
        taskType: msg.taskType,
        createdAt: msg.timestamp
      }
    });
  }

  conv.memoryLastSynced = Date.now();
};
```

**UI Toggle:**
```tsx
<Switch
  checked={memoryEnabled}
  onCheckedChange={(enabled) => {
    setMemoryEnabled(conversationId, enabled);
    if (enabled) syncToMemory(conversationId);
  }}
/>
<Label>Sync to Memory</Label>
<span className="text-xs text-muted-foreground">
  Connect to Ghost/Memory for cross-platform recall
</span>
```

### 3.5 Search

**Two Search Modes:**

1. **Local Search** (fast, client-side):
```typescript
const searchConversations = (query: string) => {
  return conversations.filter(c =>
    c.title.toLowerCase().includes(query) ||
    c.messages.some(m => m.content.toLowerCase().includes(query))
  );
};
```

2. **Semantic Search** (via Memory):
```typescript
const semanticSearch = async (query: string) => {
  const memory = await getMemoryManager();
  const results = await memory.search(query, {
    topK: 20,
    filter: { source: 'chat', aiPlatform: 'swissvault-health' }
  });
  return results;
};
```

### 3.6 Task Type Flexibility

**Per-Message Task Type:**
```tsx
// In message input area
<Select value={taskType} onValueChange={setTaskType}>
  <SelectItem value="prior_auth_review">Prior Auth Review</SelectItem>
  <SelectItem value="icd10_lookup">ICD-10 Lookup</SelectItem>
  <SelectItem value="drug_interaction">Drug Interaction</SelectItem>
  <!-- ... -->
</Select>

// When sending
const message = {
  content: input,
  taskType: taskType,  // Captured at send time
  timestamp: Date.now()
};
```

**Visual Indicator:**
```tsx
{msg.taskType !== prevMsg?.taskType && (
  <Badge variant="outline" className="mb-2">
    Task: {getTaskLabel(msg.taskType)}
  </Badge>
)}
```

### 3.7 Encryption Display

**Reuse EncryptionStatus Component:**
```tsx
// In VaultHealth.tsx header
import { EncryptionStatus } from '@/components/vault/EncryptionStatus';

<EncryptionStatus
  conversationId={currentConversationId}
  isEncrypted={true}
  keyHash={conversation?.keyHash}
  algorithm="AES-256-GCM"
  additionalInfo={{
    compliance: "HIPAA-Ready",
    storage: "Client-Side Encrypted",
    retention: conversation?.retentionMode
  }}
/>
```

### 3.8 Export/Download

**Export Options:**
```typescript
interface ExportOptions {
  format: 'markdown' | 'pdf' | 'json' | 'docx';
  includeMetadata: boolean;
  includeToolCalls: boolean;
  includeCitations: boolean;
}

const exportConversation = async (
  conversationId: string,
  options: ExportOptions
): Promise<Blob> => {
  const conv = getConversation(conversationId);

  switch (options.format) {
    case 'markdown':
      return generateMarkdown(conv, options);
    case 'pdf':
      return generatePDF(conv, options);
    case 'json':
      return new Blob([JSON.stringify(conv, null, 2)]);
    case 'docx':
      return generateDocx(conv, options);
  }
};
```

**UI:**
```tsx
<DropdownMenu>
  <DropdownMenuTrigger>
    <Button variant="ghost"><Download /></Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => exportAs('markdown')}>
      Export as Markdown
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => exportAs('pdf')}>
      Export as PDF
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => sendToStudio()}>
      Open in Studio
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### 3.9 Studio Link

**Quick Action Button:**
```tsx
// In VaultHealth.tsx header
<Button variant="outline" onClick={() => navigate('/studio', {
  state: {
    fromHealth: true,
    conversationId: currentConversationId,
    content: getSelectedMessages()
  }
})}>
  <Sparkles className="w-4 h-4 mr-2" />
  Open in Studio
</Button>
```

---

## 4. Enterprise Scaling Architecture

### 4.1 Concurrent User Support (Thousands)

```
┌─────────────────────────────────────────────────────────────────┐
│                        LOAD BALANCER                            │
│                    (Cloudflare / AWS ALB)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Lovable     │     │   Lovable     │     │   Lovable     │
│   Frontend    │     │   Frontend    │     │   Frontend    │
│   (React)     │     │   (React)     │     │   (React)     │
└───────────────┘     └───────────────┘     └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTIONS                      │
│              (Auto-scaling, Global Distribution)                │
├─────────────────────────────────────────────────────────────────┤
│  healthcare-query     │  healthcare-workflows  │  healthcare-  │
│  (Claude AI)          │  (CRUD operations)     │  export       │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Anthropic    │     │   Supabase    │     │  Cloudflare   │
│  Claude API   │     │   PostgreSQL  │     │   R2 Storage  │
│  (AI)         │     │   (Data)      │     │   (Files)     │
└───────────────┘     └───────────────┘     └───────────────┘
```

### 4.2 Database Schema (Supabase PostgreSQL)

```sql
-- Healthcare Projects (server-side for enterprise features)
CREATE TABLE healthcare_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  color TEXT,
  icon TEXT,
  default_task_type TEXT DEFAULT 'general_query',
  retention_mode TEXT DEFAULT '90days',
  memory_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Healthcare Documents (reference files)
CREATE TABLE healthcare_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES healthcare_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_key TEXT NOT NULL,  -- S3/R2 key
  extracted_text TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_projects_user ON healthcare_projects(user_id);
CREATE INDEX idx_documents_project ON healthcare_documents(project_id);
CREATE INDEX idx_documents_user ON healthcare_documents(user_id);

-- RLS Policies
ALTER TABLE healthcare_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own projects" ON healthcare_projects
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE healthcare_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own documents" ON healthcare_documents
  FOR ALL USING (auth.uid() = user_id);
```

### 4.3 Caching Strategy

```typescript
// Redis/Upstash for hot data (optional for high scale)
const cacheConfig = {
  // Frequently accessed, rarely changed
  userSettings: { ttl: 3600 },      // 1 hour
  projectList: { ttl: 300 },        // 5 minutes

  // Real-time, no cache
  conversations: { ttl: 0 },
  messages: { ttl: 0 }
};

// Client-side caching via React Query
const { data: projects } = useQuery({
  queryKey: ['health-projects', userId],
  queryFn: fetchProjects,
  staleTime: 5 * 60 * 1000,  // 5 minutes
  cacheTime: 30 * 60 * 1000  // 30 minutes
});
```

### 4.4 Rate Limiting

```typescript
// In healthcare-query edge function
const rateLimiter = new RateLimiter({
  windowMs: 60 * 1000,     // 1 minute window
  maxRequests: {
    free: 10,
    ghost_pro: 60,
    ghost_premium: 200,
    ghost_enterprise: 1000
  }
});

const allowed = await rateLimiter.check(userId, userTier);
if (!allowed) {
  return new Response(
    JSON.stringify({ error: 'Rate limit exceeded', retryAfter: 60 }),
    { status: 429 }
  );
}
```

---

## 5. Implementation Phases

### Phase 1: Fix Auth & Core (This Week)
- [x] Fix authentication (ghost-inference pattern)
- [ ] Verify healthcare-query works in Lovable
- [ ] Add encryption status display
- [ ] Fix conversation continuity (don't create new on select)

### Phase 2: Projects & Organization (Week 2)
- [ ] Create HealthProject model
- [ ] Build ProjectSidebar component
- [ ] Add project CRUD operations
- [ ] Migrate conversations to support projectId

### Phase 3: Memory & Search (Week 3)
- [ ] Integrate with Ghost/Memory system
- [ ] Add memory sync toggle (actually works)
- [ ] Implement local search
- [ ] Add semantic search via Memory

### Phase 4: Export & Studio (Week 4)
- [ ] Add export functionality (MD, PDF, JSON)
- [ ] Build Studio integration
- [ ] Add "Open in Studio" action
- [ ] Document artifact linking

### Phase 5: Enterprise Features (Week 5-6)
- [ ] Server-side project storage (Supabase)
- [ ] File upload to R2/S3
- [ ] Rate limiting
- [ ] Audit logging
- [ ] Team sharing (Enterprise tier)

---

## 6. File Structure

```
src/
├── lib/health/
│   ├── health-storage.ts          # Enhanced with projects
│   ├── health-memory-sync.ts      # Memory integration
│   └── health-export.ts           # Export utilities
├── hooks/
│   ├── useHealthStorage.ts        # Enhanced hook
│   ├── useHealthProjects.ts       # Project management
│   ├── useHealthSearch.ts         # Search functionality
│   └── useHealthExport.ts         # Export operations
├── components/vault-health/
│   ├── HealthSidebar.tsx          # Enhanced sidebar
│   ├── HealthProjectSidebar.tsx   # Project tree
│   ├── ProjectSettingsDialog.tsx  # Project config
│   ├── HealthEncryptionStatus.tsx # Encryption display
│   ├── HealthExportMenu.tsx       # Export options
│   └── HealthStudioLink.tsx       # Studio integration
├── pages/vault/
│   └── VaultHealth.tsx            # Main component
└── types/health.ts                # Type definitions

supabase/functions/
├── healthcare-query/              # AI queries (fixed auth)
├── healthcare-projects/           # Project CRUD
├── healthcare-documents/          # Document upload
└── _shared/
    ├── cross-project-auth.ts      # Auth helper
    └── healthcare-tools/          # Tool implementations
```

---

## 7. Testing Strategy

### Unit Tests
- Storage operations (CRUD)
- Encryption/decryption
- Export generation

### Integration Tests
- Auth flow (local + Lovable)
- Memory sync
- Search functionality

### E2E Tests
- Full conversation flow
- Project management
- File upload/download

### Load Tests
- 1000 concurrent users
- 10,000 requests/minute
- Large file handling

---

## 8. Monitoring & Observability

```typescript
// Metrics to track
const healthMetrics = {
  // User engagement
  conversationsCreated: Counter,
  messagesExchanged: Counter,
  projectsCreated: Counter,

  // Performance
  aiResponseLatency: Histogram,
  toolCallDuration: Histogram,
  searchLatency: Histogram,

  // Errors
  authFailures: Counter,
  aiErrors: Counter,
  exportFailures: Counter,

  // Resource usage
  storageUsed: Gauge,
  memoryItemsCount: Gauge
};
```

---

## 9. Security Considerations

### HIPAA Compliance
- All PHI encrypted at rest (AES-256-GCM)
- Client-side encryption (zero-knowledge)
- Audit logging for access
- Configurable retention policies
- BAA with Anthropic for Claude API

### Data Flow
```
User Input → Client Encryption → Supabase Edge → Claude API
     ↑                                              │
     └──────────── Encrypted Response ◄────────────┘
```

### Key Management
- PBKDF2 key derivation from user ID
- Keys never leave client
- Key fingerprint displayed for verification

---

## Conclusion

This architecture provides:
1. **Immediate fixes** for the auth issue
2. **Short-term improvements** for UX (projects, continuity)
3. **Medium-term features** (memory, search, export)
4. **Long-term scalability** (enterprise, thousands of users)

All leveraging existing patterns from Ghost Chat and Memory systems.
