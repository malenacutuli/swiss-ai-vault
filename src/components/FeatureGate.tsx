import { Navigate } from 'react-router-dom';
import { useFeatureAccess, FeatureAccess } from '@/hooks/useFeatureAccess';
import { Loader2 } from 'lucide-react';

interface FeatureGateProps {
  feature: keyof FeatureAccess;
  children: React.ReactNode;
  fallback?: string;
}

export function FeatureGate({ feature, children, fallback = '/chat' }: FeatureGateProps) {
  const { canAccess, isLoading } = useFeatureAccess();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canAccess(feature)) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
