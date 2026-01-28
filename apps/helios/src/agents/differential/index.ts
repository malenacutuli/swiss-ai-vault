/**
 * Differential Team Agents Index
 */

export { HypothesisGeneratorAgent } from './hypothesis-generator.js';

import Anthropic from '@anthropic-ai/sdk';
import { HypothesisGeneratorAgent } from './hypothesis-generator.js';

export function createDifferentialTeam(client: Anthropic) {
  return {
    hypothesisGenerator: new HypothesisGeneratorAgent(client),
  };
}
