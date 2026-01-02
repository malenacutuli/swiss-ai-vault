/**
 * Connector Sync - Pull data from OAuth integrations into Personal AI Memory
 */

import { addMemory, type MemoryItem, type MemorySource } from './memory-store';
import { supabase } from '@/integrations/supabase/client';

export type ConnectorType = 'slack' | 'github' | 'gmail' | 'googledrive' | 'notion';

export interface SyncResult {
  success: boolean;
  itemsAdded: number;
  errors: string[];
}

// Lazy load embedding engine to avoid circular deps
let embedModule: { embed: (text: string) => Promise<number[]> } | null = null;

async function getEmbedding(text: string): Promise<number[]> {
  if (!embedModule) {
    embedModule = await import('./embedding-engine');
  }
  return embedModule.embed(text);
}

/**
 * Sync GitHub issues/PRs to memory
 */
async function syncGitHub(integrationId: string, encryptionKey: CryptoKey, accessToken?: string): Promise<SyncResult> {
  const result: SyncResult = { success: true, itemsAdded: 0, errors: [] };
  
  try {
    // Call the github-sync edge function with proper auth
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
    
    const { data, error } = await supabase.functions.invoke('github-sync', {
      body: { integration_id: integrationId, for_memory: true },
      headers,
    });
    
    if (error) {
      result.errors.push(error.message);
      result.success = false;
      return result;
    }
    
    const items = data?.items || [];
    
    for (const item of items) {
      const content = `
# ${item.title}

Repository: ${item.repo || 'Unknown'}
Type: ${item.type || 'Issue'}
State: ${item.state || 'unknown'}
Author: ${item.author || 'Unknown'}

## Description
${item.body || 'No description'}

${item.labels?.length ? `## Labels\n${item.labels.join(', ')}` : ''}
      `.trim();
      
      const embedding = await getEmbedding(content);
      
      const memoryItem: MemoryItem = {
        id: `github-${item.id}`,
        content,
        embedding,
        metadata: {
          source: 'document' as MemorySource,
          filename: `${item.repo}#${item.number}`,
          title: item.title,
          url: item.url,
          createdAt: new Date(item.created_at || Date.now()).getTime(),
          updatedAt: Date.now()
        }
      };
      
      await addMemory(memoryItem, encryptionKey);
      result.itemsAdded++;
    }
    
  } catch (err) {
    result.success = false;
    result.errors.push((err as Error).message);
  }
  
  return result;
}

/**
 * Sync Google Drive documents to memory
 */
async function syncGoogleDrive(integrationId: string, encryptionKey: CryptoKey, accessToken?: string): Promise<SyncResult> {
  const result: SyncResult = { success: true, itemsAdded: 0, errors: [] };
  
  try {
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
    
    const { data, error } = await supabase.functions.invoke('googledrive-import', {
      body: { integration_id: integrationId, for_memory: true },
      headers,
    });
    
    if (error) {
      result.errors.push(error.message);
      result.success = false;
      return result;
    }
    
    const files = data?.files || [];
    
    for (const file of files) {
      const content = file.content || `Google Drive file: ${file.name}`;
      const embedding = await getEmbedding(content.slice(0, 5000)); // Limit for embedding
      
      const memoryItem: MemoryItem = {
        id: `gdrive-${file.id}`,
        content: content.slice(0, 10000), // Limit stored content
        embedding,
        metadata: {
          source: 'document' as MemorySource,
          filename: file.name,
          title: file.name,
          url: file.webViewLink,
          createdAt: new Date(file.modifiedTime || Date.now()).getTime(),
          updatedAt: Date.now()
        }
      };
      
      await addMemory(memoryItem, encryptionKey);
      result.itemsAdded++;
    }
    
  } catch (err) {
    result.success = false;
    result.errors.push((err as Error).message);
  }
  
  return result;
}

/**
 * Sync Slack messages to memory
 */
async function syncSlack(integrationId: string, encryptionKey: CryptoKey, accessToken?: string): Promise<SyncResult> {
  const result: SyncResult = { success: true, itemsAdded: 0, errors: [] };
  
  try {
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
    
    const { data, error } = await supabase.functions.invoke('slack-sync', {
      body: { integration_id: integrationId, for_memory: true },
      headers,
    });
    
    if (error) {
      result.errors.push(error.message);
      result.success = false;
      return result;
    }
    
    const threads = data?.threads || [];
    
    for (const thread of threads) {
      const content = `
# ${thread.channel_name || 'Slack Thread'}

${thread.messages?.map((m: any) => `**${m.user}**: ${m.text}`).join('\n\n') || thread.text || 'No content'}
      `.trim();
      
      const embedding = await getEmbedding(content.slice(0, 5000));
      
      const memoryItem: MemoryItem = {
        id: `slack-${thread.ts || thread.id}`,
        content,
        embedding,
        metadata: {
          source: 'chat' as MemorySource,
          title: thread.channel_name || 'Slack Thread',
          createdAt: new Date(parseFloat(thread.ts || '0') * 1000 || Date.now()).getTime(),
          updatedAt: Date.now()
        }
      };
      
      await addMemory(memoryItem, encryptionKey);
      result.itemsAdded++;
    }
    
  } catch (err) {
    result.success = false;
    result.errors.push((err as Error).message);
  }
  
  return result;
}

