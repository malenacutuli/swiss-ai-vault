import { useTranslation } from 'react-i18next';
import { Key, Globe, Brain, Sparkles, Lock, CheckCircle, Search, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResearchProgressProps {
  stage: string;
  progress: number;
  isZeroTrace: boolean;
}

export function ResearchProgress({ stage, progress, isZeroTrace }: ResearchProgressProps) {
  const { t } = useTranslation();
  
  const stages = isZeroTrace ? [
    { id: 'encrypting', labelKey: 'vaultChat.research.stages.encrypting', icon: Key },
    { id: 'searching', labelKey: 'vaultChat.research.stages.searching', icon: Globe },
    { id: 'analyzing', labelKey: 'vaultChat.research.stages.analyzing', icon: Brain },
    { id: 'synthesizing', labelKey: 'vaultChat.research.stages.synthesizing', icon: Sparkles },
    { id: 'decrypting', labelKey: 'vaultChat.research.stages.encryptingResults', icon: Lock },
  ] : [
    { id: 'searching', labelKey: 'vaultChat.research.stages.searching', icon: Globe },
    { id: 'analyzing', labelKey: 'vaultChat.research.stages.analyzing', icon: Brain },
    { id: 'synthesizing', labelKey: 'vaultChat.research.stages.synthesizing', icon: Sparkles },
  ];

  const currentIndex = stages.findIndex(s => s.id === stage);

  return (
    <div className={cn(
      "p-4 rounded-lg border",
      isZeroTrace 
        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
        : "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
    )}>
      <div className="flex items-center gap-2 mb-3">
        {isZeroTrace ? (
          <div className="flex items-center">
            <Shield className="h-5 w-5 text-green-600" />
            <Lock className="h-4 w-4 text-green-600 -ml-1" />
          </div>
        ) : (
          <Search className="h-5 w-5 text-purple-600" />
        )}
        <span className={cn(
          "font-medium",
          isZeroTrace ? "text-green-700 dark:text-green-300" : "text-purple-700 dark:text-purple-300"
        )}>
          {isZeroTrace ? t('vaultChat.research.encryptedInProgress') : t('vaultChat.research.inProgress')}
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full mb-4 overflow-hidden">
        <div 
          className={cn(
            "h-full transition-all duration-500 rounded-full",
            isZeroTrace ? "bg-green-500" : "bg-purple-500"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Stage indicators */}
      <div className="flex items-center justify-between">
        {stages.map((s, i) => {
          const Icon = s.icon;
          const isComplete = i < currentIndex;
          const isCurrent = i === currentIndex;
          
          return (
            <div key={s.id} className="flex flex-col items-center gap-1">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                isComplete 
                  ? (isZeroTrace ? "bg-green-500 text-white" : "bg-purple-500 text-white")
                  : isCurrent
                    ? (isZeroTrace ? "bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-300 animate-pulse" : "bg-purple-200 text-purple-700 dark:bg-purple-800 dark:text-purple-300 animate-pulse")
                    : "bg-muted text-muted-foreground"
              )}>
                {isComplete ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span className={cn(
                "text-xs text-center max-w-[80px]",
                isCurrent ? "font-medium" : "text-muted-foreground"
              )}>
                {t(s.labelKey)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
