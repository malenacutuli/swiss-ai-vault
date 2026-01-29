/**
 * Complete Summary Page
 * Main summary view with navigation to SOAP Note and Assessment & Plan
 */

import React, { useState } from 'react';
import { Stethoscope, FileText, Share2, Video, MessageCircle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssessmentPlan } from './AssessmentPlan';
import { SOAPNoteView } from './SOAPNoteView';
import { ShareModal } from '../chat/ShareModal';
import type { SOAPNote } from '@/lib/helios/reports/soapGenerator';
import { generateSOAPNotePDF, downloadPDF } from '@/lib/helios/reports/pdfGenerator';

interface SummaryPageProps {
  soap: SOAPNote;
  sessionId: string;
  onContinueChat: () => void;
  onBookDoctor: () => void;
}

type View = 'main' | 'assessment' | 'soap';

export function SummaryPage({
  soap,
  sessionId,
  onContinueChat,
  onBookDoctor,
}: SummaryPageProps) {
  const [view, setView] = useState<View>('main');
  const [showShare, setShowShare] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const blob = await generateSOAPNotePDF(soap);
      const filename = `HELIOS_SOAP_Note_${new Date().toISOString().split('T')[0]}.pdf`;
      downloadPDF(blob, filename);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  // Render sub-views
  if (view === 'assessment') {
    return (
      <AssessmentPlan
        soap={soap}
        onBack={() => setView('main')}
        onDownloadPDF={handleDownloadPDF}
        onShare={() => setShowShare(true)}
        onSeeDoctor={onBookDoctor}
        onContinue={onContinueChat}
      />
    );
  }

  if (view === 'soap') {
    return (
      <SOAPNoteView
        soap={soap}
        onBack={() => setView('main')}
        onDownloadPDF={handleDownloadPDF}
        onShare={() => setShowShare(true)}
      />
    );
  }

  // Main summary view
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-[#1D4E5F] rounded-full flex items-center justify-center">
          <Stethoscope className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-serif">AI Consult Summary</h1>
          <p className="text-gray-500 text-sm">
            {new Date(soap.generatedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* Summary Text */}
      <div className="prose prose-gray max-w-none mb-8">
        <p className="text-lg leading-relaxed">
          You presented with {soap.patientInfo.chiefComplaint.toLowerCase()}
          {soap.subjective.associatedSymptoms.length > 0 &&
            `, along with ${soap.subjective.associatedSymptoms.slice(0, 3).map(s =>
              s.split(' ')[0].toLowerCase()
            ).join(', ')}`
          }
          {soap.assessment.differentialDiagnosis.length > 0 &&
            `, raising concerns of ${soap.assessment.differentialDiagnosis[0].condition.toLowerCase()}`
          }.
          The next steps include {soap.plan.laboratoryTests.map(t => t.test).join(', ')}
          {soap.plan.imagingStudies.length > 0 &&
            ` and ${soap.plan.imagingStudies[0].study.toLowerCase()}`
          }
          {soap.plan.diagnosticProcedures.length > 0
            ? `—with potential follow-up imaging such as ${soap.plan.diagnosticProcedures[0].procedure.toLowerCase()} if concerns arise—`
            : ' '
          }
          to clarify the diagnosis and guide further management.
        </p>
      </div>

      {/* View Details Buttons */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => setView('assessment')}
          className="p-4 border rounded-xl text-left hover:bg-gray-50 transition-colors"
        >
          <FileText className="w-6 h-6 text-blue-600 mb-2" />
          <h3 className="font-semibold">Assessment & Plan</h3>
          <p className="text-sm text-gray-500">Differential diagnosis & action plan</p>
        </button>

        <button
          onClick={() => setView('soap')}
          className="p-4 border rounded-xl text-left hover:bg-gray-50 transition-colors"
        >
          <FileText className="w-6 h-6 text-blue-600 mb-2" />
          <h3 className="font-semibold">SOAP Note</h3>
          <p className="text-sm text-gray-500">Full clinical summary for physicians</p>
        </button>
      </div>

      {/* Doctor Recommendation Card */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
        <div className="relative h-48 bg-gradient-to-r from-blue-100 to-blue-50">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex -space-x-4">
              <div className="w-20 h-20 bg-gray-300 rounded-full border-4 border-white" />
              <div className="w-16 h-16 bg-gray-300 rounded-full border-4 border-white mt-4" />
            </div>
          </div>
        </div>

        <div className="p-6">
          <h2 className="text-2xl font-semibold mb-4">
            We Recommend You See a Doctor Now
          </h2>

          <ul className="space-y-3 mb-6">
            <li className="flex items-center gap-3 text-gray-600">
              <span className="text-green-500">✓</span>
              Video visits with our licensed doctors cost $39.
            </li>
            <li className="flex items-center gap-3 text-gray-600">
              <span className="text-green-500">✓</span>
              We also accept all major insurance.
            </li>
            <li className="flex items-center gap-3 text-gray-600">
              <span className="text-green-500">✓</span>
              Get your prescriptions and more in as little as 30 minutes.
            </li>
          </ul>

          <Button
            onClick={onBookDoctor}
            className="w-full h-14 text-lg bg-[#2196F3] hover:bg-[#1976D2]"
          >
            See a Doctor
          </Button>

          <p className="text-center text-sm text-gray-500 mt-4">
            Video appointments available immediately.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 mb-8">
        <Button
          onClick={handleDownloadPDF}
          disabled={isDownloading}
          variant="outline"
          className="w-full h-14 justify-center gap-2 bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
        >
          <FileText className="w-5 h-5" />
          {isDownloading ? 'Generating PDF...' : 'Download SOAP Note (PDF)'}
        </Button>

        <Button
          onClick={() => setShowShare(true)}
          variant="outline"
          className="w-full h-14 justify-center gap-2 bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
        >
          <Share2 className="w-5 h-5" />
          Share Summary
        </Button>
      </div>

      {/* Feedback */}
      <div className="text-center border-t pt-8">
        <h3 className="text-xl font-semibold mb-2">
          How helpful was HELIOS for you today?
        </h3>
        <p className="text-gray-500 mb-4">Your feedback helps make us better.</p>

        <div className="flex justify-center gap-4">
          <button className="flex items-center gap-2 px-6 py-3 border rounded-full hover:bg-gray-50">
            <span>😕</span> Not Helpful
          </button>
          <button className="flex items-center gap-2 px-6 py-3 border rounded-full hover:bg-gray-50">
            <span>😐</span> So-So
          </button>
          <button className="flex items-center gap-2 px-6 py-3 border rounded-full hover:bg-gray-50">
            <span>😊</span> Helpful
          </button>
        </div>
      </div>

      {/* Share Modal */}
      {showShare && (
        <ShareModal
          sessionId={sessionId}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
