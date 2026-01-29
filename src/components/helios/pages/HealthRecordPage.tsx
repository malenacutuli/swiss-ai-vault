/**
 * Health Record Page
 * Manage medical history, documents, medications
 */

import React, { useState, useEffect } from 'react';
import {
  FileText, Pill, AlertCircle, Heart, Users, Syringe,
  Plus, Upload, ChevronRight, Lock, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHealthVault } from '@/hooks/helios/useHealthVault';
import { AddMedicationModal } from '../record/AddMedicationModal';
import { AddConditionModal } from '../record/AddConditionModal';
import { AddAllergyModal } from '../record/AddAllergyModal';
import { DocumentUploadModal } from '../record/DocumentUploadModal';

const categories = [
  { id: 'conditions', name: 'Conditions', icon: Heart, color: 'text-red-500' },
  { id: 'medications', name: 'Medications', icon: Pill, color: 'text-blue-500' },
  { id: 'allergies', name: 'Allergies', icon: AlertCircle, color: 'text-amber-500' },
  { id: 'surgeries', name: 'Surgeries', icon: Plus, color: 'text-purple-500' },
  { id: 'family', name: 'Family History', icon: Users, color: 'text-green-500' },
  { id: 'immunizations', name: 'Immunizations', icon: Syringe, color: 'text-teal-500' },
];

export function HealthRecordPage() {
  const [activeCategory, setActiveCategory] = useState('conditions');
  const [items, setItems] = useState<Record<string, any[]>>({});
  const [documents, setDocuments] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState<string | null>(null);
  const [showDocUpload, setShowDocUpload] = useState(false);

  const { vault, isInitialized } = useHealthVault();

  useEffect(() => {
    if (vault && isInitialized) {
      loadData();
    }
  }, [vault, isInitialized]);

  const loadData = async () => {
    // Load profile
    const userProfile = await vault?.getProfile();
    setProfile(userProfile);

    // Load documents
    const docs = await vault?.listDocuments();
    setDocuments(docs || []);

    // Load each category
    const categoryItems: Record<string, any[]> = {};
    for (const cat of ['condition', 'medication', 'allergy', 'surgery', 'family', 'immunization']) {
      categoryItems[cat] = await vault?.getHistoryByCategory(cat as any) || [];
    }
    setItems(categoryItems);
  };

  const handleAddItem = async (category: string, data: any) => {
    await vault?.addHistoryEntry({
      id: crypto.randomUUID(),
      category: category as any,
      data,
    });
    setShowAddModal(null);
    loadData();
  };

  const handleDocumentUpload = async (file: File, type: string, tags: string[]) => {
    const arrayBuffer = await file.arrayBuffer();

    // Generate thumbnail for images
    let thumbnail: ArrayBuffer | undefined;
    if (file.type.startsWith('image/')) {
      thumbnail = await generateThumbnail(file);
    }

    await vault?.saveDocument({
      id: crypto.randomUUID(),
      type: type as any,
      filename: file.name,
      mimeType: file.type,
      data: arrayBuffer,
      thumbnail,
      tags,
    });

    setShowDocUpload(false);
    loadData();
  };

  const generateThumbnail = async (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const maxSize = 200;

        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          blob?.arrayBuffer().then(resolve);
        }, 'image/jpeg', 0.7);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif mb-2">Health Record</h1>
          <p className="text-gray-600">
            Your medical information, encrypted and stored only on your device.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Lock className="w-4 h-4" />
          <span>End-to-end encrypted</span>
        </div>
      </div>

      {/* Documents Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Documents</h2>
          <Button variant="outline" onClick={() => setShowDocUpload(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </div>

        {documents.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              Upload lab results, imaging, prescriptions, and more.
            </p>
            <Button variant="outline" onClick={() => setShowDocUpload(true)}>
              Upload Document
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {documents.slice(0, 8).map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-xl border p-4 hover:border-gray-300 cursor-pointer"
              >
                <FileText className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm font-medium truncate">{doc.filename}</p>
                <p className="text-xs text-gray-500">{doc.type}</p>
              </div>
            ))}
            {documents.length > 8 && (
              <div className="bg-white rounded-xl border p-4 flex items-center justify-center text-gray-500">
                +{documents.length - 8} more
              </div>
            )}
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`bg-white rounded-xl border p-4 text-left hover:border-gray-300 transition-colors ${
              activeCategory === cat.id ? 'border-[#1D4E5F] ring-1 ring-[#1D4E5F]' : ''
            }`}
          >
            <cat.icon className={`w-6 h-6 ${cat.color} mb-2`} />
            <p className="font-medium">{cat.name}</p>
            <p className="text-sm text-gray-500">
              {items[cat.id.slice(0, -1)]?.length || 0} items
            </p>
          </button>
        ))}
      </div>

      {/* Active Category Items */}
      <div className="bg-white rounded-xl border">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">
            {categories.find(c => c.id === activeCategory)?.name}
          </h3>
          <Button size="sm" onClick={() => setShowAddModal(activeCategory)}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>

        {items[activeCategory.slice(0, -1)]?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No {activeCategory} recorded yet.
          </div>
        ) : (
          <div className="divide-y">
            {items[activeCategory.slice(0, -1)]?.map((item) => (
              <div
                key={item.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">{item.name || item.condition || item.allergen}</p>
                  {item.dosage && (
                    <p className="text-sm text-gray-500">{item.dosage}</p>
                  )}
                  {item.severity && (
                    <p className="text-sm text-gray-500">Severity: {item.severity}</p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export */}
      <div className="mt-8 text-center">
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Health Record
        </Button>
        <p className="text-xs text-gray-500 mt-2">
          Download an encrypted backup of your health data.
        </p>
      </div>

      {/* Modals */}
      {showAddModal === 'medications' && (
        <AddMedicationModal
          onClose={() => setShowAddModal(null)}
          onAdd={(data) => handleAddItem('medication', data)}
        />
      )}

      {showAddModal === 'conditions' && (
        <AddConditionModal
          onClose={() => setShowAddModal(null)}
          onAdd={(data) => handleAddItem('condition', data)}
        />
      )}

      {showAddModal === 'allergies' && (
        <AddAllergyModal
          onClose={() => setShowAddModal(null)}
          onAdd={(data) => handleAddItem('allergy', data)}
        />
      )}

      {showDocUpload && (
        <DocumentUploadModal
          onClose={() => setShowDocUpload(false)}
          onUpload={handleDocumentUpload}
        />
      )}
    </div>
  );
}
