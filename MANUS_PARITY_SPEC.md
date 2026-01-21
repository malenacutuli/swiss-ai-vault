# SwissBrain AI Platform - Manus.im 100% Parity Specification

## Executive Summary

This document outlines the complete feature set required to achieve 100% functional parity with Manus.im. SwissBrain already has many components built, but they need to be properly connected and some gaps need to be filled.

---

## 1. UI Layout & Navigation

### 1.1 Home Page (New Task View)
**Manus.im Features:**
- Centered "What can I do for you?" heading
- Large input field with placeholder "Assign a task or ask anything"
- Attachment button (+)
- GitHub integration button
- Voice input button
- Send button
- "Connect your tools to Manus" link with tool icons (Gmail, Calendar, Drive, etc.)
- Quick action buttons: "Create slides", "Build website", "Develop apps", "Design", "More"
- Feature cards at bottom (Download app, Nano Banana Pro, AI browser)

**SwissBrain Status:**
- ✅ Has `NewTaskView.tsx` component
- ✅ Has `QuickActionBar.tsx` and `QuickActionButton.tsx`
- ⚠️ Missing: Tool connection UI
- ⚠️ Missing: Feature cards at bottom
- ⚠️ Styling needs to match Manus

### 1.2 Sidebar
**Manus.im Features:**
- Logo with version selector (Manus 1.6 Max)
- New task button
- Search
- Library
- Projects section with "New project" button
- All tasks list with task history (icons indicate task type)
- "Share Manus with a friend" referral section
- Bottom icons: Settings, Grid view, Mobile view

**SwissBrain Status:**
- ✅ Has `AgentsSidebar.tsx`
- ✅ Has task list
- ⚠️ Missing: Version selector
- ⚠️ Missing: Library section
- ⚠️ Missing: Projects section
- ⚠️ Missing: Referral section

### 1.3 Execution View (Split Layout)
**Manus.im Features:**
- Left panel: Chat with streaming messages
- Right panel: Management panel with tabs
- Top toolbar: Preview, Code (<>), Docs, Settings, Share, Publish buttons
- Device preview toggles (desktop/mobile)
- Edit mode toggle
- Expand/collapse buttons

**SwissBrain Status:**
- ✅ Has `AgentsExecutionView.tsx` and `AgentsExecutionViewV2.tsx`
- ✅ Has `PreviewPanel.tsx`
- ✅ Has `CodeEditor.tsx`
- ⚠️ Missing: Proper split layout
- ⚠️ Missing: Management panel tabs
- ⚠️ Missing: Share/Publish buttons

---

## 2. Chat & Messaging System

### 2.1 Message Types
**Manus.im Features:**
- User messages (right-aligned)
- Agent messages (left-aligned with avatar)
- Thinking/reasoning indicators
- Tool call displays (collapsible)
- File attachments
- Code blocks with syntax highlighting
- Progress updates
- Error messages

**SwissBrain Status:**
- ✅ Has basic message display
- ⚠️ Missing: Proper message fetching from backend
- ⚠️ Missing: Thinking indicators
- ⚠️ Missing: Tool call displays
- ⚠️ Missing: File attachments in chat

### 2.2 Input Features
**Manus.im Features:**
- Multi-line text input
- File attachment (+)
- GitHub integration
- Voice input (microphone)
- Send button
- Keyboard shortcuts (Enter to send, Shift+Enter for newline)

**SwissBrain Status:**
- ✅ Has text input
- ⚠️ Missing: File attachment
- ⚠️ Missing: Voice input
- ⚠️ Missing: GitHub integration in input

---

## 3. Task Execution System

### 3.1 Task States
**Manus.im States:**
- `created` - Task created, not started
- `planning` - Creating execution plan
- `executing` - Running task
- `waiting_user` - Waiting for user input
- `paused` - User paused execution
- `completed` - Task finished successfully
- `failed` - Task failed with error

