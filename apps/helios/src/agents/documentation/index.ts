/**
 * Documentation Team Agents Index
 */

export { SOAPWriterAgent } from './soap-writer.js';

import Anthropic from '@anthropic-ai/sdk';
import { SOAPWriterAgent } from './soap-writer.js';

export function createDocumentationTeam(client: Anthropic) {
  return {
    soapWriter: new SOAPWriterAgent(client),
  };
}
