import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle } from '@/icons';

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const provider = searchParams.get('provider') || detectProvider(state);

      // Handle error from OAuth provider
      if (error) {
        setStatus('error');
        setMessage(`Authentication failed: ${error}`);
        setTimeout(() => navigate('/chat?error=' + error), 2000);
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setMessage('Missing authorization code or state');
        setTimeout(() => navigate('/chat?error=missing_params'), 2000);
        return;
      }

      try {
        // Exchange code for tokens
        const { data, error: exchangeError } = await supabase.functions.invoke(`${provider}-oauth`, {
          body: {
            action: 'exchange_code',
            code,
            state
          }
        });

        if (exchangeError) throw exchangeError;

        setStatus('success');
        setMessage(`Successfully connected to ${provider}!`);
        
        // Post message to opener if in popup
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-callback',
            provider,
            success: true,
            data
          }, window.location.origin);
          setTimeout(() => window.close(), 1500);
        } else {
          setTimeout(() => navigate(`/chat?success=${provider}`), 1500);
        }
      } catch (err) {
        console.error('OAuth exchange failed:', err);
        setStatus('error');
        setMessage('Failed to complete authentication');
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-callback',
            provider,
            success: false,
            error: (err as Error).message
          }, window.location.origin);
          setTimeout(() => window.close(), 2000);
        } else {
          setTimeout(() => navigate('/chat?error=exchange_failed'), 2000);
        }
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === 'processing' && (
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        )}
        {status === 'success' && (
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
        )}
        {status === 'error' && (
          <XCircle className="h-12 w-12 text-destructive mx-auto" />
        )}
        <p className="text-lg text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

// Try to detect provider from state parameter
function detectProvider(state: string | null): string {
  if (!state) return 'slack';
  
  try {
    const decoded = atob(state);
    if (decoded.includes('slack')) return 'slack';
    if (decoded.includes('notion')) return 'notion';
    if (decoded.includes('gmail')) return 'gmail';
    if (decoded.includes('github')) return 'github';
  } catch {
    // State might not be base64 encoded
  }
  
  // Default to slack
  return 'slack';
}

export default OAuthCallback;
