/**
 * Swiss Agents V2 Page Route
 * /agents-v2 - Test environment for Manus.im parity implementation
 * 
 * This page imports the complete AgentWorkspaceV2 component
 * which provides 100% UI parity with Manus.im
 */

import React from 'react';
import { AgentWorkspaceV2 } from '../components/agents-v2/AgentWorkspaceV2';

export default function AgentsV2Page() {
  return <AgentWorkspaceV2 />;
}
