INSERT INTO public.finetuning_templates (
  name, slug, description, language, language_code, domain, icon,
  recommended_model, recommended_method, sample_system_prompt, 
  sample_conversations, use_cases, difficulty, estimated_time
) VALUES

(
  'Python Code Assistant',
  'code-python',
  'Fine-tune a model to write, explain, and debug Python code following PEP 8 standards.',
  'English',
  'en',
  'code',
  '🐍',
  'qwen2.5-coder-7b',
  'lora',
  'You are an expert Python developer. Write clean, efficient, well-documented Python code following PEP 8 standards. Always include type hints and docstrings.',
  '[
    {"messages": [
      {"role": "system", "content": "You are an expert Python developer."},
      {"role": "user", "content": "Write a function to validate email addresses"},
      {"role": "assistant", "content": "```python\nimport re\nfrom typing import bool\n\ndef validate_email(email: str) -> bool:\n    \"\"\"\n    Validate an email address using regex.\n    \n    Args:\n        email: The email address to validate.\n        \n    Returns:\n        True if valid, False otherwise.\n    \"\"\"\n    pattern = r\"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$\"\n    return bool(re.match(pattern, email))\n```"}
    ]},
    {"messages": [
      {"role": "system", "content": "You are an expert Python developer."},
      {"role": "user", "content": "Explain what this code does: sorted(data, key=lambda x: x[1], reverse=True)"},
      {"role": "assistant", "content": "This code sorts a list called `data` in descending order based on the second element of each item.\n\nBreaking it down:\n- `sorted()`: Returns a new sorted list\n- `key=lambda x: x[1]`: Sort by index 1 (second element) of each item\n- `reverse=True`: Sort in descending order (highest first)\n\nExample:\n```python\ndata = [(\"a\", 3), (\"b\", 1), (\"c\", 2)]\nresult = sorted(data, key=lambda x: x[1], reverse=True)\n# Result: [(\"a\", 3), (\"c\", 2), (\"b\", 1)]\n```"}
    ]}
  ]'::jsonb,
  ARRAY['Code generation', 'Code explanation', 'Debugging', 'Documentation'],
  'intermediate',
  '45 minutes'
),

(
  'TypeScript/React Developer',
  'code-typescript-react',
  'Fine-tune for TypeScript and React development with modern best practices.',
  'English',
  'en',
  'code',
  '⚛️',
  'qwen2.5-coder-7b',
  'lora',
  'You are a senior TypeScript/React developer. Write type-safe, functional React components using hooks. Follow React best practices and accessibility guidelines.',
  '[
    {"messages": [
      {"role": "system", "content": "You are a senior TypeScript/React developer."},
      {"role": "user", "content": "Create a reusable Button component with variants"},
      {"role": "assistant", "content": "```tsx\nimport React from \"react\";\nimport { cn } from \"@/lib/utils\";\n\ninterface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {\n  variant?: \"primary\" | \"secondary\" | \"outline\" | \"ghost\";\n  size?: \"sm\" | \"md\" | \"lg\";\n  isLoading?: boolean;\n  children: React.ReactNode;\n}\n\nexport const Button: React.FC<ButtonProps> = ({\n  variant = \"primary\",\n  size = \"md\",\n  isLoading = false,\n  className,\n  children,\n  disabled,\n  ...props\n}) => {\n  const baseStyles = \"inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2\";\n  \n  const variants = {\n    primary: \"bg-blue-600 text-white hover:bg-blue-700\",\n    secondary: \"bg-gray-200 text-gray-900 hover:bg-gray-300\",\n    outline: \"border border-gray-300 bg-transparent hover:bg-gray-100\",\n    ghost: \"bg-transparent hover:bg-gray-100\",\n  };\n  \n  const sizes = {\n    sm: \"h-8 px-3 text-sm\",\n    md: \"h-10 px-4 text-base\",\n    lg: \"h-12 px-6 text-lg\",\n  };\n\n  return (\n    <button\n      className={cn(baseStyles, variants[variant], sizes[size], className)}\n      disabled={disabled || isLoading}\n      {...props}\n    >\n      {isLoading ? <Spinner className=\"mr-2\" /> : null}\n      {children}\n    </button>\n  );\n};\n```"}
    ]}
  ]'::jsonb,
  ARRAY['React components', 'TypeScript development', 'Frontend architecture'],
  'intermediate',
  '45 minutes'
),

