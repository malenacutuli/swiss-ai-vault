
# Full Multimodal File Support for Ghost Chat Compare Mode

## Problem Analysis

Currently, when files are uploaded in Ghost Chat:

1. **Normal mode works correctly**: Files are processed via `processFile()` which extracts:
   - Images → base64 for vision models
   - PDFs → text extraction via pdf.js
   - DOCX → text extraction via mammoth
   - Text files → direct text content

2. **Compare mode completely ignores files**: When `isCompareMode` is true, the code at line 1989-1993 calls `compare(messageContent, systemPrompt)` directly, bypassing `executeMessageSend()` which handles all file processing.

3. **The edge function only supports text prompts**: `ghost-compare/index.ts` sends simple text messages to OpenAI and Google APIs without multimodal content support.

## Solution Overview

I'll implement full file support for both normal and compare modes with vision-capable model filtering.

```text
┌─────────────────────────────────────────────────────────────────┐
│                     USER UPLOADS FILE                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                    processFile() extracts:
                    - Images → base64
                    - PDFs → text (or base64 fallback)
                    - DOCX → text
                              │
         ┌────────────────────┴────────────────────┐
         │                                         │
    Normal Mode                              Compare Mode
         │                                         │
  executeMessageSend()                    NEW: Build content
  builds multimodal                       with file context
  content array                                    │
         │                                ┌────────┴────────┐
         │                                │                 │
         │                           Has Images?       Documents Only
         │                                │                 │
         │                        Filter to vision    Use all models
         │                        capable models      + append text
         │                                │                 │
         │                                └────────┬────────┘
         │                                         │
    ghost-inference                      ghost-compare (enhanced)
         │                               - OpenAI: multimodal content
         │                               - Google: inline_data parts
         │                                         │
    Single response                      Parallel responses
```

## Implementation Details

### 1. Update `useCompareMode.ts`

**Add vision model registry and enhanced compare function:**

```typescript
// Vision-capable models for compare mode
export const VISION_CAPABLE_MODELS = [
  'swissvault-1.0',  // Backed by Gemini which supports vision
  'swissvault-pro',  // Backed by GPT-4o
  'gpt-4o', 'gpt-4o-mini', 'gpt-5.2', 'gpt-5.2-mini',
  'gemini-3-pro', 'gemini-3-flash', 'gemini-2.5-pro', 'gemini-2.5-flash',
  'gemini-2.5-flash-lite', 'gemini-1.5-pro'
];

// Attachment interface for compare
interface CompareAttachment {
  type: 'image' | 'document';
  name: string;
  base64?: string;  // For images
  text?: string;    // For documents
}

// Updated compare function signature
const compare = useCallback(async (
  prompt: string, 
  systemPrompt?: string,
  attachments?: CompareAttachment[]
) => {
  // Determine which models to use based on attachments
  const hasImages = attachments?.some(a => a.type === 'image' && a.base64);
  
  let modelsToCompare = selectedModels;
  if (hasImages) {
    // Filter to only vision-capable models
    modelsToCompare = selectedModels.filter(m => VISION_CAPABLE_MODELS.includes(m));
    if (modelsToCompare.length < 2) {
      toast({
        title: 'Vision models required',
        description: 'Select at least 2 vision-capable models for image comparison.',
        variant: 'destructive',
      });
      return null;
    }
  }
  
  // Build document context from text-based attachments
  let documentContext = '';
  attachments?.forEach(att => {
    if (att.text) {
      documentContext += `\n\n=== ${att.name} ===\n${att.text.slice(0, 50000)}`;
    }
  });
  
  // Call edge function with attachments
  const { data, error } = await supabase.functions.invoke('ghost-compare', {
    body: {
      prompt: documentContext ? `${prompt}\n\n--- DOCUMENTS ---${documentContext}` : prompt,
      models: modelsToCompare,
      systemPrompt,
      // Send image attachments for multimodal models
      images: hasImages ? attachments?.filter(a => a.type === 'image' && a.base64) : undefined,
    },
  });
  // ... rest of function
}, [selectedModels, toast]);
```

### 2. Update `GhostChat.tsx` - Compare Mode Handler

**At line ~1988-1994, update the compare mode section:**

```typescript
// Check if compare mode is active
if (isCompareMode && mode === 'text') {
  console.log('[GhostChat] Using compare mode with attachments:', attachedFiles.length);
  
  // Build attachments for compare
  const compareAttachments = attachedFiles.map(f => ({
    type: f.type,
    name: f.name,
    base64: f.base64,
    text: f.text,
  }));
  
  setInputValue('');
  setAttachedFiles([]); // Clear after sending
  
  await compare(
    messageContent, 
    settings?.system_prompt || undefined,
    compareAttachments.length > 0 ? compareAttachments : undefined
  );
  return;
}
```

