import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SwissBrAInLayout } from '@/components/agents/SwissBrAInLayout';
import { Loader2 } from 'lucide-react';

export default function SwissBrAInAgents() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#D35400]" />
          <p className="text-[#666666]">Loading SwissBrAIn...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <SwissBrAInLayout />;
}
