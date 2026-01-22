# SwissBrAIn Platform - Staging Deployment Guide

**Document Version:** 1.0  
**Date:** January 22, 2026  
**Branch:** `staging-test`

---

## Overview

This guide provides step-by-step instructions for deploying the SwissBrAIn platform to a Vercel staging environment. The staging environment allows you to test the Manus-parity integration before deploying to production.

---

## Prerequisites

Before deploying, ensure you have:

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository Access** - The `staging-test` branch has been pushed to `malenacutuli/swiss-ai-vault`
3. **Environment Variables** - See the Environment Variables section below

---

## Deployment Methods

### Method 1: Vercel Dashboard (Recommended for First-Time Setup)

1. **Go to Vercel Dashboard**
   - Navigate to [vercel.com/new](https://vercel.com/new)
   - Click "Import Git Repository"

2. **Import Repository**
   - Select `malenacutuli/swiss-ai-vault`
   - Choose the `staging-test` branch

3. **Configure Project**
   - **Project Name:** `swissbrain-staging`
   - **Framework Preset:** Vite
   - **Root Directory:** `.` (leave as default)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install --legacy-peer-deps`

4. **Add Environment Variables**
   See the Environment Variables section below.

5. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete

### Method 2: Vercel CLI

```bash
# Install Vercel CLI (if not already installed)
npm install -g vercel

# Navigate to project directory
cd /path/to/swiss-ai-vault

# Login to Vercel
vercel login

# Deploy to staging (preview)
vercel --prod=false

# Or link to existing project and deploy
vercel link
vercel deploy
```

### Method 3: GitHub Integration (Automatic Deployments)

1. **Connect GitHub to Vercel**
   - In Vercel Dashboard, go to Settings > Git
   - Connect your GitHub account

2. **Configure Branch Deployments**
   - Production Branch: `main`
   - Preview Branches: `staging-test`, `develop`, `feature/*`

3. **Automatic Deployments**
   - Every push to `staging-test` will trigger a preview deployment
   - The preview URL will be posted as a comment on the PR

---

## Environment Variables

### Required Variables

Set these in Vercel Dashboard > Project Settings > Environment Variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `AGENT_API_URL` | Backend API URL | Yes |
| `E2B_API_KEY` | E2B sandbox API key | Yes |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_APP_ENV` | Environment name | `staging` |
| `VITE_ENABLE_DEBUG_MODE` | Enable debug features | `true` |
| `VITE_ENABLE_MOCK_API` | Use mock API responses | `false` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | - |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `GOOGLE_AI_API_KEY` | Google AI API key | - |

### Setting Environment Variables via CLI

```bash
# Set individual variables
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add AGENT_API_URL
vercel env add E2B_API_KEY

# Or use a .env file
vercel env pull .env.local
```

---

## Verifying the Deployment

### 1. Check Deployment Status

After deployment, verify the following endpoints:

```bash
# Health check
curl https://your-staging-url.vercel.app/api/health

# Status check (comprehensive)
curl https://your-staging-url.vercel.app/api/status
```

### 2. Expected Health Response

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "service": "swissbrain-staging"
}
```

### 3. Expected Status Response

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "staging",
  "timestamp": "2026-01-22T12:00:00.000Z",
  "checks": {
    "api": true,
    "database": true,
    "agentApi": true,
    "e2b": true
  },
  "features": {
    "wideResearch": true,
    "documentGeneration": true,
    "browserAutomation": true,
    "collaboration": true
  }
}
```

---

## Manus Integration Components

The staging deployment includes the following Manus-parity components:

### 1. Agent Orchestrator (`src/lib/manus/orchestrator.ts`)
- ReAct (Reason + Act) pattern implementation
- Strict state machine with defined transitions
- Plan management with phase tracking
- Event emission for real-time updates

### 2. API Client (`src/lib/manus/api-client.ts`)
- Task creation and management
- SSE streaming for real-time events
- Retry logic with exponential backoff
- File upload/download support

### 3. React Hooks (`src/lib/manus/hooks.ts`)
- `useAgentTask` - Full task lifecycle management
- `useAgentStream` - Real-time event streaming
- `useTaskList` - Task listing with pagination
- `useAgentHealth` - Health check monitoring

### 4. Type Definitions (`src/lib/manus/types.ts`)
- Complete type coverage for all Manus features
- State machine types and transitions
- Tool definitions and parameters
- Event types and schemas

---

## Testing the Integration

### 1. Basic Functionality Test

```typescript
import { useAgentTask } from '@/lib/manus';

function TestComponent() {
  const { createTask, task, status, events } = useAgentTask(null);
  
  const handleTest = async () => {
    const taskId = await createTask({
      prompt: 'Hello, this is a test task.',
    });
    console.log('Task created:', taskId);
  };
  
  return (
    <button onClick={handleTest}>Create Test Task</button>
  );
}
```

### 2. Event Stream Test

```typescript
import { useAgentStream } from '@/lib/manus';

function StreamTest({ taskId }: { taskId: string }) {
  const { events, isConnected } = useAgentStream(taskId);
  
  return (
    <div>
      <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
      <ul>
        {events.map((event, i) => (
          <li key={i}>{event.event}: {JSON.stringify(event.data)}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Troubleshooting

### Build Failures

1. **Dependency Issues**
   ```bash
   npm install --legacy-peer-deps
   ```

2. **TypeScript Errors**
   - Check `tsconfig.json` for correct paths
   - Ensure all imports use correct extensions

3. **Environment Variable Issues**
   - Verify all required variables are set
   - Check variable names match exactly (case-sensitive)

### Runtime Errors

1. **API Connection Failed**
   - Verify `AGENT_API_URL` is correct
   - Check CORS configuration on backend

2. **Authentication Errors**
   - Verify Supabase credentials
   - Check API key format

3. **SSE Stream Disconnects**
   - Check network connectivity
   - Verify backend supports SSE

---

## Next Steps

After successful staging deployment:

1. **Run Integration Tests**
   - Test all Manus-parity features
   - Verify event streaming works correctly

2. **Performance Testing**
   - Load test the staging environment
   - Monitor response times

3. **Security Review**
   - Verify environment variables are not exposed
   - Check CORS and authentication

4. **Production Deployment**
   - Merge `staging-test` to `main`
   - Deploy to production with production environment variables

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/malenacutuli/swiss-ai-vault/issues
- Documentation: See `.claude/` directory for detailed specs

---

*This document was generated as part of the Manus-parity integration for SwissBrAIn Platform.*
