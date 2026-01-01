import { useState } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert,
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Building2,
  GraduationCap,
  Stethoscope,
  Scale,
  Newspaper,
  Globe,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { VerifiedSearchResult, WebSource, TrustLevel, SourceType } from '@/lib/trust/verified-search';

interface VerifiedSourcesDisplayProps {
  result: VerifiedSearchResult;
  onSourceClick?: (source: WebSource) => void;
}

const trustConfig: Record<TrustLevel, {
  icon: typeof ShieldCheck;
  color: string;
  bgColor: string;
  label: string;
}> = {
  authoritative: {
    icon: ShieldCheck,
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    label: 'Authoritative Sources',
  },
  reliable: {
    icon: Shield,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Reliable Sources',
  },
  moderate: {
    icon: Info,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'Moderate Confidence',
  },
  low: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    label: 'Low Confidence',
  },
  unknown: {
    icon: ShieldAlert,
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'Unverified Sources',
  },
};

const sourceTypeIcons: Record<SourceType, typeof Building2> = {
  government: Building2,
  academic: GraduationCap,
  medical: Stethoscope,
  legal: Scale,
  news: Newspaper,
  corporate: Building2,
  wiki: Globe,
  blog: Globe,
  forum: Globe,
  unknown: Globe,
};

export function VerifiedSourcesDisplay({ 
  result, 
  onSourceClick 
}: VerifiedSourcesDisplayProps) {
  const [showSources, setShowSources] = useState(true);
  const [showMethodology, setShowMethodology] = useState(false);
  
  const trustInfo = trustConfig[result.overallTrust];
  const TrustIcon = trustInfo.icon;
  
  const authoritativeSources = result.sources.filter(s => 
    s.trustLevel === 'authoritative' || s.trustLevel === 'reliable'
  );

  return (
    <div className="mt-4 space-y-3">
      {/* Trust Banner */}
      <div className={cn(
        "rounded-lg p-3 flex items-center justify-between",
        trustInfo.bgColor
      )}>
        <div className="flex items-center gap-2">
          <TrustIcon className={cn("h-5 w-5", trustInfo.color)} />
          <div>
            <span className={cn("font-medium text-sm", trustInfo.color)}>
              {trustInfo.label}
            </span>
            <p className="text-xs text-muted-foreground">
              {authoritativeSources.length} of {result.sources.length} sources are authoritative
            </p>
          </div>
        </div>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="cursor-help">
                {(result.sources.reduce((sum, s) => sum + s.trustScore, 0) / result.sources.length * 100).toFixed(0)}% trust
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-xs">
                Trust score based on source authority, type, and reliability
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Important Notices
            </span>
          </div>
          <ul className="space-y-1">
            {result.warnings.map((warning, i) => (
              <li key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Sources */}
      <Collapsible open={showSources} onOpenChange={setShowSources}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {result.sources.length} Sources Referenced
            </div>
            {showSources ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2 pt-2">
            {result.sources.map((source, i) => {
              const SourceIcon = sourceTypeIcons[source.sourceType];
              const sourceTrust = trustConfig[source.trustLevel];
              
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    source.trustLevel === 'authoritative' || source.trustLevel === 'reliable'
                      ? "border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20"
                      : source.trustLevel === 'moderate'
                      ? "border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <SourceIcon className={cn("h-4 w-4 flex-shrink-0", sourceTrust.color)} />
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-foreground hover:text-primary truncate flex items-center gap-1"
                          onClick={(e) => {
                            if (onSourceClick) {
                              e.preventDefault();
                              onSourceClick(source);
                            }
                          }}
                        >
                          {source.title}
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {source.snippet}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {source.domain}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={cn("text-[10px]", sourceTrust.color)}
                        >
                          {source.sourceType}
                        </Badge>
                        <span className={cn("text-[10px]", sourceTrust.color)}>
                          {(source.trustScore * 100).toFixed(0)}% trust
                        </span>
                      </div>
                      {source.warnings && source.warnings.length > 0 && (
                        <div className="mt-2 text-[10px] text-amber-600 dark:text-amber-400">
                          ⚠️ {source.warnings[0]}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      {/* Methodology */}
      <Collapsible open={showMethodology} onOpenChange={setShowMethodology}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
            <span className="text-xs">View Search Methodology</span>
            {showMethodology ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="rounded-lg bg-muted/50 p-3 mt-2">
            <p className="text-xs text-muted-foreground">{result.methodology}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-2">
              Searched at: {new Date(result.searchTimestamp).toLocaleString()}
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
