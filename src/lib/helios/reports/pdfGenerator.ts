/**
 * PDF Generator for SOAP Notes
 * Creates downloadable PDF reports
 */

import type { SOAPNote } from './soapGenerator';

// Using jsPDF for browser-based PDF generation
// This would be imported: import jsPDF from 'jspdf';

export async function generateSOAPNotePDF(soap: SOAPNote): Promise<Blob> {
  // Dynamic import for code splitting
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;

  // Helper functions
  const addTitle = (text: string, size: number = 16) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, y);
    y += size * 0.5;
  };

  const addSubtitle = (text: string) => {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, y);
    y += 6;
  };

  const addText = (text: string, indent: number = 0) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    doc.text(lines, margin + indent, y);
    y += lines.length * 5;
  };

  const addBullet = (text: string, indent: number = 5) => {
    addText(`• ${text}`, indent);
  };

  const addSubBullet = (text: string) => {
    addText(`◦ ${text}`, 15);
  };

  const checkPageBreak = () => {
    if (y > 270) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  doc.setFillColor(29, 78, 95); // #1D4E5F
  doc.rect(0, 0, pageWidth, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('HELIOS AI Health Assistant', margin, 10);
  doc.setTextColor(0, 0, 0);
  y = 25;

  // Title
  addTitle('SOAP Note (for Physicians)', 18);
  y += 5;

  // Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date(soap.generatedAt).toLocaleString()}`, margin, y);
  y += 10;

  // Patient Info
  addSubtitle('Patient Information');
  addText(`Age: ${soap.patientInfo.age} | Sex: ${soap.patientInfo.sex}`);
  addText(`Chief Complaint: ${soap.patientInfo.chiefComplaint}`);
  y += 5;

  // Subjective
  checkPageBreak();
  addSubtitle('Subjective');
  addBullet(soap.subjective.historyOfPresentIllness);

  if (soap.subjective.associatedSymptoms.length > 0) {
    soap.subjective.associatedSymptoms.forEach(s => addBullet(s));
  }

  if (soap.subjective.negativeSymptoms.length > 0) {
    addBullet(`Denies: ${soap.subjective.negativeSymptoms.join(', ')}`);
  }

  if (soap.subjective.pastMedicalHistory.length > 0) {
    addBullet(`PMH: ${soap.subjective.pastMedicalHistory.join(', ')}`);
  } else {
    addBullet('No significant past medical history');
  }

  soap.subjective.medications.forEach(m => {
    addBullet(`Medication: ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''}${m.reason ? ` for ${m.reason}` : ''}`);
  });

  addBullet(soap.subjective.allergies.length > 0
    ? `Allergies: ${soap.subjective.allergies.join(', ')}`
    : 'NKDA (No Known Drug Allergies)');

  y += 5;

  // Objective
  checkPageBreak();
  addSubtitle('Objective');
  addBullet('Self-reported findings:');
  soap.objective.selfReportedFindings.forEach(f => addSubBullet(f));
  y += 5;

  // Assessment
  checkPageBreak();
  addSubtitle('Assessment');
  addText(soap.assessment.clinicalImpression);
  y += 3;
  addBullet('Differential Diagnosis:');
  soap.assessment.differentialDiagnosis.forEach((dx, i) => {
    addSubBullet(`${i + 1}. ${dx.condition}${dx.icdCode ? ` (${dx.icdCode})` : ''}`);
  });

  if (soap.assessment.redFlags.length > 0) {
    y += 3;
    doc.setTextColor(220, 38, 38); // Red
    addBullet('RED FLAGS:');
    soap.assessment.redFlags.forEach(rf => addSubBullet(rf));
    doc.setTextColor(0, 0, 0);
  }

  y += 5;

  // Plan
  checkPageBreak();
  addSubtitle('Plan');

  if (soap.plan.laboratoryTests.length > 0) {
    addBullet('Laboratory Tests:');
    soap.plan.laboratoryTests.forEach(t => {
      addSubBullet(`${t.test} - ${t.rationale}`);
    });
  }

  if (soap.plan.imagingStudies.length > 0) {
    addBullet('Imaging Studies:');
    soap.plan.imagingStudies.forEach(s => {
      addSubBullet(`${s.study} - ${s.rationale}`);
    });
  }

  if (soap.plan.diagnosticProcedures.length > 0) {
    addBullet('Further Diagnostic Procedures:');
    soap.plan.diagnosticProcedures.forEach(p => {
      addSubBullet(`${p.procedure} - ${p.indication}`);
    });
  }

  addBullet('Management:');
  soap.plan.management.forEach(m => addSubBullet(m));

  addBullet(`Follow-up: ${soap.plan.followUp}`);

  y += 10;

  // Disclaimer
  checkPageBreak();
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 30, 'F');
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('⚠️ AI DISCLAIMER', margin + 5, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  const disclaimerLines = doc.splitTextToSize(soap.disclaimer, contentWidth - 10);
  doc.text(disclaimerLines, margin + 5, y);

  // Footer
  const pageCount = (doc as any).internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} of ${pageCount} | HELIOS AI Health Assistant | Confidential Medical Record`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );
  }

  return doc.output('blob');
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
