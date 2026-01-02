import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GITHUB_API = 'https://api.github.com';
const MAX_FILE_SIZE = 100 * 1024; // 100KB
const SKIP_DIRS = ['node_modules', 'dist', 'build', '.git', '__pycache__', '.next', 'vendor', 'coverage'];
const PRIORITY_FILES = ['package.json', 'requirements.txt', 'setup.py', 'Cargo.toml', 'go.mod', 'pom.xml', 'README.md', 'README.rst', 'index.js', 'index.ts', 'main.py', 'app.py', 'main.go', 'lib.rs'];

interface SyncOptions {
  include_issues?: boolean;
  include_prs?: boolean;
  include_code?: boolean;
  open_issues_only?: boolean;
  max_files_per_repo?: number;
}

interface RequestCounter {
  count: number;
  resetTime: number;
}

const requestCounter: RequestCounter = {
  count: 0,
  resetTime: Date.now() + 3600000
};

async function githubFetch(url: string, accessToken: string): Promise<Response> {
  // Check rate limit
  if (requestCounter.count >= 4900) { // Leave buffer
    const waitTime = requestCounter.resetTime - Date.now();
    if (waitTime > 0) {
      console.log(`Rate limit approaching, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 60000)));
    }
    requestCounter.count = 0;
    requestCounter.resetTime = Date.now() + 3600000;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'SwissVault-Integration'
    }
  });

  requestCounter.count++;

  // Check rate limit headers
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const resetTime = response.headers.get('X-RateLimit-Reset');
  
  if (remaining && parseInt(remaining) < 100) {
    console.log(`GitHub rate limit low: ${remaining} remaining`);
  }
  
  if (resetTime) {
    requestCounter.resetTime = parseInt(resetTime) * 1000;
  }

  if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
    throw new Error('GitHub rate limit exceeded. Please try again later.');
  }

  return response;
}

async function getUserRepos(accessToken: string): Promise<any[]> {
  const repos: any[] = [];
  let page = 1;
  
  while (true) {
    const response = await githubFetch(
      `${GITHUB_API}/user/repos?per_page=100&page=${page}&sort=updated`,
      accessToken
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch repos: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.length === 0) break;
    
    repos.push(...data);
    page++;
    
    if (repos.length >= 200) break; // Limit total repos
  }
  
  return repos;
}

async function getRepoReadme(owner: string, repo: string, accessToken: string): Promise<string | null> {
  try {
    const response = await githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/readme`,
      accessToken
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    // Decode base64 content
    const content = atob(data.content.replace(/\n/g, ''));
    return content;
  } catch (error) {
    console.log(`No README found for ${owner}/${repo}`);
    return null;
  }
}

async function getRepoIssues(
  owner: string, 
  repo: string, 
  accessToken: string,
  openOnly: boolean = true
): Promise<any[]> {
  const state = openOnly ? 'open' : 'all';
  const response = await githubFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/issues?state=${state}&per_page=50`,
    accessToken
  );
  
  if (!response.ok) return [];
  
  const issues = await response.json();
  // Filter out PRs (GitHub API includes PRs in issues endpoint)
  return issues.filter((issue: any) => !issue.pull_request);
}

async function getRepoPRs(
  owner: string, 
  repo: string, 
  accessToken: string,
  state: string = 'open'
): Promise<any[]> {
  const response = await githubFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=${state}&per_page=30`,
    accessToken
  );
  
  if (!response.ok) return [];
  
  return await response.json();
}

async function getRepoContents(
  owner: string, 
  repo: string, 
  path: string,
  accessToken: string,
  maxFiles: number,
  fileCount: { count: number }
): Promise<any[]> {
  if (fileCount.count >= maxFiles) return [];
  
  const response = await githubFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`,
    accessToken
  );
  
  if (!response.ok) return [];
  
  const contents = await response.json();
  const files: any[] = [];
  
  for (const item of contents) {
    if (fileCount.count >= maxFiles) break;
    
    if (item.type === 'dir') {
      // Skip excluded directories
      if (SKIP_DIRS.includes(item.name)) continue;
      
      // Recursively get contents
      const subFiles = await getRepoContents(owner, repo, item.path, accessToken, maxFiles, fileCount);
      files.push(...subFiles);
    } else if (item.type === 'file') {
      // Check file size
      if (item.size > MAX_FILE_SIZE) continue;
      
      // Prioritize certain files
      const isPriority = PRIORITY_FILES.some(pf => item.name.toLowerCase() === pf.toLowerCase());
      
      // Skip non-priority files if we have many files
      if (!isPriority && fileCount.count > 20) continue;
      
      // Get file content
      try {
        const fileResponse = await githubFetch(item.download_url, accessToken);
        if (fileResponse.ok) {
          const content = await fileResponse.text();
          files.push({
            path: item.path,
            name: item.name,
            content,
            size: item.size,
            sha: item.sha
          });
          fileCount.count++;
        }
      } catch (error) {
        console.log(`Failed to fetch file: ${item.path}`);
      }
    }
  }
  
  return files;
}

function formatIssueContent(issue: any): string {
  let content = `# Issue #${issue.number}: ${issue.title}\n\n`;
  content += `**State:** ${issue.state}\n`;
  content += `**Author:** ${issue.user?.login || 'Unknown'}\n`;
  content += `**Created:** ${issue.created_at}\n`;
  
  if (issue.labels?.length > 0) {
    content += `**Labels:** ${issue.labels.map((l: any) => l.name).join(', ')}\n`;
  }
  
  if (issue.assignees?.length > 0) {
    content += `**Assignees:** ${issue.assignees.map((a: any) => a.login).join(', ')}\n`;
  }
  
  content += `\n---\n\n${issue.body || 'No description provided.'}\n`;
  
  return content;
}

function formatPRContent(pr: any): string {
  let content = `# PR #${pr.number}: ${pr.title}\n\n`;
  content += `**State:** ${pr.state}\n`;
  content += `**Author:** ${pr.user?.login || 'Unknown'}\n`;
  content += `**Branch:** ${pr.head?.ref} → ${pr.base?.ref}\n`;
  content += `**Created:** ${pr.created_at}\n`;
  
  if (pr.labels?.length > 0) {
    content += `**Labels:** ${pr.labels.map((l: any) => l.name).join(', ')}\n`;
  }
  
  content += `\n---\n\n${pr.body || 'No description provided.'}\n`;
  
  return content;
}

async function generateEmbedding(text: string, openaiKey: string): Promise<number[] | null> {
  try {
    const truncatedText = text.slice(0, 8000);
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: truncatedText,
      }),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Embedding error:', error);
    return null;
  }
}

