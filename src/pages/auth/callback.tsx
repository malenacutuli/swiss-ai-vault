// src/pages/auth/callback.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check for error in URL params
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        
        if (error) {
          console.error('Auth callback error:', error, errorDescription);
          setStatus('error');
          setErrorMessage(errorDescription || error);
          setTimeout(() => navigate('/auth?error=auth_failed'), 2000);
          return;
        }

        // Get session from Supabase (handles code exchange automatically)
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session retrieval error:', sessionError);
          setStatus('error');
          setErrorMessage(sessionError.message);
          setTimeout(() => navigate('/auth?error=session_failed'), 2000);
          return;
        }

        if (data.session) {
          setStatus('success');
          
          // Check for redirect intent
          const intent = searchParams.get('intent');
          const next = searchParams.get('next');
          
          // Determine redirect destination
          let destination = '/ghost/chat'; // Default
          
          if (next) {
            destination = next;
          } else if (intent === 'vault') {
            destination = '/vault';
          } else if (intent === 'ghost') {
            destination = '/ghost/chat';
          }
          
          // Navigate after brief success display
          setTimeout(() => navigate(destination, { replace: true }), 500);
        } else {
          // No session, redirect to login
          setStatus('error');
          setErrorMessage('No session found');
          setTimeout(() => navigate('/auth'), 2000);
        }
      } catch (err) {
        console.error('Auth callback exception:', err);
        setStatus('error');
        setErrorMessage('An unexpected error occurred');
        setTimeout(() => navigate('/auth?error=unexpected'), 2000);
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === 'processing' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Completing authentication...</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="h-8 w-8 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-muted-foreground">Authentication successful! Redirecting...</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="h-8 w-8 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-muted-foreground">Authentication failed</p>
            {errorMessage && (
              <p className="text-sm text-red-400">{errorMessage}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
