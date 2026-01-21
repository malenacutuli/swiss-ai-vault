# SwissBrain - Manus.im Parity TODO

## Critical Gap Analysis (Based on Screenshots)

### SwissBrain Current State
- Task submitted but nothing executes
- Terminal panel empty/black
- Preview panel empty
- No progress indicators
- No agent thinking visible

### Manus.im Target State
- Live chat showing agent thinking
- Progress indicators (4/6 phases)
- Knowledge recalled badges
- Live preview panel
- Full management UI

---

## Phase 1: Backend Connectivity
- [ ] Fix agent execution API endpoint
- [ ] Connect SSE streaming to frontend
- [ ] Ensure tasks actually start executing
- [ ] Add error handling and retry logic

## Phase 2: Management UI Panel
- [ ] Build collapsible right panel (like Manus)
- [ ] Preview tab with live iframe
- [ ] Code tab with file browser
- [ ] Dashboard tab with analytics
- [ ] Database tab with CRUD UI
- [ ] Settings tab (General, Domains, Notifications, Secrets, GitHub)

## Phase 3: Live Terminal
- [ ] Connect xterm.js to WebSocket
- [ ] Stream real command output
- [ ] Show file operations in real-time
- [ ] Color-coded output (success/error)

## Phase 4: Preview Panel
- [ ] Desktop/Mobile toggle buttons
- [ ] Edit mode button
- [ ] Live iframe with dev server URL
- [ ] Refresh button
- [ ] URL bar showing current route

## Phase 5: Version History
- [ ] Checkpoint creation UI
- [ ] Version list with timestamps
- [ ] Rollback functionality
- [ ] Diff viewer between versions

## Phase 6: Share/Publish/Export
- [ ] Share button with link generation
- [ ] Publish button with deployment
- [ ] Download as ZIP
- [ ] Export to GitHub

## Phase 7: Progress Indicators
- [ ] Phase progress (1/6, 2/6, etc.)
- [ ] Elapsed time display
- [ ] "Thinking" status indicator
- [ ] "Reading file" action badges
- [ ] Knowledge recalled badges

## Phase 8: Workspace Tools
- [ ] AI Chat tool card
- [ ] AI Docs tool card
- [ ] Tool descriptions
- [ ] Quick action buttons

## Phase 9: Testing
- [ ] End-to-end task execution
- [ ] Preview panel loads correctly
- [ ] Terminal shows real output
- [ ] All management tabs work

## Phase 10: Deployment
- [ ] Push all changes to GitHub
- [ ] Verify Vercel deployment
- [ ] Test production site
- [ ] Document any remaining gaps

---

## Manus UI Components to Replicate

### Top Toolbar (Right Panel)
```
[Preview] [<>] [≡] [⬚] [⋯] [⬇] [⚙] [↗Share] [Publish]
```
- Preview button (active state)
- Code button
- Dashboard button  
- Database button
- More options (...)
- Download button
- Settings button
- Share button
- Publish button

### Preview Panel Header
```
[Desktop] [Mobile]  [🏠] [/]  [↗] [↻]  [✏Edit] [⤢]
```
- Desktop/Mobile toggle
- Home button
- URL path
- Open in new tab
- Refresh
- Edit mode
- Fullscreen

### Sidebar (Left)
```
[manus logo]
[New task]
[Search]
[Library]
---
Projects
  [+ New project]
All tasks
  - Task 1
  - Task 2
---
[Share Manus with a friend]
[User profile]
```

### Chat Panel
```
[Task title] [⏸] [⬜]
---
[User message bubble]
[Agent response with badges]
  - Knowledge recalled(3)
  - Phase indicator (4/6)
  - Elapsed time (1:52)
  - Status (Thinking)
---
[+ attachment] [GitHub] [input field] [🎤] [⬆]
```
