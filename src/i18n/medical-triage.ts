/**
 * HELIOS Medical Triage Internationalization
 * Comprehensive translations for EN/ES/FR
 *
 * Includes:
 * - Assessment Panel UI
 * - OLDCARTS prompts
 * - ESI Level descriptions
 * - Medical disclaimers
 * - Chat messages
 * - Booking flows
 * - Error messages
 */

import { useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export type TriageLanguage = 'en' | 'es' | 'fr';

export interface TriageTranslations {
  // Assessment Panel
  assessmentPanel: {
    title: string;
    seeDoctor: string;
    videoVisits: string;
    insurance: string;
    prescription: string;
    seeDoctorCTA: string;
    videoAvailable: string;
    feedbackPrompt: string;
    notHelpful: string;
    soSo: string;
    helpful: string;
    assessmentPlan: string;
    differentialDiagnosis: string;
    mostLikely: string;
    leastLikely: string;
    confidence: string;
    planOfAction: string;
    labTests: string;
    imaging: string;
    referrals: string;
    medications: string;
    followUp: string;
    soapNote: string;
    soapForPhysicians: string;
    downloadPDF: string;
    share: string;
    print: string;
    generatedAt: string;
    aiDisclaimer: string;
  };

  // SOAP Note sections
  soapNote: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    chiefComplaint: string;
    historyOfPresentIllness: string;
    reviewOfSystems: string;
    pastMedicalHistory: string;
    medications: string;
    allergies: string;
    socialHistory: string;
    familyHistory: string;
    vitalSigns: string;
    physicalExam: string;
    diagnosticResults: string;
    primaryDiagnosis: string;
    differentialDiagnoses: string;
    diagnosticPlan: string;
    treatmentPlan: string;
    patientEducation: string;
    disposition: string;
  };

  // OLDCARTS prompts
  oldcarts: {
    onset: string;
    onsetFollowUp: string;
    location: string;
    locationFollowUp: string;
    duration: string;
    durationFollowUp: string;
    character: string;
    characterFollowUp: string;
    aggravating: string;
    aggravatingFollowUp: string;
    relieving: string;
    relievingFollowUp: string;
    timing: string;
    timingFollowUp: string;
    severity: string;
    severityFollowUp: string;
    progress: string;
    complete: string;
    partial: string;
    missing: string;
  };

  // ESI Levels
  esi: {
    level1: string;
    level1Description: string;
    level2: string;
    level2Description: string;
    level3: string;
    level3Description: string;
    level4: string;
    level4Description: string;
    level5: string;
    level5Description: string;
    callEmergency: string;
    emergencyNumber: string;
  };

  // Disclaimers
  disclaimers: {
    main: string;
    emergency: string;
    notDiagnosis: string;
    aiGenerated: string;
    confidentiality: string;
    accuracy: string;
    medicalAdvice: string;
  };

  // Chat messages
  chat: {
    welcome: string;
    askChiefComplaint: string;
    thankYou: string;
    gatheringInfo: string;
    assessmentReady: string;
    anythingElse: string;
    goodbye: string;
    typing: string;
    sendMessage: string;
    placeholder: string;
    attachFile: string;
    voiceInput: string;
    endSession: string;
    startNew: string;
    saveConsult: string;
  };

  // Booking
  booking: {
    title: string;
    findProvider: string;
    useLocation: string;
    enterAddress: string;
    searchRadius: string;
    miles: string;
    availableProviders: string;
    noProvidersFound: string;
    selectProvider: string;
    selectDate: string;
    selectTime: string;
    visitType: string;
    videoVisit: string;
    inPerson: string;
    confirmBooking: string;
    bookingConfirmed: string;
    confirmationCode: string;
    addToCalendar: string;
    emailConfirmation: string;
    smsReminder: string;
    appointmentDetails: string;
    provider: string;
    specialty: string;
    location: string;
    dateTime: string;
    price: string;
    insuranceAccepted: string;
    rating: string;
    reviews: string;
    waitTime: string;
    nextAvailable: string;
    videoAvailable: string;
  };

  // Symptoms and body parts
  symptoms: {
    headache: string;
    chestPain: string;
    abdominalPain: string;
    backPain: string;
    fever: string;
    cough: string;
    shortnessOfBreath: string;
    dizziness: string;
    nausea: string;
    fatigue: string;
    pain: string;
    swelling: string;
    rash: string;
    weakness: string;
    numbness: string;
  };

  // Actions and buttons
  actions: {
    continue: string;
    back: string;
    cancel: string;
    confirm: string;
    submit: string;
    save: string;
    close: string;
    retry: string;
    learnMore: string;
    viewDetails: string;
    expand: string;
    collapse: string;
    filter: string;
    sort: string;
    search: string;
    clear: string;
  };

  // Errors
  errors: {
    generic: string;
    network: string;
    timeout: string;
    sessionExpired: string;
    invalidInput: string;
    locationFailed: string;
    bookingFailed: string;
    loadingFailed: string;
    tryAgain: string;
  };

  // Time and dates
  time: {
    now: string;
    today: string;
    tomorrow: string;
    minutes: string;
    hours: string;
    days: string;
    weeks: string;
    ago: string;
    in: string;
    at: string;
  };
}

