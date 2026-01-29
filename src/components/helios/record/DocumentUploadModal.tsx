/**
 * Document Upload Modal
 */

import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DocumentUploadModalProps {
  onClose: () => void;
  onUpload: (file: File, type: string, tags: string[]) => void;
}

const documentTypes = [
  { id: 'lab_result', name: 'Lab Result' },
  { id: 'imaging', name: 'Imaging (X-ray, MRI, etc.)' },
  { id: 'prescription', name: 'Prescription' },
  { id: 'doctor_note', name: 'Doctor\'s Note' },
  { id: 'photo', name: 'Photo' },
  { id: 'other', name: 'Other' },
];

export function DocumentUploadModal({ onClose, onUpload }: DocumentUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState('other');
  const [tags, setTags] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (!file) return;

    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    onUpload(file, type, tagList);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Upload Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                {file.type.startsWith('image/') ? (
                  <Image className="w-8 h-8 text-gray-400" />
                ) : (
                  <FileText className="w-8 h-8 text-gray-400" />
                )}
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                  Drag and drop your file here, or
                </p>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Browse Files
                </Button>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileChange}
          />

          {/* Document type */}
          <div>
            <Label>Document Type</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {documentTypes.map((dt) => (
                <button
                  key={dt.id}
                  onClick={() => setType(dt.id)}
                  className={`px-3 py-2 text-sm rounded-lg border text-left ${
                    type === dt.id
                      ? 'bg-[#1D4E5F] text-white border-[#1D4E5F]'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {dt.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label htmlFor="tags">Tags (optional)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., annual checkup, cardiology"
            />
            <p className="text-xs text-gray-500 mt-1">Separate with commas</p>
          </div>

          {/* Privacy note */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
            🔒 Your document will be encrypted and stored only on your device.
            It will never be uploaded to our servers.
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!file}
              className="flex-1 bg-[#2196F3]"
            >
              Upload Document
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