**SwissBrain Status:**
- ✅ Backend supports all states
- ⚠️ Frontend doesn't handle all states properly

### 3.2 Real-time Streaming
**Manus.im Features:**
- SSE (Server-Sent Events) for real-time updates
- Streaming text responses
- Live terminal output
- Live browser preview
- Progress indicators

**SwissBrain Status:**
- ✅ Has SSE endpoint in backend
- ⚠️ Frontend SSE connection not working properly
- ⚠️ Missing: Streaming text display

### 3.3 Tool Execution Display
**Manus.im Features:**
- Shows tool calls with parameters
- Collapsible tool output
- File operation indicators
- Browser action screenshots
- Shell command output

**SwissBrain Status:**
- ✅ Has `AgentTerminal.tsx` for shell output
- ✅ Has `BrowserViewer.tsx` for browser
- ⚠️ Missing: Tool call display component
- ⚠️ Missing: File operation indicators

---

## 4. Management Panel (Right Side)

### 4.1 Preview Tab
**Manus.im Features:**
- Live website preview
- Device toggle (desktop/mobile)
- Refresh button
- URL display
- Edit mode for visual editing

**SwissBrain Status:**
- ✅ Has `PreviewPanel.tsx`
- ✅ Has `DevPreview.tsx`
- ⚠️ Missing: Edit mode
- ⚠️ Missing: Device toggle

### 4.2 Code Tab
**Manus.im Features:**
- File tree browser
- Code editor with syntax highlighting
- Download all files button
- File search

**SwissBrain Status:**
- ✅ Has `CodeEditor.tsx`
- ✅ Has `FileBrowser.tsx`
- ⚠️ Missing: Download all files

### 4.3 Docs Tab
**Manus.im Features:**
- Generated documentation
- Markdown rendering
- Export options

**SwissBrain Status:**
- ⚠️ Not implemented

### 4.4 Settings Tab
**Manus.im Features:**
- Website name
- Visibility settings
- Favicon management
- Domain settings
- Environment variables

**SwissBrain Status:**
- ⚠️ Not implemented

### 4.5 Share Button
**Manus.im Features:**
- Share link generation
- Social sharing options
- Embed code

**SwissBrain Status:**
- ⚠️ Not implemented

### 4.6 Publish Button
**Manus.im Features:**
- Deploy to production
- Custom domain support
- SSL certificates
- Version history

**SwissBrain Status:**
- ⚠️ Not implemented

---

## 5. Backend Tools (23 Manus Tools)

### 5.1 Message Tools
| Tool | Description | SwissBrain Status |
|------|-------------|-------------------|
| `message_notify_user` | Send notification without response | ✅ Implemented |
| `message_ask_user` | Ask question and wait for response | ✅ Implemented |

### 5.2 File Tools
| Tool | Description | SwissBrain Status |
|------|-------------|-------------------|
| `file_read` | Read file content | ✅ Implemented |
| `file_write` | Write/append to file | ✅ Implemented |
| `file_str_replace` | Replace string in file | ✅ Implemented |
| `file_find_in_content` | Search in file content | ✅ Implemented |
| `file_find_by_name` | Find files by name pattern | ✅ Implemented |

### 5.3 Shell Tools
| Tool | Description | SwissBrain Status |
|------|-------------|-------------------|
| `shell_exec` | Execute shell command | ✅ Implemented |
| `shell_view` | View shell session | ✅ Implemented |
| `shell_wait` | Wait for process | ✅ Implemented |
| `shell_write_to_process` | Write to stdin | ✅ Implemented |
| `shell_kill_process` | Kill process | ✅ Implemented |

