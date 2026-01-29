/**
 * Add Condition Modal
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddConditionModalProps {
  onClose: () => void;
  onAdd: (data: any) => void;
}

export function AddConditionModal({ onClose, onAdd }: AddConditionModalProps) {
  const [condition, setCondition] = useState('');
  const [diagnosedYear, setDiagnosedYear] = useState('');
  const [status, setStatus] = useState<'active' | 'resolved' | 'managed'>('active');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!condition) return;

    onAdd({
      condition,
      diagnosedYear,
      status,
      notes,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Add Condition</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label htmlFor="condition">Condition *</Label>
            <Input
              id="condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="e.g., Hypertension"
              required
            />
          </div>

          <div>
            <Label htmlFor="diagnosedYear">Year Diagnosed</Label>
            <Input
              id="diagnosedYear"
              type="number"
              value={diagnosedYear}
              onChange={(e) => setDiagnosedYear(e.target.value)}
              placeholder="e.g., 2020"
              min={1900}
              max={new Date().getFullYear()}
            />
          </div>

          <div>
            <Label>Status</Label>
            <div className="flex gap-2 mt-1">
              {(['active', 'managed', 'resolved'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-4 py-2 rounded-lg border capitalize ${
                    status === s
                      ? 'bg-[#1D4E5F] text-white border-[#1D4E5F]'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-[#2196F3]">
              Add Condition
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