// ============================================================================
// English Translations
// ============================================================================

const en: TriageTranslations = {
  assessmentPanel: {
    title: 'AI Consult Summary',
    seeDoctor: 'We Recommend You See a Doctor Now',
    videoVisits: 'Video visits starting at $39',
    insurance: 'Most insurance accepted',
    prescription: 'Get a prescription in as little as 30 minutes',
    seeDoctorCTA: 'See a Doctor',
    videoAvailable: 'Video appointments available immediately',
    feedbackPrompt: 'Was this helpful?',
    notHelpful: 'Not Helpful',
    soSo: 'So-So',
    helpful: 'Helpful',
    assessmentPlan: 'Assessment & Plan',
    differentialDiagnosis: 'Differential Diagnosis',
    mostLikely: 'Most Likely',
    leastLikely: 'Least Likely',
    confidence: 'Confidence',
    planOfAction: 'Plan of Action for Confirming Diagnosis',
    labTests: 'Laboratory Tests',
    imaging: 'Imaging Studies',
    referrals: 'Referrals',
    medications: 'Medications',
    followUp: 'Follow-up',
    soapNote: 'SOAP Note',
    soapForPhysicians: 'SOAP Note (for Physicians)',
    downloadPDF: 'Download PDF',
    share: 'Share',
    print: 'Print',
    generatedAt: 'Generated at',
    aiDisclaimer: 'AI-generated assessment for informational purposes only',
  },

  soapNote: {
    subjective: 'Subjective',
    objective: 'Objective',
    assessment: 'Assessment',
    plan: 'Plan',
    chiefComplaint: 'Chief Complaint',
    historyOfPresentIllness: 'History of Present Illness',
    reviewOfSystems: 'Review of Systems',
    pastMedicalHistory: 'Past Medical History',
    medications: 'Current Medications',
    allergies: 'Allergies',
    socialHistory: 'Social History',
    familyHistory: 'Family History',
    vitalSigns: 'Vital Signs',
    physicalExam: 'Physical Examination',
    diagnosticResults: 'Diagnostic Results',
    primaryDiagnosis: 'Primary Diagnosis',
    differentialDiagnoses: 'Differential Diagnoses',
    diagnosticPlan: 'Diagnostic Plan',
    treatmentPlan: 'Treatment Plan',
    patientEducation: 'Patient Education',
    disposition: 'Disposition',
  },

  oldcarts: {
    onset: 'When did this start?',
    onsetFollowUp: 'Was the onset sudden or gradual?',
    location: 'Where exactly do you feel it?',
    locationFollowUp: 'Does it stay in one place or move around?',
    duration: 'Is it constant or does it come and go?',
    durationFollowUp: 'How long does each episode last?',
    character: 'How would you describe the feeling?',
    characterFollowUp: 'Is it sharp, dull, burning, or aching?',
    aggravating: 'What makes it worse?',
    aggravatingFollowUp: 'Does movement, eating, or anything else make it worse?',
    relieving: 'What makes it better?',
    relievingFollowUp: 'Does rest, medication, or anything else help?',
    timing: 'When does it typically occur?',
    timingFollowUp: 'Is it worse at a particular time of day?',
    severity: 'On a scale of 0-10, how severe is it?',
    severityFollowUp: 'How does this compare to the worst pain you\'ve ever had?',
    progress: 'Symptom Assessment Progress',
    complete: 'Complete',
    partial: 'Partial',
    missing: 'Not yet collected',
  },

  esi: {
    level1: 'EMERGENCY - Call 911 Immediately',
    level1Description: 'Requires immediate life-saving intervention. Do not delay.',
    level2: 'URGENT - Seek Immediate Medical Attention',
    level2Description: 'High-risk situation that should not wait. Go to the ER now.',
    level3: 'Urgent - See a Doctor Today',
    level3Description: 'Requires medical evaluation today. Multiple resources likely needed.',
    level4: 'Less Urgent - Schedule an Appointment Soon',
    level4Description: 'Can be seen within a few days. One resource expected.',
    level5: 'Non-Urgent - Self-Care May Be Appropriate',
    level5Description: 'May not need emergency resources. Consider telemedicine or self-care.',
    callEmergency: 'Call Emergency Services',
    emergencyNumber: '911',
  },

  disclaimers: {
    main: 'This information is for educational purposes only and is NOT a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider.',
    emergency: 'If you think you may have a medical emergency, call 911 immediately.',
    notDiagnosis: 'This assessment is not a diagnosis. Please consult a healthcare professional for proper evaluation.',
    aiGenerated: 'This content was generated by AI and should be reviewed by a healthcare professional.',
    confidentiality: 'Your health information is kept confidential and secure.',
    accuracy: 'While we strive for accuracy, AI assessments may contain errors.',
    medicalAdvice: 'Do not disregard professional medical advice or delay seeking it because of something you read here.',
  },

  chat: {
    welcome: 'Hello! I\'m your HELIOS health assistant. I\'m here to help understand your symptoms and guide you to the right care.',
    askChiefComplaint: 'What brings you in today? Please describe your main concern.',
    thankYou: 'Thank you for sharing that information.',
    gatheringInfo: 'I\'m gathering more information to better understand your situation.',
    assessmentReady: 'Based on our conversation, I\'ve prepared an assessment for you.',
    anythingElse: 'Is there anything else you\'d like to share?',
    goodbye: 'Take care and feel better soon!',
    typing: 'Typing...',
    sendMessage: 'Send message',
    placeholder: 'Type your message here...',
    attachFile: 'Attach a file',
    voiceInput: 'Voice input',
    endSession: 'End Session',
    startNew: 'Start New Consult',
    saveConsult: 'Save Consult',
  },

  booking: {
    title: 'Book an Appointment',
    findProvider: 'Find Providers Near You',
    useLocation: 'Use my current location',
    enterAddress: 'Enter address or ZIP code',
    searchRadius: 'Search radius',
    miles: 'miles',
    availableProviders: 'Available Providers',
    noProvidersFound: 'No providers found in your area',
    selectProvider: 'Select Provider',
    selectDate: 'Select Date',
    selectTime: 'Select Time',
    visitType: 'Visit Type',
    videoVisit: 'Video Visit',
    inPerson: 'In-Person',
    confirmBooking: 'Confirm Booking',
    bookingConfirmed: 'Booking Confirmed!',
    confirmationCode: 'Confirmation Code',
    addToCalendar: 'Add to Calendar',
    emailConfirmation: 'Email confirmation',
    smsReminder: 'SMS reminder',
    appointmentDetails: 'Appointment Details',
    provider: 'Provider',
    specialty: 'Specialty',
    location: 'Location',
    dateTime: 'Date & Time',
    price: 'Price',
    insuranceAccepted: 'Insurance accepted',
    rating: 'Rating',
    reviews: 'reviews',
    waitTime: 'Avg. wait time',
    nextAvailable: 'Next available',
    videoAvailable: 'Video available',
  },

  symptoms: {
    headache: 'Headache',
    chestPain: 'Chest pain',
    abdominalPain: 'Abdominal pain',
    backPain: 'Back pain',
    fever: 'Fever',
    cough: 'Cough',
    shortnessOfBreath: 'Shortness of breath',
    dizziness: 'Dizziness',
    nausea: 'Nausea',
    fatigue: 'Fatigue',
    pain: 'Pain',
    swelling: 'Swelling',
    rash: 'Rash',
    weakness: 'Weakness',
    numbness: 'Numbness',
  },

  actions: {
    continue: 'Continue',
    back: 'Back',
    cancel: 'Cancel',
    confirm: 'Confirm',
    submit: 'Submit',
    save: 'Save',
    close: 'Close',
    retry: 'Retry',
    learnMore: 'Learn more',
    viewDetails: 'View details',
    expand: 'Expand',
    collapse: 'Collapse',
    filter: 'Filter',
    sort: 'Sort',
    search: 'Search',
    clear: 'Clear',
  },

  errors: {
    generic: 'Something went wrong. Please try again.',
    network: 'Network error. Please check your connection.',
    timeout: 'Request timed out. Please try again.',
    sessionExpired: 'Your session has expired. Please start a new consult.',
    invalidInput: 'Please check your input and try again.',
    locationFailed: 'Unable to get your location. Please enter it manually.',
    bookingFailed: 'Booking failed. Please try again or contact support.',
    loadingFailed: 'Failed to load data. Please refresh the page.',
    tryAgain: 'Please try again',
  },

  time: {
    now: 'Now',
    today: 'Today',
    tomorrow: 'Tomorrow',
    minutes: 'minutes',
    hours: 'hours',
    days: 'days',
    weeks: 'weeks',
    ago: 'ago',
    in: 'in',
    at: 'at',
  },
};

