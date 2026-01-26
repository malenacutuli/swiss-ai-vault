import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  UserRound,
  Phone,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Globe,
  Calendar,
  X,
  Heart,
  MessageCircle,
  CheckCircle2,
  Shield,
  Siren,
} from '@/icons';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  EMERGENCY_NUMBERS, 
  SPECIALISTS, 
  APPOINTMENT_REASONS,
  type EmergencyNumbers 
} from './EmergencyNumbersData';
import { toast } from 'sonner';

interface HumanProfessionalModalProps {
  onClose: () => void;
  userCountry?: string;
}

type TabType = 'emergency' | 'schedule';

const schedulingFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(5, 'Phone number is required'),
  country: z.string().min(1, 'Country is required'),
  city: z.string().min(1, 'City is required'),
  specialist: z.string().min(1, 'Specialist type is required'),
  reason: z.string().min(1, 'Reason is required'),
  otherDetails: z.string().optional(),
  preferredDate: z.string().optional(),
  additionalNotes: z.string().optional(),
});

type SchedulingFormData = z.infer<typeof schedulingFormSchema>;

export function HumanProfessionalModal({ onClose, userCountry }: HumanProfessionalModalProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('emergency');
  const [selectedCountry, setSelectedCountry] = useState<string>(userCountry || 'US');
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<SchedulingFormData>({
    resolver: zodResolver(schedulingFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      country: userCountry || '',
      city: '',
      specialist: '',
      reason: '',
      otherDetails: '',
      preferredDate: '',
      additionalNotes: '',
    },
  });

  const watchReason = form.watch('reason');

  // Get currently selected country's emergency info
  const currentCountryInfo = useMemo(() => {
    return EMERGENCY_NUMBERS.find(c => c.countryCode === selectedCountry) || EMERGENCY_NUMBERS[0];
  }, [selectedCountry]);

  // Priority countries to show first
  const priorityCountries = useMemo(() => {
    const priorityCodes = ['US', 'GB', 'EU', 'CH', 'DE', 'FR', 'ES', 'CA', 'AU'];
    return EMERGENCY_NUMBERS.filter(c => priorityCodes.includes(c.countryCode));
  }, []);

  const otherCountries = useMemo(() => {
    const priorityCodes = ['US', 'GB', 'EU', 'CH', 'DE', 'FR', 'ES', 'CA', 'AU'];
    return EMERGENCY_NUMBERS.filter(c => !priorityCodes.includes(c.countryCode));
  }, []);

  const displayedCountries = showAllCountries 
    ? EMERGENCY_NUMBERS 
    : priorityCountries;

  const onSubmit = async (data: SchedulingFormData) => {
    setIsSubmitting(true);
    try {
      // TODO: Send to backend/email service
      console.log('Scheduling request:', data);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setIsSubmitted(true);
      toast.success(t('ghost.health.scheduling.success', 'Your appointment request has been submitted!'));
    } catch (error) {
      console.error('Scheduling error:', error);
      toast.error(t('ghost.health.scheduling.error', 'Failed to submit request. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderEmergencyTab = () => (
    <div className="space-y-4">
      {/* Country Selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          {t('ghost.health.emergency.selectCountry', 'Select Your Country')}
        </Label>
        <Select value={selectedCountry} onValueChange={setSelectedCountry}>
          <SelectTrigger className="w-full bg-white">
            <SelectValue placeholder={t('ghost.health.emergency.selectCountryPlaceholder', 'Select a country')} />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] bg-white z-[100]">
            {displayedCountries.map((country) => (
              <SelectItem key={country.countryCode} value={country.countryCode}>
                <span className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span>{country.country}</span>
                </span>
              </SelectItem>
            ))}
            {!showAllCountries && otherCountries.length > 0 && (
              <div 
                className="px-2 py-1.5 text-sm text-[#2A8C86] cursor-pointer hover:bg-slate-50 flex items-center gap-1"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAllCountries(true);
                }}
              >
                <ChevronDown className="w-4 h-4" />
                {t('ghost.health.emergency.showMore', 'Show all countries')} ({otherCountries.length})
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Current Country Emergency Numbers */}
      {currentCountryInfo && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Globe className="w-6 h-6 text-[#1D4E5F]" />
            <span>{currentCountryInfo.country}</span>
          </div>

          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 text-red-700 font-bold text-lg">
              <Siren className="w-5 h-5" />
              <span>{t('ghost.health.emergency.emergency', 'EMERGENCY')}: {currentCountryInfo.emergency}</span>
            </div>
            {currentCountryInfo.police && (
              <p className="text-sm text-red-600 mt-1">
                {t('ghost.health.emergency.police', 'Police')}: {currentCountryInfo.police} | 
                {currentCountryInfo.ambulance && ` ${t('ghost.health.emergency.ambulance', 'Ambulance')}: ${currentCountryInfo.ambulance}`}
                {currentCountryInfo.fire && ` | ${t('ghost.health.emergency.fire', 'Fire')}: ${currentCountryInfo.fire}`}
              </p>
            )}
          </div>

          {currentCountryInfo.crisisLine && (
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 text-purple-700 font-semibold">
                <Phone className="w-4 h-4" />
                <span>{t('ghost.health.emergency.crisisLine', 'Crisis Line')}: {currentCountryInfo.crisisLine}</span>
              </div>
              {currentCountryInfo.crisisName && (
                <p className="text-sm text-purple-600 mt-1">{currentCountryInfo.crisisName}</p>
              )}
              {currentCountryInfo.crisisNote && (
                <p className="text-xs text-purple-500 mt-0.5">{currentCountryInfo.crisisNote}</p>
              )}
            </div>
          )}

          {/* Additional Lines */}
          {currentCountryInfo.additionalLines && currentCountryInfo.additionalLines.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {t('ghost.health.emergency.additionalResources', 'Additional Resources')}
              </p>
              {currentCountryInfo.additionalLines.map((line, idx) => (
                <div key={idx} className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{line.name}</span>
                    <span className="text-sm font-semibold text-[#2A8C86]">{line.number}</span>
                  </div>
                  {line.note && (
                    <p className="text-xs text-slate-500 mt-0.5">{line.note}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legal Disclaimer */}
      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
        <div className="flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-800">
              {t('ghost.health.emergency.disclaimer.title', 'Legal Disclaimer')}
            </p>
            <p className="text-xs text-amber-700 mt-1">
              {t('ghost.health.emergency.disclaimer.text', 
                'This information is provided for reference purposes only. Emergency numbers should be verified before use as crisis services may change contact information without notice. If you are experiencing a medical emergency, please call your local emergency services immediately. This AI system cannot provide emergency assistance or make emergency calls on your behalf.'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSchedulingTab = () => {
    if (isSubmitted) {
      return (
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            {t('ghost.health.scheduling.successTitle', 'Request Submitted!')}
          </h3>
          <p className="text-sm text-slate-600 max-w-sm mx-auto">
            {t('ghost.health.scheduling.successMessage', 
              'Your appointment request has been submitted. A healthcare coordinator will contact you within 24-48 hours to confirm your appointment.'
            )}
          </p>
          <Button onClick={onClose} className="bg-[#2A8C86] hover:bg-[#2A8C86]/90">
            {t('common.close', 'Close')}
          </Button>
        </div>
      );
    }

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Personal Details Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <UserRound className="w-4 h-4" />
              {t('ghost.health.scheduling.personalDetails', 'Personal Details')}
            </h4>
            
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{t('ghost.health.scheduling.firstName', 'First Name')} *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="John" className="h-9 text-sm" />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{t('ghost.health.scheduling.lastName', 'Last Name')} *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Doe" className="h-9 text-sm" />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{t('ghost.health.scheduling.email', 'Email')} *</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="john@example.com" className="h-9 text-sm" />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{t('ghost.health.scheduling.phone', 'Phone')} *</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" placeholder="+1 555 123 4567" className="h-9 text-sm" />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Location Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {t('ghost.health.scheduling.location', 'Location')}
            </h4>
            
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{t('ghost.health.scheduling.country', 'Country')} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9 text-sm bg-white">
                          <SelectValue placeholder={t('ghost.health.scheduling.selectCountry', 'Select country')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[200px] bg-white z-[100]">
                        {EMERGENCY_NUMBERS.map((country) => (
                          <SelectItem key={country.countryCode} value={country.country}>
                            <span className="flex items-center gap-2">
                              <Globe className="w-4 h-4 text-muted-foreground" />
                              <span>{country.country}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{t('ghost.health.scheduling.city', 'City')} *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="New York" className="h-9 text-sm" />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Appointment Details Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {t('ghost.health.scheduling.appointmentDetails', 'Appointment Details')}
            </h4>

            <FormField
              control={form.control}
              name="specialist"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">{t('ghost.health.scheduling.specialist', 'Specialist')} *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-sm bg-white">
                        <SelectValue placeholder={t('ghost.health.scheduling.selectSpecialist', 'Select specialist type')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white z-[100]">
                      {SPECIALISTS.map((spec) => (
                        <SelectItem key={spec.value} value={spec.value}>
                          {t(spec.labelKey, spec.value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">{t('ghost.health.scheduling.reason', 'Reason for Visit')} *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-sm bg-white">
                        <SelectValue placeholder={t('ghost.health.scheduling.selectReason', 'Select reason')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white z-[100]">
                      {APPOINTMENT_REASONS.map((reason) => (
                        <SelectItem key={reason.value} value={reason.value}>
                          {t(reason.labelKey, reason.value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {watchReason === 'other' && (
              <FormField
                control={form.control}
                name="otherDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{t('ghost.health.scheduling.otherDetails', 'Please specify')} *</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder={t('ghost.health.scheduling.otherDetailsPlaceholder', 'Describe your reason for the appointment...')}
                        className="min-h-[60px] text-sm resize-none"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="preferredDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">{t('ghost.health.scheduling.preferredDate', 'Preferred Date (optional)')}</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" className="h-9 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="additionalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">{t('ghost.health.scheduling.additionalNotes', 'Additional Notes (optional)')}</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder={t('ghost.health.scheduling.additionalNotesPlaceholder', 'Any additional information for the doctor...')}
                      className="min-h-[60px] text-sm resize-none"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* Privacy Notice */}
          <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex gap-2 items-start">
              <Shield className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600">
                {t('ghost.health.scheduling.privacyNotice', 
                  'Your information is encrypted and handled according to HIPAA requirements. We will only use it to arrange your appointment.'
                )}
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full bg-[#2A8C86] hover:bg-[#2A8C86]/90"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('ghost.health.scheduling.submitting', 'Submitting...')}
              </span>
            ) : (
              t('ghost.health.scheduling.submit', 'Submit Appointment Request')
            )}
          </Button>
        </form>
      </Form>
    );
  };

  return (
    <Card className="p-0 bg-white shadow-xl border-slate-200 max-w-lg mx-auto max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-[#2A8C86]/10 to-emerald-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#2A8C86]/20 rounded-full flex items-center justify-center">
            <UserRound className="w-5 h-5 text-[#2A8C86]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {t('ghost.health.humanProfessional.title', 'Connect with a Healthcare Professional')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('ghost.health.humanProfessional.subtitle', 'Emergency resources & appointment scheduling')}
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('emergency')}
          className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'emergency'
              ? 'text-[#2A8C86] border-b-2 border-[#2A8C86] bg-[#2A8C86]/5'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Phone className="w-4 h-4" />
          {t('ghost.health.tabs.emergency', 'Emergency Numbers')}
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'schedule'
              ? 'text-[#2A8C86] border-b-2 border-[#2A8C86] bg-[#2A8C86]/5'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar className="w-4 h-4" />
          {t('ghost.health.tabs.schedule', 'Schedule Session')}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'emergency' ? renderEmergencyTab() : renderSchedulingTab()}
      </div>

      {/* Footer */}
      {activeTab === 'emergency' && (
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <Button onClick={onClose} variant="outline" className="w-full">
            {t('common.close', 'Close')}
          </Button>
        </div>
      )}
    </Card>
  );
}
