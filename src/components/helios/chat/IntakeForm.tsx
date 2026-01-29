/**
 * Intake Form Component
 * Collects age and sex for triage
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface IntakeFormProps {
  onComplete: (data: { age: number; sex: string }) => void;
}

export function IntakeForm({ onComplete }: IntakeFormProps) {
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'female' | 'male' | null>(null);

  const handleSubmit = () => {
    if (!age || !sex) return;
    onComplete({ age: parseInt(age), sex });
  };

  return (
    <div className="space-y-6">
      {/* AI Message */}
      <div className="flex gap-3">
        <div className="w-8 h-8 bg-[#1D4E5F] rounded-full flex-shrink-0 flex items-center justify-center">
          <span className="text-white text-sm">✦</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 max-w-[80%]">
          <p className="text-gray-700">
            Thank you for sharing those details. I want to make sure I give you the most
            accurate advice and support possible. To do that, could you share your age
            and your biological sex? This information helps me tailor my recommendations
            specifically to you, as some conditions and their urgency can vary depending
            on these factors.
          </p>
          <p className="text-gray-700 mt-3">
            Please rest assured that anything you share will remain private and confidential.
            Your comfort and well-being are my top priorities, and this information will
            help me guide you more effectively.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex justify-center">
        <div className="flex flex-wrap items-center gap-3">
          {/* Age input */}
          <Input
            type="number"
            placeholder="Age (18+)"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-32 h-12 text-center border-2 border-amber-400 rounded-lg focus:border-amber-500 focus:ring-amber-500"
            min={18}
            max={120}
          />

          {/* Sex toggle */}
          <div className="flex border-2 border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setSex('female')}
              className={cn(
                "px-6 py-3 text-sm font-medium transition-colors",
                sex === 'female'
                  ? "bg-[#1D4E5F] text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              )}
            >
              Female
            </button>
            <button
              onClick={() => setSex('male')}
              className={cn(
                "px-6 py-3 text-sm font-medium transition-colors border-l",
                sex === 'male'
                  ? "bg-[#1D4E5F] text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              )}
            >
              Male
            </button>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!age || !sex}
            className="h-12 px-8 bg-[#2196F3] hover:bg-[#1976D2]"
          >
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
