# Swiss Agents V2 - Manus-Parity Implementation

A fresh, standalone implementation of the Swiss Agents module with full Manus.im API integration.

## Architecture

```
swiss-agents-v2/
├── api/                      # Vercel Serverless API Routes
│   ├── agent/
│   │   ├── create.ts        # POST /api/agent/create - Create new task
│   │   ├── [taskId]/
│   │   │   ├── index.ts     # GET /api/agent/[taskId] - Get task status
│   │   │   ├── stream.ts    # GET /api/agent/[taskId]/stream - SSE events
│   │   │   └── cancel.ts    # POST /api/agent/[taskId]/cancel
│   │   └── health.ts        # GET /api/agent/health
│   └── manus/
│       └── proxy.ts         # Proxy to Manus API (if needed)
├── src/
│   ├── components/          # React UI Components
│   │   ├── AgentChat.tsx    # Main chat interface
│   │   ├── AgentTerminal.tsx # Terminal output display
│   │   ├── AgentPreview.tsx  # Preview panel
│   │   ├── TaskList.tsx      # Task history
│   │   └── PlanViewer.tsx    # Execution plan display
│   ├── hooks/               # React Hooks
│   │   ├── useAgent.ts      # Main agent hook
│   │   ├── useSSE.ts        # Server-Sent Events hook
│   │   └── useTaskHistory.ts
│   ├── lib/                 # Core Libraries
│   │   ├── manus-client.ts  # Manus API client
│   │   ├── orchestrator.ts  # Agent orchestrator
│   │   ├── state-machine.ts # Task state machine
│   │   └── tools.ts         # Tool definitions
│   ├── pages/               # Page Components
│   │   └── AgentWorkspace.tsx
│   └── types/               # TypeScript Types
│       ├── agent.ts
│       ├── events.ts
│       └── manus.ts
└── public/                  # Static assets
```

## Key Features

1. **Direct Manus API Integration** - Uses Manus.im API as the primary LLM provider
2. **Vercel Serverless Backend** - No separate backend deployment needed
3. **Real-time SSE Streaming** - Live updates for task execution
4. **State Machine** - Strict state transitions matching Manus.im behavior
5. **Tool Execution** - E2B sandbox integration for code execution

## Environment Variables

```env
# Manus API (Required)
MANUS_API_KEY=your-manus-api-key

# E2B Sandbox (Required for tool execution)
E2B_API_KEY=your-e2b-api-key

# Supabase (For persistence)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent/create` | POST | Create a new agent task |
| `/api/agent/[taskId]` | GET | Get task status and details |
| `/api/agent/[taskId]/stream` | GET | SSE stream for real-time updates |
| `/api/agent/[taskId]/cancel` | POST | Cancel a running task |
| `/api/agent/health` | GET | Health check endpoint |

## State Machine

```
IDLE → PLANNING → EXECUTING → COMPLETED
                ↓           ↓
              FAILED    WAITING_USER
                ↓           ↓
            CANCELLED   EXECUTING
```
