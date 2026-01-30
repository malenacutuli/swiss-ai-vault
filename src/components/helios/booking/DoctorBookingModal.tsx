/**
 * Doctor Booking Modal
 * Full-featured modal for booking appointments with geolocation-based provider search
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MapPin,
  Navigation,
  Search,
  Star,
  Clock,
  Video,
  Building2,
  Shield,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Check,
  Download,
  Mail,
  Phone,
  Loader2,
  AlertCircle,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// Types
// ============================================================================

export type ESILevel = 1 | 2 | 3 | 4 | 5;

export interface Provider {
  id: string;
  name: string;
  title: string;
  specialty: string;
  facilityName: string;
  facilityAddress: string;
  distance: number; // miles
  rating: number;
  reviewCount: number;
  videoVisitAvailable: boolean;
  videoVisitPrice: number;
  inPersonPrice: number;
  insuranceNetworks: string[];
  averageWaitTime: number; // minutes
  nextAvailable: string;
  avatar?: string;
  languages: string[];
}

export interface TimeSlot {
  time: string;
  available: boolean;
  isVideo: boolean;
}

export interface Appointment {
  id: string;
  providerId: string;
  providerName: string;
  facilityName: string;
  facilityAddress: string;
  scheduledAt: string;
  visitType: 'video' | 'in_person';
  duration: number;
  price: number;
  confirmationCode: string;
}

export interface DoctorBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  esiLevel: ESILevel;
  onBookingComplete: (appointment: Appointment) => void;
  recommendedSpecialty?: string;
}

interface LocationState {
  lat: number | null;
  lng: number | null;
  address: string;
  loading: boolean;
  error: string | null;
}

type BookingStep = 'location' | 'providers' | 'booking' | 'confirmation';

// ============================================================================
// Constants
// ============================================================================

const RADIUS_OPTIONS = [
  { value: 5, label: '5 miles' },
  { value: 10, label: '10 miles' },
  { value: 25, label: '25 miles' },
  { value: 50, label: '50 miles' },
];

const SPECIALTIES = [
  { value: 'all', label: 'All Specialties' },
  { value: 'primary_care', label: 'Primary Care' },
  { value: 'internal_medicine', label: 'Internal Medicine' },
  { value: 'emergency_medicine', label: 'Emergency Medicine' },
  { value: 'cardiology', label: 'Cardiology' },
  { value: 'pulmonology', label: 'Pulmonology' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'gastroenterology', label: 'Gastroenterology' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'mental_health', label: 'Mental Health' },
];

const TIME_SLOTS: TimeSlot[] = [
  { time: '09:00', available: true, isVideo: true },
  { time: '09:30', available: true, isVideo: true },
  { time: '10:00', available: false, isVideo: true },
  { time: '10:30', available: true, isVideo: true },
  { time: '11:00', available: true, isVideo: false },
  { time: '11:30', available: true, isVideo: true },
  { time: '12:00', available: false, isVideo: true },
  { time: '13:00', available: true, isVideo: true },
  { time: '13:30', available: true, isVideo: true },
  { time: '14:00', available: true, isVideo: false },
  { time: '14:30', available: false, isVideo: true },
  { time: '15:00', available: true, isVideo: true },
  { time: '15:30', available: true, isVideo: true },
  { time: '16:00', available: true, isVideo: true },
  { time: '16:30', available: true, isVideo: false },
  { time: '17:00', available: true, isVideo: true },
];

// ============================================================================
// Helper Functions
// ============================================================================

function generateConfirmationCode(): string {
  return `HEL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function generateICSFile(appointment: Appointment): string {
  const startDate = new Date(appointment.scheduledAt);
  const endDate = new Date(startDate.getTime() + appointment.duration * 60000);

  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//HELIOS//Doctor Booking//EN
BEGIN:VEVENT
UID:${appointment.id}@helios.health
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${appointment.visitType === 'video' ? 'Video Visit' : 'In-Person Visit'} with ${appointment.providerName}
LOCATION:${appointment.visitType === 'video' ? 'Video Call (link will be sent)' : appointment.facilityAddress}
DESCRIPTION:Appointment with ${appointment.providerName} at ${appointment.facilityName}\\nConfirmation Code: ${appointment.confirmationCode}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

  return icsContent;
}

function downloadICSFile(appointment: Appointment): void {
  const icsContent = generateICSFile(appointment);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `appointment-${appointment.confirmationCode}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================================================
// Location Step Component
// ============================================================================

interface LocationStepProps {
  location: LocationState;
  radius: number;
  onLocationChange: (location: Partial<LocationState>) => void;
  onRadiusChange: (radius: number) => void;
  onUseMyLocation: () => void;
  onContinue: () => void;
}

function LocationStep({
  location,
  radius,
  onLocationChange,
  onRadiusChange,
  onUseMyLocation,
  onContinue,
}: LocationStepProps) {
  const canContinue = location.lat !== null && location.lng !== null;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Find Providers Near You</h3>
        <p className="text-sm text-muted-foreground mt-1">
          We'll search for available doctors in your area
        </p>
      </div>

      {/* Use My Location Button */}
      <Button
        onClick={onUseMyLocation}
        variant="outline"
        className="w-full h-14 text-left justify-start gap-3"
        disabled={location.loading}
      >
        {location.loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Navigation className="w-5 h-5 text-primary" />
        )}
        <div>
          <p className="font-medium">Use my current location</p>
          <p className="text-xs text-muted-foreground">
            {location.loading ? 'Getting location...' : 'Automatically detect your location'}
          </p>
        </div>
      </Button>

      {location.error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{location.error}</span>
        </div>
      )}

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      {/* Manual Address Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Enter address or ZIP code</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={location.address}
            onChange={(e) => onLocationChange({ address: e.target.value })}
            placeholder="e.g., 123 Main St or 90210"
            className="pl-10"
          />
        </div>
      </div>

      {/* Radius Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Search radius</label>
        <div className="flex gap-2">
          {RADIUS_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={radius === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onRadiusChange(option.value)}
              className="flex-1"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Current Location Display */}
      {location.lat && location.lng && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <Check className="w-4 h-4" />
            <span className="text-sm font-medium">Location set</span>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            {location.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
          </p>
        </div>
      )}

      {/* Continue Button */}
      <Button
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full"
        size="lg"
      >
        Find Providers
      </Button>
    </div>
  );
}

