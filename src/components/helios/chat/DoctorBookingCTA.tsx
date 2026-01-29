/**
 * Persistent Doctor Booking CTA
 * Shows after diagnosis is complete and persists with every response
 */

import React from 'react';
import { Video, Clock, Shield, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DoctorBookingCTAProps {
  urgency: 'high' | 'medium' | 'low';
  onBook: () => void;
  compact?: boolean;
}

export function DoctorBookingCTA({ urgency, onBook, compact = false }: DoctorBookingCTAProps) {
  if (compact) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Video className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {urgency === 'high'
                  ? 'We recommend seeing a doctor now'
                  : urgency === 'medium'
                  ? 'Consider speaking with a doctor'
                  : 'A doctor can provide more guidance'}
              </p>
              <p className="text-sm text-gray-500">
                Video appointments available immediately
              </p>
            </div>
          </div>
          <Button
            onClick={onBook}
            className="bg-[#2196F3] hover:bg-[#1976D2]"
          >
            See a Doctor
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border overflow-hidden mt-6">
      {/* Header with urgency indication */}
      <div className={`px-6 py-4 ${
        urgency === 'high'
          ? 'bg-amber-50 border-b border-amber-200'
          : 'bg-blue-50 border-b border-blue-100'
      }`}>
        <div className="flex items-center gap-2">
          <Video className={`w-5 h-5 ${
            urgency === 'high' ? 'text-amber-600' : 'text-blue-600'
          }`} />
          <span className={`font-semibold ${
            urgency === 'high' ? 'text-amber-800' : 'text-blue-800'
          }`}>
            {urgency === 'high'
              ? '⚡ We Recommend You See a Doctor Now'
              : 'Follow Up With a Doctor'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <p className="text-gray-600 mb-4">
          {urgency === 'high'
            ? 'Based on your symptoms, we strongly recommend speaking with a licensed physician as soon as possible.'
            : 'A licensed physician can provide personalized medical advice, prescriptions, and referrals.'}
        </p>

        {/* Benefits */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-gray-700">Video visits with licensed doctors - $39</span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-gray-700">All major insurance accepted</span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-gray-700">Prescriptions in as little as 30 minutes</span>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={onBook}
          className="w-full h-14 text-lg bg-[#2196F3] hover:bg-[#1976D2]"
        >
          See a Doctor
        </Button>

        {/* Availability */}
        <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>Video appointments available immediately</span>
        </div>
      </div>
    </div>
  );
}
