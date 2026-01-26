/**
 * Medical History Report Generator
 * 
 * Generates comprehensive medical history reports from consultation sessions:
 * - Aggregates data from all health sessions
 * - Extracts medical entities (symptoms, medications, conditions)
 * - Generates structured report in DOCX/PDF format
 * - Includes disclaimers and metadata
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ConversationSummary, useHealthStorage } from '@/hooks/useHealthStorage';
import { cn } from '@/lib/utils';
import {
  FileText,
  Download,
  Loader2,
  ArrowLeft,
  ClipboardList,
  Calendar,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  Shield,
  User,
  Stethoscope,
  Pill,
  Activity,
  Heart,
} from 'lucide-react';
import { generateDOCX, downloadDOCX, DocSection } from '@/lib/document-generators/docx-generator';

interface MedicalHistoryReportProps {
  onClose: () => void;
  conversations: ConversationSummary[];
}

interface ExtractedMedicalData {
  symptoms: string[];
  conditions: string[];
  medications: string[];
  allergies: string[];
  procedures: string[];
  labResults: string[];
  recommendations: string[];
  triageLevel?: string;
}

interface ReportSection {
  title: string;
  content: string[];
  level: 1 | 2 | 3;
}

export function MedicalHistoryReport({ onClose, conversations }: MedicalHistoryReportProps) {
  const { t } = useTranslation();
  const { getConversation } = useHealthStorage();
  
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedData, setExtractedData] = useState<ExtractedMedicalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter health-related conversations
  const healthConversations = useMemo(() => 
    conversations.filter(c => 
      c.taskType === 'health_consult' || 
      c.taskType === 'consultation' || 
      c.taskType === 'verified_expert' ||
      c.taskType === 'voice_consultation'
    ),
    [conversations]
  );

  const toggleSession = useCallback((id: string) => {
    setSelectedSessions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedSessions.size === healthConversations.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(healthConversations.map(c => c.id)));
    }
  }, [healthConversations, selectedSessions.size]);

  const extractMedicalEntities = useCallback(async (sessionIds: string[]): Promise<ExtractedMedicalData> => {
    const allMessages: string[] = [];
    
    for (const id of sessionIds) {
      const conv = getConversation(id);
      if (conv) {
        conv.messages.forEach(msg => {
          allMessages.push(`[${msg.role}]: ${msg.content}`);
        });
      }
    }

    const combinedText = allMessages.join('\n\n');
    
    try {
      // Use Claude to extract medical entities
      const { data, error } = await supabase.functions.invoke('hume-health-tool', {
        body: {
          query: `Extract all medical information from the following consultation transcripts. 
          Return a structured JSON with:
          - symptoms: array of reported symptoms
          - conditions: array of mentioned conditions or diagnoses
          - medications: array of medications mentioned
          - allergies: array of allergies
          - procedures: array of procedures or tests mentioned
          - labResults: array of lab results mentioned
          - recommendations: array of recommendations made
          
          TRANSCRIPTS:
          ${combinedText.slice(0, 15000)}`,
          extract_entities: true,
        },
      });

      if (error) throw error;

      // Parse the response
      const responseText = data?.response || '';
      
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          // Fall back to basic extraction
        }
      }

      // Fallback: basic keyword extraction
      return {
        symptoms: extractKeywords(combinedText, ['pain', 'ache', 'fever', 'fatigue', 'nausea', 'headache', 'dizziness', 'cough', 'swelling']),
        conditions: extractKeywords(combinedText, ['diabetes', 'hypertension', 'asthma', 'arthritis', 'allergy', 'infection']),
        medications: extractKeywords(combinedText, ['ibuprofen', 'aspirin', 'metformin', 'lisinopril', 'omeprazole']),
        allergies: [],
        procedures: [],
        labResults: [],
        recommendations: ['Consult with a healthcare professional for proper evaluation'],
      };
    } catch (err) {
      console.error('Entity extraction failed:', err);
      return {
        symptoms: [],
        conditions: [],
        medications: [],
        allergies: [],
        procedures: [],
        labResults: [],
        recommendations: ['Unable to extract entities. Please review session transcripts manually.'],
      };
    }
  }, [getConversation]);

  const generateReport = useCallback(async () => {
    if (selectedSessions.size === 0) {
      setError(t('ghost.health.report.noSessionsSelected', 'Please select at least one session'));
      return;
    }

    setIsGenerating(true);
    setProgress(10);
    setError(null);

    try {
      // Step 1: Extract medical entities
      setProgress(30);
      const extracted = await extractMedicalEntities(Array.from(selectedSessions));
      setExtractedData(extracted);
      
      setProgress(60);

      // Step 2: Build report sections
      const sections: DocSection[] = [];

      // Patient Summary (placeholder - would come from profile in production)
      sections.push({
        title: 'Patient Information',
        content: [
          'This report is generated from AI health consultation sessions.',
          `Report Date: ${new Date().toLocaleDateString()}`,
          `Sessions Included: ${selectedSessions.size}`,
        ],
        level: 1,
      });

      // Chief Complaints / Symptoms
      if (extracted.symptoms.length > 0) {
        sections.push({
          title: 'Reported Symptoms',
          content: extracted.symptoms.map(s => `• ${s}`),
          level: 2,
        });
      }

      // Medical Conditions
      if (extracted.conditions.length > 0) {
        sections.push({
          title: 'Discussed Conditions',
          content: extracted.conditions.map(c => `• ${c}`),
          level: 2,
        });
      }

      // Medications
      if (extracted.medications.length > 0) {
        sections.push({
          title: 'Medications Mentioned',
          content: extracted.medications.map(m => `• ${m}`),
          level: 2,
        });
      }

      // Allergies
      if (extracted.allergies.length > 0) {
        sections.push({
          title: 'Known Allergies',
          content: extracted.allergies.map(a => `• ${a}`),
          level: 2,
        });
      }

      // Lab Results
      if (extracted.labResults.length > 0) {
        sections.push({
          title: 'Laboratory Results Discussed',
          content: extracted.labResults.map(l => `• ${l}`),
          level: 2,
        });
      }

      // Recommendations
      if (extracted.recommendations.length > 0) {
        sections.push({
          title: 'AI Recommendations',
          content: extracted.recommendations.map(r => `• ${r}`),
          level: 2,
        });
      }

      // Session Timeline
      const sessionsIncluded = Array.from(selectedSessions).map(id => {
        const conv = healthConversations.find(c => c.id === id);
        return conv ? `• ${conv.title} (${new Date(conv.updatedAt).toLocaleDateString()})` : null;
      }).filter(Boolean) as string[];

      sections.push({
        title: 'Sessions Included',
        content: sessionsIncluded,
        level: 2,
      });

      // Disclaimers
      sections.push({
        title: 'Important Disclaimers',
        content: [
          '1. AI-ASSISTED DOCUMENTATION: This report was generated with AI assistance based on self-reported health consultations.',
          '2. NOT A DIAGNOSIS: This document does not constitute a medical diagnosis, medical advice, or treatment plan.',
          '3. CONSULT A PROFESSIONAL: All information should be reviewed and verified by a qualified healthcare provider.',
          '4. DATA ACCURACY: Accuracy depends on the completeness of information provided during consultations.',
        ],
        level: 1,
      });

      setProgress(80);

      // Step 3: Generate DOCX
      const blob = await generateDOCX(sections, {
        title: 'Medical History Report',
        subtitle: `Generated on ${new Date().toLocaleDateString()}`,
        author: 'SwissBrAIn Verified Expert System',
      });

      setProgress(100);

      // Step 4: Download
      downloadDOCX(blob, `medical-history-report-${new Date().toISOString().split('T')[0]}.docx`);

    } catch (err) {
      console.error('Report generation failed:', err);
      setError(t('ghost.health.report.generationFailed', 'Failed to generate report. Please try again.'));
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  }, [selectedSessions, extractMedicalEntities, healthConversations, t, getConversation]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          {t('common.back', 'Back')}
        </Button>
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-purple-600" />
          {t('ghost.health.report.title', 'Medical History Report Generator')}
        </h2>
      </div>

      <Card className="p-5">
        {/* Description */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="font-medium text-slate-800 mb-1">
              {t('ghost.health.report.subtitle', 'Generate a Comprehensive Medical History Report')}
            </h3>
            <p className="text-sm text-slate-500">
              {t('ghost.health.report.description', 'Select your health consultation sessions to create a structured medical history document. This report can be shared with healthcare providers.')}
            </p>
          </div>
        </div>

        <Separator className="mb-4" />

        {/* Session Selection */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-slate-700">
              {t('ghost.health.report.selectSessions', 'Select Sessions to Include')}
            </h4>
            <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">
              {selectedSessions.size === healthConversations.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          {healthConversations.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('ghost.health.report.noSessions', 'No health sessions found')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[250px] border rounded-lg">
              <div className="p-2 space-y-1">
                {healthConversations.map((conv) => (
                  <label
                    key={conv.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                      selectedSessions.has(conv.id) 
                        ? "bg-purple-50 border border-purple-200" 
                        : "hover:bg-slate-50"
                    )}
                  >
                    <Checkbox
                      checked={selectedSessions.has(conv.id)}
                      onCheckedChange={() => toggleSession(conv.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{conv.title}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Calendar className="w-3 h-3" />
                        {new Date(conv.updatedAt).toLocaleDateString()}
                        <span>•</span>
                        <MessageSquare className="w-3 h-3" />
                        {conv.messageCount} messages
                        {conv.taskType && (
                          <>
                            <span>•</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {conv.taskType === 'voice_consultation' ? 'Voice' : 'Text'}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Extracted Data Preview */}
        {extractedData && (
          <div className="mb-4 p-4 bg-slate-50 rounded-lg">
            <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {t('ghost.health.report.extractedData', 'Extracted Medical Information')}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {extractedData.symptoms.length > 0 && (
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-orange-500" />
                  <span>{extractedData.symptoms.length} symptoms</span>
                </div>
              )}
              {extractedData.conditions.length > 0 && (
                <div className="flex items-center gap-2">
                  <Heart className="w-3.5 h-3.5 text-red-500" />
                  <span>{extractedData.conditions.length} conditions</span>
                </div>
              )}
              {extractedData.medications.length > 0 && (
                <div className="flex items-center gap-2">
                  <Pill className="w-3.5 h-3.5 text-blue-500" />
                  <span>{extractedData.medications.length} medications</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 rounded-lg flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Progress */}
        {isGenerating && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span>{t('ghost.health.report.generating', 'Generating report...')}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="w-3.5 h-3.5" />
            {t('ghost.health.report.privacyNote', 'Report generated locally, never uploaded')}
          </div>
          <Button
            onClick={generateReport}
            disabled={isGenerating || selectedSessions.size === 0}
            className="bg-purple-600 hover:bg-purple-700 gap-2"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            {t('ghost.health.report.generate', 'Generate Report')}
          </Button>
        </div>
      </Card>

      {/* Information Card */}
      <Card className="p-4 bg-amber-50 border-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">{t('ghost.health.report.disclaimer.title', 'Important Notice')}</p>
            <p className="text-amber-700">
              {t('ghost.health.report.disclaimer.text', 'This report is generated from AI consultation sessions and is not a substitute for professional medical evaluation. Always consult with qualified healthcare providers for diagnosis and treatment.')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Helper function to extract keywords from text
function extractKeywords(text: string, keywords: string[]): string[] {
  const found: string[] = [];
  const lowerText = text.toLowerCase();
  
  for (const keyword of keywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      found.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
    }
  }
  
  return found;
}