### 5.4 Browser Tools
| Tool | Description | SwissBrain Status |
|------|-------------|-------------------|
| `browser_view` | View current page | ✅ Implemented |
| `browser_navigate` | Navigate to URL | ✅ Implemented |
| `browser_restart` | Restart browser | ⚠️ Missing |
| `browser_click` | Click element | ✅ Implemented |
| `browser_input` | Input text | ✅ Implemented |
| `browser_move_mouse` | Move cursor | ⚠️ Missing |
| `browser_press_key` | Press key | ✅ Implemented |
| `browser_select_option` | Select dropdown | ⚠️ Missing |
| `browser_scroll_up` | Scroll up | ✅ Implemented |
| `browser_scroll_down` | Scroll down | ✅ Implemented |
| `browser_console_exec` | Execute JS | ⚠️ Missing |
| `browser_console_view` | View console | ⚠️ Missing |

### 5.5 Other Tools
| Tool | Description | SwissBrain Status |
|------|-------------|-------------------|
| `info_search_web` | Web search | ✅ Implemented |
| `deploy_expose_port` | Expose local port | ⚠️ Missing |
| `deploy_apply_deployment` | Deploy website | ⚠️ Missing |
| `make_manus_page` | Create MDX page | ⚠️ Missing |
| `idle` | Enter idle state | ✅ Implemented |

---

## 6. Priority Implementation Order

### Phase 1: Fix Core Chat Functionality (CRITICAL)
1. ✅ Fix message fetching from `agent_messages` table
2. ✅ Fix `sendMessage` to resume tasks
3. Display agent messages in chat UI
4. Handle `waiting_user` state properly

### Phase 2: Implement Proper Execution View
1. Split layout (chat left, management right)
2. Management panel tabs (Preview, Code, Docs, Settings)
3. Top toolbar with all buttons
4. Device preview toggles

### Phase 3: Real-time Streaming
1. Fix SSE connection
2. Implement streaming text display
3. Live terminal output
4. Live browser preview

### Phase 4: Home Page Polish
1. Match Manus.im styling
2. Add tool connection UI
3. Add feature cards
4. Add referral section

### Phase 5: Advanced Features
1. Projects system
2. Share/Publish functionality
3. Visual editing mode
4. Voice input

---

## 7. Files to Modify

### Frontend (Priority Order)
1. `src/hooks/useAgentExecution.ts` - ✅ Fixed message handling
2. `src/components/agents/AgentsExecutionView.tsx` - ✅ Added messages display
3. `src/pages/Agents.tsx` - ✅ Connected messages and sendMessage
4. `src/components/agents/NewTaskView.tsx` - Polish home page
5. `src/components/agents/AgentsSidebar.tsx` - Add missing sections
6. Create `src/components/agents/ManagementPanel.tsx` - New component

### Backend
1. `agent-api/app/routes/status.py` - ✅ Already returns messages
2. `agent-api/app/routes/execute.py` - Add resume endpoint
3. `agent-api/app/routes/stream.py` - Fix SSE streaming

---

## 8. Testing Checklist

### Chat Flow
- [ ] User submits task
- [ ] Agent creates plan
- [ ] Agent asks clarifying questions
- [ ] Questions appear in chat UI
- [ ] User responds to questions
- [ ] Agent receives response and continues
- [ ] Task completes successfully
- [ ] Results displayed properly

### UI Flow
- [ ] Home page loads correctly
- [ ] Task input works
- [ ] Quick actions work
- [ ] Sidebar navigation works
- [ ] Execution view displays properly
- [ ] Management panel tabs work
- [ ] Preview shows live content
- [ ] Code editor shows files

### Real-time
- [ ] SSE connection established
- [ ] Messages stream in real-time
- [ ] Terminal output streams
- [ ] Browser preview updates
- [ ] Progress indicators update

---

## 9. Immediate Next Steps

1. **Deploy current frontend fixes** - The changes to useAgentExecution.ts and AgentsExecutionView.tsx need to be deployed
2. **Test message display** - Verify agent messages appear in chat
3. **Test sendMessage** - Verify user responses resume tasks
4. **Fix any remaining issues** - Debug based on test results
5. **Implement management panel** - Create the right-side panel with tabs
