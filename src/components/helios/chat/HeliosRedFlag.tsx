/**
 * HELIOS Red Flag Component
 * Safety alert display with emergency actions
 */

import React from 'react';
import { AlertTriangle, Phone, ExternalLink } from 'lucide-react';
import type { RedFlag, Severity } from '@/lib/helios/types';
import type { SupportedLanguage } from '@/lib/helios/types';

interface HeliosRedFlagProps {
  flag: RedFlag;
  language: SupportedLanguage;
}

export function HeliosRedFlag({ flag, language }: HeliosRedFlagProps) {
  const severityStyles: Record<Severity, string> = {
    critical: 'bg-red-600 text-white border-red-700',
    high: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700',
    moderate: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700',
    low: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700',
  };

  const labels: Record<SupportedLanguage, Record<string, string>> = {
    en: {
      emergency: 'EMERGENCY',
      urgent: 'URGENT',
      warning: 'WARNING',
      call911: 'Call 911',
      callEmergency: 'Call Emergency Services',
      actionTaken: 'Action:',
    },
    es: {
      emergency: 'EMERGENCIA',
      urgent: 'URGENTE',
      warning: 'ADVERTENCIA',
      call911: 'Llame al 911',
      callEmergency: 'Llamar a Emergencias',
      actionTaken: 'Accion:',
    },
    fr: {
      emergency: 'URGENCE',
      urgent: 'URGENT',
      warning: 'AVERTISSEMENT',
      call911: 'Appelez le 15',
      callEmergency: 'Appeler les Urgences',
      actionTaken: 'Action:',
    },
  };

  const l = labels[language];

  const getLevelLabel = () => {
    switch (flag.escalation_level) {
      case 'emergency':
        return l.emergency;
      case 'urgent':
        return l.urgent;
      default:
        return l.warning;
    }
  };

  const getEmergencyNumber = () => {
    switch (language) {
      case 'fr':
        return '15'; // SAMU in France
      case 'es':
        return '911';
      default:
        return '911';
    }
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border ${
        severityStyles[flag.severity]
      }`}
    >
      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-sm uppercase">
            {getLevelLabel()}
          </span>
          <span className="text-xs opacity-75">
            {flag.flag_type}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm mb-2">{flag.description}</p>

        {/* Action Taken */}
        {flag.action_taken && (
          <p className="text-xs opacity-75 mb-2">
            <span className="font-medium">{l.actionTaken}</span> {flag.action_taken}
          </p>
        )}

        {/* Emergency Call Button */}
        {flag.escalation_level === 'emergency' && (
          <div className="flex gap-2 mt-2">
            <a
              href={`tel:${getEmergencyNumber()}`}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white text-red-600
                         rounded-md font-bold text-sm hover:bg-red-50 transition-colors"
            >
              <Phone className="w-4 h-4" />
              {l.call911}
            </a>
            <a
              href={getEmergencyLink(language)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/20
                         rounded-md text-sm hover:bg-white/30 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              {l.callEmergency}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function getEmergencyLink(language: SupportedLanguage): string {
  // Links to local emergency services info pages
  switch (language) {
    case 'fr':
      return 'https://www.samu-de-france.fr/';
    case 'es':
      return 'https://www.911.gov/';
    default:
      return 'https://www.911.gov/';
  }
}
