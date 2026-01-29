/**
 * HELIOS Home - New Consult Screen
 * "How can I help you today?"
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Shield, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface HeliosHomeProps {
  userName?: string;
}

const doctorAvatars = [
  '/avatars/doctor-1.jpg',
  '/avatars/doctor-2.jpg',
  '/avatars/doctor-3.jpg',
];

export function HeliosHome({ userName = 'there' }: HeliosHomeProps) {
  const [message, setMessage] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const navigate = useNavigate();

  const handleStart = async () => {
    if (!message.trim()) return;

    setIsStarting(true);

    // Create new consult session
    const sessionId = crypto.randomUUID();

    // Navigate to chat with initial message
    navigate(`/health/chat/${sessionId}`, {
      state: { initialMessage: message.trim() }
    });
  };

  const placeholders = [
    'Describe your symptoms...',
    'Refill a prescription...',
    'Get health advice...',
    'Ask about a condition...',
  ];

  const [placeholderIndex] = useState(
    Math.floor(Math.random() * placeholders.length)
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      {/* Doctor avatars */}
      <div className="flex items-center justify-center mb-6">
        <div className="w-12 h-12 bg-[#1D4E5F] rounded-full flex items-center justify-center z-10">
          <span className="text-white text-xl">✦</span>
        </div>
        {doctorAvatars.map((_, i) => (
          <div
            key={i}
            className="w-10 h-10 bg-gray-300 rounded-full -ml-3 border-2 border-white"
            style={{ zIndex: 9 - i }}
          />
        ))}
      </div>

      {/* Greeting */}
      <h1 className="text-4xl md:text-5xl font-serif text-center mb-4">
        How can I help you<br />today, {userName}?
      </h1>

      <p className="text-gray-600 text-center mb-2">
        We're glad you're here.
      </p>

      <p className="text-gray-500 text-center mb-8 text-sm">
        Don't hesitate to reach out to our support staff if you have any questions.
      </p>

      {/* Input area */}
      <div className="w-full max-w-xl">
        <div className="relative bg-white rounded-2xl shadow-sm border border-gray-200">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={placeholders[placeholderIndex]}
            className="min-h-[100px] border-0 focus:ring-0 resize-none p-4 pb-16 text-lg"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleStart();
              }
            }}
          />

          <div className="absolute bottom-4 right-4">
            <Button
              onClick={handleStart}
              disabled={!message.trim() || isStarting}
              className="bg-[#2196F3] hover:bg-[#1976D2] text-white rounded-lg px-6"
            >
              Get Started
              <Send className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Privacy indicator */}
        <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <Shield className="w-4 h-4" />
            <span>HIPAA · Private</span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap justify-center gap-3 mt-12">
        {['Headache', 'Cold symptoms', 'Skin rash', 'Anxiety', 'Sleep issues'].map((symptom) => (
          <button
            key={symptom}
            onClick={() => setMessage(`I'm experiencing ${symptom.toLowerCase()}`)}
            className="px-4 py-2 bg-white rounded-full text-sm text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            {symptom}
          </button>
        ))}
      </div>
    </div>
  );
}
