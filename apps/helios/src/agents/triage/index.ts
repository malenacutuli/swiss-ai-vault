/**
 * Triage Team Agents Index
 */

export { ESICalculatorAgent } from './esi-calculator.js';
export { DispositionAgent } from './disposition.js';

import Anthropic from '@anthropic-ai/sdk';
import { ESICalculatorAgent } from './esi-calculator.js';
import { DispositionAgent } from './disposition.js';

export function createTriageTeam(client: Anthropic) {
  return {
    esiCalculator: new ESICalculatorAgent(client),
    disposition: new DispositionAgent(client),
  };
}
