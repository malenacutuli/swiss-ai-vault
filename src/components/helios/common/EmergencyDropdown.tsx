/**
 * Emergency Numbers Dropdown
 * Compact dropdown for quick access to emergency services
 */

import React, { useState, useMemo } from 'react';
import { Phone, ChevronDown, Siren, Heart, Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EMERGENCY_NUMBERS, type EmergencyNumbers } from '@/components/ghost/health/EmergencyNumbersData';
import type { SupportedLanguage } from '@/lib/helios/types';

interface EmergencyDropdownProps {
  language?: SupportedLanguage;
}

const translations = {
  en: {
    title: 'Connect with a Healthcare Professional',
    emergency: 'Emergency',
    crisis: 'Crisis Line',
    police: 'Police',
    ambulance: 'Ambulance',
    fire: 'Fire',
    selectCountry: 'Select your country',
    disclaimer: 'For immediate emergencies, call your local emergency services.',
  },
  es: {
    title: 'Conectar con un Profesional de Salud',
    emergency: 'Emergencia',
    crisis: 'Línea de Crisis',
    police: 'Policía',
    ambulance: 'Ambulancia',
    fire: 'Bomberos',
    selectCountry: 'Selecciona tu país',
    disclaimer: 'Para emergencias inmediatas, llame a los servicios de emergencia locales.',
  },
  fr: {
    title: 'Contacter un Professionnel de Santé',
    emergency: 'Urgence',
    crisis: 'Ligne de Crise',
    police: 'Police',
    ambulance: 'Ambulance',
    fire: 'Pompiers',
    selectCountry: 'Sélectionnez votre pays',
    disclaimer: 'Pour les urgences immédiates, appelez les services d\'urgence locaux.',
  },
};

export function EmergencyDropdown({ language = 'en' }: EmergencyDropdownProps) {
  const [selectedCountry, setSelectedCountry] = useState<string>('US');
  const t = translations[language] || translations.en;

  const currentCountry = useMemo(() => {
    return EMERGENCY_NUMBERS.find(c => c.countryCode === selectedCountry) || EMERGENCY_NUMBERS[0];
  }, [selectedCountry]);

  const priorityCountries = useMemo(() => {
    const codes = ['US', 'GB', 'EU', 'CH', 'DE', 'FR', 'ES', 'CA', 'AU'];
    return EMERGENCY_NUMBERS.filter(c => codes.includes(c.countryCode));
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 text-[#1D4E5F] border-[#1D4E5F]/30 hover:bg-[#1D4E5F]/10"
        >
          <Phone className="w-4 h-4" />
          <span className="hidden sm:inline">{t.title}</span>
          <span className="sm:hidden">Emergency</span>
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-white dark:bg-gray-800 z-50 p-4">
        {/* Country Selector */}
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Globe className="w-4 h-4" />
            <span>{t.selectCountry}</span>
          </div>
          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger className="w-full bg-white dark:bg-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] bg-white dark:bg-gray-800 z-[100]">
              {priorityCountries.map((country) => (
                <SelectItem key={country.countryCode} value={country.countryCode}>
                  {country.country}
                </SelectItem>
              ))}
              <DropdownMenuSeparator />
              {EMERGENCY_NUMBERS.filter(c => !priorityCountries.includes(c)).map((country) => (
                <SelectItem key={country.countryCode} value={country.countryCode}>
                  {country.country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DropdownMenuSeparator />

        {/* Emergency Numbers */}
        <div className="space-y-3 py-3">
          {/* Main Emergency */}
          <a 
            href={`tel:${currentCountry.emergency.replace(/\s+/g, '')}`}
            className="flex items-center justify-between p-3 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                <Siren className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-red-700">{t.emergency}</p>
                <p className="text-2xl font-bold text-red-800">{currentCountry.emergency}</p>
              </div>
            </div>
            <Phone className="w-5 h-5 text-red-600" />
          </a>

          {/* Crisis Line */}
          {currentCountry.crisisLine && (
            <a 
              href={`tel:${currentCountry.crisisLine.replace(/\s+/g, '')}`}
              className="flex items-center justify-between p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-amber-700">{t.crisis}</p>
                  <p className="text-lg font-bold text-amber-800">{currentCountry.crisisLine}</p>
                  {currentCountry.crisisName && (
                    <p className="text-xs text-amber-600">{currentCountry.crisisName}</p>
                  )}
                </div>
              </div>
              <Phone className="w-5 h-5 text-amber-600" />
            </a>
          )}

          {/* Additional Numbers */}
          {(currentCountry.police || currentCountry.ambulance || currentCountry.fire) && (
            <div className="grid grid-cols-3 gap-2 pt-2">
              {currentCountry.police && (
                <a 
                  href={`tel:${currentCountry.police}`}
                  className="text-center p-2 rounded-lg bg-blue-50 hover:bg-blue-100"
                >
                  <p className="text-xs text-blue-600">{t.police}</p>
                  <p className="font-bold text-blue-800">{currentCountry.police}</p>
                </a>
              )}
              {currentCountry.ambulance && (
                <a 
                  href={`tel:${currentCountry.ambulance}`}
                  className="text-center p-2 rounded-lg bg-green-50 hover:bg-green-100"
                >
                  <p className="text-xs text-green-600">{t.ambulance}</p>
                  <p className="font-bold text-green-800">{currentCountry.ambulance}</p>
                </a>
              )}
              {currentCountry.fire && (
                <a 
                  href={`tel:${currentCountry.fire}`}
                  className="text-center p-2 rounded-lg bg-orange-50 hover:bg-orange-100"
                >
                  <p className="text-xs text-orange-600">{t.fire}</p>
                  <p className="font-bold text-orange-800">{currentCountry.fire}</p>
                </a>
              )}
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground pt-2">
          {t.disclaimer}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
