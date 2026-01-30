/**
 * HELIOS Consultation Review Page
 * Displays completed consult summary with SOAP notes, recommendations, and actions
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  Phone,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  FileText,
  ArrowLeft,
  Stethoscope,
  Heart,
  Brain,
  Baby,
  Users,
  Bone,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { RedFlag, TriageLevel, Disposition } from '@/lib/helios/types';

interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface SessionData {
  session_id: string;
  chief_complaint?: string;
  specialty: string;
  current_phase: string;
  triage_level?: TriageLevel;
  disposition?: Disposition;
  summary?: string;
  soap_note?: SOAPNote;
  red_flags?: RedFlag[];
  recommended_action?: string;
  created_at: string;
  completed_at?: string;
  patient_info?: {
    age?: number;
    sex?: string;
  };
}

const SPECIALTY_ICONS: Record<string, React.ElementType> = {
  'primary-care': Stethoscope,
  'cardiology': Heart,
  'mental-health': Brain,
  'pediatrics': Baby,
  'womens-health': Users,
  'dermatology': Users,
  'orthopedics': Bone,
};

const SPECIALTY_LABELS: Record<string, string> = {
  'primary-care': 'General Health',
  'cardiology': 'Heart & Cardio',
  'mental-health': 'Mental Health',
  'pediatrics': 'Pediatrics',
  'womens-health': "Women's Health",
  'dermatology': 'Skin & Hair',
  'orthopedics': 'Bone & Joint',
};

const DISPOSITION_LABELS: Record<string, string> = {
  emergency: 'Seek Emergency Care',
  urgent_care: 'Visit Urgent Care',
  primary_care: 'Schedule with Doctor',
  specialist: 'See a Specialist',
  telehealth: 'Telehealth Follow-up',
  self_care: 'Self-Care at Home',
};

const DISPOSITION_COLORS: Record<string, string> = {
  emergency: 'bg-red-100 text-red-800 border-red-200',
  urgent_care: 'bg-orange-100 text-orange-800 border-orange-200',
  primary_care: 'bg-blue-100 text-blue-800 border-blue-200',
  specialist: 'bg-purple-100 text-purple-800 border-purple-200',
  telehealth: 'bg-green-100 text-green-800 border-green-200',
  self_care: 'bg-gray-100 text-gray-800 border-gray-200',
};

const TRIAGE_COLORS: Record<string, string> = {
  ESI1: 'bg-red-500',
  ESI2: 'bg-orange-500',
  ESI3: 'bg-yellow-500',
  ESI4: 'bg-green-500',
  ESI5: 'bg-blue-500',
};

export default function HeliosChatReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    subjective: true,
    objective: false,
    assessment: true,
    plan: true,
  });
  const [feedbackGiven, setFeedbackGiven] = useState<'helpful' | 'not_helpful' | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId]);

  const loadSession = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('helios-chat', {
        body: {
          action: 'get_session',
          session_id: id,
        },
      });

      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || 'Session not found');

      // The API returns session fields at top level, not wrapped in session object
      // Determine disposition - if escalated, set to emergency
      const disposition = data.disposition || (data.escalated ? 'emergency' : undefined);

      setSession({
        session_id: data.session_id,
        chief_complaint: data.chief_complaint,
        specialty: data.specialty || 'primary-care',
        current_phase: data.current_phase || data.phase,
        triage_level: data.triage_level,
        disposition: disposition as Disposition | undefined,
        summary: data.summary,
        soap_note: data.soap_note,
        red_flags: data.red_flags,
        recommended_action: data.recommended_action,
        created_at: data.created_at,
        completed_at: data.completed_at,
        patient_info: data.patient_info,
      });
    } catch (err) {
      console.error('[HeliosChatReviewPage] Error loading session:', err);
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleFeedback = async (feedback: 'helpful' | 'not_helpful') => {
    setFeedbackGiven(feedback);
    try {
      await supabase.functions.invoke('helios-chat', {
        body: {
          action: 'submit_feedback',
          session_id: sessionId,
          feedback,
        },
      });
    } catch (err) {
      console.error('[HeliosChatReviewPage] Error submitting feedback:', err);
    }
  };

  const handleDownload = () => {
    if (!session) return;

    const content = generateReportContent(session);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `helios-consult-${sessionId?.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (!session) return;

    const shareData = {
      title: 'HELIOS Health Consult Summary',
      text: `Consultation summary for ${session.chief_complaint || 'health concern'}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share cancelled or failed');
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard');
    }
  };

  const generateReportContent = (session: SessionData): string => {
    const lines = [
      'HELIOS Health Consultation Summary',
      '=' .repeat(40),
      '',
      `Date: ${new Date(session.created_at).toLocaleDateString()}`,
      `Specialty: ${SPECIALTY_LABELS[session.specialty] || session.specialty}`,
      '',
    ];

    if (session.chief_complaint) {
      lines.push(`Chief Complaint: ${session.chief_complaint}`, '');
    }

    if (session.soap_note) {
      lines.push('SOAP Note', '-'.repeat(20));
      lines.push(`Subjective: ${session.soap_note.subjective}`);
      lines.push(`Objective: ${session.soap_note.objective}`);
      lines.push(`Assessment: ${session.soap_note.assessment}`);
      lines.push(`Plan: ${session.soap_note.plan}`);
      lines.push('');
    }

    if (session.disposition) {
      lines.push(`Recommendation: ${DISPOSITION_LABELS[session.disposition]}`);
    }

    lines.push('', '-'.repeat(40));
    lines.push('This summary is for informational purposes only.');
    lines.push('Always consult with a healthcare professional.');

    return lines.join('\n');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F7]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1D4E5F]" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF9F7] px-4">
        <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Session Not Found</h1>
        <p className="text-gray-600 mb-6">{error || 'This consultation could not be loaded.'}</p>
        <Button onClick={() => navigate('/health')} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Return Home
        </Button>
      </div>
    );
  }

  const SpecialtyIcon = SPECIALTY_ICONS[session.specialty] || Stethoscope;

  return (
    <div className="min-h-screen bg-[#FAF9F7] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/health/consults')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Consults
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif text-gray-900">Consultation Summary</h1>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(session.created_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-[#1D4E5F]/10`}>
                <SpecialtyIcon className="w-5 h-5 text-[#1D4E5F]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Status & Specialty */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
          <Badge variant="outline" className="bg-[#1D4E5F]/10 text-[#1D4E5F] border-[#1D4E5F]/20">
            {SPECIALTY_LABELS[session.specialty] || session.specialty}
          </Badge>
          {session.triage_level && (
            <Badge className={`${TRIAGE_COLORS[session.triage_level]} text-white`}>
              {session.triage_level}
            </Badge>
          )}
        </div>

        {/* Chief Complaint */}
        {session.chief_complaint && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#1D4E5F]" />
                Chief Complaint
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{session.chief_complaint}</p>
            </CardContent>
          </Card>
        )}

        {/* Red Flags Warning */}
        {session.red_flags && session.red_flags.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                Important Health Flags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {session.red_flags.map((flag, index) => (
                  <li key={index} className="flex items-start gap-2 text-red-700">
                    <span className="text-red-500 mt-1">•</span>
                    <span>{flag.description}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Recommendation Card */}
        {session.disposition && (
          <Card className={`border-2 ${DISPOSITION_COLORS[session.disposition]}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Recommended Next Step</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xl font-semibold">
                {DISPOSITION_LABELS[session.disposition]}
              </p>
              {session.summary && (
                <p className="text-gray-700">{session.summary}</p>
              )}

              {/* Action Buttons based on disposition */}
              <div className="flex flex-wrap gap-3 pt-2">
                {session.disposition === 'emergency' && (
                  <Button className="bg-red-600 hover:bg-red-700">
                    <Phone className="w-4 h-4 mr-2" />
                    Call 911
                  </Button>
                )}
                {['urgent_care', 'primary_care', 'specialist'].includes(session.disposition) && (
                  <Button className="bg-[#1D4E5F] hover:bg-[#1D4E5F]/90">
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule Appointment
                  </Button>
                )}
                {session.disposition === 'telehealth' && (
                  <Button className="bg-[#1D4E5F] hover:bg-[#1D4E5F]/90">
                    <Users className="w-4 h-4 mr-2" />
                    Start Telehealth Visit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* SOAP Note Sections */}
        {session.soap_note && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-[#1D4E5F]" />
                Clinical Notes (SOAP)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-0">
              {/* Subjective */}
              <div className="border-b border-gray-100">
                <button
                  onClick={() => toggleSection('subjective')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">Subjective</span>
                  {expandedSections.subjective ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {expandedSections.subjective && (
                  <div className="px-4 pb-4 text-gray-700">
                    {session.soap_note.subjective || 'Patient-reported symptoms and history.'}
                  </div>
                )}
              </div>

              {/* Objective */}
              <div className="border-b border-gray-100">
                <button
                  onClick={() => toggleSection('objective')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">Objective</span>
                  {expandedSections.objective ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {expandedSections.objective && (
                  <div className="px-4 pb-4 text-gray-700">
                    {session.soap_note.objective || 'Observations from AI-assisted consultation.'}
                  </div>
                )}
              </div>

              {/* Assessment */}
              <div className="border-b border-gray-100">
                <button
                  onClick={() => toggleSection('assessment')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">Assessment</span>
                  {expandedSections.assessment ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {expandedSections.assessment && (
                  <div className="px-4 pb-4 text-gray-700">
                    {session.soap_note.assessment || 'Clinical assessment based on reported information.'}
                  </div>
                )}
              </div>

              {/* Plan */}
              <div>
                <button
                  onClick={() => toggleSection('plan')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">Plan</span>
                  {expandedSections.plan ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {expandedSections.plan && (
                  <div className="px-4 pb-4 text-gray-700">
                    {session.soap_note.plan || 'Recommended follow-up actions and care plan.'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Patient Info */}
        {session.patient_info && (session.patient_info.age || session.patient_info.sex) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-[#1D4E5F]" />
                Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6 text-gray-700">
                {session.patient_info.age && (
                  <div>
                    <span className="text-gray-500">Age:</span>{' '}
                    <span className="font-medium">{session.patient_info.age}</span>
                  </div>
                )}
                {session.patient_info.sex && (
                  <div>
                    <span className="text-gray-500">Sex:</span>{' '}
                    <span className="font-medium capitalize">{session.patient_info.sex}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Feedback Section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Was this consultation helpful?</CardTitle>
          </CardHeader>
          <CardContent>
            {feedbackGiven ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span>Thank you for your feedback!</span>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleFeedback('helpful')}
                  className="flex-1"
                >
                  <ThumbsUp className="w-4 h-4 mr-2" />
                  Helpful
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleFeedback('not_helpful')}
                  className="flex-1"
                >
                  <ThumbsDown className="w-4 h-4 mr-2" />
                  Not Helpful
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleDownload} className="flex-1">
            <Download className="w-4 h-4 mr-2" />
            Download Summary
          </Button>
          <Button variant="outline" onClick={handleShare} className="flex-1">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>

        {/* Privacy Notice */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 pt-4">
          <Shield className="w-4 h-4" />
          <span>Your health data is encrypted and HIPAA compliant</span>
        </div>

        {/* Disclaimer */}
        <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-600">
          <p className="font-medium mb-1">Important Disclaimer</p>
          <p>
            This AI-assisted consultation is for informational purposes only and does not
            constitute medical advice, diagnosis, or treatment. Always seek the advice of
            your physician or other qualified health provider with any questions you may
            have regarding a medical condition.
          </p>
        </div>
      </div>
    </div>
  );
}
