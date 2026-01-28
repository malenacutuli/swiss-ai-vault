/**
 * History Team Agents Index
 */

export { ChiefComplaintAgent } from './chief-complaint.js';
export { HPIGathererAgent } from './hpi-gatherer.js';

import Anthropic from '@anthropic-ai/sdk';
import { ChiefComplaintAgent } from './chief-complaint.js';
import { HPIGathererAgent } from './hpi-gatherer.js';

export function createHistoryTeam(client: Anthropic) {
  return {
    chiefComplaint: new ChiefComplaintAgent(client),
    hpiGatherer: new HPIGathererAgent(client),
  };
}
