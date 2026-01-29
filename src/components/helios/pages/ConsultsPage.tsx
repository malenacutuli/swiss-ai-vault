/**
 * Consults History Page
 * List of past AI consults from database
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, ChevronRight, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase as mainSupabase } from '@/integrations/supabase/client';
import { supabase as heliosSupabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Consult {
  id: string;
  session_id: string;
  user_id?: string;
  specialty?: string;
  current_phase: string;
  chief_complaint: string | null;
  triage_level: number | null;
  created_at: string;
  updated_at?: string;
  completed_at: string | null;
  summary?: string;
  disposition?: string;
}

// ESI triage level colors (1=critical to 5=non-urgent)
const triageLevelColors: Record<number, string> = {
  1: 'bg-red-100 text-red-700',
  2: 'bg-orange-100 text-orange-700',
  3: 'bg-yellow-100 text-yellow-700',
  4: 'bg-green-100 text-green-700',
  5: 'bg-blue-100 text-blue-700',
};

const triageLevelLabels: Record<number, string> = {
  1: 'ESI 1 - Immediate',
  2: 'ESI 2 - Emergent',
  3: 'ESI 3 - Urgent',
  4: 'ESI 4 - Less Urgent',
  5: 'ESI 5 - Non-urgent',
};

export function ConsultsPage() {
  const [consults, setConsults] = useState<Consult[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchConsults();
  }, []);

  const fetchConsults = async () => {
    try {
      // Get user from main Supabase auth
      const { data: { user } } = await mainSupabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Use helios-chat edge function to list sessions
      const { data, error } = await heliosSupabase.functions.invoke('helios-chat', {
        body: {
          action: 'list_sessions',
          user_id: user.id,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to load consults');

      setConsults((data.sessions as Consult[]) || []);
    } catch (err) {
      console.error('Failed to fetch consults:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#1D4E5F]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {consults.length === 0 ? (
        // Empty state
        <div className="text-center py-16">
          <h1 className="text-4xl font-serif mb-4">
            You have no consults
          </h1>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Start a health consultation to get AI-powered triage and guidance.
            Your completed consults will appear here.
          </p>

          <Link to="/health">
            <Button className="h-12 px-8 bg-[#1D4E5F] hover:bg-[#1D4E5F]/90">
              Start a New Chat
            </Button>
          </Link>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-serif">Your Consults</h1>
            <Link to="/health">
              <Button className="bg-[#1D4E5F] hover:bg-[#1D4E5F]/90">
                <Plus className="w-4 h-4 mr-2" />
                New Consult
              </Button>
            </Link>
          </div>

          <div className="space-y-3">
            {consults.map((consult) => (
              <button
                key={consult.id}
                onClick={() => navigate(`/health/chat/${consult.session_id}`)}
                className="block w-full text-left bg-white rounded-xl p-4 border hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#1D4E5F]/10 rounded-full flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-[#1D4E5F]" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {consult.chief_complaint || (consult.current_phase === 'completed' ? 'Completed Consult' : 'In Progress')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(consult.completed_at || consult.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {consult.current_phase !== 'completed' && (
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                        In Progress
                      </span>
                    )}
                    {consult.triage_level && (
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        triageLevelColors[consult.triage_level] || 'bg-gray-100'
                      )}>
                        {triageLevelLabels[consult.triage_level] || `ESI ${consult.triage_level}`}
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Privacy note */}
          <p className="text-center text-sm text-gray-500 mt-8">
            🔒 Your health consultations are private and secure.
          </p>
        </div>
      )}
    </div>
  );
}
