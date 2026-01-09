/**
 * Template Registry for Swiss Agents Sandbox
 * Defines available project templates with their configurations
 */

import type { LucideIcon } from 'lucide-react';
import { 
  Globe, 
  Atom, 
  Triangle, 
  Rocket, 
  Code2, 
  BarChart3, 
  FolderOpen 
} from 'lucide-react';

import {
  STATIC_INDEX_HTML,
  STATIC_MAIN_TS,
  STATIC_STYLE_CSS,
  REACT_INDEX_HTML,
  REACT_APP_TSX,
  REACT_MAIN_TSX,
  REACT_INDEX_CSS,
  REACT_VITE_CONFIG,
  REACT_TSCONFIG,
  NEXTJS_PAGE_TSX,
  NEXTJS_LAYOUT_TSX,
  NEXTJS_GLOBALS_CSS,
  NEXTJS_CONFIG,
  NEXTJS_TSCONFIG,
  EXPRESS_INDEX_TS,
  EXPRESS_ROUTES_TS,
  EXPRESS_TSCONFIG,
  FASTAPI_MAIN_PY,
  FASTAPI_REQUIREMENTS,
  PYTHON_DATA_MAIN,
  PYTHON_DATA_REQUIREMENTS,
  JUPYTER_NOTEBOOK,
  VITE_CONFIG,
  TAILWIND_CONFIG,
  TSCONFIG,
  GITIGNORE_TEMPLATE,
} from './files';

export interface TemplateFile {
  path: string;
  content: string;
  binary?: boolean;
}

export interface Template {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: 'web' | 'api' | 'data' | 'other';
  iconName: string;
  features: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  files: TemplateFile[];
  hooks?: {
    preInit?: string;
    postInit?: string;
  };
}

// Icon mapping - Lucide icons ONLY (thin line weight)
export const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  'web-static': Globe,
  'web-react': Atom,
  'web-nextjs': Triangle,
  'api-express': Rocket,
  'api-fastapi': Code2,
  'python-data': BarChart3,
  'generic': FolderOpen,
};

