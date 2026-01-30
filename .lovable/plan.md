

# Fix Compare Mode Document Handling + UI Provider Hiding

## Overview

This plan addresses two issues:
1. **Document extraction flooding the prompt** - Currently, full document text is extracted and appended to the prompt, making it visible in the UI
2. **SwissVault provider exposure** - The UI shows "Google" or "OpenAI" as the provider for SwissVault models

Additionally, I'll fix the **helios-chat build errors** (unrelated TypeScript issues blocking deployment).

---

## Part 1: Document Handling Alternatives

### Current Problem
When a document is uploaded in compare mode, the full extracted text is appended to the prompt like:
```
User question...

--- ATTACHED DOCUMENTS ---
=== report.pdf ===
[50,000 characters of text visible in UI]
```

### Proposed Solutions

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **A. Summarize First** | Use AI to create a condensed summary before sending | Reduces tokens, cleaner UI | Adds latency, may lose detail |
| **B. Hidden Context** | Send documents as separate `context` field, don't show in prompt display | Full fidelity, clean UI | Need UI changes |
| **C. Truncate with Indicator** | Show only first 500 chars + "[Document content sent to models]" | Simple, clear to user | User sees partial text |
| **D. Collapse/Expand UI** | Full text sent but UI shows collapsed view | No data loss | More UI work |

### Recommended: **Option B - Hidden Context**

**Implementation:**

1. **Separate document context from display prompt**
   - Store `displayPrompt` (what user sees) vs `fullPrompt` (what models receive)
   - UI shows: "Analyze this document" with file badge
   - Models receive: Full prompt + extracted text

2. **Update `useCompareMode.ts`**:
   ```typescript
   // Return display-friendly result
   setResult({
     prompt: displayPrompt,  // Just user's question
     attachmentSummary: `${attachments.length} file(s) attached`,
     responses: [...],
   });
   ```

3. **Update `CompareResults.tsx`**:
   - Show attachment badge instead of full document text
   - Optional expand to see what was sent

---

## Part 2: Hide SwissVault Provider Details

### Current Problem
In `CompareResults.tsx` line 67, the response card shows:
```tsx
<Badge variant="outline" className="text-xs">
  {response.provider}  // Shows "google" or "openai" for SwissVault models
</Badge>
```

### Solution

1. **Update edge function `ghost-compare/index.ts`**:
   - Return "SwissVault" as provider for all SwissVault models
   - Don't expose underlying provider mapping

2. **Update `AVAILABLE_MODELS` in `useCompareMode.ts`**:
   - Already correct (provider: "SwissVault" for SwissVault models)
   - Issue is the edge function returning the actual provider

**Edge function change:**
```typescript
return {
  model: modelKey,
  displayName: config.displayName,
  // Use display provider, not actual provider
  provider: modelKey.startsWith('swissvault') ? 'SwissVault' : config.provider,
  response: result.text,
  ...
};
```

---

## Part 3: Fix Helios-Chat Build Errors

### Root Cause
The `HandleMessageResult` interface is missing two properties that are being returned:
- `triggerOrchestrator`
- `orchestratorPayload`

And the `orchestration` variable is typed as `OrchestrationResponse | null` but never assigned, causing TypeScript to narrow it to `never`.

### Solution

1. **Add missing properties to `HandleMessageResult` interface**:
   ```typescript
   interface HandleMessageResult {
     message: string;
     assessmentReady: boolean;
     triggerOrchestrator?: boolean;  // ADD
     orchestratorPayload?: any;       // ADD
     consensus?: ConsensusResult;
     orchestration?: OrchestrationResponse;
     ...
   }
   ```

2. **Fix the type narrowing issue** by using explicit type assertion or restructuring the code to properly type the orchestration access.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useCompareMode.ts` | Separate display prompt from full prompt |
| `src/components/ghost/compare/CompareResults.tsx` | Show attachment badge, hide full doc text |
| `supabase/functions/ghost-compare/index.ts` | Return "SwissVault" as provider for SwissVault models |
| `supabase/functions/helios-chat/index.ts` | Fix HandleMessageResult interface + type assertions |

---

## UI Result

**Before:**
```
Your prompt: Please analyze this document

--- ATTACHED DOCUMENTS ---
=== financial_report.pdf ===
[10 pages of extracted text visible...]
```

**After:**
```
Your prompt: Please analyze this document
[Attachments: financial_report.pdf (10 pages)]  ← Small badge, expandable
```

**Model cards:**
- Before: `SwissVault 1.0` | `google`
- After: `SwissVault 1.0` | `SwissVault`

---

## Technical Details

### Compare Mode Flow (Updated)

```text
User uploads file + types question
         │
    processFile() extracts text
         │
    compare() called with attachments
         │
    ┌─────────────────────────────┐
    │ Build two prompts:          │
    │ - displayPrompt: user text  │
    │ - fullPrompt: text + docs   │
    └─────────────────────────────┘
         │
    Edge function receives fullPrompt
         │
    Results returned with:
    - prompt: displayPrompt (for UI)
    - provider: "SwissVault" (masked)
```

### CompareAttachment Enhancement

```typescript
interface CompareAttachment {
  type: 'image' | 'document';
  name: string;
  base64?: string;
  text?: string;
  pageCount?: number;  // For display
  byteSize?: number;   // For display
}
```

