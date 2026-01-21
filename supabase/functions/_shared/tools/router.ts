// Tool Router for executing different tool types

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getGoogleAIClient } from '../google-ai/index.ts';

export interface ToolResult {
  output: unknown;
  success: boolean;
  error?: string;
  creditsUsed?: number;
  artifacts?: Array<{
    id: string;
    filename: string;
    file_type: string;
    url: string;
  }>;
  memory?: Array<{
    type: 'fact' | 'preference' | 'context';
    content: string;
    importance: number;
  }>;
}

export interface ToolContext {
  runId: string;
  userId: string;
  stepId: string;
}

export class ToolRouter {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  async execute(
    toolName: string,
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    // Route to appropriate tool handler
    switch (toolName) {
      case 'shell':
        return this.executeShell(input, context);
      case 'code':
        return this.executeCode(input, context);
      case 'message':
        return this.sendMessage(input, context);
      case 'search':
        return this.webSearch(input, context);
      case 'browser':
        return this.browserInteraction(input, context);
      case 'file_read':
        return this.fileRead(input, context);
      case 'file_write':
        return this.fileWrite(input, context);
      case 'file_list':
        return this.fileList(input, context);
      case 'connector':
        return this.connectorAccess(input, context);
      case 'image_generate':
        return this.generateImage(input, context);
      case 'image_analyze':
        return this.analyzeImage(input, context);
      case 'podcast_generate':
        return this.generatePodcast(input, context);
      case 'gemini_text':
        return this.geminiText(input, context);
      default:
        return {
          output: null,
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
    }
  }

  // Google AI Tools
  private async generateImage(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const prompt = input.prompt as string;
    const model = input.model as 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview' | undefined;
    const aspectRatio = input.aspect_ratio as '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | undefined;
    const imageSize = input.image_size as '1K' | '2K' | '4K' | undefined;

    if (!prompt) {
      return { success: false, output: null, error: 'Prompt is required for image generation' };
    }

    console.log('[Tool:image_generate] Generating image:', prompt.slice(0, 50));

    const googleAI = getGoogleAIClient();
    const result = await googleAI.generateImages({
      prompt,
      model,
      aspectRatio,
      imageSize,
    });

    if (!result.success || !result.images) {
      return {
        success: false,
        output: null,
        error: result.error || 'Image generation failed',
        creditsUsed: 5,
      };
    }

    // Save images to storage
    const artifacts: Array<{ id: string; filename: string; file_type: string; url: string }> = [];

    for (let i = 0; i < result.images.length; i++) {
      const image = result.images[i];
      const imageId = crypto.randomUUID();
      const filename = `generated_${Date.now()}_${i}.png`;
      const storagePath = `${context.userId}/${context.runId}/${filename}`;

      // Convert base64 to Uint8Array
      const imageData = Uint8Array.from(atob(image.base64), c => c.charCodeAt(0));

      // Upload to storage
      const { error: uploadError } = await this.supabase.storage
        .from('agent-outputs')
        .upload(storagePath, imageData, {
          contentType: image.mimeType,
        });

      if (!uploadError) {
        const { data: { publicUrl } } = this.supabase.storage
          .from('agent-outputs')
          .getPublicUrl(storagePath);

        artifacts.push({
          id: imageId,
          filename,
          file_type: 'image',
          url: publicUrl,
        });
      }
    }

    return {
      success: true,
      output: {
        message: `Generated ${result.images.length} image(s)`,
        images: artifacts.map(a => a.url),
      },
      artifacts,
      creditsUsed: 10,
    };
  }

  private async analyzeImage(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const imageBase64 = input.image_base64 as string;
    const imageUrl = input.image_url as string;
    const prompt = input.prompt as string || 'Describe this image in detail.';

    if (!imageBase64 && !imageUrl) {
      return { success: false, output: null, error: 'Either image_base64 or image_url is required' };
    }

    console.log('[Tool:image_analyze] Analyzing image');

    let base64Data = imageBase64;

    // If URL provided, fetch and convert to base64
    if (imageUrl && !imageBase64) {
      try {
        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      } catch (err) {
        return { success: false, output: null, error: 'Failed to fetch image from URL' };
      }
    }

    const googleAI = getGoogleAIClient();
    const result = await googleAI.analyzeImage(base64Data, prompt);

    if (!result.success) {
      return {
        success: false,
        output: null,
        error: result.error || 'Image analysis failed',
        creditsUsed: 3,
      };
    }

    return {
      success: true,
      output: {
        analysis: result.text,
      },
      creditsUsed: 5,
    };
  }

  private async generatePodcast(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const sources = input.sources as Array<{ type: string; content: string; title?: string }>;
    const style = input.style as 'conversational' | 'educational' | 'news' | undefined;
    const duration = input.duration as 'short' | 'medium' | 'long' | undefined;

    if (!sources || sources.length === 0) {
      return { success: false, output: null, error: 'At least one source is required' };
    }

    console.log('[Tool:podcast_generate] Generating podcast from', sources.length, 'sources');

    const googleAI = getGoogleAIClient();
    const result = await googleAI.generatePodcast({
      sources: sources.map(s => ({
        type: s.type as 'text' | 'url' | 'document',
        content: s.content,
        title: s.title,
      })),
      style,
      duration,
    });

    if (!result.success) {
      return {
        success: false,
        output: null,
        error: result.error || 'Podcast generation failed',
        creditsUsed: 10,
      };
    }

    return {
      success: true,
      output: {
        audioUrl: result.audioUrl,
        transcript: result.transcript,
        duration: result.duration,
      },
      creditsUsed: 20,
    };
  }

  private async geminiText(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const prompt = input.prompt as string;
    const model = input.model as string | undefined;
    const systemInstruction = input.system_instruction as string | undefined;
    const maxTokens = input.max_tokens as number | undefined;
    const temperature = input.temperature as number | undefined;

    if (!prompt) {
      return { success: false, output: null, error: 'Prompt is required' };
    }

    console.log('[Tool:gemini_text] Generating text with Gemini');

    const googleAI = getGoogleAIClient();
    const result = await googleAI.generateText({
      prompt,
      model,
      systemInstruction,
      maxTokens,
      temperature,
    });

    if (!result.success) {
      return {
        success: false,
        output: null,
        error: result.error || 'Text generation failed',
        creditsUsed: 2,
      };
    }

    return {
      success: true,
      output: {
        text: result.text,
        usage: result.usage,
      },
      creditsUsed: 5,
    };
  }

  private async executeShell(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    // TODO: Implement shell execution via K8s
    // This will create a K8s pod with the user's workspace
    // Execute the command and return stdout/stderr

    const command = input.command as string;
    const workingDir = input.working_dir as string | undefined;

    // Placeholder implementation
    console.log(`[Shell] Command: ${command}, Dir: ${workingDir || '/workspace'}`);

    // In production, this would:
    // 1. Get user's workspace from storage
    // 2. Create ephemeral K8s pod with workspace mounted
    // 3. Execute command in pod
    // 4. Capture stdout/stderr
    // 5. Save workspace changes back to storage
    // 6. Clean up pod

    return {
      output: {
        stdout: `Shell execution not yet implemented. Would execute: ${command}`,
        stderr: '',
        exit_code: 0,
      },
      success: true,
      creditsUsed: 1,
    };
  }

  private async executeCode(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    // TODO: Implement code execution via K8s sandbox
    // This will create an isolated pod with language runtime

    const language = input.language as string;
    const code = input.code as string;
    const timeout = input.timeout as number | undefined;

    // Placeholder implementation
    console.log(`[Code] Language: ${language}, Timeout: ${timeout || 30}s`);

    // In production, this would:
    // 1. Create sandboxed K8s pod with appropriate runtime (Python, Node, etc.)
    // 2. Execute code with resource limits (CPU, memory, time)
    // 3. Capture output and return value
    // 4. Handle errors and timeouts
    // 5. Clean up pod

    return {
      output: {
        result: `Code execution not yet implemented. Would execute ${language} code`,
        execution_time_ms: 0,
      },
      success: true,
      creditsUsed: 2,
    };
  }

  private async sendMessage(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    // Store message in agent_messages
    const message = input.message as string;

    const { error } = await (this.supabase.from('agent_messages') as any).insert({
      run_id: context.runId,
      role: 'assistant',
      content: message,
    });

    if (error) {
      return {
        output: null,
        success: false,
        error: `Failed to send message: ${error.message}`,
      };
    }

    return {
      output: { sent: true, message },
      success: true,
      creditsUsed: 0, // Messages are free
    };
  }

  private async webSearch(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    // TODO: Implement web search via search API (e.g., Brave Search, Google, etc.)

    const query = input.query as string;
    const maxResults = input.max_results as number | undefined || 5;

    // Placeholder implementation
    console.log(`[Search] Query: ${query}, Max: ${maxResults}`);

    // In production, this would:
    // 1. Call search API with query
    // 2. Parse and format results
    // 3. Extract relevant snippets
    // 4. Return structured search results

    return {
      output: {
        results: [
          {
            title: `Search result for: ${query}`,
            url: 'https://example.com',
            snippet: 'Web search not yet implemented',
          },
        ],
        query,
      },
      success: true,
      creditsUsed: 1,
    };
  }

  private async browserInteraction(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    // TODO: Implement browser automation via Playwright/Puppeteer

    const action = input.action as string; // 'navigate', 'click', 'type', 'screenshot', etc.
    const url = input.url as string | undefined;

    // Placeholder implementation
    console.log(`[Browser] Action: ${action}, URL: ${url}`);

    // In production, this would:
    // 1. Launch browser in K8s pod
    // 2. Perform requested action
    // 3. Capture screenshots if needed
    // 4. Extract page content
    // 5. Return results

    return {
      output: {
        action,
        result: 'Browser interaction not yet implemented',
      },
      success: true,
      creditsUsed: 3,
    };
  }

  private async fileRead(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    // Read file from user's workspace storage
    const filepath = input.filepath as string;

    // TODO: Implement file operations via storage backend
    // For now, this is a placeholder

    console.log(`[File Read] Path: ${filepath}`);

    return {
      output: {
        content: `File read not yet implemented: ${filepath}`,
        filepath,
      },
      success: true,
      creditsUsed: 1,
    };
  }

  private async fileWrite(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    // Write file to user's workspace storage
    const filepath = input.filepath as string;
    const content = input.content as string;

    // TODO: Implement file operations via storage backend

    console.log(`[File Write] Path: ${filepath}, Size: ${content.length} bytes`);

    return {
      output: {
        written: true,
        filepath,
        bytes: content.length,
      },
      success: true,
      creditsUsed: 1,
      artifacts: [
        {
          id: crypto.randomUUID(),
          filename: filepath.split('/').pop() || 'file',
          file_type: this.getFileType(filepath),
          url: `storage://${filepath}`,
        },
      ],
    };
  }

  private async fileList(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    // List files in user's workspace
    const dirpath = input.dirpath as string || '/';

    // TODO: Implement directory listing via storage backend

    console.log(`[File List] Path: ${dirpath}`);

    return {
      output: {
        files: [],
        dirpath,
      },
      success: true,
      creditsUsed: 1,
    };
  }

  private async connectorAccess(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    // Access external service via connector
    const connectorType = input.connector_type as string;
    const operation = input.operation as string;
    const params = input.params as Record<string, unknown>;

    // Get connector credentials
    const { data: connector } = await (this.supabase
      .from('connector_credentials') as any)
      .select('*')
      .eq('user_id', context.userId)
      .eq('connector_type', connectorType)
      .eq('status', 'active')
      .single();

    if (!connector) {
      return {
        output: null,
        success: false,
        error: `Connector not found or not active: ${connectorType}`,
      };
    }

    // Route to connector handler
    switch (connectorType) {
      case 'github':
        return this.githubConnector(operation, params, connector);
      case 'linear':
        return this.linearConnector(operation, params, connector);
      case 'notion':
        return this.notionConnector(operation, params, connector);
      case 'slack':
        return this.slackConnector(operation, params, connector);
      case 'google_drive':
        return this.googleDriveConnector(operation, params, connector);
      default:
        return {
          output: null,
          success: false,
          error: `Unsupported connector: ${connectorType}`,
        };
    }
  }

  // Connector implementations (placeholders)
  private async githubConnector(
    operation: string,
    params: Record<string, unknown>,
    connector: { credentials: Record<string, unknown> }
  ): Promise<ToolResult> {
    // TODO: Implement GitHub API calls
    console.log(`[GitHub] Operation: ${operation}`);

    return {
      output: { operation, result: 'GitHub connector not yet implemented' },
      success: true,
      creditsUsed: 2,
    };
  }

  private async linearConnector(
    operation: string,
    params: Record<string, unknown>,
    connector: { credentials: Record<string, unknown> }
  ): Promise<ToolResult> {
    // TODO: Implement Linear API calls
    console.log(`[Linear] Operation: ${operation}`);

    return {
      output: { operation, result: 'Linear connector not yet implemented' },
      success: true,
      creditsUsed: 2,
    };
  }

  private async notionConnector(
    operation: string,
    params: Record<string, unknown>,
    connector: { credentials: Record<string, unknown> }
  ): Promise<ToolResult> {
    // TODO: Implement Notion API calls
    console.log(`[Notion] Operation: ${operation}`);

    return {
      output: { operation, result: 'Notion connector not yet implemented' },
      success: true,
      creditsUsed: 2,
    };
  }

  private async slackConnector(
    operation: string,
    params: Record<string, unknown>,
    connector: { credentials: Record<string, unknown> }
  ): Promise<ToolResult> {
    // TODO: Implement Slack API calls
    console.log(`[Slack] Operation: ${operation}`);

    return {
      output: { operation, result: 'Slack connector not yet implemented' },
      success: true,
      creditsUsed: 2,
    };
  }

  private async googleDriveConnector(
    operation: string,
    params: Record<string, unknown>,
    connector: { credentials: Record<string, unknown> }
  ): Promise<ToolResult> {
    // TODO: Implement Google Drive API calls
    console.log(`[Google Drive] Operation: ${operation}`);

    return {
      output: { operation, result: 'Google Drive connector not yet implemented' },
      success: true,
      creditsUsed: 2,
    };
  }

  // Helper methods
  private getFileType(filepath: string): string {
    const ext = filepath.split('.').pop()?.toLowerCase();
    const typeMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'xml': 'xml',
      'md': 'markdown',
      'txt': 'text',
      'pdf': 'pdf',
      'png': 'image',
      'jpg': 'image',
      'jpeg': 'image',
      'gif': 'image',
      'svg': 'image',
    };
    return typeMap[ext || ''] || 'unknown';
  }
}