/**
 * Sync Gmail emails to memory
 */
async function syncGmail(integrationId: string, encryptionKey: CryptoKey, accessToken?: string): Promise<SyncResult> {
  const result: SyncResult = { success: true, itemsAdded: 0, errors: [] };
  
  try {
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
    
    const { data, error } = await supabase.functions.invoke('gmail-sync', {
      body: { integration_id: integrationId, for_memory: true },
      headers,
    });
    
    if (error) {
      result.errors.push(error.message);
      result.success = false;
      return result;
    }
    
    const emails = data?.emails || [];
    
    for (const email of emails) {
      const content = `
# ${email.subject || 'Email'}

From: ${email.from || 'Unknown'}
To: ${email.to || 'Unknown'}
Date: ${email.date || 'Unknown'}

${email.body || email.snippet || 'No content'}
      `.trim();
      
      const embedding = await getEmbedding(content.slice(0, 5000));
      
      const memoryItem: MemoryItem = {
        id: `gmail-${email.id}`,
        content,
        embedding,
        metadata: {
          source: 'document' as MemorySource,
          title: email.subject || 'Email',
          createdAt: new Date(email.date || Date.now()).getTime(),
          updatedAt: Date.now()
        }
      };
      
      await addMemory(memoryItem, encryptionKey);
      result.itemsAdded++;
    }
    
  } catch (err) {
    result.success = false;
    result.errors.push((err as Error).message);
  }
  
  return result;
}

/**
 * Sync Notion pages to memory
 */
async function syncNotion(integrationId: string, encryptionKey: CryptoKey, accessToken?: string): Promise<SyncResult> {
  const result: SyncResult = { success: true, itemsAdded: 0, errors: [] };
  
  try {
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
    
    const { data, error } = await supabase.functions.invoke('notion-sync', {
      body: { integration_id: integrationId, for_memory: true },
      headers,
    });
    
    if (error) {
      result.errors.push(error.message);
      result.success = false;
      return result;
    }
    
    const pages = data?.pages || [];
    
    for (const page of pages) {
      const content = `
# ${page.title || 'Notion Page'}

${page.content || 'No content'}
      `.trim();
      
      const embedding = await getEmbedding(content.slice(0, 5000));
      
      const memoryItem: MemoryItem = {
        id: `notion-${page.id}`,
        content,
        embedding,
        metadata: {
          source: 'document' as MemorySource,
          title: page.title || 'Notion Page',
          url: page.url,
          createdAt: new Date(page.last_edited_time || Date.now()).getTime(),
          updatedAt: Date.now()
        }
      };
      
      await addMemory(memoryItem, encryptionKey);
      result.itemsAdded++;
    }
    
  } catch (err) {
    result.success = false;
    result.errors.push((err as Error).message);
  }
  
  return result;
}

/**
 * Main sync function - routes to appropriate connector
 */
export async function syncConnector(
  connector: ConnectorType,
  integrationId: string,
  encryptionKey: CryptoKey,
  accessToken?: string
): Promise<SyncResult> {
  console.log(`[ConnectorSync] Starting sync for ${connector}`);
  
  switch (connector) {
    case 'github':
      return syncGitHub(integrationId, encryptionKey, accessToken);
    case 'googledrive':
      return syncGoogleDrive(integrationId, encryptionKey, accessToken);
    case 'slack':
      return syncSlack(integrationId, encryptionKey, accessToken);
    case 'gmail':
      return syncGmail(integrationId, encryptionKey, accessToken);
    case 'notion':
      return syncNotion(integrationId, encryptionKey, accessToken);
    default:
      return { 
        success: false, 
        itemsAdded: 0, 
        errors: [`Connector '${connector}' not implemented`] 
      };
  }
}

/**
 * Get the integration ID for a connector type
 */
export async function getIntegrationId(
  userId: string,
  connectorType: ConnectorType
): Promise<string | null> {
  const { data } = await supabase
    .from('chat_integrations')
    .select('id')
    .eq('user_id', userId)
    .eq('integration_type', connectorType)
    .eq('is_active', true)
    .single();
  
  return data?.id || null;
}