// ============================================================================
// Spanish Translations
// ============================================================================

const es: TriageTranslations = {
  assessmentPanel: {
    title: 'Resumen de Consulta con IA',
    seeDoctor: 'Le Recomendamos Ver a un Médico Ahora',
    videoVisits: 'Consultas por video desde $39',
    insurance: 'Se acepta la mayoría de seguros',
    prescription: 'Obtenga una receta en tan solo 30 minutos',
    seeDoctorCTA: 'Ver a un Médico',
    videoAvailable: 'Citas por video disponibles inmediatamente',
    feedbackPrompt: '¿Le fue útil?',
    notHelpful: 'No me ayudó',
    soSo: 'Regular',
    helpful: 'Útil',
    assessmentPlan: 'Evaluación y Plan',
    differentialDiagnosis: 'Diagnóstico Diferencial',
    mostLikely: 'Más Probable',
    leastLikely: 'Menos Probable',
    confidence: 'Confianza',
    planOfAction: 'Plan de Acción para Confirmar el Diagnóstico',
    labTests: 'Pruebas de Laboratorio',
    imaging: 'Estudios de Imagen',
    referrals: 'Derivaciones',
    medications: 'Medicamentos',
    followUp: 'Seguimiento',
    soapNote: 'Nota SOAP',
    soapForPhysicians: 'Nota SOAP (para Médicos)',
    downloadPDF: 'Descargar PDF',
    share: 'Compartir',
    print: 'Imprimir',
    generatedAt: 'Generado el',
    aiDisclaimer: 'Evaluación generada por IA solo con fines informativos',
  },

  soapNote: {
    subjective: 'Subjetivo',
    objective: 'Objetivo',
    assessment: 'Evaluación',
    plan: 'Plan',
    chiefComplaint: 'Motivo de Consulta',
    historyOfPresentIllness: 'Historia de la Enfermedad Actual',
    reviewOfSystems: 'Revisión por Sistemas',
    pastMedicalHistory: 'Antecedentes Médicos',
    medications: 'Medicamentos Actuales',
    allergies: 'Alergias',
    socialHistory: 'Historia Social',
    familyHistory: 'Antecedentes Familiares',
    vitalSigns: 'Signos Vitales',
    physicalExam: 'Examen Físico',
    diagnosticResults: 'Resultados Diagnósticos',
    primaryDiagnosis: 'Diagnóstico Principal',
    differentialDiagnoses: 'Diagnósticos Diferenciales',
    diagnosticPlan: 'Plan Diagnóstico',
    treatmentPlan: 'Plan de Tratamiento',
    patientEducation: 'Educación del Paciente',
    disposition: 'Disposición',
  },

  oldcarts: {
    onset: '¿Cuándo comenzó esto?',
    onsetFollowUp: '¿Fue el inicio repentino o gradual?',
    location: '¿Dónde exactamente lo siente?',
    locationFollowUp: '¿Se queda en un lugar o se mueve?',
    duration: '¿Es constante o va y viene?',
    durationFollowUp: '¿Cuánto dura cada episodio?',
    character: '¿Cómo describiría la sensación?',
    characterFollowUp: '¿Es agudo, sordo, ardiente o adolorido?',
    aggravating: '¿Qué lo empeora?',
    aggravatingFollowUp: '¿El movimiento, comer o algo más lo empeora?',
    relieving: '¿Qué lo mejora?',
    relievingFollowUp: '¿El descanso, medicamentos o algo más ayuda?',
    timing: '¿Cuándo ocurre típicamente?',
    timingFollowUp: '¿Es peor en algún momento particular del día?',
    severity: 'En una escala de 0-10, ¿qué tan severo es?',
    severityFollowUp: '¿Cómo se compara con el peor dolor que ha tenido?',
    progress: 'Progreso de Evaluación de Síntomas',
    complete: 'Completo',
    partial: 'Parcial',
    missing: 'Aún no recopilado',
  },

  esi: {
    level1: 'EMERGENCIA - Llame al 911 Inmediatamente',
    level1Description: 'Requiere intervención inmediata para salvar la vida. No demore.',
    level2: 'URGENTE - Busque Atención Médica Inmediata',
    level2Description: 'Situación de alto riesgo que no puede esperar. Vaya a urgencias ahora.',
    level3: 'Urgente - Vea a un Médico Hoy',
    level3Description: 'Requiere evaluación médica hoy. Probablemente necesite múltiples recursos.',
    level4: 'Menos Urgente - Programe una Cita Pronto',
    level4Description: 'Puede ser atendido en unos días. Se espera un recurso.',
    level5: 'No Urgente - El Autocuidado Puede Ser Apropiado',
    level5Description: 'Puede no necesitar recursos de emergencia. Considere telemedicina o autocuidado.',
    callEmergency: 'Llamar a Servicios de Emergencia',
    emergencyNumber: '911',
  },

  disclaimers: {
    main: 'Esta información es solo para fines educativos y NO sustituye el consejo, diagnóstico o tratamiento médico profesional. Siempre consulte a un proveedor de atención médica calificado.',
    emergency: 'Si cree que puede tener una emergencia médica, llame al 911 inmediatamente.',
    notDiagnosis: 'Esta evaluación no es un diagnóstico. Por favor consulte a un profesional de la salud para una evaluación adecuada.',
    aiGenerated: 'Este contenido fue generado por IA y debe ser revisado por un profesional de la salud.',
    confidentiality: 'Su información de salud se mantiene confidencial y segura.',
    accuracy: 'Si bien nos esforzamos por la precisión, las evaluaciones de IA pueden contener errores.',
    medicalAdvice: 'No ignore el consejo médico profesional ni demore en buscarlo por algo que lea aquí.',
  },

  chat: {
    welcome: '¡Hola! Soy su asistente de salud HELIOS. Estoy aquí para ayudarle a entender sus síntomas y guiarle hacia la atención adecuada.',
    askChiefComplaint: '¿Qué le trae hoy? Por favor describa su preocupación principal.',
    thankYou: 'Gracias por compartir esa información.',
    gatheringInfo: 'Estoy recopilando más información para entender mejor su situación.',
    assessmentReady: 'Basándome en nuestra conversación, he preparado una evaluación para usted.',
    anythingElse: '¿Hay algo más que le gustaría compartir?',
    goodbye: '¡Cuídese y recupérese pronto!',
    typing: 'Escribiendo...',
    sendMessage: 'Enviar mensaje',
    placeholder: 'Escriba su mensaje aquí...',
    attachFile: 'Adjuntar archivo',
    voiceInput: 'Entrada de voz',
    endSession: 'Terminar Sesión',
    startNew: 'Iniciar Nueva Consulta',
    saveConsult: 'Guardar Consulta',
  },

  booking: {
    title: 'Reservar una Cita',
    findProvider: 'Encontrar Proveedores Cerca de Usted',
    useLocation: 'Usar mi ubicación actual',
    enterAddress: 'Ingrese dirección o código postal',
    searchRadius: 'Radio de búsqueda',
    miles: 'millas',
    availableProviders: 'Proveedores Disponibles',
    noProvidersFound: 'No se encontraron proveedores en su área',
    selectProvider: 'Seleccionar Proveedor',
    selectDate: 'Seleccionar Fecha',
    selectTime: 'Seleccionar Hora',
    visitType: 'Tipo de Visita',
    videoVisit: 'Consulta por Video',
    inPerson: 'Presencial',
    confirmBooking: 'Confirmar Reserva',
    bookingConfirmed: '¡Reserva Confirmada!',
    confirmationCode: 'Código de Confirmación',
    addToCalendar: 'Agregar al Calendario',
    emailConfirmation: 'Confirmación por email',
    smsReminder: 'Recordatorio por SMS',
    appointmentDetails: 'Detalles de la Cita',
    provider: 'Proveedor',
    specialty: 'Especialidad',
    location: 'Ubicación',
    dateTime: 'Fecha y Hora',
    price: 'Precio',
    insuranceAccepted: 'Seguro aceptado',
    rating: 'Calificación',
    reviews: 'reseñas',
    waitTime: 'Tiempo de espera promedio',
    nextAvailable: 'Próxima disponibilidad',
    videoAvailable: 'Video disponible',
  },

  symptoms: {
    headache: 'Dolor de cabeza',
    chestPain: 'Dolor de pecho',
    abdominalPain: 'Dolor abdominal',
    backPain: 'Dolor de espalda',
    fever: 'Fiebre',
    cough: 'Tos',
    shortnessOfBreath: 'Dificultad para respirar',
    dizziness: 'Mareo',
    nausea: 'Náuseas',
    fatigue: 'Fatiga',
    pain: 'Dolor',
    swelling: 'Hinchazón',
    rash: 'Sarpullido',
    weakness: 'Debilidad',
    numbness: 'Entumecimiento',
  },

  actions: {
    continue: 'Continuar',
    back: 'Atrás',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    submit: 'Enviar',
    save: 'Guardar',
    close: 'Cerrar',
    retry: 'Reintentar',
    learnMore: 'Saber más',
    viewDetails: 'Ver detalles',
    expand: 'Expandir',
    collapse: 'Contraer',
    filter: 'Filtrar',
    sort: 'Ordenar',
    search: 'Buscar',
    clear: 'Limpiar',
  },

  errors: {
    generic: 'Algo salió mal. Por favor intente de nuevo.',
    network: 'Error de red. Por favor verifique su conexión.',
    timeout: 'La solicitud expiró. Por favor intente de nuevo.',
    sessionExpired: 'Su sesión ha expirado. Por favor inicie una nueva consulta.',
    invalidInput: 'Por favor verifique su entrada e intente de nuevo.',
    locationFailed: 'No se pudo obtener su ubicación. Por favor ingrésela manualmente.',
    bookingFailed: 'La reserva falló. Por favor intente de nuevo o contacte soporte.',
    loadingFailed: 'Error al cargar datos. Por favor actualice la página.',
    tryAgain: 'Por favor intente de nuevo',
  },

  time: {
    now: 'Ahora',
    today: 'Hoy',
    tomorrow: 'Mañana',
    minutes: 'minutos',
    hours: 'horas',
    days: 'días',
    weeks: 'semanas',
    ago: 'hace',
    in: 'en',
    at: 'a las',
  },
};

