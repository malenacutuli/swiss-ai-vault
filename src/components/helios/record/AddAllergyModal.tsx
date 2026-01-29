/**
 * Add Allergy Modal
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddAllergyModalProps {
  onClose: () => void;
  onAdd: (data: any) => void;
}

export function AddAllergyModal({ onClose, onAdd }: AddAllergyModalProps) {
  const [allergen, setAllergen] = useState('');
  const [reaction, setReaction] = useState('');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allergen) return;

    onAdd({
      allergen,
      reaction,
      severity,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Add Allergy</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label htmlFor="allergen">Allergen *</Label>
            <Input
              id="allergen"
              value={allergen}
              onChange={(e) => setAllergen(e.target.value)}
              placeholder="e.g., Penicillin"
              required
            />
          </div>

          <div>
            <Label htmlFor="reaction">Reaction</Label>
            <Input
              id="reaction"
              value={reaction}
              onChange={(e) => setReaction(e.target.value)}
              placeholder="e.g., Hives, difficulty breathing"
            />
          </div>

          <div>
            <Label>Severity</Label>
            <div className="flex gap-2 mt-1">
              {(['mild', 'moderate', 'severe'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className={`px-4 py-2 rounded-lg border capitalize ${
                    severity === s
                      ? s === 'severe'
                        ? 'bg-red-500 text-white border-red-500'
                        : s === 'moderate'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-green-500 text-white border-green-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-[#2196F3]">
              Add Allergy
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
