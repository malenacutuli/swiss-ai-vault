/**
 * Consults History Page
 * List of past AI consults (encrypted locally)
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHealthVault } from '@/hooks/helios/useHealthVault';
import { cn } from '@/lib/utils';

const triageLevelColors: Record<string, string> = {
  'ESI1': 'bg-red-100 text-red-700',
  'ESI2': 'bg-orange-100 text-orange-700',
  'ESI3': 'bg-yellow-100 text-yellow-700',
  'ESI4': 'bg-green-100 text-green-700',
  'ESI5': 'bg-blue-100 text-blue-700',
};

export function ConsultsPage() {
  const [consults, setConsults] = useState<any[]>([]);
  const { vault, isInitialized } = useHealthVault();

  useEffect(() => {
    if (vault && isInitialized) {
      loadConsults();
    }
  }, [vault, isInitialized]);

  const loadConsults = async () => {
    const list = await vault?.listConsults();
    setConsults(list || []);
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {consults.length === 0 ? (
        // Empty state
        <div className="text-center py-16">
          <h1 className="text-4xl font-serif mb-4">
            You have no consults
          </h1>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            If you recently became a member, your previous chats were anonymous
            and cannot be linked to your account. Always remember to login before
            using HELIOS.
          </p>

          <Link to="/health">
            <Button className="h-12 px-8 bg-[#2196F3] hover:bg-[#1976D2]">
              Start a New Chat
            </Button>
          </Link>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-serif">Your Consults</h1>
            <Link to="/health">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Consult
              </Button>
            </Link>
          </div>

          <div className="space-y-3">
            {consults.map((consult) => (
              <Link
                key={consult.id}
                to={`/health/chat/${consult.id}`}
                className="block bg-white rounded-xl p-4 border hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#1D4E5F]/10 rounded-full flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-[#1D4E5F]" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {consult.phase === 'completed' ? 'Completed Consult' : 'In Progress'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(consult.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {consult.triageLevel && (
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        triageLevelColors[consult.triageLevel] || 'bg-gray-100'
                      )}>
                        {consult.triageLevel}
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Privacy note */}
          <p className="text-center text-sm text-gray-500 mt-8">
            🔒 All consults are encrypted and stored only on your device.
          </p>
        </div>
      )}
    </div>
  );
}