// ============================================================================
// French Translations
// ============================================================================

const fr: TriageTranslations = {
  assessmentPanel: {
    title: 'Résumé de Consultation IA',
    seeDoctor: 'Nous Vous Recommandons de Consulter un Médecin Maintenant',
    videoVisits: 'Consultations vidéo à partir de 39$',
    insurance: 'La plupart des assurances acceptées',
    prescription: 'Obtenez une ordonnance en seulement 30 minutes',
    seeDoctorCTA: 'Consulter un Médecin',
    videoAvailable: 'Rendez-vous vidéo disponibles immédiatement',
    feedbackPrompt: 'Cela vous a-t-il été utile?',
    notHelpful: 'Pas utile',
    soSo: 'Moyen',
    helpful: 'Utile',
    assessmentPlan: 'Évaluation et Plan',
    differentialDiagnosis: 'Diagnostic Différentiel',
    mostLikely: 'Plus Probable',
    leastLikely: 'Moins Probable',
    confidence: 'Confiance',
    planOfAction: 'Plan d\'Action pour Confirmer le Diagnostic',
    labTests: 'Tests de Laboratoire',
    imaging: 'Examens d\'Imagerie',
    referrals: 'Références',
    medications: 'Médicaments',
    followUp: 'Suivi',
    soapNote: 'Note SOAP',
    soapForPhysicians: 'Note SOAP (pour Médecins)',
    downloadPDF: 'Télécharger PDF',
    share: 'Partager',
    print: 'Imprimer',
    generatedAt: 'Généré le',
    aiDisclaimer: 'Évaluation générée par IA à titre informatif uniquement',
  },

  soapNote: {
    subjective: 'Subjectif',
    objective: 'Objectif',
    assessment: 'Évaluation',
    plan: 'Plan',
    chiefComplaint: 'Motif de Consultation',
    historyOfPresentIllness: 'Histoire de la Maladie Actuelle',
    reviewOfSystems: 'Revue des Systèmes',
    pastMedicalHistory: 'Antécédents Médicaux',
    medications: 'Médicaments Actuels',
    allergies: 'Allergies',
    socialHistory: 'Histoire Sociale',
    familyHistory: 'Antécédents Familiaux',
    vitalSigns: 'Signes Vitaux',
    physicalExam: 'Examen Physique',
    diagnosticResults: 'Résultats Diagnostiques',
    primaryDiagnosis: 'Diagnostic Principal',
    differentialDiagnoses: 'Diagnostics Différentiels',
    diagnosticPlan: 'Plan Diagnostique',
    treatmentPlan: 'Plan de Traitement',
    patientEducation: 'Éducation du Patient',
    disposition: 'Disposition',
  },

  oldcarts: {
    onset: 'Quand cela a-t-il commencé?',
    onsetFollowUp: 'Le début était-il soudain ou progressif?',
    location: 'Où exactement le ressentez-vous?',
    locationFollowUp: 'Est-ce que ça reste au même endroit ou ça se déplace?',
    duration: 'Est-ce constant ou intermittent?',
    durationFollowUp: 'Combien de temps dure chaque épisode?',
    character: 'Comment décririez-vous la sensation?',
    characterFollowUp: 'Est-ce aigu, sourd, brûlant ou douloureux?',
    aggravating: 'Qu\'est-ce qui l\'aggrave?',
    aggravatingFollowUp: 'Le mouvement, manger ou autre chose l\'aggrave-t-il?',
    relieving: 'Qu\'est-ce qui l\'améliore?',
    relievingFollowUp: 'Le repos, les médicaments ou autre chose aide-t-il?',
    timing: 'Quand cela se produit-il généralement?',
    timingFollowUp: 'Est-ce pire à un moment particulier de la journée?',
    severity: 'Sur une échelle de 0-10, quelle est la sévérité?',
    severityFollowUp: 'Comment cela se compare-t-il à la pire douleur que vous avez eue?',
    progress: 'Progression de l\'Évaluation des Symptômes',
    complete: 'Complet',
    partial: 'Partiel',
    missing: 'Pas encore collecté',
  },

  esi: {
    level1: 'URGENCE - Appelez le 15 (SAMU) Immédiatement',
    level1Description: 'Nécessite une intervention immédiate pour sauver la vie. Ne tardez pas.',
    level2: 'URGENT - Consultez Immédiatement',
    level2Description: 'Situation à haut risque qui ne peut pas attendre. Allez aux urgences maintenant.',
    level3: 'Urgent - Consultez un Médecin Aujourd\'hui',
    level3Description: 'Nécessite une évaluation médicale aujourd\'hui. Plusieurs ressources probablement nécessaires.',
    level4: 'Moins Urgent - Prenez Rendez-vous Rapidement',
    level4Description: 'Peut être vu dans quelques jours. Une ressource attendue.',
    level5: 'Non Urgent - L\'Auto-soin Peut Être Approprié',
    level5Description: 'Peut ne pas nécessiter de ressources d\'urgence. Envisagez la télémédecine ou l\'auto-soin.',
    callEmergency: 'Appeler les Services d\'Urgence',
    emergencyNumber: '15',
  },

  disclaimers: {
    main: 'Ces informations sont à titre éducatif uniquement et NE remplacent PAS les conseils, le diagnostic ou le traitement médical professionnel. Consultez toujours un professionnel de santé qualifié.',
    emergency: 'Si vous pensez avoir une urgence médicale, appelez le 15 (SAMU) immédiatement.',
    notDiagnosis: 'Cette évaluation n\'est pas un diagnostic. Veuillez consulter un professionnel de santé pour une évaluation appropriée.',
    aiGenerated: 'Ce contenu a été généré par l\'IA et doit être examiné par un professionnel de santé.',
    confidentiality: 'Vos informations de santé sont gardées confidentielles et sécurisées.',
    accuracy: 'Bien que nous nous efforcions d\'être précis, les évaluations IA peuvent contenir des erreurs.',
    medicalAdvice: 'N\'ignorez pas les conseils médicaux professionnels et ne tardez pas à les chercher à cause de ce que vous lisez ici.',
  },

  chat: {
    welcome: 'Bonjour! Je suis votre assistant de santé HELIOS. Je suis là pour vous aider à comprendre vos symptômes et vous guider vers les soins appropriés.',
    askChiefComplaint: 'Qu\'est-ce qui vous amène aujourd\'hui? Veuillez décrire votre préoccupation principale.',
    thankYou: 'Merci d\'avoir partagé ces informations.',
    gatheringInfo: 'Je rassemble plus d\'informations pour mieux comprendre votre situation.',
    assessmentReady: 'Sur la base de notre conversation, j\'ai préparé une évaluation pour vous.',
    anythingElse: 'Y a-t-il autre chose que vous aimeriez partager?',
    goodbye: 'Prenez soin de vous et rétablissez-vous vite!',
    typing: 'En train d\'écrire...',
    sendMessage: 'Envoyer le message',
    placeholder: 'Tapez votre message ici...',
    attachFile: 'Joindre un fichier',
    voiceInput: 'Entrée vocale',
    endSession: 'Terminer la Session',
    startNew: 'Nouvelle Consultation',
    saveConsult: 'Sauvegarder la Consultation',
  },

  booking: {
    title: 'Prendre Rendez-vous',
    findProvider: 'Trouver des Médecins Près de Vous',
    useLocation: 'Utiliser ma position actuelle',
    enterAddress: 'Entrez l\'adresse ou le code postal',
    searchRadius: 'Rayon de recherche',
    miles: 'km',
    availableProviders: 'Médecins Disponibles',
    noProvidersFound: 'Aucun médecin trouvé dans votre zone',
    selectProvider: 'Sélectionner un Médecin',
    selectDate: 'Sélectionner la Date',
    selectTime: 'Sélectionner l\'Heure',
    visitType: 'Type de Visite',
    videoVisit: 'Consultation Vidéo',
    inPerson: 'En Personne',
    confirmBooking: 'Confirmer la Réservation',
    bookingConfirmed: 'Réservation Confirmée!',
    confirmationCode: 'Code de Confirmation',
    addToCalendar: 'Ajouter au Calendrier',
    emailConfirmation: 'Confirmation par email',
    smsReminder: 'Rappel par SMS',
    appointmentDetails: 'Détails du Rendez-vous',
    provider: 'Médecin',
    specialty: 'Spécialité',
    location: 'Lieu',
    dateTime: 'Date et Heure',
    price: 'Prix',
    insuranceAccepted: 'Assurance acceptée',
    rating: 'Note',
    reviews: 'avis',
    waitTime: 'Temps d\'attente moyen',
    nextAvailable: 'Prochain disponible',
    videoAvailable: 'Vidéo disponible',
  },

  symptoms: {
    headache: 'Mal de tête',
    chestPain: 'Douleur thoracique',
    abdominalPain: 'Douleur abdominale',
    backPain: 'Mal de dos',
    fever: 'Fièvre',
    cough: 'Toux',
    shortnessOfBreath: 'Essoufflement',
    dizziness: 'Vertiges',
    nausea: 'Nausées',
    fatigue: 'Fatigue',
    pain: 'Douleur',
    swelling: 'Gonflement',
    rash: 'Éruption cutanée',
    weakness: 'Faiblesse',
    numbness: 'Engourdissement',
  },

  actions: {
    continue: 'Continuer',
    back: 'Retour',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    submit: 'Soumettre',
    save: 'Sauvegarder',
    close: 'Fermer',
    retry: 'Réessayer',
    learnMore: 'En savoir plus',
    viewDetails: 'Voir les détails',
    expand: 'Développer',
    collapse: 'Réduire',
    filter: 'Filtrer',
    sort: 'Trier',
    search: 'Rechercher',
    clear: 'Effacer',
  },

  errors: {
    generic: 'Une erreur s\'est produite. Veuillez réessayer.',
    network: 'Erreur réseau. Veuillez vérifier votre connexion.',
    timeout: 'La requête a expiré. Veuillez réessayer.',
    sessionExpired: 'Votre session a expiré. Veuillez démarrer une nouvelle consultation.',
    invalidInput: 'Veuillez vérifier votre saisie et réessayer.',
    locationFailed: 'Impossible d\'obtenir votre position. Veuillez la saisir manuellement.',
    bookingFailed: 'La réservation a échoué. Veuillez réessayer ou contacter le support.',
    loadingFailed: 'Échec du chargement des données. Veuillez rafraîchir la page.',
    tryAgain: 'Veuillez réessayer',
  },

  time: {
    now: 'Maintenant',
    today: 'Aujourd\'hui',
    tomorrow: 'Demain',
    minutes: 'minutes',
    hours: 'heures',
    days: 'jours',
    weeks: 'semaines',
    ago: 'il y a',
    in: 'dans',
    at: 'à',
  },
};

