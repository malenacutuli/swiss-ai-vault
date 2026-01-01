import { useState } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
  AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { GroundedResponse, ConfidenceLevel, SourceCitation } from '@/lib/trust/grounded-response';

interface GroundedResponseDisplayProps {
  response: GroundedResponse;
  onSourceClick?: (citation: SourceCitation) => void;
}

const confidenceConfig: Record<ConfidenceLevel, {
  icon: typeof CheckCircle2;
  color: string;
  bgColor: string;
  label: string;
  description: string;
}> = {
  high: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    label: 'High Confidence',
    description: 'Well-supported by your documents'
  },
  medium: {
    icon: Info,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'Medium Confidence',
    description: 'Partially supported, verify key claims'
  },
  low: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    label: 'Low Confidence',
    description: 'Limited source support, verify independently'
  },
  unverified: {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'Unverified',
    description: 'Not found in your documents'
  }
};

export function GroundedResponseDisplay({ 
  response, 
  onSourceClick 
}: GroundedResponseDisplayProps) {
  const [showSources, setShowSources] = useState(false);
  const [showWarnings, setShowWarnings] = useState(response.warnings.length > 0);
  const [showAudit, setShowAudit] = useState(false);
  
  const confidenceInfo = confidenceConfig[response.overallConfidence];
  const ConfidenceIcon = confidenceInfo.icon;
  
  const verifiedClaims = response.claims.filter(c => c.verificationStatus === 'verified').length;
  const totalClaims = response.claims.length;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Confidence Banner */}
        <div className={cn(
          "flex items-center justify-between p-3 rounded-lg border",
          confidenceInfo.bgColor
        )}>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-full bg-background/80", confidenceInfo.color)}>
              <ConfidenceIcon className="h-5 w-5" />
            </div>
            <div>
              <p className={cn("font-medium", confidenceInfo.color)}>
                {confidenceInfo.label}
              </p>
              <p className="text-sm text-muted-foreground">
                {confidenceInfo.description}
              </p>
            </div>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="cursor-help">
                {verifiedClaims}/{totalClaims} verified
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{verifiedClaims} claims backed by your documents</p>
              <p>{totalClaims - verifiedClaims} claims need independent verification</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Warnings */}
        {response.warnings.length > 0 && (
          <Collapsible open={showWarnings} onOpenChange={setShowWarnings}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between p-3 h-auto bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30"
              >
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">
                    {response.warnings.length} Important Notice{response.warnings.length > 1 ? 's' : ''}
                  </span>
                </div>
                {showWarnings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-b-lg border-x border-b border-amber-200 dark:border-amber-800">
                {response.warnings.map((warning, i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5 text-sm text-amber-800 dark:text-amber-300">
                    <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Response Content */}
        <div className="prose dark:prose-invert max-w-none">
          <p className="whitespace-pre-wrap">{response.content}</p>
        </div>

        {/* Sources Used */}
        {response.sourcesUsed.length > 0 && (
          <Collapsible open={showSources} onOpenChange={setShowSources}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {response.sourcesUsed.length} Source{response.sourcesUsed.length > 1 ? 's' : ''} Referenced
                </div>
                {showSources ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2">
                {response.sourcesUsed.map((source, i) => (
                  <Card 
                    key={i} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => onSourceClick?.(source)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <span className="font-medium text-sm truncate">
                              {source.documentName}
                            </span>
                            {source.pageNumber && (
                              <Badge variant="secondary" className="text-xs">
                                Page {source.pageNumber}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            "{source.excerpt}"
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(
                            "text-xs font-medium",
                            source.relevanceScore > 0.8 ? "text-green-600" :
                            source.relevanceScore > 0.5 ? "text-amber-600" : "text-orange-600"
                          )}>
                            {(source.relevanceScore * 100).toFixed(0)}% match
                          </span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Audit Trail (for compliance) */}
        <Collapsible open={showAudit} onOpenChange={setShowAudit}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              <Shield className="h-3 w-3 mr-1" />
              View Audit Trail
              {showAudit ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Compliance Audit Trail
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-3">
                <div className="space-y-1 text-xs font-mono">
                  {response.auditLog.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {new Date(entry.timestamp).toISOString()}
                      </span>
                      <span>{entry.action}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <span className="text-muted-foreground">Model:</span>
                    <span>{response.metadata.modelUsed}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Domains:</span>
                    <span>{response.metadata.domainDetected.join(', ') || 'General'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </TooltipProvider>
  );
}
