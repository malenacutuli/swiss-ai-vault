/**
 * Template Initializer
 * Handles project scaffolding from templates
 */

import { Template, TemplateFile } from './TemplateRegistry';

interface InitOptions {
  projectName?: string;
  skipInstall?: boolean;
  variables?: Record<string, string>;
}

interface InitResult {
  success: boolean;
  template: string;
  targetDir: string;
  duration: number;
  files: string[];
  errors?: string[];
}

interface FileSystemAdapter {
  mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
  writeFile: (path: string, content: string) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  exists: (path: string) => Promise<boolean>;
}

interface CommandExecutor {
  exec: (command: string, options?: { cwd?: string; timeout?: number; env?: Record<string, string> }) => Promise<{ stdout: string; stderr: string }>;
}

export class TemplateInitializer {
  private fs: FileSystemAdapter;
  private executor: CommandExecutor;

  constructor(fs: FileSystemAdapter, executor: CommandExecutor) {
    this.fs = fs;
    this.executor = executor;
  }

  /**
   * Initialize a project from a template
   */
  async initializeProject(
    template: Template,
    targetDir: string,
    options: InitOptions = {}
  ): Promise<InitResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const writtenFiles: string[] = [];

    try {
      // Run pre-init hook
      if (template.hooks?.preInit) {
        await this.runHook(template.hooks.preInit, targetDir, 'pre-init');
      }

      // Create directory structure
      await this.createDirectories(template, targetDir);

      // Write template files with variable substitution
      const files = await this.writeFiles(template, targetDir, options);
      writtenFiles.push(...files);

      // Create package.json for JS/TS projects
      if (this.hasPackageJson(template)) {
        await this.createPackageJson(template, targetDir, options);
        writtenFiles.push('package.json');
      }

      // Run post-init hook
      if (template.hooks?.postInit) {
        await this.runHook(template.hooks.postInit, targetDir, 'post-init');
      }

      // Install dependencies (unless skipped)
      if (!options.skipInstall && this.hasPackageJson(template)) {
        try {
          await this.installDependencies(targetDir);
        } catch (err) {
          errors.push(`Dependency installation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      return {
        success: errors.length === 0,
        template: template.id,
        targetDir,
        duration: Date.now() - startTime,
        files: writtenFiles,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (err) {
      return {
        success: false,
        template: template.id,
        targetDir,
        duration: Date.now() - startTime,
        files: writtenFiles,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
      };
    }
  }

  /**
   * Create all required directories
   */
  private async createDirectories(template: Template, targetDir: string): Promise<void> {
    const dirs = new Set<string>();
    
    for (const file of template.files) {
      const parts = file.path.split('/');
      if (parts.length > 1) {
        // Get directory path (everything except filename)
        const dir = parts.slice(0, -1).join('/');
        dirs.add(dir);
      }
    }

    // Create directories
    for (const dir of dirs) {
      const fullPath = this.joinPath(targetDir, dir);
      await this.fs.mkdir(fullPath, { recursive: true });
    }
  }

  /**
   * Write template files with variable substitution
   */
  private async writeFiles(
    template: Template, 
    targetDir: string, 
    options: InitOptions
  ): Promise<string[]> {
    const writtenFiles: string[] = [];

    for (const file of template.files) {
      let content = file.content;
      
      // Variable substitution
      content = this.substituteVariables(content, {
        projectName: options.projectName || template.name,
        ...options.variables,
      });

      const fullPath = this.joinPath(targetDir, file.path);
      await this.fs.writeFile(fullPath, content);
      writtenFiles.push(file.path);
    }

    return writtenFiles;
  }

  /**
   * Substitute template variables in content
   */
  private substituteVariables(content: string, variables: Record<string, string>): string {
    let result = content;
    
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(pattern, value);
    }
    
    return result;
  }

  /**
   * Create package.json file
   */
  private async createPackageJson(
    template: Template, 
    targetDir: string, 
    options: InitOptions
  ): Promise<void> {
    const packageJson = {
      name: this.sanitizePackageName(options.projectName || template.name),
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: template.scripts,
      dependencies: template.dependencies,
      devDependencies: template.devDependencies,
    };

    const fullPath = this.joinPath(targetDir, 'package.json');
    await this.fs.writeFile(fullPath, JSON.stringify(packageJson, null, 2));
  }

  /**
   * Check if template needs package.json
   */
  private hasPackageJson(template: Template): boolean {
    // Check if template has JS/TS dependencies
    return (
      Object.keys(template.dependencies).length > 0 ||
      Object.keys(template.devDependencies).length > 0 ||
      Object.keys(template.scripts).length > 0
    );
  }

  /**
   * Install dependencies
   */
  private async installDependencies(targetDir: string): Promise<void> {
    await this.executor.exec('pnpm install', {
      cwd: targetDir,
      timeout: 120000, // 2 minutes
    });
  }

  /**
   * Run a hook script
   */
  private async runHook(
    script: string,
    targetDir: string,
    hookName: string
  ): Promise<void> {
    const env = {
      TEMPLATE_DIR: targetDir,
      HOOK_NAME: hookName,
    };

    const timeout = hookName === 'pre-init' ? 60000 : 300000;

    await this.executor.exec(script, {
      cwd: targetDir,
      env,
      timeout,
    });
  }

  /**
   * Join path segments
   */
  private joinPath(...segments: string[]): string {
    return segments.join('/').replace(/\/+/g, '/');
  }

  /**
   * Sanitize package name for npm
   */
  private sanitizePackageName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

/**
 * Browser-compatible template initializer
 * Creates files in memory for preview
 */
export class BrowserTemplateInitializer {
  /**
   * Generate files from template
   */
  static generateFiles(
    template: Template,
    options: { projectName?: string; variables?: Record<string, string> } = {}
  ): { path: string; content: string }[] {
    const files: { path: string; content: string }[] = [];
    const variables = {
      projectName: options.projectName || template.name,
      ...options.variables,
    };

    // Generate template files
    for (const file of template.files) {
      let content = file.content;
      
      // Variable substitution
      for (const [key, value] of Object.entries(variables)) {
        const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        content = content.replace(pattern, value);
      }

      files.push({ path: file.path, content });
    }

    // Generate package.json if needed
    if (
      Object.keys(template.dependencies).length > 0 ||
      Object.keys(template.devDependencies).length > 0 ||
      Object.keys(template.scripts).length > 0
    ) {
      const packageJson = {
        name: variables.projectName
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/--+/g, '-')
          .replace(/^-|-$/g, ''),
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: template.scripts,
        dependencies: template.dependencies,
        devDependencies: template.devDependencies,
      };

      files.push({
        path: 'package.json',
        content: JSON.stringify(packageJson, null, 2),
      });
    }

    return files;
  }

  /**
   * Get file tree structure from template
   */
  static getFileTree(template: Template): { name: string; type: 'file' | 'folder'; children?: typeof this[] }[] {
    const tree: Map<string, any> = new Map();

    for (const file of template.files) {
      const parts = file.path.split('/');
      let current = tree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;

        if (!current.has(part)) {
          current.set(part, isFile ? { name: part, type: 'file' } : { name: part, type: 'folder', children: new Map() });
        }

        if (!isFile) {
          current = current.get(part).children;
        }
      }
    }

    // Convert to array structure
    const mapToArray = (map: Map<string, any>): any[] => {
      const result: any[] = [];
      for (const [, value] of map) {
        if (value.type === 'folder') {
          result.push({
            name: value.name,
            type: 'folder',
            children: mapToArray(value.children),
          });
        } else {
          result.push(value);
        }
      }
      return result.sort((a, b) => {
        // Folders first, then files
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    };

    return mapToArray(tree);
  }
}
