// International Emergency & Crisis Helpline Numbers
// Reference for Healthcare AI Triage Systems
// Last Updated: January 2026

export interface EmergencyNumbers {
  country: string;
  countryCode: string;
  emergency: string;
  police?: string;
  ambulance?: string;
  fire?: string;
  crisisLine?: string;
  crisisName?: string;
  crisisNote?: string;
  additionalLines?: Array<{
    name: string;
    number: string;
    note?: string;
  }>;
}

export const EMERGENCY_NUMBERS: EmergencyNumbers[] = [
  // USA
  {
    country: 'United States',
    countryCode: 'US',
    emergency: '911',
    crisisLine: '988',
    crisisName: 'Suicide & Crisis Lifeline',
    crisisNote: 'Call or text 988 (24/7)',
    additionalLines: [
      { name: 'Crisis Text Line', number: 'Text HOME to 741741', note: '24/7' },
      { name: 'Veterans Crisis Line', number: '988, Press 1' },
      { name: 'SAMHSA Helpline', number: '1-800-662-4357', note: 'Substance abuse' },
      { name: 'National Domestic Violence', number: '1-800-799-7233' },
    ]
  },
  // United Kingdom
  {
    country: 'United Kingdom',
    countryCode: 'GB',
    emergency: '999 or 112',
    crisisLine: '116 123',
    crisisName: 'Samaritans',
    crisisNote: '24/7, free',
    additionalLines: [
      { name: 'NHS Non-emergency', number: '111' },
      { name: 'Text Support', number: 'Text SHOUT to 85258', note: '24/7' },
      { name: 'Childline', number: '0800 1111', note: 'Under 19s' },
    ]
  },
  // European Union
  {
    country: 'European Union (General)',
    countryCode: 'EU',
    emergency: '112',
    crisisNote: 'Works in all EU countries from any phone, free of charge',
  },
  // Switzerland
  {
    country: 'Switzerland',
    countryCode: 'CH',
    emergency: '112',
    police: '117',
    ambulance: '144',
    fire: '118',
    crisisLine: '143',
    crisisName: 'Die Dargebotene Hand',
    crisisNote: '24/7, DE/FR/IT',
    additionalLines: [
      { name: 'Youth Line (under 25)', number: '147', note: 'Pro Juventute, 24/7' },
      { name: 'English Support', number: '0800 143 000', note: 'Heart2Heart' },
    ]
  },
  // Germany
  {
    country: 'Germany',
    countryCode: 'DE',
    emergency: '112',
    police: '110',
    crisisLine: '0800 111 0 111',
    crisisName: 'TelefonSeelsorge',
    crisisNote: '24/7, free',
    additionalLines: [
      { name: 'Alternative', number: '0800 111 0 222' },
      { name: 'Children/Youth', number: '0800 111 0 333', note: 'Nummer gegen Kummer' },
    ]
  },
  // France
  {
    country: 'France',
    countryCode: 'FR',
    emergency: '112',
    ambulance: '15',
    police: '17',
    fire: '18',
    crisisLine: '3114',
    crisisName: 'National Suicide Prevention',
    crisisNote: '24/7',
    additionalLines: [
      { name: 'SOS Help (English)', number: '01 46 21 46 46' },
    ]
  },
  // Spain
  {
    country: 'Spain',
    countryCode: 'ES',
    emergency: '112',
    police: '091',
    crisisLine: '024',
    crisisName: 'National Suicide Prevention',
    crisisNote: '24/7',
    additionalLines: [
      { name: 'Teléfono de la Esperanza', number: '717 003 717' },
      { name: 'Children/Youth', number: '116 111', note: 'ANAR' },
    ]
  },
  // Italy
  {
    country: 'Italy',
    countryCode: 'IT',
    emergency: '112',
    police: '113',
    ambulance: '118',
    fire: '115',
    crisisLine: '800 86 00 22',
    crisisName: 'Samaritans ONLUS',
    additionalLines: [
      { name: 'Telefono Amico', number: '199 284 284' },
      { name: 'Youth (Telefono Azzurro)', number: '19696' },
    ]
  },
  // Netherlands
  {
    country: 'Netherlands',
    countryCode: 'NL',
    emergency: '112',
    crisisLine: '0800-0113',
    crisisName: '113 Zelfmoordpreventie',
    crisisNote: '24/7, free',
  },
  // Belgium
  {
    country: 'Belgium',
    countryCode: 'BE',
    emergency: '112',
    police: '101',
    crisisLine: '1813',
    crisisName: 'Zelfmoord Lijn',
    crisisNote: 'Dutch, 24/7',
    additionalLines: [
      { name: 'Crisis Line (French)', number: '0800 32 123', note: 'Centre de Prévention du Suicide' },
    ]
  },
  // Austria
  {
    country: 'Austria',
    countryCode: 'AT',
    emergency: '112',
    ambulance: '144',
    police: '133',
    fire: '122',
    crisisLine: '142',
    crisisName: 'TelefonSeelsorge',
    crisisNote: '24/7',
    additionalLines: [
      { name: 'Youth Line', number: '147', note: 'Rat auf Draht' },
    ]
  },
  // Portugal
  {
    country: 'Portugal',
    countryCode: 'PT',
    emergency: '112',
    crisisLine: '(+351) 225 50 60 70',
    crisisName: 'Voz de Apoio',
    additionalLines: [
      { name: 'SNS24 Health Line', number: '808 24 24 24' },
    ]
  },
  // Ireland
  {
    country: 'Ireland',
    countryCode: 'IE',
    emergency: '112 or 999',
    crisisLine: '116 123',
    crisisName: 'Samaritans',
    crisisNote: '24/7, free',
    additionalLines: [
      { name: 'Text Support', number: 'Text HELLO to 50808', note: '24/7' },
      { name: 'Pieta House', number: '1800 247 247', note: 'Suicide/self-harm support' },
    ]
  },
  // UAE
  {
    country: 'United Arab Emirates',
    countryCode: 'AE',
    emergency: '999',
    police: '999',
    ambulance: '998',
    fire: '997',
    crisisLine: '800-4673',
    crisisName: 'National Mental Support Line',
    crisisNote: '8am-8pm',
    additionalLines: [
      { name: 'MOHAP Mental Health', number: '800 4673', note: '24/7' },
    ]
  },
  // Mexico
  {
    country: 'Mexico',
    countryCode: 'MX',
    emergency: '911',
    crisisLine: '800 911 2000',
    crisisName: 'Línea de la Vida',
    crisisNote: '24/7, free',
    additionalLines: [
      { name: 'WhatsApp', number: '55 5533 5533' },
    ]
  },
  // Brazil
  {
    country: 'Brazil',
    countryCode: 'BR',
    emergency: '190',
    ambulance: '192',
    fire: '193',
    crisisLine: '188',
    crisisName: 'CVV - Centro de Valorização da Vida',
    crisisNote: '24/7',
  },
  // Argentina
  {
    country: 'Argentina',
    countryCode: 'AR',
    emergency: '101',
    ambulance: '107',
    fire: '100',
    crisisLine: '135',
    crisisName: 'Centro de Asistencia al Suicida',
    crisisNote: 'Buenos Aires',
  },
  // Colombia
  {
    country: 'Colombia',
    countryCode: 'CO',
    emergency: '123',
    crisisLine: '106',
    crisisName: 'Línea 106',
    crisisNote: '24/7',
  },
  // Chile
  {
    country: 'Chile',
    countryCode: 'CL',
    emergency: '131',
    police: '133',
    fire: '132',
    crisisLine: '*4141',
    crisisName: 'No Estás Solo',
    crisisNote: 'Mobile',
  },
  // Australia
  {
    country: 'Australia',
    countryCode: 'AU',
    emergency: '000',
    crisisLine: '13 11 14',
    crisisName: 'Lifeline',
    crisisNote: '24/7',
    additionalLines: [
      { name: 'Beyond Blue', number: '1300 22 4636' },
      { name: 'Kids Helpline', number: '1800 55 1800' },
    ]
  },
  // Canada
  {
    country: 'Canada',
    countryCode: 'CA',
    emergency: '911',
    crisisLine: '988',
    crisisName: 'Suicide Crisis Helpline',
    crisisNote: '24/7',
    additionalLines: [
      { name: 'Crisis Text Line', number: 'Text HELLO to 686868' },
      { name: 'Kids Help Phone', number: '1-800-668-6868' },
    ]
  },
  // India
  {
    country: 'India',
    countryCode: 'IN',
    emergency: '112',
    police: '100',
    ambulance: '102',
    fire: '101',
    crisisLine: '9152987821',
    crisisName: 'iCall',
    crisisNote: 'Mon-Sat 8am-10pm',
    additionalLines: [
      { name: 'Vandrevala Foundation', number: '1860-2662-345' },
    ]
  },
  // Japan
  {
    country: 'Japan',
    countryCode: 'JP',
    emergency: '110',
    ambulance: '119',
    fire: '119',
    crisisLine: '0570-064-556',
    crisisName: 'Yorisoi Hotline',
    crisisNote: '24/7',
  },
  // South Korea
  {
    country: 'South Korea',
    countryCode: 'KR',
    emergency: '112',
    ambulance: '119',
    fire: '119',
    crisisLine: '1393',
    crisisName: 'Suicide Prevention Hotline',
    crisisNote: '24/7',
  },
  // Singapore
  {
    country: 'Singapore',
    countryCode: 'SG',
    emergency: '999',
    ambulance: '995',
    fire: '995',
    crisisLine: '1800-221-4444',
    crisisName: 'Samaritans of Singapore',
    crisisNote: '24/7',
  },
  // New Zealand
  {
    country: 'New Zealand',
    countryCode: 'NZ',
    emergency: '111',
    crisisLine: '1737',
    crisisName: 'Need to Talk?',
    crisisNote: '24/7, call or text',
    additionalLines: [
      { name: 'Lifeline', number: '0800 543 354' },
    ]
  },
  // South Africa
  {
    country: 'South Africa',
    countryCode: 'ZA',
    emergency: '10111',
    ambulance: '10177',
    crisisLine: '0800 567 567',
    crisisName: 'SADAG',
    crisisNote: '24/7',
  },
];

