/**
 * AI Consult Summary
 * Displays final assessment and recommendations
 */

import React from 'react';
import {
  AlertTriangle, Calendar, Phone, FileText,
  Download, Share2, Printer, CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConsultSummaryProps {
  summary: {
    chiefComplaint: string;
    assessment: string;
    differentialConsiderations: string[];
    redFlags: string[];
    recommendations: string[];
    nextSteps: string[];
    triageLevel: string;
    disposition: string;
  };
  onBookAppointment: () => void;
  onDownload: () => void;
  onShare: () => void;
}

const doctorImage = '/images/doctor-video-call.jpg';

export function ConsultSummary({
  summary,
  onBookAppointment,
  onDownload,
  onShare,
}: ConsultSummaryProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-[#1D4E5F] rounded-full flex items-center justify-center">
          <span className="text-white text-xl">✦</span>
        </div>
        <div>
          <h1 className="text-3xl font-serif">AI Consult Summary</h1>
          <p className="text-gray-500 text-sm">
            {new Date().toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* Summary text */}
      <div className="prose prose-gray max-w-none mb-8">
        <p className="text-lg leading-relaxed">
          {summary.assessment}
        </p>

        {summary.nextSteps.length > 0 && (
          <p className="text-lg leading-relaxed mt-4">
            The next steps include: {summary.nextSteps.join(', ')}.
          </p>
        )}
      </div>

      {/* Red flags */}
      {summary.redFlags.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Important Safety Information</span>
          </div>
          <ul className="text-red-600 text-sm space-y-1">
            {summary.redFlags.map((flag, i) => (
              <li key={i}>• {flag}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Doctor recommendation card */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
        <div className="relative h-48 bg-gray-200">
          <img
            src={doctorImage}
            alt="Video consultation"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-4 right-4 w-24 h-24 bg-gray-300 rounded-lg border-2 border-white" />
        </div>

        <div className="p-6">
          <h2 className="text-2xl font-semibold mb-4">
            We Recommend You See a Doctor Now
          </h2>

          <ul className="space-y-2 mb-6">
            <li className="flex items-center gap-2 text-gray-600">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Video visits with our licensed doctors cost $39.
            </li>
            <li className="flex items-center gap-2 text-gray-600">
              <CheckCircle className="w-5 h-5 text-green-500" />
              We also accept all major insurance.
            </li>
            <li className="flex items-center gap-2 text-gray-600">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Get your prescriptions and more in as little as 30 minutes.
            </li>
          </ul>

          <Button
            onClick={onBookAppointment}
            className="w-full h-14 text-lg bg-[#2196F3] hover:bg-[#1976D2]"
          >
            See a Doctor
          </Button>

          <p className="text-center text-sm text-gray-500 mt-4">
            ⚡ Video appointments available immediately.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-center mb-8">
        <Button variant="outline" onClick={onDownload}>
          <Download className="w-4 h-4 mr-2" />
          Download Report
        </Button>
        <Button variant="outline" onClick={onShare}>
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" />
          Print
        </Button>
      </div>

      {/* Feedback */}
      <div className="text-center border-t pt-8">
        <h3 className="text-xl font-semibold mb-2">
          How helpful was HELIOS for you today?
        </h3>
        <p className="text-gray-500 mb-4">
          Your feedback helps make us better.
        </p>

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

      {/* AI Disclaimer */}
      <div className="mt-8 p-4 bg-gray-100 rounded-lg text-xs text-gray-500">
        <p className="font-medium mb-2">⚠️ AI DISCLAIMER</p>
        <p>
          This clinical summary was generated by an AI system (HELIOS) for informational
          purposes only. It does NOT constitute a medical diagnosis, treatment plan, or
          professional medical advice. All information should be verified by a licensed
          healthcare provider. The AI system may make errors or omissions. Always seek the
          advice of a qualified healthcare professional for any medical concerns.
        </p>
      </div>
    </div>
  );
}
