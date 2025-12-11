import { useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

interface QualityCheckProps {
  rows: any[];
}

export function DatasetQualityCheck({ rows }: QualityCheckProps) {
  const analysis = useMemo(() => {
    if (rows.length === 0) return null;

    const issues: { type: 'error' | 'warning' | 'info'; message: string }[] = [];
    const stats = {
      total: rows.length,
      avgInputLength: 0,
      avgOutputLength: 0,
      duplicates: 0,
      emptyOutputs: 0,
      shortOutputs: 0,
    };

    const seen = new Set<string>();
    let totalInputLen = 0;
    let totalOutputLen = 0;

    for (const row of rows) {
      const key = JSON.stringify(row);
      if (seen.has(key)) {
        stats.duplicates++;
      } else {
        seen.add(key);
      }

      const outputLen = (row.output || '').length;
      const inputLen = (row.instruction || row.input || '').length;
      
      totalInputLen += inputLen;
      totalOutputLen += outputLen;

      if (!outputLen) stats.emptyOutputs++;
      if (outputLen < 20) stats.shortOutputs++;
    }

    stats.avgInputLength = totalInputLen / rows.length;
    stats.avgOutputLength = totalOutputLen / rows.length;

    // Generate issues
    if (rows.length < 50) {
      issues.push({ type: 'warning', message: `Only ${rows.length} examples. Minimum 50 recommended for POC.` });
    }
    if (rows.length < 500) {
      issues.push({ type: 'info', message: 'Consider enriching to 500+ examples for production quality.' });
    }
    if (stats.duplicates > 0) {
      issues.push({ type: 'warning', message: `${stats.duplicates} duplicate examples found.` });
    }
    if (stats.emptyOutputs > 0) {
      issues.push({ type: 'error', message: `${stats.emptyOutputs} examples have empty outputs.` });
    }
    if (stats.shortOutputs > rows.length * 0.2) {
      issues.push({ type: 'warning', message: `${stats.shortOutputs} examples have very short outputs (<20 chars).` });
    }
    if (stats.avgOutputLength < 50) {
      issues.push({ type: 'info', message: 'Average output length is short. Consider more detailed responses.' });
    }

    return { stats, issues };
  }, [rows]);

  if (!analysis) return null;

  const { stats, issues } = analysis;
  const hasErrors = issues.some(i => i.type === 'error');
  const hasWarnings = issues.some(i => i.type === 'warning');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {hasErrors ? (
          <XCircle className="h-5 w-5 text-destructive" />
        ) : hasWarnings ? (
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        ) : (
          <CheckCircle className="h-5 w-5 text-green-600" />
        )}
        <span className="font-medium">
          {hasErrors ? 'Issues Found' : hasWarnings ? 'Warnings' : 'Dataset Looks Good'}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Examples</p>
          <p className="font-medium">{stats.total}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Avg Input</p>
          <p className="font-medium">{Math.round(stats.avgInputLength)} chars</p>
        </div>
        <div>
          <p className="text-muted-foreground">Avg Output</p>
          <p className="font-medium">{Math.round(stats.avgOutputLength)} chars</p>
        </div>
        <div>
          <p className="text-muted-foreground">Est. Tokens</p>
          <p className="font-medium">~{Math.round((stats.avgInputLength + stats.avgOutputLength) * stats.total / 4).toLocaleString()}</p>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="space-y-2">
          {issues.map((issue, i) => (
            <Alert key={i} variant={issue.type === 'error' ? 'destructive' : 'default'}>
              {issue.type === 'error' && <XCircle className="h-4 w-4" />}
              {issue.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
              {issue.type === 'info' && <Info className="h-4 w-4" />}
              <AlertDescription>{issue.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}