export const SPECIALISTS = [
  { value: 'general', labelKey: 'ghost.health.scheduling.specialists.general' },
  { value: 'cardiology', labelKey: 'ghost.health.scheduling.specialists.cardiology' },
  { value: 'dermatology', labelKey: 'ghost.health.scheduling.specialists.dermatology' },
  { value: 'endocrinology', labelKey: 'ghost.health.scheduling.specialists.endocrinology' },
  { value: 'gastroenterology', labelKey: 'ghost.health.scheduling.specialists.gastroenterology' },
  { value: 'neurology', labelKey: 'ghost.health.scheduling.specialists.neurology' },
  { value: 'oncology', labelKey: 'ghost.health.scheduling.specialists.oncology' },
  { value: 'orthopedics', labelKey: 'ghost.health.scheduling.specialists.orthopedics' },
  { value: 'pediatrics', labelKey: 'ghost.health.scheduling.specialists.pediatrics' },
  { value: 'psychiatry', labelKey: 'ghost.health.scheduling.specialists.psychiatry' },
  { value: 'pulmonology', labelKey: 'ghost.health.scheduling.specialists.pulmonology' },
  { value: 'urology', labelKey: 'ghost.health.scheduling.specialists.urology' },
  { value: 'gynecology', labelKey: 'ghost.health.scheduling.specialists.gynecology' },
  { value: 'ophthalmology', labelKey: 'ghost.health.scheduling.specialists.ophthalmology' },
  { value: 'otolaryngology', labelKey: 'ghost.health.scheduling.specialists.otolaryngology' },
  { value: 'rheumatology', labelKey: 'ghost.health.scheduling.specialists.rheumatology' },
];

export const APPOINTMENT_REASONS = [
  { value: 'consultation', labelKey: 'ghost.health.scheduling.reasons.consultation' },
  { value: 'prescription', labelKey: 'ghost.health.scheduling.reasons.prescription' },
  { value: 'medical_exam', labelKey: 'ghost.health.scheduling.reasons.medical_exam' },
  { value: 'follow_up', labelKey: 'ghost.health.scheduling.reasons.follow_up' },
  { value: 'second_opinion', labelKey: 'ghost.health.scheduling.reasons.second_opinion' },
  { value: 'other', labelKey: 'ghost.health.scheduling.reasons.other' },
];
