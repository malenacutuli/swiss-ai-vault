import { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { openApiSpec } from '@/lib/openapi-spec';

interface SwaggerUIWrapperProps {
  apiKey?: string;
}

export function SwaggerUIWrapper({ apiKey }: SwaggerUIWrapperProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Custom request interceptor to add auth
  const requestInterceptor = (req: { headers: Record<string, string> }) => {
    if (apiKey) {
      req.headers['Authorization'] = `Bearer ${apiKey}`;
    }
    return req;
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="swagger-ui-wrapper">
      <style>{`
        .swagger-ui-wrapper {
          --swagger-ui-primary: hsl(var(--primary));
          --swagger-ui-bg: hsl(var(--background));
          --swagger-ui-text: hsl(var(--foreground));
          --swagger-ui-muted: hsl(var(--muted));
          --swagger-ui-border: hsl(var(--border));
        }
        
        .swagger-ui-wrapper .swagger-ui {
          font-family: inherit;
        }
        
        .swagger-ui-wrapper .swagger-ui .info {
          margin: 20px 0;
        }
        
        .swagger-ui-wrapper .swagger-ui .info .title {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--swagger-ui-text);
        }
        
        .swagger-ui-wrapper .swagger-ui .info .description {
          color: var(--swagger-ui-text);
        }
        
        .swagger-ui-wrapper .swagger-ui .info .description p {
          margin: 0.5rem 0;
        }
        
        .swagger-ui-wrapper .swagger-ui .opblock-tag {
          font-size: 1rem;
          font-weight: 600;
          color: var(--swagger-ui-text);
          border-bottom: 1px solid var(--swagger-ui-border);
        }
        
        .swagger-ui-wrapper .swagger-ui .opblock {
          border-radius: 8px;
          margin-bottom: 12px;
          box-shadow: none;
          border: 1px solid var(--swagger-ui-border);
        }
        
        .swagger-ui-wrapper .swagger-ui .opblock .opblock-summary {
          border-radius: 8px;
        }
        
        .swagger-ui-wrapper .swagger-ui .opblock .opblock-summary-method {
          border-radius: 4px;
          font-weight: 600;
          min-width: 70px;
          text-align: center;
        }
        
        .swagger-ui-wrapper .swagger-ui .opblock.opblock-post .opblock-summary-method {
          background: hsl(217 91% 60%);
        }
        
        .swagger-ui-wrapper .swagger-ui .opblock.opblock-get .opblock-summary-method {
          background: hsl(142 71% 45%);
        }
        
        .swagger-ui-wrapper .swagger-ui .opblock.opblock-put .opblock-summary-method {
          background: hsl(45 93% 47%);
        }
        
        .swagger-ui-wrapper .swagger-ui .opblock.opblock-delete .opblock-summary-method {
          background: hsl(0 84% 60%);
        }
        
        .swagger-ui-wrapper .swagger-ui .opblock .opblock-summary-path {
          font-family: monospace;
          font-size: 0.875rem;
          color: var(--swagger-ui-text);
        }
        
        .swagger-ui-wrapper .swagger-ui .opblock .opblock-summary-description {
          font-size: 0.875rem;
          color: var(--swagger-ui-text);
          opacity: 0.8;
        }
        
        .swagger-ui-wrapper .swagger-ui .opblock-body {
          background: var(--swagger-ui-bg);
        }
        
        .swagger-ui-wrapper .swagger-ui .btn {
          border-radius: 6px;
          font-weight: 500;
        }
        
        .swagger-ui-wrapper .swagger-ui .btn.execute {
          background: var(--swagger-ui-primary);
          border-color: var(--swagger-ui-primary);
        }
        
        .swagger-ui-wrapper .swagger-ui .btn.execute:hover {
          opacity: 0.9;
        }
        
        .swagger-ui-wrapper .swagger-ui .model-box {
          background: var(--swagger-ui-muted);
          border-radius: 8px;
        }
        
        .swagger-ui-wrapper .swagger-ui .response-col_status {
          font-size: 0.875rem;
        }
        
        .swagger-ui-wrapper .swagger-ui table tbody tr td {
          border-color: var(--swagger-ui-border);
          padding: 12px 8px;
        }
        
        .swagger-ui-wrapper .swagger-ui .parameter__name {
          font-family: monospace;
          font-weight: 600;
          color: var(--swagger-ui-text);
        }
        
        .swagger-ui-wrapper .swagger-ui .parameter__type {
          font-family: monospace;
          font-size: 0.75rem;
        }
        
        .swagger-ui-wrapper .swagger-ui input[type=text],
        .swagger-ui-wrapper .swagger-ui textarea {
          border-radius: 6px;
          border: 1px solid var(--swagger-ui-border);
          background: var(--swagger-ui-bg);
          color: var(--swagger-ui-text);
          padding: 8px 12px;
        }
        
        .swagger-ui-wrapper .swagger-ui select {
          border-radius: 6px;
          border: 1px solid var(--swagger-ui-border);
          background: var(--swagger-ui-bg);
          color: var(--swagger-ui-text);
        }
        
        .swagger-ui-wrapper .swagger-ui .highlight-code {
          border-radius: 8px;
        }
        
        .swagger-ui-wrapper .swagger-ui .responses-inner {
          padding: 16px;
        }
        
        .swagger-ui-wrapper .swagger-ui .scheme-container {
          background: transparent;
          box-shadow: none;
          padding: 20px 0;
        }
        
        .swagger-ui-wrapper .swagger-ui .auth-wrapper {
          display: flex;
          justify-content: flex-end;
        }
        
        .swagger-ui-wrapper .swagger-ui .auth-wrapper .authorize {
          border-radius: 6px;
          border: 1px solid var(--swagger-ui-border);
          background: transparent;
          color: var(--swagger-ui-text);
        }
        
        .swagger-ui-wrapper .swagger-ui .auth-wrapper .authorize.unlocked {
          border-color: hsl(142 71% 45%);
          color: hsl(142 71% 45%);
        }
        
        /* Dark mode adjustments */
        .dark .swagger-ui-wrapper .swagger-ui .info .title,
        .dark .swagger-ui-wrapper .swagger-ui .info .description,
        .dark .swagger-ui-wrapper .swagger-ui .opblock-tag,
        .dark .swagger-ui-wrapper .swagger-ui .opblock .opblock-summary-path,
        .dark .swagger-ui-wrapper .swagger-ui .parameter__name {
          color: hsl(var(--foreground));
        }
        
        .dark .swagger-ui-wrapper .swagger-ui .opblock-body,
        .dark .swagger-ui-wrapper .swagger-ui table tbody tr td {
          background: hsl(var(--background));
        }
        
        .dark .swagger-ui-wrapper .swagger-ui .model-box {
          background: hsl(var(--muted));
        }
      `}</style>
      <SwaggerUI
        spec={openApiSpec}
        requestInterceptor={requestInterceptor}
        docExpansion="list"
        defaultModelsExpandDepth={1}
        defaultModelExpandDepth={1}
        displayRequestDuration
        filter
        showExtensions
        showCommonExtensions
        tryItOutEnabled
      />
    </div>
  );
}
