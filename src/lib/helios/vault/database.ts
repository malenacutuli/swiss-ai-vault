/**
 * HELIOS Health Vault - IndexedDB Schema
 * Encrypted local storage for medical data
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface HealthVaultDB extends DBSchema {
  // Encryption keys
  keys: {
    key: string;
    value: {
      id: string;
      salt: Uint8Array;
      keyHash: string;
      createdAt: string;
    };
  };

  // Consult sessions
  consults: {
    key: string;
    value: {
      id: string;
      encryptedData: ArrayBuffer;
      iv: Uint8Array;
      language: string;
      phase: string;
      triageLevel?: string;
      createdAt: string;
      updatedAt: string;
      completedAt?: string;
    };
    indexes: { 'by-date': string };
  };

  // Medical documents (encrypted)
  documents: {
    key: string;
    value: {
      id: string;
      consultId?: string;
      type: 'lab_result' | 'imaging' | 'prescription' | 'doctor_note' | 'photo' | 'other';
      filename: string;
      mimeType: string;
      encryptedData: ArrayBuffer;
      iv: Uint8Array;
      thumbnail?: ArrayBuffer;
      thumbnailIv?: Uint8Array;
      metadata: {
        uploadedAt: string;
        size: number;
        tags?: string[];
      };
    };
    indexes: { 'by-consult': string; 'by-type': string; 'by-date': string };
  };

  // Health profile (encrypted)
  profile: {
    key: string;
    value: {
      id: 'user_profile';
      encryptedData: ArrayBuffer;
      iv: Uint8Array;
      updatedAt: string;
    };
  };

  // Medical history entries (encrypted)
  history: {
    key: string;
    value: {
      id: string;
      category: 'condition' | 'medication' | 'allergy' | 'surgery' | 'family' | 'immunization';
      encryptedData: ArrayBuffer;
      iv: Uint8Array;
      createdAt: string;
    };
    indexes: { 'by-category': string };
  };

  // AI-generated reports (encrypted)
  reports: {
    key: string;
    value: {
      id: string;
      consultId: string;
      type: 'summary' | 'soap_note' | 'differential' | 'handoff';
      encryptedData: ArrayBuffer;
      iv: Uint8Array;
      generatedAt: string;
    };
    indexes: { 'by-consult': string };
  };

  // Appointments
  appointments: {
    key: string;
    value: {
      id: string;
      consultId?: string;
      providerId?: string;
      providerName?: string;
      specialty?: string;
      scheduledAt: string;
      status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
      encryptedNotes?: ArrayBuffer;
      notesIv?: Uint8Array;
      createdAt: string;
    };
    indexes: { 'by-date': string; 'by-status': string };
  };
}

const DB_NAME = 'helios-health-vault';
const DB_VERSION = 1;

let db: IDBPDatabase<HealthVaultDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<HealthVaultDB>> {
  if (db) return db;

  db = await openDB<HealthVaultDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Keys store
      if (!database.objectStoreNames.contains('keys')) {
        database.createObjectStore('keys', { keyPath: 'id' });
      }

      // Consults store
      if (!database.objectStoreNames.contains('consults')) {
        const consultsStore = database.createObjectStore('consults', { keyPath: 'id' });
        consultsStore.createIndex('by-date', 'createdAt');
      }

      // Documents store
      if (!database.objectStoreNames.contains('documents')) {
        const docsStore = database.createObjectStore('documents', { keyPath: 'id' });
        docsStore.createIndex('by-consult', 'consultId');
        docsStore.createIndex('by-type', 'type');
        docsStore.createIndex('by-date', 'metadata.uploadedAt');
      }

      // Profile store
      if (!database.objectStoreNames.contains('profile')) {
        database.createObjectStore('profile', { keyPath: 'id' });
      }

      // History store
      if (!database.objectStoreNames.contains('history')) {
        const historyStore = database.createObjectStore('history', { keyPath: 'id' });
        historyStore.createIndex('by-category', 'category');
      }

      // Reports store
      if (!database.objectStoreNames.contains('reports')) {
        const reportsStore = database.createObjectStore('reports', { keyPath: 'id' });
        reportsStore.createIndex('by-consult', 'consultId');
      }

      // Appointments store
      if (!database.objectStoreNames.contains('appointments')) {
        const apptStore = database.createObjectStore('appointments', { keyPath: 'id' });
        apptStore.createIndex('by-date', 'scheduledAt');
        apptStore.createIndex('by-status', 'status');
      }
    },
  });

  return db;
}

export async function clearAllData(): Promise<void> {
  const database = await getDB();
  const tx = database.transaction(
    ['consults', 'documents', 'profile', 'history', 'reports', 'appointments'],
    'readwrite'
  );

  await Promise.all([
    tx.objectStore('consults').clear(),
    tx.objectStore('documents').clear(),
    tx.objectStore('profile').clear(),
    tx.objectStore('history').clear(),
    tx.objectStore('reports').clear(),
    tx.objectStore('appointments').clear(),
  ]);

  await tx.done;
}
