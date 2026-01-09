/**
 * Agent Registry - Defines all agent roles and their capabilities
 * Based on Manus.im's proven multi-agent architecture
 */

export type AgentRole = 
  | 'orchestrator' 
  | 'researcher' 
  | 'coder' 
  | 'analyst' 
  | 'reviewer'
  | 'browser'
  | 'writer';

export interface AgentCapability {
  name: string;
  description: string;
  requiredTools: string[];
}

export interface AgentDefinition {
  role: AgentRole;
  description: string;
  capabilities: string[];
  maxConcurrent: number;
  priority: number;
  systemPrompt: string;
  modelPreference?: string;
  timeoutMs: number;
  retryConfig: {
    maxRetries: number;
    backoffMs: number;
  };
}

export const AGENT_CAPABILITIES: Record<string, AgentCapability> = {
  task_planning: {
    name: 'Task Planning',
    description: 'Decompose complex tasks into subtasks',
    requiredTools: [],
  },
  agent_dispatch: {
    name: 'Agent Dispatch',
    description: 'Assign tasks to specialized agents',
    requiredTools: [],
  },
  result_synthesis: {
    name: 'Result Synthesis',
    description: 'Combine agent outputs into final result',
    requiredTools: [],
  },
  web_search: {
    name: 'Web Search',
    description: 'Search the internet for information',
    requiredTools: ['web_search'],
  },
  browser_navigate: {
    name: 'Browser Navigation',
    description: 'Navigate and interact with web pages',
    requiredTools: ['browser.navigate', 'browser.click', 'browser.type'],
  },
  document_read: {
    name: 'Document Reading',
    description: 'Read and extract content from documents',
    requiredTools: ['file_read'],
  },
  file_write: {
    name: 'File Writing',
    description: 'Create and write files',
    requiredTools: ['file_write'],
  },
  file_edit: {
    name: 'File Editing',
    description: 'Modify existing files',
    requiredTools: ['file_edit'],
  },
  shell_exec: {
    name: 'Shell Execution',
    description: 'Execute shell commands',
    requiredTools: ['shell_exec'],
  },
  code_review: {
    name: 'Code Review',
    description: 'Review and analyze code',
    requiredTools: [],
  },
  data_process: {
    name: 'Data Processing',
    description: 'Process and transform data',
    requiredTools: [],
  },
  chart_generate: {
    name: 'Chart Generation',
    description: 'Create data visualizations',
    requiredTools: [],
  },
  report_write: {
    name: 'Report Writing',
    description: 'Generate comprehensive reports',
    requiredTools: ['file_write'],
  },
  fact_check: {
    name: 'Fact Checking',
    description: 'Verify claims and information',
    requiredTools: ['web_search'],
  },
  test_run: {
    name: 'Test Execution',
    description: 'Run tests and validate outputs',
    requiredTools: ['shell_exec'],
  },
};

