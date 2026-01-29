/**
 * Assessment & Plan Component
 * Detailed differential diagnosis and action plan
 */

import React from 'react';
import { ChevronLeft, FileText, Share2, Video, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SOAPNote } from '@/lib/helios/reports/soapGenerator';

interface AssessmentPlanProps {
  soap: SOAPNote;
  onBack: () => void;
  onDownloadPDF: () => void;
  onShare: () => void;
  onSeeDoctor: () => void;
  onContinue: () => void;
}

export function AssessmentPlan({
  soap,
  onBack,
  onDownloadPDF,
  onShare,
  onSeeDoctor,
  onContinue,
}: AssessmentPlanProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="text-blue-600 hover:text-blue-700">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-blue-600">Assessment & Plan</h1>
          <p className="text-gray-500 text-sm">
            A clinical overview of possible causes considered
          </p>
        </div>
      </div>

      {/* Introduction */}
      <div className="prose prose-gray max-w-none mb-8">
        <p>
          Below is a differential diagnosis and a plan of action based on your symptoms,
          background, and the details you have provided.
        </p>
      </div>

      {/* Differential Diagnosis */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">
          Differential Diagnosis (ranked in order from most to least likely):
        </h2>
        <ol className="space-y-3">
          {soap.assessment.differentialDiagnosis.map((dx, index) => (
            <li key={index} className="flex gap-3">
              <span className="font-semibold text-gray-500">{index + 1}.</span>
              <div>
                <span className="font-medium">{dx.condition}</span>
                {dx.reasoning && (
                  <span className="text-gray-600"> - {dx.reasoning}</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Plan of Action */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Plan of Action for Confirming Diagnosis</h2>

        {/* Laboratory Tests */}
        {soap.plan.laboratoryTests.length > 0 && (
          <div className="mb-6">
            <h3 className="font-medium mb-2">• Laboratory Tests</h3>
            <ul className="ml-4 space-y-2">
              {soap.plan.laboratoryTests.map((test, index) => (
                <li key={index} className="text-gray-700">
                  – {test.test}
                  <p className="text-gray-500 text-sm ml-4">{test.rationale}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Imaging Studies */}
        {soap.plan.imagingStudies.length > 0 && (
          <div className="mb-6">
            <h3 className="font-medium mb-2">• Imaging Studies</h3>
            <ul className="ml-4 space-y-2">
              {soap.plan.imagingStudies.map((study, index) => (
                <li key={index} className="text-gray-700">
                  – {study.study}
                  <p className="text-gray-500 text-sm ml-4">• Rationale: {study.rationale}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Diagnostic Procedures */}
        {soap.plan.diagnosticProcedures.length > 0 && (
          <div className="mb-6">
            <h3 className="font-medium mb-2">• Further Diagnostic Procedures</h3>
            <ul className="ml-4 space-y-2">
              {soap.plan.diagnosticProcedures.map((proc, index) => (
                <li key={index} className="text-gray-700">
                  – {proc.procedure}
                  <p className="text-gray-500 text-sm ml-4">{proc.indication}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Management */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">• Management</h3>
          <ul className="ml-4 space-y-1">
            {soap.plan.management.map((item, index) => (
              <li key={index} className="text-gray-700">– {item}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 mb-8">
        <Button
          onClick={onDownloadPDF}
          variant="outline"
          className="w-full h-14 justify-center gap-2 bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
        >
          <FileText className="w-5 h-5" />
          Download SOAP Note (PDF)
        </Button>

        <Button
          onClick={onShare}
          variant="outline"
          className="w-full h-14 justify-center gap-2 bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
        >
          <Share2 className="w-5 h-5" />
          Share Summary
        </Button>
      </div>

      {/* Divider */}
      <div className="border-t my-8" />

      {/* Next Steps */}
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-6">What do you want to do next?</h3>

        <div className="flex justify-center gap-4 mb-4">
          <Button
            onClick={onSeeDoctor}
            variant="outline"
            className="flex items-center gap-2 px-6 py-3 h-auto"
          >
            <Video className="w-5 h-5 text-blue-600" />
            <span>See a Doctor</span>
          </Button>

          <Button
            onClick={onContinue}
            variant="outline"
            className="flex items-center gap-2 px-6 py-3 h-auto"
          >
            <MessageCircle className="w-5 h-5 text-blue-600" />
            <span>Continue</span>
          </Button>
        </div>

        <p className="text-gray-500 text-sm">
          Book a video visit with a doctor. Appointments available immediately.
          <br />Insurance accepted, but not required.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="mt-8 p-4 bg-gray-100 rounded-lg text-xs text-gray-500">
        <p className="font-medium mb-2">⚠️ AI DISCLAIMER</p>
        <p>{soap.disclaimer}</p>
      </div>
    </div>
  );
}
