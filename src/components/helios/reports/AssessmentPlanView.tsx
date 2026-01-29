/**
 * Assessment Plan View (Route Wrapper)
 * Wraps AssessmentPlan for route rendering
 */

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AssessmentPlan } from './AssessmentPlan';
import type { SOAPNote } from '@/lib/helios/reports/soapGenerator';

interface AssessmentPlanViewProps {
  soap?: SOAPNote;
}

export function AssessmentPlanView({ soap }: AssessmentPlanViewProps) {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();

  if (!soap) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-600">Loading assessment...</p>
      </div>
    );
  }

  return (
    <AssessmentPlan
      soap={soap}
      onBack={() => navigate(-1)}
      onDownloadPDF={() => {
        // PDF download handled by parent
      }}
      onShare={() => {
        // Share handled by parent
      }}
      onSeeDoctor={() => {
        navigate(`/health/appointments/book?consultId=${sessionId}`);
      }}
      onContinue={() => {
        navigate(`/health/chat/${sessionId}`);
      }}
    />
  );
}
