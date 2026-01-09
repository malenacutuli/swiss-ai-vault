/**
 * Template File Contents
 * Contains all file templates for project scaffolding
 */

// ===== SHARED FILES =====

export const GITIGNORE_TEMPLATE = `# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
.next/
out/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Python
__pycache__/
*.py[cod]
.venv/
venv/
*.egg-info/
.eggs/

# Jupyter
.ipynb_checkpoints/
`;

export const TAILWIND_CONFIG = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;

export const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
`;

export const VITE_CONFIG = `import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
  },
})
`;

// ===== STATIC SITE FILES =====

export const STATIC_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{projectName}}</title>
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body class="min-h-screen bg-gray-50">
    <main class="container mx-auto px-4 py-16">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">
        Welcome to {{projectName}}
      </h1>
      <p class="text-lg text-gray-600">
        Edit <code class="bg-gray-200 px-2 py-1 rounded">src/main.ts</code> to get started.
      </p>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;

export const STATIC_MAIN_TS = `import './style.css'

console.log('Hello from {{projectName}}!')

// Add your code here
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded')
})
`;

export const STATIC_STYLE_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

/* Add your custom styles here */
`;

// ===== REACT FILES =====

export const REACT_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{projectName}}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

export const REACT_APP_TSX = `import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {{projectName}}
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Welcome to your React app!
        </p>
        <button
          onClick={() => setCount((c) => c + 1)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Count: {count}
        </button>
      </div>
    </div>
  )
}

export default App
`;

export const REACT_MAIN_TSX = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`;

export const REACT_INDEX_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;

export const REACT_VITE_CONFIG = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
})
`;

export const REACT_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
`;

// ===== NEXT.JS FILES =====

export const NEXTJS_PAGE_TSX = `export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {{projectName}}
        </h1>
        <p className="text-lg text-gray-600">
          Welcome to your Next.js app!
        </p>
      </div>
    </main>
  )
}
`;

export const NEXTJS_LAYOUT_TSX = `import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '{{projectName}}',
  description: 'Built with Next.js',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
`;

export const NEXTJS_GLOBALS_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;

export const NEXTJS_CONFIG = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = nextConfig
`;

export const NEXTJS_TSCONFIG = `{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`;

// ===== EXPRESS FILES =====

export const EXPRESS_INDEX_TS = `import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { router } from './routes'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())

// Routes
app.use('/api', router)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`)
})
`;

export const EXPRESS_ROUTES_TS = `import { Router } from 'express'

export const router = Router()

router.get('/', (req, res) => {
  res.json({ message: 'Welcome to {{projectName}} API!' })
})

router.get('/example', (req, res) => {
  res.json({
    data: [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ],
  })
})
`;

export const EXPRESS_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`;

// ===== FASTAPI FILES =====

export const FASTAPI_MAIN_PY = `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="{{projectName}}")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Item(BaseModel):
    id: int
    name: str
    description: Optional[str] = None


# In-memory storage
items: List[Item] = []


@app.get("/")
async def root():
    return {"message": "Welcome to {{projectName}} API!"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/items", response_model=List[Item])
async def get_items():
    return items


@app.post("/items", response_model=Item)
async def create_item(item: Item):
    items.append(item)
    return item


@app.get("/items/{item_id}", response_model=Item)
async def get_item(item_id: int):
    for item in items:
        if item.id == item_id:
            return item
    return {"error": "Item not found"}
`;

export const FASTAPI_REQUIREMENTS = `fastapi>=0.109.0
uvicorn[standard]>=0.27.0
pydantic>=2.5.0
python-dotenv>=1.0.0
`;

// ===== PYTHON DATA SCIENCE FILES =====

export const PYTHON_DATA_MAIN = `"""
{{projectName}} - Data Analysis Script
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt


def main():
    # Create sample data
    np.random.seed(42)
    data = {
        'x': np.linspace(0, 10, 100),
        'y': np.random.randn(100).cumsum(),
    }
    df = pd.DataFrame(data)
    
    # Basic analysis
    print("Data Summary:")
    print(df.describe())
    
    # Visualization
    plt.figure(figsize=(10, 6))
    plt.plot(df['x'], df['y'])
    plt.title('Sample Data Visualization')
    plt.xlabel('X')
    plt.ylabel('Y')
    plt.savefig('output.png')
    print("\\nPlot saved to output.png")


if __name__ == "__main__":
    main()
`;

export const PYTHON_DATA_REQUIREMENTS = `pandas>=2.1.0
numpy>=1.26.0
matplotlib>=3.8.0
seaborn>=0.13.0
scikit-learn>=1.3.0
jupyter>=1.0.0
jupyterlab>=4.0.0
`;

export const JUPYTER_NOTEBOOK = `{
 "cells": [
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "# {{projectName}}\\n",
    "\\n",
    "Data analysis notebook."
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "import pandas as pd\\n",
    "import numpy as np\\n",
    "import matplotlib.pyplot as plt\\n",
    "import seaborn as sns\\n",
    "\\n",
    "# Set style\\n",
    "sns.set_theme(style='whitegrid')\\n",
    "plt.rcParams['figure.figsize'] = (10, 6)"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Create sample data\\n",
    "np.random.seed(42)\\n",
    "df = pd.DataFrame({\\n",
    "    'category': np.random.choice(['A', 'B', 'C'], 100),\\n",
    "    'value': np.random.randn(100).cumsum(),\\n",
    "    'count': np.random.randint(1, 100, 100)\\n",
    "})\\n",
    "df.head()"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Summary statistics\\n",
    "df.describe()"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Visualization\\n",
    "fig, axes = plt.subplots(1, 2, figsize=(14, 5))\\n",
    "\\n",
    "df.groupby('category')['value'].mean().plot(kind='bar', ax=axes[0])\\n",
    "axes[0].set_title('Mean Value by Category')\\n",
    "\\n",
    "sns.boxplot(data=df, x='category', y='count', ax=axes[1])\\n",
    "axes[1].set_title('Count Distribution by Category')\\n",
    "\\n",
    "plt.tight_layout()\\n",
    "plt.show()"
   ]
  }
 ],
 "metadata": {
  "kernelspec": {
   "display_name": "Python 3",
   "language": "python",
   "name": "python3"
  },
  "language_info": {
   "name": "python",
   "version": "3.11.0"
  }
 },
 "nbformat": 4,
 "nbformat_minor": 4
}
`;
