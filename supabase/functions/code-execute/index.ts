import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Security patterns to block
const DANGEROUS_PATTERNS = {
  python: [
    /import\s+os\s*;?\s*os\.(system|popen|exec)/i,
    /subprocess\.(run|call|Popen|check_output)/i,
    /eval\s*\(/,
    /exec\s*\(/,
    /__import__\s*\(/,
    /open\s*\([^)]*['"](\/etc|\/proc|\/sys)/i,
    /shutil\.(rmtree|move|copy)/i,
    /os\.(remove|rmdir|unlink|chmod|chown)/i,
    /socket\s*\.\s*socket/i,
    /urllib|requests\.get|http\.client/i,
  ],
  javascript: [
    /require\s*\(\s*['"]child_process['"]\s*\)/i,
    /spawn|exec|execSync|fork/i,
    /process\.exit/i,
    /fs\.(unlink|rmdir|rm|writeFile|appendFile)/i,
    /eval\s*\(/,
    /new\s+Function\s*\(/,
    /require\s*\(\s*['"]net['"]\s*\)/i,
    /require\s*\(\s*['"]http['"]\s*\)/i,
    /global\[|globalThis\[/i,
  ],
  shell: [
    /rm\s+-rf?\s+\//i,
    /dd\s+if=/i,
    /mkfs/i,
    /:(){ :|:& };:/,  // Fork bomb
    /wget|curl.*\|\s*(ba)?sh/i,
    /chmod\s+[0-7]*777/i,
    />\s*\/dev\//i,
    /sudo|su\s+-/i,
    /passwd|shadow/i,
    /nc\s+-l|netcat/i,
  ],
};

// Resource limits by tier
const RESOURCE_LIMITS = {
  free: {
    timeout_ms: 5000,
    memory_mb: 128,
    cpu_shares: 256,
    max_output_bytes: 65536,
  },
  pro: {
    timeout_ms: 30000,
    memory_mb: 512,
    cpu_shares: 512,
    max_output_bytes: 1048576,
  },
  enterprise: {
    timeout_ms: 120000,
    memory_mb: 2048,
    cpu_shares: 1024,
    max_output_bytes: 10485760,
  },
};

interface ExecutionRequest {
  code: string;
  language: 'python' | 'javascript' | 'shell';
  stdin?: string;
  timeout_ms?: number;
  task_id?: string;
  sandbox_id?: string;
}

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  execution_time_ms: number;
  memory_used_mb?: number;
  truncated: boolean;
  security_warnings: string[];
  sandbox_region?: string;
}

// Swiss K8s execution - Primary sandbox provider
async function executeWithSwissK8s(
  code: string,
  language: string,
  limits: typeof RESOURCE_LIMITS.free,
  apiKey: string,
  startTime: number,
  userId?: string,
  tier?: string
): Promise<ExecutionResult & { sandbox_region: string }> {
  const SWISS_API_URL = 'http://api.swissbrain.ai/execute';
  
  try {
    console.log(`[code-execute] Calling Swiss K8s API for ${language} execution`);
    
    const response = await fetch(SWISS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        code,
        language,
        user_id: userId || 'anonymous',
        tier: tier || 'free',
        timeout_seconds: Math.ceil(limits.timeout_ms / 1000),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Swiss K8s API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const executionTime = Date.now() - startTime;

    console.log(`[code-execute] Swiss K8s execution completed in ${executionTime}ms`);

    let stdout = result.stdout || '';
    let truncated = false;

    if (stdout.length > limits.max_output_bytes) {
      stdout = stdout.slice(0, limits.max_output_bytes);
      truncated = true;
    }

    return {
      stdout,
      stderr: result.stderr || '',
      exit_code: result.exit_code ?? result.exitCode ?? 0,
      execution_time_ms: result.execution_time_ms || executionTime,
      memory_used_mb: result.memory_used_mb,
      truncated,
      security_warnings: result.security_warnings || [],
      sandbox_region: 'ch-gva-2',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[code-execute] Swiss K8s execution failed: ${errorMessage}`);
    throw error; // Re-throw to trigger fallback
  }
}

// Scan code for security issues
function scanForSecurityIssues(code: string, language: string): string[] {
  const warnings: string[] = [];
  const patterns = DANGEROUS_PATTERNS[language as keyof typeof DANGEROUS_PATTERNS] || [];

  for (const pattern of patterns) {
    if (pattern.test(code)) {
      warnings.push(`Potentially dangerous pattern detected: ${pattern.toString().slice(0, 50)}...`);
    }
  }

  // Check for suspiciously long lines (potential obfuscation)
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > 1000) {
      warnings.push(`Line ${i + 1} is suspiciously long (${lines[i].length} chars) - potential obfuscation`);
    }
  }

  // Check for base64 encoded content
  if (/[A-Za-z0-9+/]{100,}={0,2}/.test(code)) {
    warnings.push('Large base64-encoded content detected - potential payload hiding');
  }

  return warnings;
}

// Create wrapper code for safe execution
function wrapCode(code: string, language: string, stdin?: string): string {
  switch (language) {
    case 'python':
      return `
import sys
import io
import resource
import signal

# Set resource limits
resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024))
resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
resource.setrlimit(resource.RLIMIT_NPROC, (0, 0))

# Override dangerous builtins
import builtins
_blocked = ['eval', 'exec', 'compile', '__import__', 'open', 'input']
for name in _blocked:
    if hasattr(builtins, name):
        delattr(builtins, name)

# Set stdin
${stdin ? `sys.stdin = io.StringIO(${JSON.stringify(stdin)})` : ''}

# User code
${code}
`;

    case 'javascript':
      return `
// Sandbox globals
const _originalSetTimeout = setTimeout;
const _originalSetInterval = setInterval;
let _timeouts = [];
let _intervals = [];

globalThis.setTimeout = (fn, ms) => {
  if (ms > 5000) ms = 5000;
  const id = _originalSetTimeout(fn, ms);
  _timeouts.push(id);
  return id;
};

globalThis.setInterval = (fn, ms) => {
  if (ms < 100) ms = 100;
  const id = _originalSetInterval(fn, ms);
  _intervals.push(id);
  return id;
};

// Block dangerous globals
delete globalThis.require;
delete globalThis.process;
delete globalThis.Buffer;

// Stdin simulation
const stdin = ${JSON.stringify(stdin || '')};
let stdinIndex = 0;
globalThis.readline = () => {
  const lines = stdin.split('\\n');
  return stdinIndex < lines.length ? lines[stdinIndex++] : null;
};

// User code
${code}

// Cleanup
_timeouts.forEach(id => clearTimeout(id));
_intervals.forEach(id => clearInterval(id));
`;

    case 'shell':
      return `
#!/bin/bash
set -e
set -o pipefail
ulimit -t 5
ulimit -v 262144
ulimit -f 1024
ulimit -u 0

# Restricted PATH
export PATH=/usr/bin:/bin

${stdin ? `cat <<'STDIN_EOF' | ` : ''}
${code}
${stdin ? `STDIN_EOF` : ''}
`;

    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

// Execute code using Swiss K8s API (primary), or fallback to E2B/Modal
async function executeInSandbox(
  code: string,
  language: string,
  limits: typeof RESOURCE_LIMITS.free,
  stdin?: string,
  userId?: string,
  tier?: string
): Promise<ExecutionResult & { sandbox_region: string }> {
  const startTime = Date.now();
  const wrappedCode = wrapCode(code, language, stdin);
  
  // Primary: Swiss K8s Sandbox API
  const swissApiKey = Deno.env.get('SWISS_SANDBOX_API_KEY');
  
  if (swissApiKey) {
    try {
      const result = await executeWithSwissK8s(code, language, limits, swissApiKey, startTime, userId, tier);
      return result;
    } catch (error) {
      console.error('[code-execute] Swiss K8s failed, trying fallback:', error);
      // Fall through to other providers
    }
  }
  
  // Fallback: E2B or Modal
  const e2bApiKey = Deno.env.get('E2B_API_KEY');
  const modalApiKey = Deno.env.get('MODAL_API_KEY');
  
  let result: ExecutionResult;
  
  if (e2bApiKey) {
    result = await executeWithE2B(wrappedCode, language, limits, e2bApiKey, startTime);
  } else if (modalApiKey) {
    result = await executeWithModal(wrappedCode, language, limits, modalApiKey, startTime);
  } else {
    // Fallback to simulated execution for demo
    result = await simulateExecution(code, language, limits, stdin, startTime);
  }
  
  return { ...result, sandbox_region: 'fallback' };
}

// E2B execution
async function executeWithE2B(
  code: string,
  language: string,
  limits: typeof RESOURCE_LIMITS.free,
  apiKey: string,
  startTime: number
): Promise<ExecutionResult> {
  const templateMap: Record<string, string> = {
    python: 'Python3',
    javascript: 'Node',
    shell: 'Bash',
  };

  try {
    // Create sandbox
    const createResponse = await fetch('https://api.e2b.dev/sandboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        template: templateMap[language] || 'Python3',
        timeout: Math.ceil(limits.timeout_ms / 1000),
      }),
    });

    if (!createResponse.ok) {
      throw new Error(`E2B sandbox creation failed: ${createResponse.status}`);
    }

    const sandbox = await createResponse.json();

    // Execute code
    const execResponse = await fetch(`https://api.e2b.dev/sandboxes/${sandbox.id}/code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        code,
        timeout: Math.ceil(limits.timeout_ms / 1000),
      }),
    });

    const result = await execResponse.json();

    // Cleanup sandbox
    await fetch(`https://api.e2b.dev/sandboxes/${sandbox.id}`, {
      method: 'DELETE',
      headers: { 'X-API-Key': apiKey },
    });

    const executionTime = Date.now() - startTime;
    let stdout = result.stdout || '';
    let truncated = false;

    if (stdout.length > limits.max_output_bytes) {
      stdout = stdout.slice(0, limits.max_output_bytes);
      truncated = true;
    }

    return {
      stdout,
      stderr: result.stderr || '',
      exit_code: result.exit_code || 0,
      execution_time_ms: executionTime,
      truncated,
      security_warnings: [],
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      stdout: '',
      stderr: `E2B execution error: ${errorMessage}`,
      exit_code: 1,
      execution_time_ms: Date.now() - startTime,
      truncated: false,
      security_warnings: [],
    };
  }
}

// Modal execution
async function executeWithModal(
  code: string,
  language: string,
  limits: typeof RESOURCE_LIMITS.free,
  apiKey: string,
  startTime: number
): Promise<ExecutionResult> {
  const imageMap: Record<string, string> = {
    python: 'python:3.11-slim',
    javascript: 'node:20-slim',
    shell: 'ubuntu:22.04',
  };

  const commandMap: Record<string, string[]> = {
    python: ['python3', '-c'],
    javascript: ['node', '-e'],
    shell: ['bash', '-c'],
  };

  try {
    const response = await fetch('https://api.modal.com/v1/apps/code-sandbox/functions/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        image: imageMap[language],
        command: [...commandMap[language], code],
        timeout: Math.ceil(limits.timeout_ms / 1000),
        memory_mb: limits.memory_mb,
        cpu: limits.cpu_shares / 1024,
      }),
    });

    const result = await response.json();
    const executionTime = Date.now() - startTime;

    let stdout = result.stdout || '';
    let truncated = false;

    if (stdout.length > limits.max_output_bytes) {
      stdout = stdout.slice(0, limits.max_output_bytes);
      truncated = true;
    }

    return {
      stdout,
      stderr: result.stderr || '',
      exit_code: result.exit_code || 0,
      execution_time_ms: executionTime,
      memory_used_mb: result.memory_used_mb,
      truncated,
      security_warnings: [],
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      stdout: '',
      stderr: `Modal execution error: ${errorMessage}`,
      exit_code: 1,
      execution_time_ms: Date.now() - startTime,
      truncated: false,
      security_warnings: [],
    };
  }
}

// Simulated execution for demo/testing
async function simulateExecution(
  code: string,
  language: string,
  limits: typeof RESOURCE_LIMITS.free,
  stdin: string | undefined,
  startTime: number
): Promise<ExecutionResult> {
  // Simple simulation for basic operations
  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    if (language === 'python') {
      // Simulate print statements
      const printMatches = code.matchAll(/print\s*\(\s*(?:f?['"]([^'"]*)['"]\s*|([^)]+))\s*\)/g);
      for (const match of printMatches) {
        stdout += (match[1] || match[2] || '') + '\n';
      }

      // Simulate basic math
      const mathMatch = code.match(/(\d+)\s*([+\-*/])\s*(\d+)/);
      if (mathMatch) {
        const [, a, op, b] = mathMatch;
        const result = eval(`${a} ${op} ${b}`);
        if (!stdout.includes(result.toString())) {
          stdout += result.toString() + '\n';
        }
      }
    } else if (language === 'javascript') {
      // Simulate console.log
      const logMatches = code.matchAll(/console\.log\s*\(\s*(?:['"`]([^'"`]*)[`'"]\s*|([^)]+))\s*\)/g);
      for (const match of logMatches) {
        stdout += (match[1] || match[2] || '') + '\n';
      }
    } else if (language === 'shell') {
      // Simulate echo
      const echoMatches = code.matchAll(/echo\s+(['"]?)([^'";\n]+)\1/g);
      for (const match of echoMatches) {
        stdout += match[2] + '\n';
      }
    }

    if (!stdout) {
      stdout = '[Simulated execution - no sandbox configured]\n';
      stdout += `Language: ${language}\n`;
      stdout += `Code length: ${code.length} chars\n`;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stderr = `Simulation error: ${errorMessage}`;
    exitCode = 1;
  }

  const executionTime = Date.now() - startTime;
  
  return {
    stdout: stdout.slice(0, limits.max_output_bytes),
    stderr,
    exit_code: exitCode,
    execution_time_ms: executionTime,
    truncated: stdout.length > limits.max_output_bytes,
    security_warnings: ['Running in simulation mode - configure E2B_API_KEY or MODAL_API_KEY for real execution'],
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ExecutionRequest = await req.json();
    const { code, language, stdin, timeout_ms, task_id, sandbox_id } = body;

    // Validate inputs
    if (!code || !language) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: code, language' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['python', 'javascript', 'shell'].includes(language)) {
      return new Response(
        JSON.stringify({ error: 'Invalid language. Supported: python, javascript, shell' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user tier for resource limits
    const { data: billing } = await supabase
      .from('billing_customers')
      .select('tier')
      .eq('user_id', user.id)
      .single();

    const tier = (billing?.tier || 'free') as keyof typeof RESOURCE_LIMITS;
    const limits = RESOURCE_LIMITS[tier] || RESOURCE_LIMITS.free;

    // Apply custom timeout if within limits
    if (timeout_ms && timeout_ms < limits.timeout_ms) {
      limits.timeout_ms = timeout_ms;
    }

    console.log(`[code-execute] User ${user.id} executing ${language} code (${code.length} chars), tier: ${tier}`);

    // Security scan
    const securityWarnings = scanForSecurityIssues(code, language);
    
    // Block execution if critical security issues found
    const criticalPatterns = [
      /fork\s*bomb/i,
      /rm\s+-rf\s+\//,
      /:(){ :|:& };:/,
    ];
    
    for (const pattern of criticalPatterns) {
      if (pattern.test(code)) {
        console.error(`[code-execute] BLOCKED: Critical security pattern detected`);
        return new Response(
          JSON.stringify({ 
            error: 'Code blocked for security reasons',
            security_warnings: ['Critical security pattern detected - execution blocked']
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Execute code with Swiss K8s as primary
    const result = await executeInSandbox(code, language, limits, stdin, user.id, tier);
    
    // Add security warnings from scan
    result.security_warnings = [...securityWarnings, ...result.security_warnings];
    
    console.log(`[code-execute] Sandbox region: ${result.sandbox_region}`);

    // Log execution
    console.log(`[code-execute] Completed in ${result.execution_time_ms}ms, exit code: ${result.exit_code}`);

    // Store execution record with sandbox region
    const { data: execution, error: insertError } = await supabase
      .from('code_executions')
      .insert({
        sandbox_id,
        language,
        code: code.slice(0, 10000), // Limit stored code size
        stdin: stdin?.slice(0, 1000),
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exit_code,
        execution_time_ms: result.execution_time_ms,
        memory_used_mb: result.memory_used_mb,
        sandbox_region: result.sandbox_region,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[code-execute] Failed to store execution:', insertError);
    }

    // Deduct credits
    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      service_type: 'code_execution',
      credits_used: 1,
      description: `${language} code execution`,
      metadata: { 
        execution_id: execution?.id,
        execution_time_ms: result.execution_time_ms,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        execution_id: execution?.id,
        ...result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[code-execute] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Execution failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