(
  'SQL Query Expert',
  'code-sql',
  'Fine-tune for SQL query writing, optimization, and database design.',
  'English',
  'en',
  'code',
  '🗄️',
  'starcoder2-7b',
  'lora',
  'You are a database expert. Write efficient SQL queries, explain execution plans, and suggest optimizations. Support PostgreSQL, MySQL, and SQLite syntax.',
  '[
    {"messages": [
      {"role": "system", "content": "You are a database expert specializing in SQL."},
      {"role": "user", "content": "Write a query to find the top 5 customers by total order value"},
      {"role": "assistant", "content": "```sql\nSELECT \n    c.customer_id,\n    c.customer_name,\n    c.email,\n    SUM(o.total_amount) as total_spent,\n    COUNT(o.order_id) as order_count\nFROM customers c\nINNER JOIN orders o ON c.customer_id = o.customer_id\nWHERE o.status = ''completed''\n  AND o.created_at >= NOW() - INTERVAL ''1 year''\nGROUP BY c.customer_id, c.customer_name, c.email\nORDER BY total_spent DESC\nLIMIT 5;\n```\n\nThis query:\n1. Joins customers with their orders\n2. Filters for completed orders in the last year\n3. Groups by customer and calculates total spent\n4. Orders by highest spenders and returns top 5\n\nFor better performance, ensure indexes exist on:\n- `orders(customer_id)`\n- `orders(status, created_at)`"}
    ]}
  ]'::jsonb,
  ARRAY['Query writing', 'Query optimization', 'Database design', 'Data analysis'],
  'intermediate',
  '30 minutes'
),

(
  'API Documentation Writer',
  'code-api-docs',
  'Fine-tune to generate API documentation, OpenAPI specs, and developer guides.',
  'English',
  'en',
  'code',
  '📚',
  'qwen2.5-coder-7b',
  'lora',
  'You are a technical writer specializing in API documentation. Write clear, comprehensive API docs with examples. Generate OpenAPI/Swagger specifications when requested.',
  '[
    {"messages": [
      {"role": "system", "content": "You are a technical writer for API documentation."},
      {"role": "user", "content": "Document this endpoint: POST /api/users - creates a new user with email and password"},
      {"role": "assistant", "content": "## Create User\n\nCreates a new user account.\n\n### Endpoint\n\n```\nPOST /api/users\n```\n\n### Request Headers\n\n| Header | Type | Required | Description |\n|--------|------|----------|-------------|\n| Content-Type | string | Yes | Must be `application/json` |\n| Authorization | string | No | Bearer token (admin only) |\n\n### Request Body\n\n```json\n{\n  \"email\": \"user@example.com\",\n  \"password\": \"securePassword123\",\n  \"name\": \"John Doe\"\n}\n```\n\n| Field | Type | Required | Description |\n|-------|------|----------|-------------|\n| email | string | Yes | Valid email address |\n| password | string | Yes | Min 8 chars, 1 uppercase, 1 number |\n| name | string | No | User display name |\n\n### Response\n\n#### Success (201 Created)\n\n```json\n{\n  \"id\": \"usr_abc123\",\n  \"email\": \"user@example.com\",\n  \"name\": \"John Doe\",\n  \"created_at\": \"2024-01-15T10:30:00Z\"\n}\n```\n\n#### Error (400 Bad Request)\n\n```json\n{\n  \"error\": \"validation_error\",\n  \"message\": \"Email already exists\"\n}\n```"}
    ]}
  ]'::jsonb,
  ARRAY['API documentation', 'OpenAPI specs', 'Developer guides', 'Code examples'],
  'beginner',
  '30 minutes'
)

ON CONFLICT (slug) DO NOTHING;