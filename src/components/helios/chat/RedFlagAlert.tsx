/**
 * Red Flag Alert Component
 * Critical safety warning display
 */

import React from 'react';
import { AlertTriangle, Phone, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RedFlag } from '@/lib/helios/types';

interface RedFlagAlertProps {
  redFlags: RedFlag[];
}

export function RedFlagAlert({ redFlags }: RedFlagAlertProps) {
  // Get the most severe red flag
  const primaryFlag = redFlags.reduce((prev, curr) => {
    const severityOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
    return severityOrder[curr.severity] < severityOrder[prev.severity] ? curr : prev;
  }, redFlags[0]);

  const isCritical = primaryFlag.severity === 'critical';

  return (
    <div className={`px-4 py-3 ${isCritical ? 'bg-red-600' : 'bg-amber-500'}`}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-white flex-shrink-0 mt-0.5" />

          <div className="flex-1">
            <p className="text-white font-semibold">
              {isCritical
                ? '⚠️ EMERGENCY: This may be a medical emergency'
                : '⚠️ Important Safety Information'
              }
            </p>
            <p className="text-white/90 text-sm mt-1">
              {primaryFlag.action_taken}
            </p>

            {isCritical && (
              <div className="flex flex-wrap gap-3 mt-3">
                <Button
                  onClick={() => window.location.href = 'tel:911'}
                  className="bg-white text-red-600 hover:bg-white/90"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call 911
                </Button>

                {primaryFlag.emergency_number && primaryFlag.emergency_number !== '911' && (
                  <Button
                    onClick={() => window.location.href = `tel:${primaryFlag.emergency_number}`}
                    variant="outline"
                    className="border-white text-white hover:bg-white/10"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    {primaryFlag.emergency_number}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {redFlags.length > 1 && (
          <details className="mt-3">
            <summary className="text-white/80 text-sm cursor-pointer hover:text-white">
              View all {redFlags.length} concerns
            </summary>
            <ul className="mt-2 text-white/80 text-sm space-y-1">
              {redFlags.map((flag, i) => (
                <li key={i}>• {flag.description}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
