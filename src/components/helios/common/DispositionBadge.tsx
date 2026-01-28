/**
 * Disposition Badge Component
 */

import React from 'react';
import {
  Ambulance, Clock, Building2, Stethoscope,
  Video, Home, type LucideIcon
} from 'lucide-react';
import type { Disposition, SupportedLanguage } from '@/lib/helios/types';

interface DispositionBadgeProps {
  disposition: Disposition;
  language: SupportedLanguage;
}

const DISPOSITION_CONFIG: Record<Disposition, {
  icon: LucideIcon;
  color: string;
  labels: Record<SupportedLanguage, string>;
}> = {
  emergency: {
    icon: Ambulance,
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    labels: { en: 'Emergency', es: 'Emergencia', fr: 'Urgence' },
  },
  urgent_care: {
    icon: Clock,
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    labels: { en: 'Urgent Care', es: 'Urgencias', fr: 'Soins Urgents' },
  },
  primary_care: {
    icon: Building2,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    labels: { en: 'Primary Care', es: 'Atención Primaria', fr: 'Soins Primaires' },
  },
  specialist: {
    icon: Stethoscope,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    labels: { en: 'Specialist', es: 'Especialista', fr: 'Spécialiste' },
  },
  telehealth: {
    icon: Video,
    color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
    labels: { en: 'Telehealth', es: 'Telesalud', fr: 'Télésanté' },
  },
  self_care: {
    icon: Home,
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    labels: { en: 'Self Care', es: 'Autocuidado', fr: 'Autosoins' },
  },
};

export function DispositionBadge({ disposition, language }: DispositionBadgeProps) {
  const config = DISPOSITION_CONFIG[disposition];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${config.color}`}>
      <Icon className="w-4 h-4" />
      {config.labels[language]}
    </span>
  );
}
