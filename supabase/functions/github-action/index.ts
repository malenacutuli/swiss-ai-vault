// supabase/functions/github-action/index.ts
// GitHub Actions for Manus Parity - create_issue, create_pr, search_code, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GITHUB_CLIENT_SECRET = Deno.env.get('GITHUB_CLIENT_SECRET_INTEGRATION')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// GitHub API
const GITHUB_API = 'https://api.github.com';

// Action types
type GitHubActionType =
  | 'create_issue'
  | 'create_pr'
  | 'search_code'
  | 'search_repos'
  | 'list_repos'
  | 'get_repo'
  | 'list_issues'
  | 'get_issue'
  | 'comment_issue'
  | 'close_issue'
  | 'list_prs'
  | 'get_pr'
  | 'merge_pr'
  | 'create_branch'
  | 'get_file'
  | 'create_file'
  | 'update_file';

interface GitHubActionRequest {
  action: GitHubActionType;
  // Repo context
  owner?: string;
  repo?: string;
  // Issue params
  title?: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  issue_number?: number;
  // PR params
  head?: string;
  base?: string;
  pr_number?: number;
  // Search params
  query?: string;
  // File params
  path?: string;
  content?: string;
  message?: string;
  branch?: string;
  sha?: string;
  // Pagination
  page?: number;
  per_page?: number;
  // Agent context
  run_id?: string;
  step_id?: string;
}

interface GitHubActionResponse {
  success: boolean;
  action: GitHubActionType;
  data?: any;
  error?: string;
}

// Decrypt stored credentials
async function decryptToken(encrypted: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const keyMaterial = encoder.encode((GITHUB_CLIENT_SECRET || '').slice(0, 32).padEnd(32, '0'));
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return decoder.decode(decrypted);
}

// Get user's GitHub token
async function getGitHubToken(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('chat_integrations')
    .select('encrypted_access_token')
    .eq('user_id', userId)
    .eq('integration_type', 'github')
    .eq('is_active', true)
    .single();

  if (error || !data?.encrypted_access_token) {
    console.error('[github-action] No GitHub token found:', error);
    return null;
  }

  try {
    return await decryptToken(data.encrypted_access_token);
  } catch (e) {
    console.error('[github-action] Failed to decrypt token:', e);
    return null;
  }
}

