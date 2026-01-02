// src/lib/memory/voice-memory.ts
// Voice transcript storage functions for Personal AI Memory

import { addMemory } from './memory-store';
import { embed } from './embedding-engine';

export interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export async function saveVoiceChatToMemory(
  transcript: string,
  messages: VoiceMessage[],
  encryptionKey: CryptoKey
): Promise<{ success: boolean; id: string }> {
  // Generate title from first user message
  const firstUserMessage = messages.find(m => m.role === 'user');
  const title = firstUserMessage
    ? firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
    : `Voice Chat - ${new Date().toLocaleString()}`;

  // Create full content with metadata
  const fullContent = `# Voice Conversation: ${title}

**Date:** ${new Date().toLocaleString()}
**Messages:** ${messages.length}
**Duration:** ${calculateDuration(messages)} seconds

---

${transcript}`;

  // Generate embedding
  const embedding = await embed(fullContent);

  // Create unique ID
  const id = crypto.randomUUID();

  // Save to memory store - use 'swissvault' as platform since voice is our internal feature
  await addMemory({
    id,
    content: fullContent,
    embedding,
    metadata: {
      source: 'chat',
      aiPlatform: 'swissvault', // Valid AIPlatform type
      title,
      createdAt: Date.now(),
    }
  }, encryptionKey);

  return { success: true, id };
}

function calculateDuration(messages: VoiceMessage[]): number {
  if (messages.length < 2) return 0;
  const first = messages[0].timestamp.getTime();
  const last = messages[messages.length - 1].timestamp.getTime();
  return Math.round((last - first) / 1000);
}

// Format voice messages as a readable transcript
export function formatVoiceTranscript(messages: VoiceMessage[]): string {
  return messages.map(m => {
    const speaker = m.role === 'user' ? '🎤 You' : '🤖 Assistant';
    const time = m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `[${time}] ${speaker}:\n${m.content}`;
  }).join('\n\n---\n\n');
}