export const TEMPLATES: Template[] = [
  {
    id: 'web-static',
    name: 'web-static',
    displayName: 'Static Website',
    description: 'HTML/CSS/JS static site with Vite',
    category: 'web',
    iconName: 'Globe',
    features: ['vite', 'tailwind', 'typescript'],
    dependencies: {},
    devDependencies: {
      'vite': '^5.0.0',
      'tailwindcss': '^3.4.0',
      'typescript': '^5.3.0',
      'postcss': '^8.4.0',
      'autoprefixer': '^10.4.0',
    },
    scripts: {
      'dev': 'vite',
      'build': 'vite build',
      'preview': 'vite preview',
    },
    files: [
      { path: 'index.html', content: STATIC_INDEX_HTML },
      { path: 'src/main.ts', content: STATIC_MAIN_TS },
      { path: 'src/style.css', content: STATIC_STYLE_CSS },
      { path: 'tailwind.config.js', content: TAILWIND_CONFIG },
      { path: 'vite.config.ts', content: VITE_CONFIG },
      { path: 'tsconfig.json', content: TSCONFIG },
      { path: '.gitignore', content: GITIGNORE_TEMPLATE },
    ],
  },
  {
    id: 'web-react',
    name: 'web-react',
    displayName: 'React App',
    description: 'React with TypeScript, Vite, and Tailwind',
    category: 'web',
    iconName: 'Atom',
    features: ['react', 'vite', 'tailwind', 'typescript'],
    dependencies: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      '@vitejs/plugin-react': '^4.2.0',
      'vite': '^5.0.0',
      'tailwindcss': '^3.4.0',
      'typescript': '^5.3.0',
      'postcss': '^8.4.0',
      'autoprefixer': '^10.4.0',
    },
    scripts: {
      'dev': 'vite',
      'build': 'tsc && vite build',
      'preview': 'vite preview',
    },
    files: [
      { path: 'index.html', content: REACT_INDEX_HTML },
      { path: 'src/App.tsx', content: REACT_APP_TSX },
      { path: 'src/main.tsx', content: REACT_MAIN_TSX },
      { path: 'src/index.css', content: REACT_INDEX_CSS },
      { path: 'vite.config.ts', content: REACT_VITE_CONFIG },
      { path: 'tsconfig.json', content: REACT_TSCONFIG },
      { path: 'tailwind.config.js', content: TAILWIND_CONFIG },
      { path: '.gitignore', content: GITIGNORE_TEMPLATE },
    ],
  },
  {
    id: 'web-nextjs',
    name: 'web-nextjs',
    displayName: 'Next.js App',
    description: 'Next.js 14 with App Router and Tailwind',
    category: 'web',
    iconName: 'Triangle',
    features: ['nextjs', 'react', 'tailwind', 'typescript', 'server'],
    dependencies: {
      'next': '^14.0.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      'tailwindcss': '^3.4.0',
      'typescript': '^5.3.0',
      'postcss': '^8.4.0',
      'autoprefixer': '^10.4.0',
    },
    scripts: {
      'dev': 'next dev',
      'build': 'next build',
      'start': 'next start',
      'lint': 'next lint',
    },
    files: [
      { path: 'app/page.tsx', content: NEXTJS_PAGE_TSX },
      { path: 'app/layout.tsx', content: NEXTJS_LAYOUT_TSX },
      { path: 'app/globals.css', content: NEXTJS_GLOBALS_CSS },
      { path: 'next.config.js', content: NEXTJS_CONFIG },
      { path: 'tsconfig.json', content: NEXTJS_TSCONFIG },
      { path: 'tailwind.config.js', content: TAILWIND_CONFIG },
      { path: '.gitignore', content: GITIGNORE_TEMPLATE },
    ],
  },
  {
    id: 'api-express',
    name: 'api-express',
    displayName: 'Express API',
    description: 'Express.js REST API with TypeScript',
    category: 'api',
    iconName: 'Rocket',
    features: ['express', 'typescript', 'server'],
    dependencies: {
      'express': '^4.18.0',
      'cors': '^2.8.5',
      'helmet': '^7.1.0',
      'dotenv': '^16.3.0',
    },
    devDependencies: {
      '@types/express': '^4.17.0',
      '@types/cors': '^2.8.0',
      '@types/node': '^20.0.0',
      'tsx': '^4.0.0',
      'typescript': '^5.3.0',
    },
    scripts: {
      'dev': 'tsx watch src/index.ts',
      'build': 'tsc',
      'start': 'node dist/index.js',
    },
    files: [
      { path: 'src/index.ts', content: EXPRESS_INDEX_TS },
      { path: 'src/routes/index.ts', content: EXPRESS_ROUTES_TS },
      { path: 'tsconfig.json', content: EXPRESS_TSCONFIG },
      { path: '.gitignore', content: GITIGNORE_TEMPLATE },
    ],
  },
  {
    id: 'api-fastapi',
    name: 'api-fastapi',
    displayName: 'FastAPI',
    description: 'Python FastAPI with async support',
    category: 'api',
    iconName: 'Code2',
    features: ['python', 'fastapi', 'async', 'server'],
    dependencies: {},
    devDependencies: {},
    scripts: {
      'dev': 'uvicorn main:app --reload',
      'start': 'uvicorn main:app --host 0.0.0.0 --port 8000',
    },
    files: [
      { path: 'main.py', content: FASTAPI_MAIN_PY },
      { path: 'requirements.txt', content: FASTAPI_REQUIREMENTS },
      { path: '.python-version', content: '3.11' },
      { path: '.gitignore', content: GITIGNORE_TEMPLATE },
    ],
  },
  {
    id: 'python-data',
    name: 'python-data',
    displayName: 'Python Data Science',
    description: 'Jupyter-compatible Python environment',
    category: 'data',
    iconName: 'BarChart3',
    features: ['python', 'jupyter', 'pandas', 'numpy'],
    dependencies: {},
    devDependencies: {},
    scripts: {
      'notebook': 'jupyter notebook',
      'lab': 'jupyter lab',
    },
    files: [
      { path: 'main.py', content: PYTHON_DATA_MAIN },
      { path: 'requirements.txt', content: PYTHON_DATA_REQUIREMENTS },
      { path: 'notebooks/analysis.ipynb', content: JUPYTER_NOTEBOOK },
      { path: '.gitignore', content: GITIGNORE_TEMPLATE },
    ],
  },
  {
    id: 'generic',
    name: 'generic',
    displayName: 'Empty Project',
    description: 'Blank slate with basic tooling',
    category: 'other',
    iconName: 'FolderOpen',
    features: [],
    dependencies: {},
    devDependencies: {},
    scripts: {},
    files: [
      { path: 'README.md', content: '# {{projectName}}\n\nStart building here!' },
      { path: '.gitignore', content: GITIGNORE_TEMPLATE },
    ],
  },
];

/**
 * Get a template by ID
 */
export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find(t => t.id === id);
}

/**
 * Get all templates in a category
 */
export function getTemplatesByCategory(category: Template['category']): Template[] {
  return TEMPLATES.filter(t => t.category === category);
}

/**
 * Get all available categories
 */
export function getCategories(): Template['category'][] {
  return [...new Set(TEMPLATES.map(t => t.category))];
}

/**
 * Search templates by feature
 */
export function getTemplatesByFeature(feature: string): Template[] {
  return TEMPLATES.filter(t => t.features.includes(feature));
}
