
# Plan: Fix HELIOS Voice Agent on `/health` by Replicating Working Implementation

## Problem Analysis

The voice agent on `/health` is broken due to fundamental architecture differences from the working implementation on `/ghost/health/expert`:

| Aspect | Working (`/ghost/health/expert`) | Broken (`/health`) |
|--------|----------------------------------|-------------------|
| **SDK** | `@humeai/voice-react` (official) | Raw WebSocket (custom) |
| **Token Endpoint** | `hume-access-token` | `helios-hume-evi` |
| **Voice Provider** | `VoiceProvider` wrapper | Manual audio handling |
| **Response Flow** | `sendAssistantInput()` from SDK | Custom WebSocket messages |
| **Error** | None | "Long AssistantInput message (276 > 256 chars)" |

The custom WebSocket implementation in `useHumeEVI.ts` has multiple issues:
1. Incorrect message format for `session_settings`
2. Manual audio capture/encoding that may not match Hume's expected format
3. Response messages exceed Hume's character limit for assistant input

## Solution: Adopt the Working Pattern

Replace the custom WebSocket implementation with the proven `@humeai/voice-react` SDK pattern.

---

## Implementation Steps

### Step 1: Create New Voice Component for HELIOS

Create `src/components/helios/voice/HeliosVoiceConsultation.tsx` that mirrors `HealthVoiceChat.tsx` architecture:

- Import `VoiceProvider`, `useVoice` from `@humeai/voice-react`
- Fetch access token from `hume-access-token` edge function (already working)
- Use the same 3D avatar component pattern from HealthVoiceChat
- Call `hume-health-tool` for healthcare responses
- Use `sendAssistantInput()` for AI responses

**Key differences for HELIOS:**
- Include session persistence to `helios_sessions` table
- Support specialty-specific prompts
- Maintain HELIOS branding/styling

### Step 2: Update Token Fetching

Modify the HELIOS voice component to use the simpler `hume-access-token` edge function instead of the complex `helios-hume-evi` function.

The working edge function (`hume-access-token`) is simpler and proven:
```
POST /functions/v1/hume-access-token
Response: { accessToken, expiresIn }
```

### Step 3: Integrate with HeliosHome or VoiceConsultation Page

Replace or update the voice consultation entry point to use the new component:
- Add voice button to HeliosHome page
- Create modal/overlay for voice consultation
- Wire up session creation and message persistence

### Step 4: Simplify or Remove Custom Hook

The `useHumeEVI.ts` hook can be deprecated in favor of the SDK's `useVoice()` hook. The SDK handles:
- WebSocket connection management
- Audio capture and encoding
- Message parsing
- Connection state

---

## Technical Details

### New Component Structure

```text
src/components/helios/voice/
├── HeliosVoiceConsultation.tsx   (NEW - main component using SDK)
├── VoiceConsultation.tsx         (EXISTING - can be deprecated)
```

### Component Flow

```text
User clicks "Voice Consult"
         ↓
HeliosVoiceConsultation mounts
         ↓
Fetch token from hume-access-token
         ↓
Wrap in VoiceProvider with auth
         ↓
User speaks → useVoice().messages updates
         ↓
Call hume-health-tool with transcript
         ↓
sendAssistantInput(response)
         ↓
Hume speaks the response
```

### Files to Create/Modify

1. **Create:** `src/components/helios/voice/HeliosVoiceConsultation.tsx`
   - New voice component using `@humeai/voice-react` SDK
   - Based on `HealthVoiceChat.tsx` architecture
   - HELIOS-specific styling and session management

2. **Create:** `src/components/helios/voice/HeliosVoiceAvatar.tsx`
   - 3D audio-reactive avatar (similar to HealthAvatar3D)
   - HELIOS branding colors

3. **Modify:** `src/components/helios/pages/HeliosHome.tsx`
   - Add "Start Voice Consultation" button
   - Modal/overlay to show voice component

4. **Optional Cleanup:** `src/hooks/helios/useHumeEVI.ts`
   - Can be removed or kept for reference
   - SDK handles all WebSocket logic

---

## Edge Function Configuration (No Changes Needed)

The existing `hume-access-token` edge function is already working and will be reused. The existing `hume-health-tool` edge function is also working for healthcare triage.

No new edge functions required.

---

## Dependencies

The project already has `@humeai/voice-react` installed (verified from HealthVoiceChat.tsx imports). No new dependencies needed.

---

## Summary

This plan replicates the proven architecture from `/ghost/health/expert` to fix the broken voice agent on `/health`. The key change is adopting the official `@humeai/voice-react` SDK instead of the custom WebSocket implementation, which eliminates the "Long AssistantInput message" error and provides reliable voice interaction.
