/**
 * HELIOS Health Vault - Main API
 */

import { getDB } from './database';
import { encrypt, decrypt, deriveKey, generateSalt } from './encryption';

export class HealthVault {
  private key: CryptoKey | null = null;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  async initialize(password: string): Promise<boolean> {
    const db = await getDB();
    const existingKey = await db.get('keys', this.userId);

    if (existingKey) {
      // Derive key from existing salt
      this.key = await deriveKey(password, existingKey.salt);
      return true;
    } else {
      // First time - create new key
      const salt = generateSalt();
      this.key = await deriveKey(password, salt);

      // Store salt (NOT the key)
      await db.put('keys', {
        id: this.userId,
        salt,
        keyHash: await this.hashKey(this.key),
        createdAt: new Date().toISOString(),
      });

      return true;
    }
  }

  private async hashKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', key);
    const hash = await crypto.subtle.digest('SHA-256', exported);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ========================================
  // CONSULTS
  // ========================================

  async saveConsult(consult: {
    id: string;
    messages: any[];
    symptoms: any[];
    hypotheses: any[];
    redFlags: any[];
    language: string;
    phase: string;
    triageLevel?: string;
  }): Promise<void> {
    if (!this.key) throw new Error('Vault not initialized');

    const db = await getDB();
    const data = JSON.stringify(consult);
    const { ciphertext, iv } = await encrypt(data, this.key);

    const existing = await db.get('consults', consult.id);

    await db.put('consults', {
      id: consult.id,
      encryptedData: ciphertext,
      iv,
      language: consult.language,
      phase: consult.phase,
      triageLevel: consult.triageLevel,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async getConsult(id: string): Promise<any | null> {
    if (!this.key) throw new Error('Vault not initialized');

    const db = await getDB();
    const record = await db.get('consults', id);

    if (!record) return null;

    const decrypted = await decrypt(record.encryptedData, record.iv, this.key);
    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  async listConsults(): Promise<Array<{
    id: string;
    language: string;
    phase: string;
    triageLevel?: string;
    createdAt: string;
    updatedAt: string;
  }>> {
    const db = await getDB();
    const all = await db.getAllFromIndex('consults', 'by-date');

    return all.map(c => ({
      id: c.id,
      language: c.language,
      phase: c.phase,
      triageLevel: c.triageLevel,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })).reverse(); // Newest first
  }

  // ========================================
  // DOCUMENTS
  // ========================================

  async saveDocument(doc: {
    id: string;
    consultId?: string;
    type: 'lab_result' | 'imaging' | 'prescription' | 'doctor_note' | 'photo' | 'other';
    filename: string;
    mimeType: string;
    data: ArrayBuffer;
    thumbnail?: ArrayBuffer;
    tags?: string[];
  }): Promise<void> {
    if (!this.key) throw new Error('Vault not initialized');

    const db = await getDB();
    const { ciphertext, iv } = await encrypt(doc.data, this.key);

    let thumbnail: ArrayBuffer | undefined;
    let thumbnailIv: Uint8Array | undefined;

    if (doc.thumbnail) {
      const encrypted = await encrypt(doc.thumbnail, this.key);
      thumbnail = encrypted.ciphertext;
      thumbnailIv = encrypted.iv;
    }

    await db.put('documents', {
      id: doc.id,
      consultId: doc.consultId,
      type: doc.type,
      filename: doc.filename,
      mimeType: doc.mimeType,
      encryptedData: ciphertext,
      iv,
      thumbnail,
      thumbnailIv,
      metadata: {
        uploadedAt: new Date().toISOString(),
        size: doc.data.byteLength,
        tags: doc.tags,
      },
    });
  }

  async getDocument(id: string): Promise<{
    filename: string;
    mimeType: string;
    data: ArrayBuffer;
  } | null> {
    if (!this.key) throw new Error('Vault not initialized');

    const db = await getDB();
    const record = await db.get('documents', id);

    if (!record) return null;

    const decrypted = await decrypt(record.encryptedData, record.iv, this.key);

    return {
      filename: record.filename,
      mimeType: record.mimeType,
      data: decrypted,
    };
  }

  async listDocuments(consultId?: string): Promise<Array<{
    id: string;
    type: string;
    filename: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
    tags?: string[];
  }>> {
    const db = await getDB();

    let records;
    if (consultId) {
      records = await db.getAllFromIndex('documents', 'by-consult', consultId);
    } else {
      records = await db.getAll('documents');
    }

    return records.map(d => ({
      id: d.id,
      type: d.type,
      filename: d.filename,
      mimeType: d.mimeType,
      size: d.metadata.size,
      uploadedAt: d.metadata.uploadedAt,
      tags: d.metadata.tags,
    }));
  }

  // ========================================
  // HEALTH PROFILE
  // ========================================

  async saveProfile(profile: {
    name?: string;
    dateOfBirth?: string;
    sex?: string;
    bloodType?: string;
    emergencyContact?: {
      name: string;
      phone: string;
      relationship: string;
    };
    insurance?: {
      provider: string;
      memberId: string;
      groupNumber: string;
    };
  }): Promise<void> {
    if (!this.key) throw new Error('Vault not initialized');

    const db = await getDB();
    const data = JSON.stringify(profile);
    const { ciphertext, iv } = await encrypt(data, this.key);

    await db.put('profile', {
      id: 'user_profile',
      encryptedData: ciphertext,
      iv,
      updatedAt: new Date().toISOString(),
    });
  }

  async getProfile(): Promise<any | null> {
    if (!this.key) throw new Error('Vault not initialized');

    const db = await getDB();
    const record = await db.get('profile', 'user_profile');

    if (!record) return null;

    const decrypted = await decrypt(record.encryptedData, record.iv, this.key);
    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  // ========================================
  // MEDICAL HISTORY
  // ========================================

  async addHistoryEntry(entry: {
    id: string;
    category: 'condition' | 'medication' | 'allergy' | 'surgery' | 'family' | 'immunization';
    data: any;
  }): Promise<void> {
    if (!this.key) throw new Error('Vault not initialized');

    const db = await getDB();
    const dataStr = JSON.stringify(entry.data);
    const { ciphertext, iv } = await encrypt(dataStr, this.key);

    await db.put('history', {
      id: entry.id,
      category: entry.category,
      encryptedData: ciphertext,
      iv,
      createdAt: new Date().toISOString(),
    });
  }

  async getHistoryByCategory(
    category: 'condition' | 'medication' | 'allergy' | 'surgery' | 'family' | 'immunization'
  ): Promise<any[]> {
    if (!this.key) throw new Error('Vault not initialized');

    const db = await getDB();
    const records = await db.getAllFromIndex('history', 'by-category', category);

    const results = [];
    for (const record of records) {
      const decrypted = await decrypt(record.encryptedData, record.iv, this.key);
      results.push({
        id: record.id,
        category: record.category,
        createdAt: record.createdAt,
        ...JSON.parse(new TextDecoder().decode(decrypted)),
      });
    }

    return results;
  }

  // ========================================
  // APPOINTMENTS
  // ========================================

  async saveAppointment(appointment: {
    id: string;
    consultId?: string;
    providerId?: string;
    providerName?: string;
    specialty?: string;
    scheduledAt: string;
    status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
    notes?: string;
  }): Promise<void> {
    const db = await getDB();

    let encryptedNotes: ArrayBuffer | undefined;
    let notesIv: Uint8Array | undefined;

    if (appointment.notes && this.key) {
      const encrypted = await encrypt(appointment.notes, this.key);
      encryptedNotes = encrypted.ciphertext;
      notesIv = encrypted.iv;
    }

    await db.put('appointments', {
      id: appointment.id,
      consultId: appointment.consultId,
      providerId: appointment.providerId,
      providerName: appointment.providerName,
      specialty: appointment.specialty,
      scheduledAt: appointment.scheduledAt,
      status: appointment.status,
      encryptedNotes,
      notesIv,
      createdAt: new Date().toISOString(),
    });
  }

  async listAppointments(status?: string): Promise<any[]> {
    const db = await getDB();

    let records;
    if (status) {
      records = await db.getAllFromIndex('appointments', 'by-status', status);
    } else {
      records = await db.getAllFromIndex('appointments', 'by-date');
    }

    return records.map(a => ({
      id: a.id,
      consultId: a.consultId,
      providerName: a.providerName,
      specialty: a.specialty,
      scheduledAt: a.scheduledAt,
      status: a.status,
    }));
  }
}

// Export singleton factory
let vaultInstance: HealthVault | null = null;

export function getHealthVault(userId: string): HealthVault {
  if (!vaultInstance || (vaultInstance as any).userId !== userId) {
    vaultInstance = new HealthVault(userId);
  }
  return vaultInstance;
}
