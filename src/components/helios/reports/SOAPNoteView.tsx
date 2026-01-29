/**
 * SOAP Note View Component
 * Full clinical summary for physicians
 */

import React from 'react';
import { ChevronLeft, FileText, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SOAPNote } from '@/lib/helios/reports/soapGenerator';

interface SOAPNoteViewProps {
  soap: SOAPNote;
  onBack: () => void;
  onDownloadPDF: () => void;
  onShare: () => void;
}

export function SOAPNoteView({
  soap,
  onBack,
  onDownloadPDF,
  onShare,
}: SOAPNoteViewProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="text-blue-600 hover:text-blue-700">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-blue-600">SOAP Note (for Physicians)</h1>
          <p className="text-gray-500 text-sm">
            A clinical summary to share with your doctor
          </p>
        </div>
      </div>

      {/* SOAP Note Content */}
      <div className="prose prose-gray max-w-none">
        {/* Title */}
        <h2 className="text-lg font-semibold">SOAP Note</h2>

        {/* Subjective */}
        <h3 className="font-semibold mt-6">Subjective</h3>
        <ul className="list-disc ml-4 space-y-2">
          <li>
            {soap.patientInfo.age}-year-old {soap.patientInfo.sex} with {soap.patientInfo.chiefComplaint}
            {soap.subjective.historyOfPresentIllness.includes('onset') &&
              `; ${soap.subjective.historyOfPresentIllness.split('. ')[0]}`
            }
          </li>

          {soap.subjective.associatedSymptoms.map((symptom, i) => (
            <li key={i}>{symptom}</li>
          ))}

          {soap.subjective.negativeSymptoms.length > 0 && (
            <li>Denies {soap.subjective.negativeSymptoms.join(', ')}</li>
          )}

          <li>
            {soap.subjective.pastMedicalHistory.length > 0
              ? `Past medical history includes ${soap.subjective.pastMedicalHistory.join(', ')}`
              : 'No history of infections, injuries, surgeries or chronic medical conditions'
            }
          </li>

          {soap.subjective.medications.map((med, i) => (
            <li key={i}>
              Medication: <strong>{med.name}{med.dose ? ` ${med.dose}` : ''}</strong>
              {med.frequency && ` ${med.frequency}`}
              {med.reason && ` for ${med.reason}`}
            </li>
          ))}

          <li>
            {soap.subjective.allergies.length > 0
              ? `Allergies: ${soap.subjective.allergies.join(', ')}`
              : 'No known allergies'
            }
          </li>
        </ul>

        {/* Objective */}
        <h3 className="font-semibold mt-6">Objective</h3>
        <ul className="list-disc ml-4 space-y-2">
          <li>Self-reported findings:</li>
          <ul className="list-[circle] ml-6 space-y-1">
            {soap.objective.selfReportedFindings.map((finding, i) => (
              <li key={i}>{finding}</li>
            ))}
          </ul>
        </ul>

        {/* Assessment */}
        <h3 className="font-semibold mt-6">Assessment</h3>
        <ul className="list-disc ml-4 space-y-2">
          <li>Differential includes:</li>
          <ul className="list-[circle] ml-6 space-y-1">
            {soap.assessment.differentialDiagnosis.map((dx, i) => (
              <li key={i}>
                {dx.condition}
                {dx.reasoning && ` (${dx.reasoning})`}
              </li>
            ))}
          </ul>
        </ul>

        {/* Plan */}
        <h3 className="font-semibold mt-6">Plan</h3>

        {soap.plan.laboratoryTests.length > 0 && (
          <>
            <ul className="list-disc ml-4">
              <li>Laboratory Tests:</li>
            </ul>
            <ul className="list-[circle] ml-10 space-y-1">
              {soap.plan.laboratoryTests.map((test, i) => (
                <li key={i}>{test.test} to {test.rationale.toLowerCase()}</li>
              ))}
            </ul>
          </>
        )}

        {soap.plan.imagingStudies.length > 0 && (
          <>
            <ul className="list-disc ml-4 mt-3">
              <li>Imaging Studies:</li>
            </ul>
            <ul className="list-[circle] ml-10 space-y-1">
              {soap.plan.imagingStudies.map((study, i) => (
                <li key={i}>{study.study} to {study.rationale.toLowerCase()}</li>
              ))}
            </ul>
          </>
        )}

        {soap.plan.diagnosticProcedures.length > 0 && (
          <>
            <ul className="list-disc ml-4 mt-3">
              <li>Further Diagnostic Procedures:</li>
            </ul>
            <ul className="list-[circle] ml-10 space-y-1">
              {soap.plan.diagnosticProcedures.map((proc, i) => (
                <li key={i}>{proc.procedure} if {proc.indication.toLowerCase()}</li>
              ))}
            </ul>
          </>
        )}

        <ul className="list-disc ml-4 mt-3">
          <li>Management:</li>
        </ul>
        <ul className="list-[circle] ml-10 space-y-1">
          {soap.plan.management.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 mt-8">
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

      {/* Disclaimer */}
      <div className="mt-8 p-4 bg-gray-100 rounded-lg text-xs text-gray-500">
        <p className="font-medium mb-2">⚠️ AI DISCLAIMER</p>
        <p>{soap.disclaimer}</p>
      </div>
    </div>
  );
}