### 3. Update `ghost-compare/index.ts` Edge Function

**Add multimodal support for OpenAI and Google APIs:**

```typescript
// Enhanced model configs with vision capability flag
const MODEL_CONFIGS: Record<string, {
  provider: 'openai' | 'google' | 'swissvault';
  modelId: string;
  displayName: string;
  supportsVision: boolean;
}> = {
  'swissvault-1.0': { provider: 'google', modelId: 'gemini-2.5-flash-lite', displayName: 'SwissVault 1.0', supportsVision: true },
  'gpt-4o': { provider: 'openai', modelId: 'gpt-4o', displayName: 'GPT-4o', supportsVision: true },
  'gemini-2.5-pro': { provider: 'google', modelId: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportsVision: true },
  // ... etc
};

// Updated OpenAI call with vision support
async function callOpenAI(
  prompt: string, 
  modelId: string, 
  apiKey: string,
  images?: Array<{ base64: string; name: string }>
): Promise<{ text: string; tokens: number }> {
  
  // Build content array for multimodal
  let content: any = prompt;
  if (images && images.length > 0) {
    content = [
      ...images.map(img => ({
        type: 'image_url',
        image_url: { url: img.base64, detail: 'auto' }
      })),
      { type: 'text', text: prompt }
    ];
  }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content }],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });
  // ... rest
}

// Updated Google call with vision support
async function callGoogle(
  prompt: string, 
  modelId: string, 
  apiKey: string,
  images?: Array<{ base64: string; name: string }>
): Promise<{ text: string; tokens: number }> {
  
  // Build parts array for multimodal
  const parts: any[] = [];
  
  if (images && images.length > 0) {
    images.forEach(img => {
      // Extract mime type and data from data URL
      const match = img.base64.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        parts.push({
          inline_data: {
            mime_type: match[1],
            data: match[2]
          }
        });
      }
    });
  }
  
  parts.push({ text: prompt });
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
      }),
    }
  );
  // ... rest
}
```

### 4. Add Model Filtering Presets

**In `useCompareMode.ts`, add vision-specific presets:**

```typescript
export const MODEL_PRESETS = {
  'frontier': ['gpt-5.2', 'gemini-3-pro', 'o3', 'gemini-2.5-pro'],
  'fast': ['swissvault-fast', 'gpt-4o-mini', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'],
  'code': ['swissvault-code', 'o3-mini', 'gpt-4o', 'gemini-2.5-pro'],
  'free': ['swissvault-1.0', 'swissvault-code', 'swissvault-fast', 'gemini-2.5-flash-lite'],
  // NEW: Vision-specific presets
  'vision': ['gpt-4o', 'gemini-2.5-pro', 'gpt-5.2', 'gemini-3-pro'],
  'vision-fast': ['swissvault-1.0', 'gpt-4o-mini', 'gemini-2.5-flash', 'gemini-3-flash'],
};
```

### 5. UI Feedback for Vision Filtering

**Add toast notification when models are filtered:**

In the compare function, after filtering for vision models:

```typescript
if (hasImages && modelsToCompare.length < selectedModels.length) {
  toast({
    title: 'Models filtered for vision',
    description: `Comparing with ${modelsToCompare.length} vision-capable models (${selectedModels.length - modelsToCompare.length} skipped).`,
  });
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useCompareMode.ts` | Add vision model registry, attachment interface, enhanced compare function |
| `src/pages/GhostChat.tsx` | Extract file content before compare call (~line 1988-1994) |
| `supabase/functions/ghost-compare/index.ts` | Add multimodal content support for OpenAI and Google APIs |

## Edge Cases Handled

1. **Only images, no text**: Will work with vision models
2. **Only documents**: Text extracted and appended to prompt, all models work
3. **Mixed images + documents**: Images sent to vision models, documents as text context
4. **Scanned PDFs (no text)**: Falls back to base64 image for vision models
5. **Non-vision models selected with images**: Automatically filtered out with toast notification
6. **Fewer than 2 vision models after filter**: Error message prompting user to select vision-capable models

## Testing Checklist

- [ ] Upload PDF in compare mode → text extracted and included in comparison
- [ ] Upload DOCX in compare mode → text extracted correctly
- [ ] Upload image in compare mode → only vision models compared
- [ ] Upload image + text models selected → non-vision models filtered with notification
- [ ] Upload multiple files (mixed types) → all content combined correctly
- [ ] Normal mode with files → continues to work as before