function chunkContent(content: string, maxTokens: number = 500): string[] {
  const chunks: string[] = [];
  const sentences = content.split(/(?<=[.!?\n])\s+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const estimatedTokens = (currentChunk + sentence).length / 4;
    
    if (estimatedTokens > maxTokens && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { integration_id, repos, options, for_memory } = await req.json() as {
      integration_id: string;
      repos?: string[];
      options?: SyncOptions;
      for_memory?: boolean;
    };
    
    if (!integration_id) {
      return new Response(
        JSON.stringify({ error: 'Missing integration_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get integration record
    const { data: integration, error: integrationError } = await supabase
      .from('chat_integrations')
      .select('*')
      .eq('id', integration_id)
      .eq('user_id', user.id)
      .eq('integration_type', 'github')
      .single();
    
    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Decode the base64-encoded access token
    let accessToken: string;
    try {
      // The token is stored as base64-encoded string
      accessToken = atob(integration.encrypted_access_token);
    } catch (e) {
      // If not base64, use as-is (backwards compatibility)
      accessToken = integration.encrypted_access_token;
    }
    
    console.log(`GitHub token format: ${accessToken.substring(0, 4)}...`);
    
    const syncOptions: SyncOptions = {
      include_issues: options?.include_issues ?? true,
      include_prs: options?.include_prs ?? false,
      include_code: options?.include_code ?? false,
      open_issues_only: options?.open_issues_only ?? true,
      max_files_per_repo: options?.max_files_per_repo ?? 30
    };
    
    console.log(`Starting GitHub sync for user ${user.id} with options:`, syncOptions, `for_memory: ${for_memory}`);
    
    // Collect items for memory sync response
    const memoryItems: Array<{
      id: string;
      title: string;
      body: string;
      repo: string;
      type: string;
      state: string;
      author: string;
      url: string;
      labels: string[];
      number?: number;
      created_at: string;
    }> = [];
    // Get repos to sync
    let reposToSync: any[];
    
    if (repos && repos.length > 0) {
      // Sync specific repos
      reposToSync = [];
      for (const repoFullName of repos) {
        const [owner, repo] = repoFullName.split('/');
        const response = await githubFetch(
          `${GITHUB_API}/repos/${owner}/${repo}`,
          accessToken
        );
        if (response.ok) {
          reposToSync.push(await response.json());
        }
      }
    } else {
      // Get all user repos
      reposToSync = await getUserRepos(accessToken);
    }
    
    console.log(`Found ${reposToSync.length} repos to sync`);
    
    let reposSynced = 0;
    let filesIndexed = 0;
    let issuesIndexed = 0;
    let prsIndexed = 0;
    
    for (const repo of reposToSync) {
      const owner = repo.owner.login;
      const repoName = repo.name;
      const fullName = repo.full_name;
      
      console.log(`Syncing repo: ${fullName}`);
      
      // 1. Store repo metadata
      const repoContent = `# ${repo.name}\n\n${repo.description || 'No description'}\n\n` +
        `**Language:** ${repo.language || 'Unknown'}\n` +
        `**Stars:** ${repo.stargazers_count}\n` +
        `**Forks:** ${repo.forks_count}\n` +
        `**Open Issues:** ${repo.open_issues_count}\n` +
        `**Created:** ${repo.created_at}\n` +
        `**Updated:** ${repo.updated_at}\n` +
        `**URL:** ${repo.html_url}`;
      
      const repoEmbedding = await generateEmbedding(repoContent, openaiKey);
      
      await supabase
        .from('chat_integration_data')
        .upsert({
          integration_id,
          data_type: 'github_repo',
          external_id: fullName,
          title: repo.name,
          snippet: repo.description?.slice(0, 200) || `${repo.name} repository`,
          encrypted_content: repoContent,
          metadata: {
            repo: fullName,
            language: repo.language,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            issues_count: repo.open_issues_count,
            url: repo.html_url,
            default_branch: repo.default_branch,
            topics: repo.topics || []
          },
          synced_at: new Date().toISOString()
        }, {
          onConflict: 'integration_id,external_id'
        });
      
      // Store embedding in document_chunks for RAG
      if (repoEmbedding) {
        await supabase
          .from('document_chunks')
          .upsert({
            user_id: user.id,
            filename: `github:${fullName}`,
            chunk_index: 0,
            content: repoContent,
            embedding: JSON.stringify(repoEmbedding),
            metadata: { source: 'github', repo: fullName, type: 'repo' }
          }, {
            onConflict: 'user_id,filename,chunk_index'
          });
      }
      
      // 2. Get and store README
      const readme = await getRepoReadme(owner, repoName, accessToken);
      if (readme) {
        const readmeChunks = chunkContent(readme);
        
        for (let i = 0; i < readmeChunks.length; i++) {
          const chunk = readmeChunks[i];
          const embedding = await generateEmbedding(chunk, openaiKey);
          
          if (embedding) {
            await supabase
              .from('document_chunks')
              .upsert({
                user_id: user.id,
                filename: `github:${fullName}/README`,
                chunk_index: i,
                content: chunk,
                embedding: JSON.stringify(embedding),
                metadata: { source: 'github', repo: fullName, type: 'readme', chunk: i + 1, total_chunks: readmeChunks.length }
              }, {
                onConflict: 'user_id,filename,chunk_index'
              });
          }
        }
        
        await supabase
          .from('chat_integration_data')
          .upsert({
            integration_id,
            data_type: 'github_readme',
            external_id: `${fullName}/README`,
            title: `${repo.name} README`,
            snippet: readme.slice(0, 200),
            encrypted_content: readme,
            metadata: { repo: fullName, type: 'readme' },
            synced_at: new Date().toISOString()
          }, {
            onConflict: 'integration_id,external_id'
          });
        
        filesIndexed++;
      }
      
      // 3. Sync issues if enabled
      if (syncOptions.include_issues) {
        const issues = await getRepoIssues(owner, repoName, accessToken, syncOptions.open_issues_only);
        
        for (const issue of issues.slice(0, 20)) { // Limit to 20 issues per repo
          const issueContent = formatIssueContent(issue);
          
          // Collect item for memory response
          if (for_memory) {
            memoryItems.push({
              id: issue.id.toString(),
              title: issue.title,
              body: issue.body || '',
              repo: fullName,
              type: 'issue',
              state: issue.state,
              author: issue.user?.login || 'unknown',
              url: issue.html_url,
              labels: issue.labels?.map((l: any) => l.name) || [],
              number: issue.number,
              created_at: issue.created_at
            });
          }
          
          const embedding = await generateEmbedding(issueContent, openaiKey);
          
          await supabase
            .from('chat_integration_data')
            .upsert({
              integration_id,
              data_type: 'github_issue',
              external_id: `${fullName}/issues/${issue.number}`,
              title: `Issue #${issue.number}: ${issue.title}`,
              snippet: issue.body?.slice(0, 200) || issue.title,
              encrypted_content: issueContent,
              metadata: {
                repo: fullName,
                issue_number: issue.number,
                state: issue.state,
                labels: issue.labels?.map((l: any) => l.name) || [],
                author: issue.user?.login,
                url: issue.html_url
              },
              synced_at: new Date().toISOString()
            }, {
              onConflict: 'integration_id,external_id'
            });
          
          if (embedding) {
            await supabase
              .from('document_chunks')
              .upsert({
                user_id: user.id,
                filename: `github:${fullName}/issues/${issue.number}`,
                chunk_index: 0,
                content: issueContent,
                embedding: JSON.stringify(embedding),
                metadata: { source: 'github', repo: fullName, type: 'issue', issue_number: issue.number }
              }, {
                onConflict: 'user_id,filename,chunk_index'
              });
          }
          
          issuesIndexed++;
        }
      }
      
      // 4. Sync PRs if enabled
      if (syncOptions.include_prs) {
        const prs = await getRepoPRs(owner, repoName, accessToken);
        
        for (const pr of prs.slice(0, 10)) { // Limit to 10 PRs per repo
          const prContent = formatPRContent(pr);
          
          // Collect item for memory response
          if (for_memory) {
            memoryItems.push({
              id: pr.id.toString(),
              title: pr.title,
              body: pr.body || '',
              repo: fullName,
              type: 'pr',
              state: pr.state,
              author: pr.user?.login || 'unknown',
              url: pr.html_url,
              labels: pr.labels?.map((l: any) => l.name) || [],
              number: pr.number,
              created_at: pr.created_at
            });
          }
          
          const embedding = await generateEmbedding(prContent, openaiKey);
          
          await supabase
            .from('chat_integration_data')
            .upsert({
              integration_id,
              data_type: 'github_pr',
              external_id: `${fullName}/pulls/${pr.number}`,
              title: `PR #${pr.number}: ${pr.title}`,
              snippet: pr.body?.slice(0, 200) || pr.title,
              encrypted_content: prContent,
              metadata: {
                repo: fullName,
                pr_number: pr.number,
                state: pr.state,
                labels: pr.labels?.map((l: any) => l.name) || [],
                author: pr.user?.login,
                branch: pr.head?.ref,
                url: pr.html_url
              },
              synced_at: new Date().toISOString()
            }, {
              onConflict: 'integration_id,external_id'
            });
          
          if (embedding) {
            await supabase
              .from('document_chunks')
              .upsert({
                user_id: user.id,
                filename: `github:${fullName}/pulls/${pr.number}`,
                chunk_index: 0,
                content: prContent,
                embedding: JSON.stringify(embedding),
                metadata: { source: 'github', repo: fullName, type: 'pr', pr_number: pr.number }
              }, {
                onConflict: 'user_id,filename,chunk_index'
              });
          }
          
          prsIndexed++;
        }
      }
      
      // 5. Sync code files if enabled
      if (syncOptions.include_code) {
        const fileCount = { count: 0 };
        const files = await getRepoContents(
          owner, 
          repoName, 
          '', 
          accessToken, 
          syncOptions.max_files_per_repo || 30,
          fileCount
        );
        
        for (const file of files) {
          const fileContent = `# ${file.path}\n\n\`\`\`\n${file.content}\n\`\`\``;
          const chunks = chunkContent(file.content);
          
          for (let i = 0; i < chunks.length; i++) {
            const embedding = await generateEmbedding(chunks[i], openaiKey);
            
            if (embedding) {
              await supabase
                .from('document_chunks')
                .upsert({
                  user_id: user.id,
                  filename: `github:${fullName}/${file.path}`,
                  chunk_index: i,
                  content: chunks[i],
                  embedding: JSON.stringify(embedding),
                  metadata: { 
                    source: 'github', 
                    repo: fullName, 
                    type: 'code',
                    path: file.path,
                    chunk: i + 1,
                    total_chunks: chunks.length
                  }
                }, {
                  onConflict: 'user_id,filename,chunk_index'
                });
            }
          }
          
          await supabase
            .from('chat_integration_data')
            .upsert({
              integration_id,
              data_type: 'github_code',
              external_id: `${fullName}/${file.path}`,
              title: file.path,
              snippet: file.content.slice(0, 200),
              encrypted_content: file.content,
              metadata: {
                repo: fullName,
                path: file.path,
                size: file.size,
                sha: file.sha
              },
              synced_at: new Date().toISOString()
            }, {
              onConflict: 'integration_id,external_id'
            });
          
          filesIndexed++;
        }
      }
      
      reposSynced++;
    }
    
    // Update integration last_synced_at
    await supabase
      .from('chat_integrations')
      .update({ 
        last_synced_at: new Date().toISOString(),
        metadata: {
          ...integration.metadata,
          last_sync_stats: {
            repos_synced: reposSynced,
            files_indexed: filesIndexed,
            issues_indexed: issuesIndexed,
            prs_indexed: prsIndexed
          }
        }
      })
      .eq('id', integration_id);
    
    console.log(`GitHub sync complete: ${reposSynced} repos, ${filesIndexed} files, ${issuesIndexed} issues, ${prsIndexed} PRs`);
    
    // Return items for memory sync, or stats for regular sync
    const response = for_memory 
      ? {
          success: true,
          items: memoryItems,
          repos_synced: reposSynced,
          files_indexed: filesIndexed,
          issues_indexed: issuesIndexed,
          prs_indexed: prsIndexed
        }
      : {
          success: true,
          repos_synced: reposSynced,
          files_indexed: filesIndexed,
          issues_indexed: issuesIndexed,
          prs_indexed: prsIndexed,
          rate_limit_remaining: 5000 - requestCounter.count
        };
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('GitHub sync error:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        rate_limit_info: errorMessage.includes('rate limit') ? 
          'GitHub rate limit exceeded. Try again in an hour.' : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