// Execute GitHub API call
async function githubApiCall(
  token: string,
  method: string,
  endpoint: string,
  body?: Record<string, any>
): Promise<any> {
  const response = await fetch(`${GITHUB_API}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'SwissBrain-Agent',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `GitHub API error: ${response.status}`);
  }

  return data;
}

// Action handlers
const actionHandlers: Record<GitHubActionType, (token: string, params: GitHubActionRequest) => Promise<any>> = {
  // Create an issue
  async create_issue(token, params) {
    if (!params.owner || !params.repo || !params.title) {
      throw new Error('owner, repo, and title are required');
    }

    const result = await githubApiCall(token, 'POST', `/repos/${params.owner}/${params.repo}/issues`, {
      title: params.title,
      body: params.body || '',
      labels: params.labels,
      assignees: params.assignees,
    });

    return {
      issue_number: result.number,
      html_url: result.html_url,
      title: result.title,
      state: result.state,
    };
  },

  // Create a pull request
  async create_pr(token, params) {
    if (!params.owner || !params.repo || !params.title || !params.head || !params.base) {
      throw new Error('owner, repo, title, head, and base are required');
    }

    const result = await githubApiCall(token, 'POST', `/repos/${params.owner}/${params.repo}/pulls`, {
      title: params.title,
      body: params.body || '',
      head: params.head,
      base: params.base,
    });

    return {
      pr_number: result.number,
      html_url: result.html_url,
      title: result.title,
      state: result.state,
      mergeable: result.mergeable,
    };
  },

  // Search code
  async search_code(token, params) {
    if (!params.query) {
      throw new Error('query is required');
    }

    const result = await githubApiCall(
      token,
      'GET',
      `/search/code?q=${encodeURIComponent(params.query)}&page=${params.page || 1}&per_page=${params.per_page || 30}`
    );

    return {
      total_count: result.total_count,
      items: result.items.map((item: any) => ({
        name: item.name,
        path: item.path,
        html_url: item.html_url,
        repository: item.repository?.full_name,
        score: item.score,
      })),
    };
  },

  // Search repos
  async search_repos(token, params) {
    if (!params.query) {
      throw new Error('query is required');
    }

    const result = await githubApiCall(
      token,
      'GET',
      `/search/repositories?q=${encodeURIComponent(params.query)}&page=${params.page || 1}&per_page=${params.per_page || 30}`
    );

    return {
      total_count: result.total_count,
      items: result.items.map((item: any) => ({
        full_name: item.full_name,
        description: item.description,
        html_url: item.html_url,
        stargazers_count: item.stargazers_count,
        language: item.language,
        updated_at: item.updated_at,
      })),
    };
  },

  // List user's repos
  async list_repos(token, params) {
    const result = await githubApiCall(
      token,
      'GET',
      `/user/repos?page=${params.page || 1}&per_page=${params.per_page || 30}&sort=updated`
    );

    return {
      repos: result.map((r: any) => ({
        full_name: r.full_name,
        name: r.name,
        description: r.description,
        html_url: r.html_url,
        private: r.private,
        default_branch: r.default_branch,
        updated_at: r.updated_at,
      })),
    };
  },

  // Get repo info
  async get_repo(token, params) {
    if (!params.owner || !params.repo) {
      throw new Error('owner and repo are required');
    }

    const result = await githubApiCall(token, 'GET', `/repos/${params.owner}/${params.repo}`);

    return {
      full_name: result.full_name,
      description: result.description,
      html_url: result.html_url,
      default_branch: result.default_branch,
      stargazers_count: result.stargazers_count,
      forks_count: result.forks_count,
      open_issues_count: result.open_issues_count,
      language: result.language,
      topics: result.topics,
    };
  },

  // List issues
  async list_issues(token, params) {
    if (!params.owner || !params.repo) {
      throw new Error('owner and repo are required');
    }

    const result = await githubApiCall(
      token,
      'GET',
      `/repos/${params.owner}/${params.repo}/issues?page=${params.page || 1}&per_page=${params.per_page || 30}&state=open`
    );

    return {
      issues: result.map((i: any) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        html_url: i.html_url,
        user: i.user?.login,
        labels: i.labels?.map((l: any) => l.name),
        created_at: i.created_at,
      })),
    };
  },

  // Get issue details
  async get_issue(token, params) {
    if (!params.owner || !params.repo || !params.issue_number) {
      throw new Error('owner, repo, and issue_number are required');
    }

    const result = await githubApiCall(
      token,
      'GET',
      `/repos/${params.owner}/${params.repo}/issues/${params.issue_number}`
    );

    return {
      number: result.number,
      title: result.title,
      body: result.body,
      state: result.state,
      html_url: result.html_url,
      user: result.user?.login,
      labels: result.labels?.map((l: any) => l.name),
      assignees: result.assignees?.map((a: any) => a.login),
      comments: result.comments,
      created_at: result.created_at,
      updated_at: result.updated_at,
    };
  },

  // Comment on issue
  async comment_issue(token, params) {
    if (!params.owner || !params.repo || !params.issue_number || !params.body) {
      throw new Error('owner, repo, issue_number, and body are required');
    }

    const result = await githubApiCall(
      token,
      'POST',
      `/repos/${params.owner}/${params.repo}/issues/${params.issue_number}/comments`,
      { body: params.body }
    );

    return {
      id: result.id,
      html_url: result.html_url,
      created_at: result.created_at,
    };
  },

  // Close issue
  async close_issue(token, params) {
    if (!params.owner || !params.repo || !params.issue_number) {
      throw new Error('owner, repo, and issue_number are required');
    }

    const result = await githubApiCall(
      token,
      'PATCH',
      `/repos/${params.owner}/${params.repo}/issues/${params.issue_number}`,
      { state: 'closed' }
    );

    return {
      number: result.number,
      state: result.state,
      html_url: result.html_url,
    };
  },

  // List PRs
  async list_prs(token, params) {
    if (!params.owner || !params.repo) {
      throw new Error('owner and repo are required');
    }

    const result = await githubApiCall(
      token,
      'GET',
      `/repos/${params.owner}/${params.repo}/pulls?page=${params.page || 1}&per_page=${params.per_page || 30}&state=open`
    );

    return {
      prs: result.map((pr: any) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        html_url: pr.html_url,
        user: pr.user?.login,
        head: pr.head?.ref,
        base: pr.base?.ref,
        created_at: pr.created_at,
      })),
    };
  },

  // Get PR details
  async get_pr(token, params) {
    if (!params.owner || !params.repo || !params.pr_number) {
      throw new Error('owner, repo, and pr_number are required');
    }

    const result = await githubApiCall(
      token,
      'GET',
      `/repos/${params.owner}/${params.repo}/pulls/${params.pr_number}`
    );

    return {
      number: result.number,
      title: result.title,
      body: result.body,
      state: result.state,
      html_url: result.html_url,
      user: result.user?.login,
      head: result.head?.ref,
      base: result.base?.ref,
      mergeable: result.mergeable,
      merged: result.merged,
      additions: result.additions,
      deletions: result.deletions,
      changed_files: result.changed_files,
    };
  },

  // Merge PR
  async merge_pr(token, params) {
    if (!params.owner || !params.repo || !params.pr_number) {
      throw new Error('owner, repo, and pr_number are required');
    }

    const result = await githubApiCall(
      token,
      'PUT',
      `/repos/${params.owner}/${params.repo}/pulls/${params.pr_number}/merge`,
      {
        commit_title: params.title || `Merge PR #${params.pr_number}`,
        merge_method: 'squash',
      }
    );

    return {
      sha: result.sha,
      merged: result.merged,
      message: result.message,
    };
  },

  // Create branch
  async create_branch(token, params) {
    if (!params.owner || !params.repo || !params.branch) {
      throw new Error('owner, repo, and branch are required');
    }

    // Get the SHA of the base branch
    const baseBranch = params.base || 'main';
    const refResult = await githubApiCall(
      token,
      'GET',
      `/repos/${params.owner}/${params.repo}/git/refs/heads/${baseBranch}`
    );

    const result = await githubApiCall(
      token,
      'POST',
      `/repos/${params.owner}/${params.repo}/git/refs`,
      {
        ref: `refs/heads/${params.branch}`,
        sha: refResult.object.sha,
      }
    );

    return {
      ref: result.ref,
      sha: result.object.sha,
    };
  },

  // Get file contents
  async get_file(token, params) {
    if (!params.owner || !params.repo || !params.path) {
      throw new Error('owner, repo, and path are required');
    }

    const branch = params.branch ? `?ref=${params.branch}` : '';
    const result = await githubApiCall(
      token,
      'GET',
      `/repos/${params.owner}/${params.repo}/contents/${params.path}${branch}`
    );

    return {
      name: result.name,
      path: result.path,
      sha: result.sha,
      size: result.size,
      html_url: result.html_url,
      content: result.content ? atob(result.content) : null,
      encoding: result.encoding,
    };
  },

  // Create file
  async create_file(token, params) {
    if (!params.owner || !params.repo || !params.path || !params.content) {
      throw new Error('owner, repo, path, and content are required');
    }

    const result = await githubApiCall(
      token,
      'PUT',
      `/repos/${params.owner}/${params.repo}/contents/${params.path}`,
      {
        message: params.message || `Create ${params.path}`,
        content: btoa(params.content),
        branch: params.branch || 'main',
      }
    );

    return {
      path: result.content.path,
      sha: result.content.sha,
      html_url: result.content.html_url,
      commit_sha: result.commit.sha,
    };
  },

  // Update file
  async update_file(token, params) {
    if (!params.owner || !params.repo || !params.path || !params.content || !params.sha) {
      throw new Error('owner, repo, path, content, and sha are required');
    }

    const result = await githubApiCall(
      token,
      'PUT',
      `/repos/${params.owner}/${params.repo}/contents/${params.path}`,
      {
        message: params.message || `Update ${params.path}`,
        content: btoa(params.content),
        sha: params.sha,
        branch: params.branch || 'main',
      }
    );

    return {
      path: result.content.path,
      sha: result.content.sha,
      html_url: result.content.html_url,
      commit_sha: result.commit.sha,
    };
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const params: GitHubActionRequest = await req.json();

    if (!params.action) {
      return new Response(
        JSON.stringify({ success: false, error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[github-action] User ${user.id} executing action: ${params.action}`);

    // Get user's GitHub token
    const githubToken = await getGitHubToken(supabase, user.id);
    if (!githubToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'GitHub not connected. Please connect GitHub in settings.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Execute action
    const handler = actionHandlers[params.action];
    if (!handler) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown action: ${params.action}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await handler(githubToken, params);

    // Log action for agent tracking
    if (params.run_id) {
      await supabase.from('agent_task_outputs').insert({
        task_id: params.run_id,
        step_id: params.step_id,
        output_type: 'github_action',
        content: {
          action: params.action,
          repo: params.repo ? `${params.owner}/${params.repo}` : undefined,
          result,
          executed_at: new Date().toISOString(),
        },
      });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: `github_${params.action}`,
      resource_type: 'integration',
      resource_id: 'github',
      metadata: {
        action: params.action,
        repo: params.repo ? `${params.owner}/${params.repo}` : undefined,
        success: true,
      },
    });
    // Non-critical audit log - don't await or handle errors

    const response: GitHubActionResponse = {
      success: true,
      action: params.action,
      data: result,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[github-action] Error:', error);

    const response: GitHubActionResponse = {
      success: false,
      action: 'create_issue',
      error: error.message || 'Action failed',
    };

    return new Response(
      JSON.stringify(response),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