// ============================================================================
// Provider Card Component
// ============================================================================

interface ProviderCardProps {
  provider: Provider;
  onSelect: () => void;
}

function ProviderCard({ provider, onSelect }: ProviderCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border rounded-xl p-4 hover:border-primary/50 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-lg font-medium text-primary">
            {provider.name.split(' ').slice(1).map((n) => n[0]).join('')}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold truncate">{provider.name}</h4>
              <p className="text-sm text-muted-foreground">{provider.title}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-medium">{provider.rating}</span>
              <span className="text-xs text-muted-foreground">
                ({provider.reviewCount})
              </span>
            </div>
          </div>

          {/* Facility */}
          <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
            <Building2 className="w-3.5 h-3.5" />
            <span className="truncate">{provider.facilityName}</span>
            <span className="text-primary font-medium ml-auto">
              {provider.distance} mi
            </span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {provider.videoVisitAvailable && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Video className="w-3 h-3" />
                ${provider.videoVisitPrice}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs gap-1">
              <Clock className="w-3 h-3" />
              {provider.averageWaitTime} min wait
            </Badge>
          </div>

          {/* Insurance */}
          <div className="flex flex-wrap gap-1 mt-2">
            {provider.insuranceNetworks.slice(0, 3).map((network) => (
              <Badge key={network} variant="outline" className="text-xs">
                {network}
              </Badge>
            ))}
            {provider.insuranceNetworks.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{provider.insuranceNetworks.length - 3} more
              </Badge>
            )}
          </div>

          {/* Next Available */}
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            Next available: {provider.nextAvailable}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Provider List Step Component
// ============================================================================

interface ProviderListStepProps {
  providers: Provider[];
  loading: boolean;
  filters: {
    specialty: string;
    videoOnly: boolean;
    hasInsurance: boolean;
  };
  onFilterChange: (filters: Partial<ProviderListStepProps['filters']>) => void;
  onSelectProvider: (provider: Provider) => void;
  onBack: () => void;
}

function ProviderListStep({
  providers,
  loading,
  filters,
  onFilterChange,
  onSelectProvider,
  onBack,
}: ProviderListStepProps) {
  const filteredProviders = providers.filter((p) => {
    if (filters.specialty !== 'all' && p.specialty !== filters.specialty) return false;
    if (filters.videoOnly && !p.videoVisitAvailable) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Back Button & Title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h3 className="font-semibold">Available Providers</h3>
          <p className="text-sm text-muted-foreground">
            {filteredProviders.length} providers found
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={filters.specialty}
          onValueChange={(v) => onFilterChange({ specialty: v })}
        >
          <SelectTrigger className="w-[160px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPECIALTIES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={filters.videoOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange({ videoOnly: !filters.videoOnly })}
          className="gap-1.5"
        >
          <Video className="w-4 h-4" />
          Video visits
        </Button>

        <Button
          variant={filters.hasInsurance ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange({ hasInsurance: !filters.hasInsurance })}
          className="gap-1.5"
        >
          <Shield className="w-4 h-4" />
          Accepts insurance
        </Button>
      </div>

      {/* Provider List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground mt-2">
              Finding providers near you...
            </p>
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No providers found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your filters or search radius
            </p>
          </div>
        ) : (
          filteredProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onSelect={() => onSelectProvider(provider)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Booking Step Component
// ============================================================================

interface BookingStepProps {
  provider: Provider;
  selectedDate: Date | undefined;
  selectedTime: string | null;
  visitType: 'video' | 'in_person';
  onDateChange: (date: Date | undefined) => void;
  onTimeChange: (time: string) => void;
  onVisitTypeChange: (type: 'video' | 'in_person') => void;
  onConfirm: () => void;
  onBack: () => void;
  loading: boolean;
}

function BookingStep({
  provider,
  selectedDate,
  selectedTime,
  visitType,
  onDateChange,
  onTimeChange,
  onVisitTypeChange,
  onConfirm,
  onBack,
  loading,
}: BookingStepProps) {
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 7);

  const canConfirm = selectedDate && selectedTime;

  return (
    <div className="space-y-4">
      {/* Back Button & Provider Info */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium text-primary">
            {provider.name.split(' ').slice(1).map((n) => n[0]).join('')}
          </div>
          <div>
            <h3 className="font-semibold">{provider.name}</h3>
            <p className="text-sm text-muted-foreground">{provider.facilityName}</p>
          </div>
        </div>
      </div>

      {/* Visit Type Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Visit Type</label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={visitType === 'video' ? 'default' : 'outline'}
            onClick={() => onVisitTypeChange('video')}
            disabled={!provider.videoVisitAvailable}
            className="h-auto py-3 flex-col gap-1"
          >
            <Video className="w-5 h-5" />
            <span>Video Visit</span>
            <span className="text-xs opacity-75">${provider.videoVisitPrice}</span>
          </Button>
          <Button
            variant={visitType === 'in_person' ? 'default' : 'outline'}
            onClick={() => onVisitTypeChange('in_person')}
            className="h-auto py-3 flex-col gap-1"
          >
            <Building2 className="w-5 h-5" />
            <span>In-Person</span>
            <span className="text-xs opacity-75">${provider.inPersonPrice}</span>
          </Button>
        </div>
      </div>

      {/* Date Picker */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Select Date</label>
        <div className="border rounded-lg p-2">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={onDateChange}
            disabled={(date) => date < today || date > maxDate}
            className="mx-auto"
          />
        </div>
      </div>

      {/* Time Slots */}
      {selectedDate && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Available Times</label>
          <div className="grid grid-cols-4 gap-2">
            {TIME_SLOTS.filter((slot) =>
              visitType === 'video' ? slot.isVideo : true
            ).map((slot) => (
              <Button
                key={slot.time}
                variant={selectedTime === slot.time ? 'default' : 'outline'}
                size="sm"
                disabled={!slot.available}
                onClick={() => onTimeChange(slot.time)}
                className="text-xs"
              >
                {formatTime(slot.time)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Confirm Button */}
      <Button
        onClick={onConfirm}
        disabled={!canConfirm || loading}
        className="w-full"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Booking...
          </>
        ) : (
          'Confirm Booking'
        )}
      </Button>
    </div>
  );
}

// ============================================================================
// Confirmation Step Component
// ============================================================================

interface ConfirmationStepProps {
  appointment: Appointment;
  provider: Provider;
  sendSMS: boolean;
  sendEmail: boolean;
  onSMSChange: (value: boolean) => void;
  onEmailChange: (value: boolean) => void;
  onDownloadCalendar: () => void;
  onClose: () => void;
}

function ConfirmationStep({
  appointment,
  provider,
  sendSMS,
  sendEmail,
  onSMSChange,
  onEmailChange,
  onDownloadCalendar,
  onClose,
}: ConfirmationStepProps) {
  const appointmentDate = new Date(appointment.scheduledAt);

  return (
    <div className="space-y-6">
      {/* Success Icon */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto"
        >
          <Check className="w-10 h-10 text-green-600 dark:text-green-400" />
        </motion.div>
        <h3 className="text-xl font-semibold mt-4">Appointment Confirmed!</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Confirmation code: <span className="font-mono font-medium">{appointment.confirmationCode}</span>
        </p>
      </div>

      {/* Appointment Details */}
      <div className="bg-muted/50 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium text-primary">
            {provider.name.split(' ').slice(1).map((n) => n[0]).join('')}
          </div>
          <div>
            <p className="font-medium">{provider.name}</p>
            <p className="text-sm text-muted-foreground">{provider.specialty}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            <span>
              {appointmentDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>
              {appointmentDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {appointment.visitType === 'video' ? (
              <Video className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Building2 className="w-4 h-4 text-muted-foreground" />
            )}
            <span>
              {appointment.visitType === 'video' ? 'Video Visit' : 'In-Person'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-primary">${appointment.price}</span>
          </div>
        </div>

        {appointment.visitType === 'in_person' && (
          <div className="flex items-start gap-2 pt-2 border-t">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">{appointment.facilityName}</p>
              <p className="text-xs text-muted-foreground">
                {appointment.facilityAddress}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Notification Options */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Send confirmation to:</p>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={sendEmail}
              onCheckedChange={(checked) => onEmailChange(checked as boolean)}
            />
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">Email confirmation</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={sendSMS}
              onCheckedChange={(checked) => onSMSChange(checked as boolean)}
            />
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">SMS reminder</span>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button onClick={onDownloadCalendar} variant="outline" className="w-full gap-2">
          <Download className="w-4 h-4" />
          Add to Calendar (.ics)
        </Button>
        <Button onClick={onClose} className="w-full">
          Done
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DoctorBookingModal({
  isOpen,
  onClose,
  sessionId,
  esiLevel,
  onBookingComplete,
  recommendedSpecialty,
}: DoctorBookingModalProps) {
  // State
  const [step, setStep] = useState<BookingStep>('location');
  const [location, setLocation] = useState<LocationState>({
    lat: null,
    lng: null,
    address: '',
    loading: false,
    error: null,
  });
  const [radius, setRadius] = useState(10);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [filters, setFilters] = useState({
    specialty: recommendedSpecialty || 'all',
    videoOnly: false,
    hasInsurance: false,
  });
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [visitType, setVisitType] = useState<'video' | 'in_person'>('video');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [sendSMS, setSendSMS] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('location');
      setSelectedProvider(null);
      setSelectedTime(null);
      setAppointment(null);
    }
  }, [isOpen]);

  // Geolocation
  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation((prev) => ({
        ...prev,
        error: 'Geolocation is not supported by your browser',
      }));
      return;
    }

    setLocation((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: 'Current location',
          loading: false,
          error: null,
        });
      },
      (error) => {
        let errorMessage = 'Failed to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enable location permissions.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        setLocation((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // Fetch providers (mock implementation - would call Supabase in production)
  const fetchProviders = useCallback(async () => {
    setProvidersLoading(true);

    // Simulated API call - in production, this would call:
    // const { data } = await supabase.rpc('find_nearby_providers', {
    //   lat: location.lat,
    //   lng: location.lng,
    //   radius_miles: radius
    // });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock providers
    const mockProviders: Provider[] = [
      {
        id: 'prov-1',
        name: 'Dr. Sarah Chen',
        title: 'MD, FACP',
        specialty: 'primary_care',
        facilityName: 'HealthFirst Medical Center',
        facilityAddress: '123 Medical Plaza, Suite 100',
        distance: 2.3,
        rating: 4.9,
        reviewCount: 234,
        videoVisitAvailable: true,
        videoVisitPrice: 49,
        inPersonPrice: 89,
        insuranceNetworks: ['Blue Cross', 'Aetna', 'United'],
        averageWaitTime: 5,
        nextAvailable: 'Today, 3:30 PM',
        languages: ['English', 'Mandarin'],
      },
      {
        id: 'prov-2',
        name: 'Dr. Michael Rodriguez',
        title: 'MD',
        specialty: 'internal_medicine',
        facilityName: 'City Medical Group',
        facilityAddress: '456 Health Street',
        distance: 4.1,
        rating: 4.7,
        reviewCount: 156,
        videoVisitAvailable: true,
        videoVisitPrice: 59,
        inPersonPrice: 99,
        insuranceNetworks: ['Cigna', 'Aetna'],
        averageWaitTime: 10,
        nextAvailable: 'Today, 5:00 PM',
        languages: ['English', 'Spanish'],
      },
      {
        id: 'prov-3',
        name: 'Dr. Emily Johnson',
        title: 'MD, FACEP',
        specialty: 'emergency_medicine',
        facilityName: 'Regional Urgent Care',
        facilityAddress: '789 Emergency Lane',
        distance: 1.8,
        rating: 4.8,
        reviewCount: 312,
        videoVisitAvailable: false,
        videoVisitPrice: 0,
        inPersonPrice: 129,
        insuranceNetworks: ['Blue Cross', 'Medicare', 'Medicaid'],
        averageWaitTime: 15,
        nextAvailable: 'Now',
        languages: ['English'],
      },
      {
        id: 'prov-4',
        name: 'Dr. David Kim',
        title: 'MD, FACC',
        specialty: 'cardiology',
        facilityName: 'Heart & Vascular Institute',
        facilityAddress: '321 Cardiac Drive',
        distance: 5.6,
        rating: 4.9,
        reviewCount: 189,
        videoVisitAvailable: true,
        videoVisitPrice: 79,
        inPersonPrice: 149,
        insuranceNetworks: ['Blue Cross', 'United', 'Cigna', 'Aetna'],
        averageWaitTime: 8,
        nextAvailable: 'Tomorrow, 10:00 AM',
        languages: ['English', 'Korean'],
      },
    ];

    setProviders(mockProviders);
    setProvidersLoading(false);
  }, [location.lat, location.lng, radius]);

  // Book appointment
  const handleBookAppointment = useCallback(async () => {
    if (!selectedProvider || !selectedDate || !selectedTime) return;

    setBookingLoading(true);

    // Combine date and time
    const [hours, minutes] = selectedTime.split(':');
    const appointmentDate = new Date(selectedDate);
    appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // Simulated API call - in production, this would call:
    // const { data } = await supabase.from('appointments').insert({...});

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const newAppointment: Appointment = {
      id: `apt-${Date.now()}`,
      providerId: selectedProvider.id,
      providerName: selectedProvider.name,
      facilityName: selectedProvider.facilityName,
      facilityAddress: selectedProvider.facilityAddress,
      scheduledAt: appointmentDate.toISOString(),
      visitType,
      duration: 30,
      price: visitType === 'video' ? selectedProvider.videoVisitPrice : selectedProvider.inPersonPrice,
      confirmationCode: generateConfirmationCode(),
    };

    setAppointment(newAppointment);
    setBookingLoading(false);
    setStep('confirmation');
    onBookingComplete(newAppointment);
  }, [selectedProvider, selectedDate, selectedTime, visitType, onBookingComplete]);

  // Step handlers
  const handleLocationContinue = () => {
    setStep('providers');
    fetchProviders();
  };

  const handleSelectProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setVisitType(provider.videoVisitAvailable ? 'video' : 'in_person');
    setStep('booking');
  };

  const handleDownloadCalendar = () => {
    if (appointment) {
      downloadICSFile(appointment);
    }
  };

  // Get step title
  const getStepTitle = () => {
    switch (step) {
      case 'location':
        return 'Find Doctors';
      case 'providers':
        return 'Select Provider';
      case 'booking':
        return 'Book Appointment';
      case 'confirmation':
        return 'Confirmation';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {step === 'location' && (
              <LocationStep
                location={location}
                radius={radius}
                onLocationChange={(partial) =>
                  setLocation((prev) => ({ ...prev, ...partial }))
                }
                onRadiusChange={setRadius}
                onUseMyLocation={handleUseMyLocation}
                onContinue={handleLocationContinue}
              />
            )}

            {step === 'providers' && (
              <ProviderListStep
                providers={providers}
                loading={providersLoading}
                filters={filters}
                onFilterChange={(partial) =>
                  setFilters((prev) => ({ ...prev, ...partial }))
                }
                onSelectProvider={handleSelectProvider}
                onBack={() => setStep('location')}
              />
            )}

            {step === 'booking' && selectedProvider && (
              <BookingStep
                provider={selectedProvider}
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                visitType={visitType}
                onDateChange={setSelectedDate}
                onTimeChange={setSelectedTime}
                onVisitTypeChange={setVisitType}
                onConfirm={handleBookAppointment}
                onBack={() => setStep('providers')}
                loading={bookingLoading}
              />
            )}

            {step === 'confirmation' && appointment && selectedProvider && (
              <ConfirmationStep
                appointment={appointment}
                provider={selectedProvider}
                sendSMS={sendSMS}
                sendEmail={sendEmail}
                onSMSChange={setSendSMS}
                onEmailChange={setSendEmail}
                onDownloadCalendar={handleDownloadCalendar}
                onClose={onClose}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export default DoctorBookingModal;
