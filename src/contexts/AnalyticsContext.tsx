// src/contexts/AnalyticsContext.tsx
import React, { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface AnalyticsEvent {
  event_type: string;
  event_name?: string;
  page_path?: string;
  feature_category?: string;
  metadata?: Record<string, unknown>;
}

interface AnalyticsContextType {
  trackEvent: (event: AnalyticsEvent) => void;
  trackPageView: (path: string) => void;
  trackFeatureUse: (feature: string, category: string, metadata?: Record<string, unknown>) => void;
  trackClick: (element: string, metadata?: Record<string, unknown>) => void;
  getSessionId: () => string;
  getAnonymousId: () => string;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

// Generate a unique ID
const generateId = () => crypto.randomUUID();

// Get or create anonymous ID (persists across sessions)
const getOrCreateAnonymousId = (): string => {
  const key = 'sb_anonymous_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = generateId();
    localStorage.setItem(key, id);
  }
  return id;
};

// Get UTM parameters from URL
const getUtmParams = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
  };
};

// Get session storage data
const getSessionData = () => {
  const key = 'sb_session_data';
  const data = sessionStorage.getItem(key);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
};

const setSessionData = (data: Record<string, unknown>) => {
  sessionStorage.setItem('sb_session_data', JSON.stringify(data));
};

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const sessionIdRef = useRef<string>('');
  const anonymousIdRef = useRef<string>('');
  const eventQueueRef = useRef<AnalyticsEvent[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartTimeRef = useRef<number>(0);
  const pageCountRef = useRef<number>(0);
  const isInitializedRef = useRef(false);

  // Initialize on mount
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    anonymousIdRef.current = getOrCreateAnonymousId();
    
    // Check for existing session or create new one
    const existingSession = getSessionData();
    const now = Date.now();
    
    // Session expires after 30 minutes of inactivity
    if (existingSession && existingSession.lastActivity && (now - existingSession.lastActivity) < 30 * 60 * 1000) {
      sessionIdRef.current = existingSession.sessionId;
      sessionStartTimeRef.current = existingSession.startTime;
      pageCountRef.current = existingSession.pageCount || 0;
    } else {
      // Start new session
      sessionIdRef.current = generateId();
      sessionStartTimeRef.current = now;
      pageCountRef.current = 0;

      const utmParams = getUtmParams();
      
      // Send session start
      sendToBackend({
        type: 'session',
        session: {
          session_id: sessionIdRef.current,
          action: 'start',
          entry_page: window.location.pathname,
          anonymous_id: anonymousIdRef.current,
          referrer: document.referrer || undefined,
          ...utmParams
        }
      });

      // Store first visit data for signup attribution
      if (!localStorage.getItem('sb_first_visit')) {
        localStorage.setItem('sb_first_visit', JSON.stringify({
          timestamp: now,
          landing_page: window.location.pathname,
          referrer: document.referrer,
          ...utmParams
        }));
      }
    }

    // Update session data
    setSessionData({
      sessionId: sessionIdRef.current,
      startTime: sessionStartTimeRef.current,
      lastActivity: now,
      pageCount: pageCountRef.current
    });

    // Set up heartbeat
    const heartbeatInterval = setInterval(() => {
      setSessionData({
        sessionId: sessionIdRef.current,
        startTime: sessionStartTimeRef.current,
        lastActivity: Date.now(),
        pageCount: pageCountRef.current
      });

      sendToBackend({
        type: 'session',
        session: {
          session_id: sessionIdRef.current,
          action: 'heartbeat',
          exit_page: window.location.pathname
        }
      });
    }, 60000); // Every minute

    // Handle page unload
    const handleBeforeUnload = () => {
      // Flush remaining events
      if (eventQueueRef.current.length > 0) {
        flushEvents(true);
      }

      // End session
      sendToBackend({
        type: 'session',
        session: {
          session_id: sessionIdRef.current,
          action: 'end',
          exit_page: window.location.pathname
        }
      }, true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, []);

  // Track user authentication - both new signups AND existing user logins
  useEffect(() => {
    if (user && isInitializedRef.current) {
      const firstVisit = localStorage.getItem('sb_first_visit');
      
      // Small delay to ensure auth token is ready
      setTimeout(() => {
        if (firstVisit) {
          // NEW USER SIGNUP - send signup_complete with attribution data
          let firstVisitData: Record<string, unknown> = {};
          try {
            firstVisitData = JSON.parse(firstVisit);
          } catch {
            localStorage.removeItem('sb_first_visit');
            // Still track as login
            sendToBackend({
              type: 'user_login',
              session_id: sessionIdRef.current,
              is_new_user: false
            });
            return;
          }

          const signupData = {
            session_id: sessionIdRef.current,
            pages_before_signup: pageCountRef.current,
            time_to_signup_seconds: firstVisitData.timestamp 
              ? Math.floor((Date.now() - (firstVisitData.timestamp as number)) / 1000)
              : 0,
            landing_page: firstVisitData.landing_page,
            referrer: firstVisitData.referrer || document.referrer,
            utm_source: firstVisitData.utm_source,
            utm_medium: firstVisitData.utm_medium,
            utm_campaign: firstVisitData.utm_campaign
          };

          sendToBackend({
            type: 'signup_complete',
            signup_data: signupData
          });

          // Clear first visit data after signup
          localStorage.removeItem('sb_first_visit');
        } else {
          // EXISTING USER LOGIN - track login event and link session
          sendToBackend({
            type: 'user_login',
            session_id: sessionIdRef.current,
            is_new_user: false
          });
        }
      }, 500);
    }
  }, [user]);

  const sendToBackend = async (payload: Record<string, unknown>, sync = false) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      if (sync && 'sendBeacon' in navigator) {
        // Use sendBeacon for unload events
        navigator.sendBeacon(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-analytics`,
          JSON.stringify(payload)
        );
      } else {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-analytics`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          }
        );
      }
    } catch (error) {
      console.error('Analytics error:', error);
    }
  };

  const flushEvents = useCallback((sync = false) => {
    if (eventQueueRef.current.length === 0) return;

    const events = [...eventQueueRef.current];
    eventQueueRef.current = [];

    sendToBackend({
      type: 'events',
      events: events.map(e => ({
        ...e,
        session_id: sessionIdRef.current,
        anonymous_id: anonymousIdRef.current
      }))
    }, sync);
  }, []);

  const queueEvent = useCallback((event: AnalyticsEvent) => {
    eventQueueRef.current.push(event);

    // Update last activity
    setSessionData({
      sessionId: sessionIdRef.current,
      startTime: sessionStartTimeRef.current,
      lastActivity: Date.now(),
      pageCount: pageCountRef.current
    });

    // Batch events - flush every 5 seconds or when queue reaches 10 events
    if (eventQueueRef.current.length >= 10) {
      flushEvents();
    } else if (!flushTimeoutRef.current) {
      flushTimeoutRef.current = setTimeout(() => {
        flushEvents();
        flushTimeoutRef.current = null;
      }, 5000);
    }
  }, [flushEvents]);

  const trackEvent = useCallback((event: AnalyticsEvent) => {
    queueEvent(event);
  }, [queueEvent]);

  const trackPageView = useCallback((path: string) => {
    pageCountRef.current++;
    queueEvent({
      event_type: 'page_view',
      page_path: path
    });
  }, [queueEvent]);

  const trackFeatureUse = useCallback((feature: string, category: string, metadata?: Record<string, unknown>) => {
    queueEvent({
      event_type: 'feature_use',
      event_name: feature,
      feature_category: category,
      metadata
    });
  }, [queueEvent]);

  const trackClick = useCallback((element: string, metadata?: Record<string, unknown>) => {
    queueEvent({
      event_type: 'click',
      event_name: element,
      metadata
    });
  }, [queueEvent]);

  const getSessionId = useCallback(() => sessionIdRef.current, []);
  const getAnonymousId = useCallback(() => anonymousIdRef.current, []);

  return (
    <AnalyticsContext.Provider value={{
      trackEvent,
      trackPageView,
      trackFeatureUse,
      trackClick,
      getSessionId,
      getAnonymousId
    }}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}
