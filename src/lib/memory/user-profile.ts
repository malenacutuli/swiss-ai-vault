/**
 * User Profile - Learned preferences and context
 * Automatically extracts insights from conversations to personalize AI responses
 */

import * as crypto from '@/lib/crypto/zerotrace-crypto';

export interface UserProfile {
  id: string;
  version: number;
  lastUpdated: number;
  
  // Communication preferences
  communication: {
    style: 'formal' | 'casual' | 'mixed';
    verbosity: 'concise' | 'detailed' | 'adaptive';
    preferredLanguage: string;
    technicalLevel: 'beginner' | 'intermediate' | 'expert';
    formatPreferences: {
      usesBulletPoints: boolean;
      prefersCodeBlocks: boolean;
      likesExamples: boolean;
      prefersStepByStep: boolean;
    };
  };
  
  // Domain knowledge
  domains: {
    name: string;
    expertise: 'novice' | 'familiar' | 'expert';
    keywords: string[];
    lastMentioned: number;
  }[];
  
  // Professional context
  professional: {
    role?: string;
    industry?: string;
    company?: string;
    teamSize?: string;
    responsibilities: string[];
  };
  
  // Personal preferences
  preferences: {
    topics: { name: string; sentiment: 'positive' | 'negative' | 'neutral' }[];
    tools: string[];
    frameworks: string[];
    avoidTopics: string[];
  };
  
  // Interaction patterns
  patterns: {
    typicalQueryLength: 'short' | 'medium' | 'long';
    asksFollowUps: boolean;
    providesContext: boolean;
    prefersDirectAnswers: boolean;
    timeZone?: string;
    activeHours?: { start: number; end: number };
  };
  
  // Goals and projects
  projects: {
    name: string;
    description: string;
    status: 'active' | 'completed' | 'mentioned';
    lastMentioned: number;
    relatedTopics: string[];
  }[];
  
  // Key facts
  keyFacts: {
    fact: string;
    confidence: number;
    source: 'explicit' | 'inferred';
    extractedAt: number;
  }[];
  
  // Statistics
  stats: {
    totalConversations: number;
    totalMessages: number;
    firstInteraction: number;
    averageSessionLength: number;
  };
}

const PROFILE_DB_NAME = 'SwissBrAInProfile';
const PROFILE_STORE = 'profile';
const PROFILE_VERSION = 1;

let profileDb: IDBDatabase | null = null;

async function getProfileDB(): Promise<IDBDatabase> {
  if (profileDb) return profileDb;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PROFILE_DB_NAME, PROFILE_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PROFILE_STORE)) {
        db.createObjectStore(PROFILE_STORE, { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => {
      profileDb = request.result;
      resolve(profileDb);
    };
  });
}

function createDefaultProfile(): UserProfile {
  return {
    id: 'primary',
    version: 1,
    lastUpdated: Date.now(),
    communication: {
      style: 'mixed',
      verbosity: 'adaptive',
      preferredLanguage: 'en',
      technicalLevel: 'intermediate',
      formatPreferences: {
        usesBulletPoints: true,
        prefersCodeBlocks: true,
        likesExamples: true,
        prefersStepByStep: true
      }
    },
    domains: [],
    professional: {
      responsibilities: []
    },
    preferences: {
      topics: [],
      tools: [],
      frameworks: [],
      avoidTopics: []
    },
    patterns: {
      typicalQueryLength: 'medium',
      asksFollowUps: true,
      providesContext: true,
      prefersDirectAnswers: false
    },
    projects: [],
    keyFacts: [],
    stats: {
      totalConversations: 0,
      totalMessages: 0,
      firstInteraction: Date.now(),
      averageSessionLength: 0
    }
  };
}

/**
 * Load user profile (encrypted)
 */
