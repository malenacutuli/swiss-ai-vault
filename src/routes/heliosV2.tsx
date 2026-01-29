/**
 * HELIOS Routes V2
 * Complete health platform routing
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { HeliosLayout } from '@/components/helios/layout/HeliosLayout';
import { HeliosHome } from '@/components/helios/pages/HeliosHome';
import { HeliosChatPageV2 } from '@/components/helios/chat/HeliosChatPageV2';
import { ConsultsPage } from '@/components/helios/pages/ConsultsPage';
import { HealthRecordPage } from '@/components/helios/pages/HealthRecordPage';
import { AppointmentsPage } from '@/components/helios/pages/AppointmentsPage';
import { SOAPNoteView } from '@/components/helios/reports/SOAPNoteView';
import { AssessmentPlanView } from '@/components/helios/reports/AssessmentPlanView';
import { SignInPrompt } from '@/components/helios/auth/SignInPrompt';

// Mock auth hook - replace with actual implementation
function useAuth() {
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('helios_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // Invalid saved user
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = () => {
    // Mock sign in - replace with actual auth
    const mockUser = { name: 'Guest', email: 'guest@example.com' };
    setUser(mockUser);
    localStorage.setItem('helios_user', JSON.stringify(mockUser));
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem('helios_user');
  };

  return { user, isLoading, signIn, signOut };
}

export function HeliosRoutesV2() {
  const { user, isLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);

  // Show sign-in prompt for guests after first visit
  useEffect(() => {
    if (!user && !isLoading) {
      const hasSeenPrompt = localStorage.getItem('helios_seen_signin');
      if (!hasSeenPrompt) {
        setShowSignInPrompt(true);
      }
    }
  }, [user, isLoading]);

  const handleSignIn = () => {
    setShowSignInPrompt(false);
    signIn();
  };

  const handleContinueGuest = () => {
    setShowSignInPrompt(false);
    localStorage.setItem('helios_seen_signin', 'true');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F7]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1D4E5F]" />
      </div>
    );
  }

  return (
    <>
      {/* Sign-in prompt modal for guests */}
      {showSignInPrompt && !user && (
        <SignInPrompt
          variant="modal"
          onSignIn={handleSignIn}
          onContinueGuest={handleContinueGuest}
        />
      )}

      {/* Sign-in banner for guests (shown after dismissing modal) */}
      {!user && !showSignInPrompt && (
        <SignInPrompt
          variant="banner"
          onSignIn={handleSignIn}
          onContinueGuest={() => {}}
        />
      )}

      <HeliosLayout userName={user?.name || user?.email?.split('@')[0]}>
        <Routes>
          {/* Home */}
          <Route path="/" element={<HeliosHome userName={user?.name} />} />

          {/* Chat */}
          <Route path="/chat/:sessionId" element={<HeliosChatPageV2 />} />

          {/* Reports */}
          <Route path="/chat/:sessionId/soap" element={<SOAPNoteRoute />} />
          <Route path="/chat/:sessionId/assessment" element={<AssessmentRoute />} />

          {/* Consults */}
          <Route path="/consults" element={<ConsultsPage />} />

          {/* Health Record */}
          <Route path="/record" element={<HealthRecordPage />} />

          {/* Appointments */}
          <Route path="/appointments" element={<AppointmentsPage />} />

          {/* Shared view */}
          <Route path="/shared/:token" element={<SharedConsultView />} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/health" replace />} />
        </Routes>
      </HeliosLayout>
    </>
  );
}

// Route components for reports
function SOAPNoteRoute() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();

  // In real implementation, load SOAP note from vault
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-center">
      <p className="text-gray-600">Loading SOAP Note for session {sessionId}...</p>
      <button
        onClick={() => navigate(-1)}
        className="mt-4 text-blue-600 hover:underline"
      >
        Go back
      </button>
    </div>
  );
}

function AssessmentRoute() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();

  // In real implementation, load assessment from vault
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-center">
      <p className="text-gray-600">Loading Assessment for session {sessionId}...</p>
      <button
        onClick={() => navigate(-1)}
        className="mt-4 text-blue-600 hover:underline"
      >
        Go back
      </button>
    </div>
  );
}

function SharedConsultView() {
  const { token } = useParams<{ token: string }>();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-center">
      <h1 className="text-2xl font-semibold mb-4">Shared Consult</h1>
      <p className="text-gray-600 mb-4">
        This is a read-only view of a shared health consult.
      </p>
      <p className="text-sm text-gray-400">
        Share token: {token}
      </p>
    </div>
  );
}
