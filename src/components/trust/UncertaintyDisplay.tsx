import { HelpCircle, Upload, Search, MessageSquare, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface UncertaintyDisplayProps {
  query: string;
  domains: string[];
  searchAttempted: boolean;
  onUploadDocuments: () => void;
  onRephrase: () => void;
  onAskAnyway: () => void;
}

export function UncertaintyDisplay({
  query,
  domains,
  searchAttempted,
  onUploadDocuments,
  onRephrase,
  onAskAnyway
}: UncertaintyDisplayProps) {
  const domainLabel = domains.length > 0 ? domains.join('/') : 'professional';

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <HelpCircle className="h-5 w-5" />
          I Don't Have Enough Information
        </CardTitle>
        <CardDescription>
          I couldn't find reliable information in your documents to answer this {domainLabel} question.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Explanation */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Why am I seeing this?</AlertTitle>
          <AlertDescription>
            For {domainLabel} questions, SwissVault requires source verification to prevent errors 
            that could have serious consequences. I won't make up information.
          </AlertDescription>
        </Alert>

        {/* What was searched */}
        <div className="space-y-2">
          <p className="text-sm font-medium">What I searched for:</p>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-start gap-2">
              <Search className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <span className="text-sm">"{query}"</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {searchAttempted 
              ? "No documents matched with sufficient relevance (threshold: 30%)"
              : "Your document library is empty"
            }
          </p>
        </div>

        {/* Recommendations */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Recommendations:</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onUploadDocuments}>
              <Upload className="h-4 w-4 mr-2" />
              Upload relevant documents
            </Button>
            <Button variant="outline" size="sm" onClick={onRephrase}>
              <Search className="h-4 w-4 mr-2" />
              Rephrase your question
            </Button>
            <Button variant="ghost" size="sm" onClick={onAskAnyway}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Ask anyway (unverified response)
            </Button>
          </div>
        </div>

        {/* Professional disclaimer */}
        <p className="text-xs text-muted-foreground border-t pt-3">
          For {domainLabel} matters, always consult a qualified professional. 
          AI responses, even when sourced, are not a substitute for expert advice.
        </p>
      </CardContent>
    </Card>
  );
}
