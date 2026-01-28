/**
 * Triage Level Badge Component
 */

import React from 'react';
import type { TriageLevel } from '@/lib/helios/types';

interface TriageLevelProps {
  level: TriageLevel;
  showLabel?: boolean;
}

const TRIAGE_CONFIG: Record<TriageLevel, { color: string; label: string; bgColor: string }> = {
  ESI1: { color: 'text-white', bgColor: 'bg-red-600', label: 'Immediate' },
  ESI2: { color: 'text-white', bgColor: 'bg-orange-500', label: 'Emergent' },
  ESI3: { color: 'text-white', bgColor: 'bg-yellow-500', label: 'Urgent' },
  ESI4: { color: 'text-gray-800', bgColor: 'bg-green-400', label: 'Less Urgent' },
  ESI5: { color: 'text-gray-800', bgColor: 'bg-blue-300', label: 'Non-Urgent' },
};

export function TriageLevelBadge({ level, showLabel = true }: TriageLevelProps) {
  const config = TRIAGE_CONFIG[level];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium
                      ${config.bgColor} ${config.color}`}>
      <span>{level}</span>
      {showLabel && <span className="hidden sm:inline">- {config.label}</span>}
    </span>
  );
}