export async function loadProfile(encryptionKey: CryptoKey): Promise<UserProfile> {
  const db = await getProfileDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILE_STORE, 'readonly');
    const request = tx.objectStore(PROFILE_STORE).get('primary');
    
    request.onsuccess = async () => {
      if (!request.result) {
        resolve(createDefaultProfile());
        return;
      }
      
      try {
        const decrypted = await crypto.decrypt(
          {
            ciphertext: request.result.ciphertext,
            nonce: request.result.nonce
          },
          encryptionKey
        );
        resolve(JSON.parse(decrypted));
      } catch (error) {
        console.error('Failed to decrypt profile:', error);
        resolve(createDefaultProfile());
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save user profile (encrypted)
 */
export async function saveProfile(
  profile: UserProfile,
  encryptionKey: CryptoKey
): Promise<void> {
  const db = await getProfileDB();
  
  const encrypted = await crypto.encrypt(
    JSON.stringify(profile),
    encryptionKey
  );
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILE_STORE, 'readwrite');
    tx.objectStore(PROFILE_STORE).put({
      id: 'primary',
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      updatedAt: Date.now()
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Extract insights from a conversation
 */
export async function extractInsightsFromConversation(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  profile: UserProfile,
  encryptionKey: CryptoKey
): Promise<UserProfile> {
  const userMessages = messages.filter(m => m.role === 'user');
  
  if (userMessages.length === 0) return profile;
  
  const updatedProfile = { ...profile };
  
  // 1. Analyze communication style
  const avgLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;
  if (avgLength < 100) {
    updatedProfile.patterns.typicalQueryLength = 'short';
  } else if (avgLength > 500) {
    updatedProfile.patterns.typicalQueryLength = 'long';
  } else {
    updatedProfile.patterns.typicalQueryLength = 'medium';
  }
  
  // 2. Check for technical indicators
  const allUserText = userMessages.map(m => m.content).join(' ');
  const technicalIndicators = [
    /\bAPI\b/i, /\bSDK\b/i, /\bfunction\b/i, /\bclass\b/i,
    /\bdatabase\b/i, /\bquery\b/i, /\balgorithm\b/i, /\bdeployment\b/i,
    /```/
  ];
  const technicalScore = technicalIndicators.filter(r => r.test(allUserText)).length;
  
  if (technicalScore >= 4) {
    updatedProfile.communication.technicalLevel = 'expert';
  } else if (technicalScore >= 2) {
    updatedProfile.communication.technicalLevel = 'intermediate';
  }
  
  // 3. Extract domain keywords
  const domainPatterns: Record<string, RegExp[]> = {
    'finance': [/\binvestment\b/i, /\bportfolio\b/i, /\bstock\b/i, /\btax\b/i, /\bGDPR\b/i],
    'legal': [/\bcontract\b/i, /\bclause\b/i, /\bcompliance\b/i, /\blitigation\b/i],
    'healthcare': [/\bpatient\b/i, /\bdiagnosis\b/i, /\btreatment\b/i, /\bclinical\b/i],
    'technology': [/\bsoftware\b/i, /\bcode\b/i, /\bdevelop\b/i, /\bengineer\b/i],
    'marketing': [/\bcampaign\b/i, /\bconversion\b/i, /\bSEO\b/i, /\bbrand\b/i]
  };
  
  for (const [domain, patterns] of Object.entries(domainPatterns)) {
    const matches = patterns.filter(p => p.test(allUserText)).length;
    if (matches >= 2) {
      const existing = updatedProfile.domains.find(d => d.name === domain);
      if (existing) {
        existing.lastMentioned = Date.now();
        if (matches >= 3 && existing.expertise !== 'expert') {
          existing.expertise = 'familiar';
        }
      } else {
        updatedProfile.domains.push({
          name: domain,
          expertise: matches >= 3 ? 'familiar' : 'novice',
          keywords: [],
          lastMentioned: Date.now()
        });
      }
    }
  }
  
  // 4. Extract explicit preferences
  const preferencePatterns = [
    /I (?:prefer|like|want|need) (.+?)(?:\.|,|$)/gi,
    /(?:please|always) (?:use|include|add) (.+?)(?:\.|,|$)/gi,
    /(?:don't|never|avoid) (.+?)(?:\.|,|$)/gi
  ];
  
  for (const msg of userMessages) {
    for (const pattern of preferencePatterns) {
      const matches = msg.content.matchAll(pattern);
      for (const match of matches) {
        const preference = match[1].trim().toLowerCase();
        if (preference.length > 3 && preference.length < 100) {
          if (msg.content.includes("don't") || msg.content.includes("never") || msg.content.includes("avoid")) {
            if (!updatedProfile.preferences.avoidTopics.includes(preference)) {
              updatedProfile.preferences.avoidTopics.push(preference);
            }
          } else {
            const existingFact = updatedProfile.keyFacts.find(
              f => f.fact.toLowerCase().includes(preference)
            );
            if (!existingFact) {
              updatedProfile.keyFacts.push({
                fact: `User prefers: ${preference}`,
                confidence: 0.7,
                source: 'explicit',
                extractedAt: Date.now()
              });
            }
          }
        }
      }
    }
  }
  
  // 5. Extract role/company mentions
  const rolePatterns = [
    /I(?:'m| am) (?:a |an |the )?(.+?) at (.+?)(?:\.|,|$)/i,
    /I work (?:as |at |for )(.+?)(?:\.|,|$)/i,
    /my (?:role|job|position) is (.+?)(?:\.|,|$)/i
  ];
  
  for (const msg of userMessages) {
    for (const pattern of rolePatterns) {
      const match = msg.content.match(pattern);
      if (match) {
        if (match[2]) {
          updatedProfile.professional.company = match[2].trim();
        }
        if (match[1] && !match[1].includes('at')) {
          updatedProfile.professional.role = match[1].trim();
        }
      }
    }
  }
  
  // 6. Update stats
  updatedProfile.stats.totalConversations += 1;
  updatedProfile.stats.totalMessages += messages.length;
  updatedProfile.lastUpdated = Date.now();
  
  // Save updated profile
  await saveProfile(updatedProfile, encryptionKey);
  
  return updatedProfile;
}

/**
 * Generate context prompt from profile for AI requests
 */
export function generateProfileContext(profile: UserProfile): string {
  const parts: string[] = [];
  
  parts.push('=== USER CONTEXT (learned preferences) ===');
  
  if (profile.communication.technicalLevel !== 'intermediate') {
    parts.push(`Technical level: ${profile.communication.technicalLevel}`);
  }
  
  if (profile.communication.verbosity !== 'adaptive') {
    parts.push(`Prefers ${profile.communication.verbosity} responses`);
  }
  
  if (profile.professional.role || profile.professional.company) {
    const roleInfo = [profile.professional.role, profile.professional.company]
      .filter(Boolean)
      .join(' at ');
    parts.push(`Role: ${roleInfo}`);
  }
  
  if (profile.professional.industry) {
    parts.push(`Industry: ${profile.professional.industry}`);
  }
  
  const expertDomains = profile.domains
    .filter(d => d.expertise === 'expert' || d.expertise === 'familiar')
    .map(d => d.name);
  
  if (expertDomains.length > 0) {
    parts.push(`Domain expertise: ${expertDomains.join(', ')}`);
  }
  
  const activeProjects = profile.projects
    .filter(p => p.status === 'active')
    .slice(0, 3);
  
  if (activeProjects.length > 0) {
    parts.push(`Active projects: ${activeProjects.map(p => p.name).join(', ')}`);
  }
  
  const relevantFacts = profile.keyFacts
    .filter(f => f.confidence >= 0.7)
    .slice(0, 5);
  
  if (relevantFacts.length > 0) {
    parts.push('Key preferences:');
    relevantFacts.forEach(f => parts.push(`- ${f.fact}`));
  }
  
  if (profile.preferences.avoidTopics.length > 0) {
    parts.push(`Avoid: ${profile.preferences.avoidTopics.slice(0, 5).join(', ')}`);
  }
  
  const formatPrefs: string[] = [];
  if (profile.communication.formatPreferences.prefersCodeBlocks) {
    formatPrefs.push('code blocks');
  }
  if (profile.communication.formatPreferences.prefersStepByStep) {
    formatPrefs.push('step-by-step explanations');
  }
  if (formatPrefs.length > 0) {
    parts.push(`Preferred formats: ${formatPrefs.join(', ')}`);
  }
  
  parts.push('=== END USER CONTEXT ===');
  
  return parts.join('\n');
}

/**
 * Export profile for backup
 */
export async function exportProfile(encryptionKey: CryptoKey): Promise<Blob> {
  const profile = await loadProfile(encryptionKey);
  const exportData = {
    version: 1,
    exportedAt: Date.now(),
    profile
  };
  
  return new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
}

/**
 * Import profile
 */
export async function importProfile(
  blob: Blob,
  encryptionKey: CryptoKey,
  mode: 'replace' | 'merge' = 'merge'
): Promise<void> {
  const text = await blob.text();
  const importData = JSON.parse(text);
  
  if (mode === 'replace') {
    await saveProfile(importData.profile, encryptionKey);
    return;
  }
  
  const existing = await loadProfile(encryptionKey);
  const merged: UserProfile = {
    ...existing,
    ...importData.profile,
    domains: [...existing.domains, ...importData.profile.domains]
      .filter((d, i, arr) => arr.findIndex(x => x.name === d.name) === i),
    keyFacts: [...existing.keyFacts, ...importData.profile.keyFacts]
      .filter((f, i, arr) => arr.findIndex(x => x.fact === f.fact) === i),
    projects: [...existing.projects, ...importData.profile.projects]
      .filter((p, i, arr) => arr.findIndex(x => x.name === p.name) === i),
    lastUpdated: Date.now()
  };
  
  await saveProfile(merged, encryptionKey);
}
