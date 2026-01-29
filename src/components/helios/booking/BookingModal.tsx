/**
 * Booking Modal
 * Book video appointment with SOAP note handoff
 */

import React, { useState } from 'react';
import { X, Calendar, Clock, User, Video, CreditCard, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SOAPNote } from '@/lib/helios/reports/soapGenerator';

interface BookingModalProps {
  consultId?: string;
  soap?: SOAPNote;
  onClose: () => void;
  onBook: (data: BookingData) => void;
}

interface BookingData {
  consultId?: string;
  scheduledAt: string;
  specialty: string;
  includeSOAPNote: boolean;
  paymentMethod: 'insurance' | 'self_pay';
}

const specialties = [
  { id: 'primary_care', name: 'Primary Care', icon: '🩺' },
  { id: 'internal_medicine', name: 'Internal Medicine', icon: '🏥' },
  { id: 'dermatology', name: 'Dermatology', icon: '🧴' },
  { id: 'mental_health', name: 'Mental Health', icon: '🧠' },
  { id: 'womens_health', name: "Women's Health", icon: '👩' },
];

const timeSlots = [
  'Now (Next Available)',
  'In 30 minutes',
  'In 1 hour',
  'In 2 hours',
  'Tomorrow Morning',
  'Tomorrow Afternoon',
];

export function BookingModal({ consultId, soap, onClose, onBook }: BookingModalProps) {
  const [step, setStep] = useState(1);
  const [specialty, setSpecialty] = useState('primary_care');
  const [timeSlot, setTimeSlot] = useState('Now (Next Available)');
  const [includeSOAPNote, setIncludeSOAPNote] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'insurance' | 'self_pay'>('self_pay');
  const [isBooking, setIsBooking] = useState(false);

  const handleBook = async () => {
    setIsBooking(true);

    // Calculate scheduled time
    const scheduledAt = new Date();
    if (timeSlot.includes('30 minutes')) {
      scheduledAt.setMinutes(scheduledAt.getMinutes() + 30);
    } else if (timeSlot.includes('1 hour')) {
      scheduledAt.setHours(scheduledAt.getHours() + 1);
    } else if (timeSlot.includes('2 hours')) {
      scheduledAt.setHours(scheduledAt.getHours() + 2);
    } else if (timeSlot.includes('Tomorrow Morning')) {
      scheduledAt.setDate(scheduledAt.getDate() + 1);
      scheduledAt.setHours(9, 0, 0, 0);
    } else if (timeSlot.includes('Tomorrow Afternoon')) {
      scheduledAt.setDate(scheduledAt.getDate() + 1);
      scheduledAt.setHours(14, 0, 0, 0);
    }

    try {
      await onBook({
        consultId,
        scheduledAt: scheduledAt.toISOString(),
        specialty,
        includeSOAPNote,
        paymentMethod,
      });
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-semibold">Book Video Visit</h2>
            <p className="text-gray-500 text-sm">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: Select Specialty */}
          {step === 1 && (
            <div>
              <h3 className="font-semibold mb-4">Select Specialty</h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {specialties.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSpecialty(s.id)}
                    className={`p-4 border rounded-xl text-left transition-colors ${
                      specialty === s.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-2xl mb-2 block">{s.icon}</span>
                    <span className="font-medium">{s.name}</span>
                  </button>
                ))}
              </div>

              <Button onClick={() => setStep(2)} className="w-full">
                Continue
              </Button>
            </div>
          )}

          {/* Step 2: Select Time */}
          {step === 2 && (
            <div>
              <h3 className="font-semibold mb-4">Select Appointment Time</h3>
              <div className="space-y-2 mb-6">
                {timeSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setTimeSlot(slot)}
                    className={`w-full p-4 border rounded-xl text-left transition-colors flex items-center gap-3 ${
                      timeSlot === slot
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <Clock className="w-5 h-5 text-gray-400" />
                    <span>{slot}</span>
                    {slot === 'Now (Next Available)' && (
                      <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        Recommended
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* SOAP Note Sharing */}
              {soap && (
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSOAPNote}
                      onChange={(e) => setIncludeSOAPNote(e.target.checked)}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium">Share AI Consult Summary with Doctor</p>
                      <p className="text-sm text-gray-500">
                        Your SOAP note will be securely shared to help the doctor prepare for your visit.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button onClick={() => setStep(3)} className="flex-1">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Payment & Confirm */}
          {step === 3 && (
            <div>
              <h3 className="font-semibold mb-4">Payment Method</h3>

              <div className="space-y-3 mb-6">
                <button
                  onClick={() => setPaymentMethod('insurance')}
                  className={`w-full p-4 border rounded-xl text-left transition-colors flex items-center gap-3 ${
                    paymentMethod === 'insurance'
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <Shield className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Use Insurance</p>
                    <p className="text-sm text-gray-500">Copay varies by plan</p>
                  </div>
                </button>

                <button
                  onClick={() => setPaymentMethod('self_pay')}
                  className={`w-full p-4 border rounded-xl text-left transition-colors flex items-center gap-3 ${
                    paymentMethod === 'self_pay'
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium">Self Pay - $39</p>
                    <p className="text-sm text-gray-500">No insurance needed</p>
                  </div>
                </button>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h4 className="font-medium mb-3">Appointment Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Specialty</span>
                    <span>{specialties.find(s => s.id === specialty)?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Time</span>
                    <span>{timeSlot}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payment</span>
                    <span>{paymentMethod === 'insurance' ? 'Insurance' : '$39'}</span>
                  </div>
                  {soap && includeSOAPNote && (
                    <div className="flex justify-between text-blue-600">
                      <span>AI Summary</span>
                      <span>✓ Will be shared</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={handleBook}
                  disabled={isBooking}
                  className="flex-1 bg-[#2196F3]"
                >
                  {isBooking ? 'Booking...' : 'Confirm Booking'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Video className="w-4 h-4" />
            <span>
              Video visits are conducted through our secure HIPAA-compliant platform.
              You'll receive a link before your appointment.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
