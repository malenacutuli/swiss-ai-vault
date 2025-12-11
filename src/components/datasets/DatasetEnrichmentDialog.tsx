import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { useDatasetEnrichment } from '@/hooks/useDatasetEnrichment';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  open: boolean;
  onClose: () => void;
  trainingExamples: any[];
  onEnrichComplete: (newExamples: any[]) => void;
  hasValidationSplit: boolean;
}

export function DatasetEnrichmentDialog({
  open,
  onClose,
  trainingExamples,
  onEnrichComplete,
  hasValidationSplit
}: Props) {
  const [targetCount, setTargetCount] = useState(100);
  const [creativity, setCreativity] = useState(0.3);
  const [instructions, setInstructions] = useState('');
  
  const { enrichDataset, isEnriching, enrichmentProgress } = useDatasetEnrichment();

  const handleEnrich = async () => {
    const result = await enrichDataset({
      seedExamples: trainingExamples,
      targetCount,
      creativity,
      instructions,
      preserveFormat: true
    });

    if (result) {
      onEnrichComplete(result.generatedExamples);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Enrich Dataset with Synthetic Data
          </DialogTitle>
          <DialogDescription>
            Generate additional training examples based on your existing {trainingExamples.length} examples.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!hasValidationSplit && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Recommended:</strong> Split your dataset into training/validation 
                before enriching to avoid data leakage. Synthetic data should only be 
                added to the training set.
              </AlertDescription>
            </Alert>
          )}

          {/* Target Count Slider */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Examples to Generate</Label>
              <span className="text-sm font-medium">{targetCount}</span>
            </div>
            <Slider
              value={[targetCount]}
              onValueChange={([v]) => setTargetCount(v)}
              min={10}
              max={500}
              step={10}
            />
            <p className="text-xs text-muted-foreground">
              Final dataset size: ~{trainingExamples.length + targetCount} examples
            </p>
          </div>

          {/* Creativity Slider */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Creativity (Temperature)</Label>
              <span className="text-sm font-medium">{creativity.toFixed(1)}</span>
            </div>
            <Slider
              value={[creativity]}
              onValueChange={([v]) => setCreativity(v)}
              min={0}
              max={1}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              Lower = more consistent, Higher = more diverse
            </p>
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <Label>Custom Instructions (Optional)</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="E.g., Focus on edge cases, vary sentence structure, maintain professional tone..."
              rows={3}
            />
          </div>

          {/* Progress */}
          {isEnriching && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Generating...</span>
                <span>{enrichmentProgress}%</span>
              </div>
              <Progress value={enrichmentProgress} />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isEnriching}>
            Cancel
          </Button>
          <Button onClick={handleEnrich} disabled={isEnriching}>
            {isEnriching ? 'Generating...' : `Generate ${targetCount} Examples`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
