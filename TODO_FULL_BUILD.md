# SwissBrain Full Build - Task Tracker

## Phase 1: Infrastructure
- [ ] Fix Kubernetes SSL certificates (DNS01 challenge timeout)
- [ ] Deploy Redis cluster for BullMQ job queue
- [ ] Configure E2B API credentials in K8s secrets
- [ ] Verify agent-api health endpoint works over HTTPS

## Phase 2: Frontend Integration
- [ ] Integrate AgentExecutionPanel into AgentsStudio page
- [ ] Add useAgentStream hook to agent execution flow
- [ ] Connect terminal component to WebSocket stream
- [ ] Build file browser component for sandbox filesystem
- [ ] Implement preview panel for dev server output
- [ ] Add checkpoint management UI

## Phase 3: Backend Enhancements
- [ ] Connect BullMQ worker to Agent API job producers
- [ ] Implement warm sandbox pool in production
- [ ] Add WebSocket endpoint for terminal streaming
- [ ] Implement file browser API endpoints

## Phase 4: Testing & Verification
- [ ] Test end-to-end agent execution flow
- [ ] Verify SSE streaming works in production
- [ ] Test webdev tools (init_project, check_status, etc.)
- [ ] Verify checkpoint save/restore functionality

## Phase 5: Production Deployment
- [ ] Push all changes to GitHub
- [ ] Trigger Vercel redeployment
- [ ] Update K8s deployments with new agent-api image
- [ ] Verify production URLs work

---
Last Updated: 2026-01-21
