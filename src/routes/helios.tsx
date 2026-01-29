/**
 * HELIOS Routes
 * All health-related routes
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { HeliosLayout } from '@/components/helios/layout/HeliosLayout';
import { HeliosHome } from '@/components/helios/pages/HeliosHome';
import { HeliosChatPage } from '@/components/helios/chat/HeliosChatPage';
import { ConsultsPage } from '@/components/helios/pages/ConsultsPage';
import { HealthRecordPage } from '@/components/helios/pages/HealthRecordPage';
import { AppointmentsPage } from '@/components/helios/pages/AppointmentsPage';
import { useAuth } from '@/contexts/AuthContext';

export function HeliosRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1D4E5F]" />
      </div>
    );
  }

  // Get display name from user metadata or email
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0];

  return (
    <HeliosLayout userName={displayName}>
      <Routes>
        {/* Home - New Consult */}
        <Route path="/" element={<HeliosHome userName={displayName} />} />

        {/* Chat */}
        <Route path="/chat/:sessionId" element={<HeliosChatPage />} />

        {/* Consults History */}
        <Route path="/consults" element={<ConsultsPage />} />

        {/* Health Record */}
        <Route path="/record" element={<HealthRecordPage />} />

        {/* Appointments */}
        <Route path="/appointments" element={<AppointmentsPage />} />

        {/* Specialty consults */}
        <Route path="/consult/:specialty" element={<HeliosHome />} />

        {/* Shared consult view */}
        <Route path="/shared/:token" element={<SharedConsultView />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/health" replace />} />
      </Routes>
    </HeliosLayout>
  );
}

// Placeholder for shared view
function SharedConsultView() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-center">
      <h1 className="text-2xl font-semibold mb-4">Shared Consult</h1>
      <p className="text-gray-600">
        This is a read-only view of a shared health consult.
      </p>
    </div>
  );
}
