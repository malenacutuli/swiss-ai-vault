/**
 * Ghost Export/Import - Password-protected .svghost file handling
 * Uses PBKDF2 for key derivation and AES-256-GCM for encryption
 */

// Derive export key from password using PBKDF2
async function deriveExportKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface ExportableConversation {
  id: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  createdAt: number;
  updatedAt: number;
  model?: string;
}

interface ExportData {
  version: string;
  exportedAt: string;
  encrypted: boolean;
  conversations: Array<{
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    model?: string;
    messageCount: number;
    encryptedMessages: string;
  }>;
  metadata: {
    totalConversations: number;
    totalMessages: number;
  };
}

export async function exportGhostConversations(
  conversations: ExportableConversation[],
  password: string
): Promise<Blob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const exportKey = await deriveExportKey(password, salt);

  const exportData: ExportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    encrypted: true,
    conversations: [],
    metadata: {
      totalConversations: conversations.length,
      totalMessages: 0,
    },
  };

  for (const conv of conversations) {
    const messagesJson = JSON.stringify(conv.messages);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      exportKey,
      new TextEncoder().encode(messagesJson)
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    exportData.conversations.push({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      model: conv.model,
      messageCount: conv.messages.length,
      encryptedMessages: btoa(String.fromCharCode(...combined)),
    });

    exportData.metadata.totalMessages += conv.messages.length;
  }

  const exportJson = JSON.stringify(exportData);
  const exportBytes = new TextEncoder().encode(exportJson);

  const finalExport = new Uint8Array(salt.length + exportBytes.length);
  finalExport.set(salt);
  finalExport.set(exportBytes, salt.length);

  return new Blob([finalExport], { type: 'application/octet-stream' });
}

export async function importGhostConversations(
  file: File,
  password: string
): Promise<{ conversations: ExportableConversation[]; stats: { total: number; messages: number } }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const salt = bytes.slice(0, 16);
  const exportJson = new TextDecoder().decode(bytes.slice(16));
  const exportData: ExportData = JSON.parse(exportJson);

  if (exportData.version !== '1.0') {
    throw new Error('Unsupported export version');
  }

  const exportKey = await deriveExportKey(password, salt);
  const conversations: ExportableConversation[] = [];

  for (const conv of exportData.conversations) {
    const combined = Uint8Array.from(atob(conv.encryptedMessages), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        exportKey,
        ciphertext
      );

      const messages = JSON.parse(new TextDecoder().decode(decrypted));

      conversations.push({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        model: conv.model,
        messages,
      });
    } catch (e) {
      throw new Error('Invalid password or corrupted file');
    }
  }

  return {
    conversations,
    stats: {
      total: conversations.length,
      messages: exportData.metadata.totalMessages,
    },
  };
}
