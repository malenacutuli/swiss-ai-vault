import { describe, it, expect } from 'vitest';
import { heartScoreTool } from '../../src/tools/calculators/heart-score.js';
import { qsofaTool } from '../../src/tools/calculators/qsofa.js';
import { curb65Tool } from '../../src/tools/calculators/curb65.js';
import { nihssTool } from '../../src/tools/calculators/nihss.js';

describe('HEART Score', () => {
  it('should calculate low risk correctly', async () => {
    const result = await heartScoreTool.execute({
      historyTypicality: 'slightly_suspicious',
      ecgFindings: 'normal',
      age: 35,
      riskFactorCount: 0,
      troponin: 'normal',
    });

    expect(result.success).toBe(true);
    expect(result.score).toBe(0);
    expect(result.category).toBe('low');
  });

  it('should calculate high risk correctly', async () => {
    const result = await heartScoreTool.execute({
      historyTypicality: 'highly_suspicious',
      ecgFindings: 'significant_st_deviation',
      age: 70,
      riskFactorCount: 4,
      troponin: 'elevated_3x',
    });

    expect(result.success).toBe(true);
    expect(result.score).toBe(10);
    expect(result.category).toBe('high');
  });

  it('should validate required fields', async () => {
    const result = await heartScoreTool.execute({
      age: 50,
      // Missing required fields
    });

    expect(result.success).toBe(false);
  });
});

describe('qSOFA Score', () => {
  it('should be negative with 0-1 criteria', async () => {
    const result = await qsofaTool.execute({
      alteredMentalStatus: false,
      respiratoryRate: 18,
      systolicBP: 120,
    });

    expect(result.success).toBe(true);
    expect(result.score).toBe(0);
    expect(result.category).toBe('negative');
  });

  it('should be positive with 2+ criteria', async () => {
    const result = await qsofaTool.execute({
      alteredMentalStatus: true,
      respiratoryRate: 25,
      systolicBP: 90,
    });

    expect(result.success).toBe(true);
    expect(result.score).toBe(3);
    expect(result.category).toBe('positive');
  });

  it('should warn on positive result', async () => {
    const result = await qsofaTool.execute({
      alteredMentalStatus: true,
      respiratoryRate: 22,
      systolicBP: 100,
    });

    expect(result.warnings).toBeDefined();
    expect(result.warnings?.length).toBeGreaterThan(0);
  });
});

describe('CURB-65 Score', () => {
  it('should calculate low severity', async () => {
    const result = await curb65Tool.execute({
      confusion: false,
      bun: 15,
      respiratoryRate: 20,
      systolicBP: 120,
      diastolicBP: 80,
      age: 50,
    });

    expect(result.success).toBe(true);
    expect(result.score).toBe(0);
    expect(result.category).toBe('low');
  });

  it('should calculate severe pneumonia', async () => {
    const result = await curb65Tool.execute({
      confusion: true,
      bun: 25,
      respiratoryRate: 35,
      systolicBP: 85,
      diastolicBP: 55,
      age: 75,
    });

    expect(result.success).toBe(true);
    expect(result.score).toBe(5);
    expect(result.category).toBe('severe');
  });

  it('should include mortality risk', async () => {
    const result = await curb65Tool.execute({
      confusion: false,
      bun: 10,
      respiratoryRate: 20,
      systolicBP: 120,
      diastolicBP: 80,
      age: 50,
    });

    expect(result.risk).toBeDefined();
    expect(result.risk).toBeGreaterThan(0);
  });
});

describe('NIHSS', () => {
  it('should calculate minor stroke', async () => {
    const result = await nihssTool.execute({
      consciousness: 0,
      motorArmLeft: 1,
      motorArmRight: 0,
      motorLegLeft: 1,
      motorLegRight: 0,
    });

    expect(result.success).toBe(true);
    expect(result.score).toBe(2);
    expect(result.category).toBe('minor');
  });

  it('should calculate no stroke', async () => {
    const result = await nihssTool.execute({
      consciousness: 0,
      motorArmLeft: 0,
      motorArmRight: 0,
      motorLegLeft: 0,
      motorLegRight: 0,
    });

    expect(result.success).toBe(true);
    expect(result.score).toBe(0);
    expect(result.category).toBe('no_stroke');
  });

  it('should calculate severe stroke with warning', async () => {
    const result = await nihssTool.execute({
      consciousness: 3,
      monthYear: 2,
      commands: 2,
      gaze: 2,
      visualFields: 3,
      facialPalsy: 3,
      motorArmLeft: 4,
      motorArmRight: 4,
      motorLegLeft: 4,
      motorLegRight: 4,
      limbAtaxia: 2,
      sensory: 2,
      language: 3,
      dysarthria: 2,
      neglect: 2,
    });

    expect(result.success).toBe(true);
    expect(result.score).toBe(42);
    expect(result.category).toBe('severe');
    expect(result.warnings).toBeDefined();
  });
});