export const AGENT_DEFINITIONS: Record<AgentRole, AgentDefinition> = {
  orchestrator: {
    role: 'orchestrator',
    description: 'Coordinator and task decomposer',
    capabilities: ['task_planning', 'agent_dispatch', 'result_synthesis'],
    maxConcurrent: 1,
    priority: 100,
    timeoutMs: 300000, // 5 minutes
    retryConfig: { maxRetries: 3, backoffMs: 1000 },
    modelPreference: 'google/gemini-2.5-pro',
    systemPrompt: `You are the Orchestrator Agent for SwissVault.
Your role is to:
1. Decompose complex tasks into subtasks
2. Assign subtasks to specialized agents
3. Coordinate agent execution
4. Synthesize results into final output

Always create a clear plan before dispatching agents.
Monitor progress and handle failures gracefully.
Prioritize efficiency by parallelizing independent subtasks.

Available agents:
- researcher: Web search and information gathering
- coder: Code generation and modification
- analyst: Data analysis and visualization
- reviewer: Quality assurance and verification
- browser: Web navigation and interaction
- writer: Content creation and documentation`,
  },
  researcher: {
    role: 'researcher',
    description: 'Information gathering and web research',
    capabilities: ['web_search', 'browser_navigate', 'document_read'],
    maxConcurrent: 3,
    priority: 80,
    timeoutMs: 120000, // 2 minutes
    retryConfig: { maxRetries: 2, backoffMs: 2000 },
    modelPreference: 'google/gemini-2.5-flash',
    systemPrompt: `You are a Research Agent for SwissVault.
Your role is to:
1. Search the web for relevant information
2. Navigate websites and extract data
3. Summarize findings clearly
4. Cite sources accurately

Focus on finding accurate, up-to-date information.
Always verify information from multiple sources when possible.
Return structured data with source citations.`,
  },
  coder: {
    role: 'coder',
    description: 'Code generation and modification',
    capabilities: ['file_write', 'file_edit', 'shell_exec', 'code_review'],
    maxConcurrent: 2,
    priority: 90,
    timeoutMs: 180000, // 3 minutes
    retryConfig: { maxRetries: 2, backoffMs: 1000 },
    modelPreference: 'google/gemini-2.5-pro',
    systemPrompt: `You are a Coding Agent for SwissVault.
Your role is to:
1. Write clean, well-documented code
2. Follow best practices and conventions
3. Test your code before submitting
4. Explain your implementation decisions

Always prioritize code quality and maintainability.
Use TypeScript with proper types.
Follow the project's existing patterns and conventions.`,
  },
  analyst: {
    role: 'analyst',
    description: 'Data analysis and visualization',
    capabilities: ['data_process', 'chart_generate', 'report_write'],
    maxConcurrent: 2,
    priority: 70,
    timeoutMs: 120000, // 2 minutes
    retryConfig: { maxRetries: 2, backoffMs: 1000 },
    modelPreference: 'google/gemini-2.5-flash',
    systemPrompt: `You are an Analysis Agent for SwissVault.
Your role is to:
1. Analyze data and identify patterns
2. Create clear visualizations
3. Write comprehensive reports
4. Provide actionable insights

Focus on clarity and accuracy in your analysis.
Use appropriate statistical methods.
Present findings in an accessible format.`,
  },
  reviewer: {
    role: 'reviewer',
    description: 'Quality assurance and verification',
    capabilities: ['code_review', 'fact_check', 'test_run'],
    maxConcurrent: 1,
    priority: 85,
    timeoutMs: 90000, // 1.5 minutes
    retryConfig: { maxRetries: 1, backoffMs: 500 },
    modelPreference: 'google/gemini-2.5-flash',
    systemPrompt: `You are a Review Agent for SwissVault.
Your role is to:
1. Review code for bugs and issues
2. Verify facts and claims
3. Run tests and validate output
4. Suggest improvements

Be thorough but constructive in your feedback.
Focus on critical issues first.
Provide specific, actionable suggestions.`,
  },
  browser: {
    role: 'browser',
    description: 'Web browsing and interaction',
    capabilities: ['browser_navigate', 'web_search'],
    maxConcurrent: 2,
    priority: 75,
    timeoutMs: 60000, // 1 minute
    retryConfig: { maxRetries: 3, backoffMs: 2000 },
    modelPreference: 'google/gemini-2.5-flash',
    systemPrompt: `You are a Browser Agent for SwissVault.
Your role is to:
1. Navigate web pages and extract content
2. Fill forms and interact with elements
3. Take screenshots for verification
4. Handle authentication when needed

Be efficient with page interactions.
Handle dynamic content loading properly.
Report any access issues immediately.`,
  },
  writer: {
    role: 'writer',
    description: 'Content creation and documentation',
    capabilities: ['file_write', 'report_write'],
    maxConcurrent: 2,
    priority: 65,
    timeoutMs: 120000, // 2 minutes
    retryConfig: { maxRetries: 2, backoffMs: 1000 },
    modelPreference: 'google/gemini-2.5-flash',
    systemPrompt: `You are a Writer Agent for SwissVault.
Your role is to:
1. Create clear, well-structured content
2. Write documentation and guides
3. Generate reports and summaries
4. Adapt tone for different audiences

Focus on clarity and readability.
Use proper formatting and structure.
Maintain consistent voice and style.`,
  },
};

/**
 * Get agent definition by role
 */
export function getAgentDefinition(role: AgentRole): AgentDefinition {
  return AGENT_DEFINITIONS[role];
}

/**
 * Get agents that have a specific capability
 */
export function getAgentsByCapability(capability: string): AgentRole[] {
  return Object.entries(AGENT_DEFINITIONS)
    .filter(([_, def]) => def.capabilities.includes(capability))
    .map(([role]) => role as AgentRole);
}

/**
 * Get the best agent for a given task based on required capabilities
 */
export function selectBestAgent(
  requiredCapabilities: string[],
  excludeRoles: AgentRole[] = []
): AgentRole | null {
  const candidates = Object.entries(AGENT_DEFINITIONS)
    .filter(([role, def]) => {
      if (excludeRoles.includes(role as AgentRole)) return false;
      return requiredCapabilities.every(cap => def.capabilities.includes(cap));
    })
    .sort((a, b) => b[1].priority - a[1].priority);

  return candidates.length > 0 ? (candidates[0][0] as AgentRole) : null;
}
