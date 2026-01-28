/**
 * HELIOS Health Assistant Page
 */

'use client';

import React from 'react';
import { HeliosChat } from '@/components/helios/chat/HeliosChat';

export default function HealthPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600
                          rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">H</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                HELIOS Health Assistant
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                AI-Powered Clinical Triage Support
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
             style={{ height: 'calc(100vh - 200px)' }}>
          <HeliosChat />
        </div>

        {/* Disclaimer */}
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg
                        border border-amber-200 dark:border-amber-800">
          <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
            Important Notice
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            This AI assistant is designed to help gather information and provide general
            health guidance. It is NOT a substitute for professional medical advice,
            diagnosis, or treatment. Always seek the advice of a qualified healthcare
            provider with any questions you may have regarding a medical condition.
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
            <strong>If you are experiencing a medical emergency, call emergency services
            (911 in the US, 15 in France, 112 in Europe) immediately.</strong>
          </p>
        </div>
      </main>
    </div>
  );
}