// ============================================================================
// Translations Map
// ============================================================================

export const triageTranslations: Record<TriageLanguage, TriageTranslations> = {
  en,
  es,
  fr,
};

// ============================================================================
// Hook: useTriageTranslations
// ============================================================================

/**
 * React hook for accessing triage translations
 *
 * @param language - The target language (en, es, fr)
 * @returns Typed translation object for the specified language
 *
 * @example
 * ```tsx
 * const t = useTriageTranslations('es');
 * return <h1>{t.assessmentPanel.title}</h1>;
 * ```
 */
export function useTriageTranslations(language: TriageLanguage = 'en'): TriageTranslations {
  return useMemo(() => {
    return triageTranslations[language] || triageTranslations.en;
  }, [language]);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a specific translation key with fallback to English
 */
export function getTriageTranslation<K extends keyof TriageTranslations>(
  language: TriageLanguage,
  section: K
): TriageTranslations[K] {
  const translations = triageTranslations[language] || triageTranslations.en;
  return translations[section];
}

/**
 * Check if a language is supported
 */
export function isTriageLanguageSupported(language: string): language is TriageLanguage {
  return language === 'en' || language === 'es' || language === 'fr';
}

/**
 * Get the emergency number for a given language/region
 */
export function getEmergencyNumber(language: TriageLanguage): string {
  const numbers: Record<TriageLanguage, string> = {
    en: '911',
    es: '911',
    fr: '15', // SAMU in France
  };
  return numbers[language];
}

/**
 * Format an ESI level message for the given language
 */
export function formatESIMessage(
  level: 1 | 2 | 3 | 4 | 5,
  language: TriageLanguage = 'en'
): { title: string; description: string } {
  const t = triageTranslations[language] || triageTranslations.en;
  const levelKey = `level${level}` as keyof typeof t.esi;
  const descKey = `level${level}Description` as keyof typeof t.esi;

  return {
    title: t.esi[levelKey] as string,
    description: t.esi[descKey] as string,
  };
}

// ============================================================================
// Language-Aware System Prompt Builder
// ============================================================================

/**
 * Build language-specific instructions for AI agents
 */
export function buildLanguageInstructions(language: TriageLanguage): string {
  const instructions: Record<TriageLanguage, string> = {
    en: `
LANGUAGE INSTRUCTIONS:
- Respond in English
- Use clear, patient-friendly medical terminology
- Avoid excessive medical jargon; explain terms when necessary
- Be empathetic and reassuring while maintaining clinical accuracy
- Use American English spelling and conventions`,

    es: `
INSTRUCCIONES DE IDIOMA:
- Responda en español
- Use terminología médica clara y accesible para el paciente
- Use "usted" (formal) al dirigirse al paciente
- Adapte la terminología médica al español estándar (evite regionalismos)
- Sea empático y tranquilizador manteniendo la precisión clínica
- Recuerde que el número de emergencias puede variar según el país

LANGUAGE INSTRUCTIONS:
- Respond in Spanish
- Use formal "usted" when addressing the patient
- Adapt medical terminology to standard Spanish (avoid regionalisms)
- Be empathetic and reassuring while maintaining clinical accuracy`,

    fr: `
INSTRUCTIONS LINGUISTIQUES:
- Répondez en français
- Utilisez une terminologie médicale claire et accessible au patient
- Utilisez le vouvoiement pour vous adresser au patient
- Adaptez la terminologie médicale au français standard
- Soyez empathique et rassurant tout en maintenant la précision clinique
- Le numéro d'urgence en France est le 15 (SAMU) ou le 112

LANGUAGE INSTRUCTIONS:
- Respond in French
- Use formal "vous" when addressing the patient
- Adapt medical terminology to standard French
- Be empathetic and reassuring while maintaining clinical accuracy
- Emergency number in France is 15 (SAMU) or 112`,
  };

  return instructions[language];
}

/**
 * Build culturally-appropriate medical terminology guidelines
 */
export function buildCulturalGuidelines(language: TriageLanguage): string {
  const guidelines: Record<TriageLanguage, string> = {
    en: `
CULTURAL CONSIDERATIONS:
- Be mindful of diverse cultural backgrounds
- Respect patient preferences for information sharing
- Use inclusive language
- Consider health literacy levels`,

    es: `
CONSIDERACIONES CULTURALES:
- Respete las diversas tradiciones de salud hispanas/latinas
- Sea sensible a las creencias sobre remedios naturales y medicina tradicional
- Considere la importancia de la familia en las decisiones de salud
- Use un lenguaje inclusivo y respetuoso
- Adapte las recomendaciones dietéticas a los hábitos alimentarios culturales`,

    fr: `
CONSIDÉRATIONS CULTURELLES:
- Respectez les traditions de santé françaises et francophones
- Soyez sensible au système de santé français et à ses particularités
- Considérez l'importance du médecin traitant dans le parcours de soins
- Utilisez un langage inclusif et respectueux
- Tenez compte des habitudes alimentaires françaises dans les recommandations`,
  };

  return guidelines[language];
}

export default triageTranslations;
