# SwissBrain API Contract Specification

**Document Version:** 1.0  
**Author:** Manus AI  
**Date:** January 12, 2026  
**Classification:** API Reference Documentation  
**OpenAPI Version:** 3.1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication](#2-authentication)
3. [Execute Endpoint](#3-execute-endpoint)
4. [Response Schemas by Operation Type](#4-response-schemas-by-operation-type)
5. [Streaming Specifications](#5-streaming-specifications)
6. [Payload Limits](#6-payload-limits)
7. [Timeout Configuration](#7-timeout-configuration)
8. [Multi-File Output Handling](#8-multi-file-output-handling)
9. [Error Responses](#9-error-responses)
10. [OpenAPI Specification](#10-openapi-specification)

---

## 1. Overview

### 1.1 Base URL

```
Production:  https://api.swissbrain.ch/v1
Staging:     https://api-staging.swissbrain.ch/v1
Development: https://api-dev.swissbrain.ch/v1
```

### 1.2 Content Types

| Request Type | Content-Type |
|--------------|--------------|
| Standard JSON | `application/json` |
| File Upload | `multipart/form-data` |
| Streaming Response | `text/event-stream` |
| Binary Download | `application/octet-stream` |

### 1.3 API Versioning

The API uses URL path versioning. The current version is `v1`. Breaking changes will increment the version number. Non-breaking additions (new optional fields, new endpoints) do not change the version.

---

## 2. Authentication

### 2.1 Authentication Methods

| Method | Header | Use Case |
|--------|--------|----------|
| **API Key** | `Authorization: Bearer <api_key>` | Server-to-server |
| **JWT Token** | `Authorization: Bearer <jwt>` | User sessions |
| **OAuth 2.0** | `Authorization: Bearer <access_token>` | Third-party apps |

### 2.2 API Key Format

```
sb_live_<32_char_random>  # Production
sb_test_<32_char_random>  # Staging/Development
```

### 2.3 Request Signing (Optional, for high-security)

```http
X-Signature-Timestamp: 1704067200
X-Signature: sha256=<hmac_signature>
```

Signature computation:
```
signature = HMAC-SHA256(
  key: api_secret,
  message: timestamp + "." + request_body
)
```

---

## 3. Execute Endpoint

### 3.1 Endpoint Definition

```
POST /v1/execute
```

### 3.2 Complete Request Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://api.swissbrain.ch/schemas/execute-request.json",
  "title": "ExecuteRequest",
  "description": "Complete request schema for the /execute endpoint",
  "type": "object",
  "required": ["operation", "params"],
  "properties": {
    
    "operation": {
      "type": "string",
      "description": "The type of operation to execute",
      "enum": [
        "code_exec",
        "document_generate",
        "browser_automate",
        "llm_invoke",
        "file_operation",
        "search",
        "workflow_execute"
      ]
    },
    
    "params": {
      "type": "object",
      "description": "Operation-specific parameters (see operation schemas below)",
      "oneOf": [
        { "$ref": "#/$defs/CodeExecParams" },
        { "$ref": "#/$defs/DocumentGenerateParams" },
        { "$ref": "#/$defs/BrowserAutomateParams" },
        { "$ref": "#/$defs/LLMInvokeParams" },
        { "$ref": "#/$defs/FileOperationParams" },
        { "$ref": "#/$defs/SearchParams" },
        { "$ref": "#/$defs/WorkflowExecuteParams" }
      ]
    },
    
    "execution_config": {
      "type": "object",
      "description": "Execution configuration options",
      "properties": {
        "timeout_ms": {
          "type": "integer",
          "description": "Maximum execution time in milliseconds",
          "minimum": 1000,
          "maximum": 3600000,
          "default": 300000
        },
        "idempotency_key": {
          "type": "string",
          "description": "Client-provided idempotency key for exactly-once execution",
          "maxLength": 255,
          "pattern": "^[a-zA-Z0-9_-]+$"
        },
        "priority": {
          "type": "string",
          "description": "Execution priority level",
          "enum": ["low", "normal", "high", "critical"],
          "default": "normal"
        },
        "retry_policy": {
          "type": "object",
          "description": "Custom retry policy (overrides defaults)",
          "properties": {
            "max_attempts": {
              "type": "integer",
              "minimum": 1,
              "maximum": 10,
              "default": 3
            },
            "backoff_type": {
              "type": "string",
              "enum": ["fixed", "exponential", "exponential_jitter"],
              "default": "exponential_jitter"
            },
            "base_delay_ms": {
              "type": "integer",
              "minimum": 100,
              "maximum": 60000,
              "default": 1000
            },
            "max_delay_ms": {
              "type": "integer",
              "minimum": 1000,
              "maximum": 300000,
              "default": 30000
            }
          }
        },
        "sandbox_config": {
          "type": "object",
          "description": "Sandbox environment configuration",
          "properties": {
            "memory_mb": {
              "type": "integer",
              "description": "Memory allocation in MB",
              "minimum": 256,
              "maximum": 16384,
              "default": 2048
            },
            "cpu_cores": {
              "type": "number",
              "description": "CPU core allocation",
              "minimum": 0.5,
              "maximum": 8,
              "default": 1
            },
            "disk_gb": {
              "type": "integer",
              "description": "Disk allocation in GB",
              "minimum": 1,
              "maximum": 100,
              "default": 10
            },
            "network_enabled": {
              "type": "boolean",
              "description": "Enable network access",
              "default": true
            },
            "gpu_enabled": {
              "type": "boolean",
              "description": "Enable GPU access (if available)",
              "default": false
            }
          }
        }
      }
    },
    
    "streaming": {
      "type": "object",
      "description": "Streaming configuration",
      "properties": {
        "enabled": {
          "type": "boolean",
          "description": "Enable streaming response",
          "default": false
        },
        "mode": {
          "type": "string",
          "description": "Streaming transport mode",
          "enum": ["sse", "websocket", "polling"],
          "default": "sse"
        },
        "include_logs": {
          "type": "boolean",
          "description": "Include execution logs in stream",
          "default": true
        },
        "log_level": {
          "type": "string",
          "description": "Minimum log level to stream",
          "enum": ["debug", "info", "warn", "error"],
          "default": "info"
        },
        "heartbeat_interval_ms": {
          "type": "integer",
          "description": "Heartbeat interval for keep-alive",
          "minimum": 1000,
          "maximum": 30000,
          "default": 15000
        }
      }
    },
    
    "callback": {
      "type": "object",
      "description": "Webhook callback configuration",
      "properties": {
        "url": {
          "type": "string",
          "format": "uri",
          "description": "Webhook URL to call on completion"
        },
        "headers": {
          "type": "object",
          "description": "Custom headers to include in callback",
          "additionalProperties": { "type": "string" }
        },
        "events": {
          "type": "array",
          "description": "Events to trigger callback",
          "items": {
            "type": "string",
            "enum": ["started", "progress", "completed", "failed", "cancelled"]
          },
          "default": ["completed", "failed"]
        },
        "retry_config": {
          "type": "object",
          "properties": {
            "max_attempts": { "type": "integer", "default": 3 },
            "timeout_ms": { "type": "integer", "default": 30000 }
          }
        }
      },
      "required": ["url"]
    },
    
    "metadata": {
      "type": "object",
      "description": "Custom metadata (passed through to response)",
      "additionalProperties": true,
      "maxProperties": 50
    },
    
    "tenant_id": {
      "type": "string",
      "description": "Tenant identifier (for multi-tenant deployments)",
      "pattern": "^[a-zA-Z0-9_-]+$",
      "maxLength": 64
    },
    
    "trace_id": {
      "type": "string",
      "description": "Distributed tracing ID (auto-generated if not provided)",
      "pattern": "^[a-f0-9]{32}$"
    }
  },
  
  "$defs": {
    
    "CodeExecParams": {
      "type": "object",
      "description": "Parameters for code execution",
      "required": ["language", "code"],
      "properties": {
        "language": {
          "type": "string",
          "description": "Programming language",
          "enum": ["python", "javascript", "typescript", "bash", "ruby", "go", "rust", "java"]
        },
        "code": {
          "type": "string",
          "description": "Source code to execute",
          "maxLength": 1048576
        },
        "entrypoint": {
          "type": "string",
          "description": "Entry point function/file (if applicable)",
          "maxLength": 255
        },
        "args": {
          "type": "array",
          "description": "Command line arguments",
          "items": { "type": "string" },
          "maxItems": 100
        },
        "env": {
          "type": "object",
          "description": "Environment variables",
          "additionalProperties": { "type": "string" },
          "maxProperties": 100
        },
        "stdin": {
          "type": "string",
          "description": "Standard input data",
          "maxLength": 10485760
        },
        "files": {
          "type": "array",
          "description": "Files to include in execution environment",
          "items": {
            "type": "object",
            "required": ["path", "content"],
            "properties": {
              "path": {
                "type": "string",
                "description": "File path relative to working directory",
                "maxLength": 255
              },
              "content": {
                "type": "string",
                "description": "File content (base64 encoded for binary)",
                "maxLength": 10485760
              },
              "encoding": {
                "type": "string",
                "enum": ["utf8", "base64"],
                "default": "utf8"
              },
              "permissions": {
                "type": "string",
                "pattern": "^[0-7]{3,4}$",
                "default": "644"
              }
            }
          },
          "maxItems": 100
        },
        "dependencies": {
          "type": "object",
          "description": "Package dependencies to install",
          "properties": {
            "packages": {
              "type": "array",
              "items": {
                "type": "object",
                "required": ["name"],
                "properties": {
                  "name": { "type": "string" },
                  "version": { "type": "string" },
                  "source": { 
                    "type": "string",
                    "enum": ["pip", "npm", "cargo", "gem", "go"]
                  }
                }
              }
            },
            "requirements_file": {
              "type": "string",
              "description": "Path to requirements file (e.g., requirements.txt)"
            }
          }
        },
        "working_directory": {
          "type": "string",
          "description": "Working directory for execution",
          "default": "/home/sandbox"
        },
        "capture_output": {
          "type": "object",
          "properties": {
            "stdout": { "type": "boolean", "default": true },
            "stderr": { "type": "boolean", "default": true },
            "files": {
              "type": "array",
              "description": "File patterns to capture as output",
              "items": { "type": "string" },
              "maxItems": 50
            },
            "max_output_size": {
              "type": "integer",
              "description": "Max output size in bytes",
              "default": 10485760
            }
          }
        }
      }
    },
    
    "DocumentGenerateParams": {
      "type": "object",
      "description": "Parameters for document generation",
      "required": ["document_type"],
      "properties": {
        "document_type": {
          "type": "string",
          "description": "Type of document to generate",
          "enum": ["pdf", "docx", "xlsx", "pptx", "html", "markdown", "image", "infographic"]
        },
        "template": {
          "type": "object",
          "description": "Template configuration",
          "properties": {
            "id": {
              "type": "string",
              "description": "Pre-defined template ID"
            },
            "url": {
              "type": "string",
              "format": "uri",
              "description": "URL to template file"
            },
            "content": {
              "type": "string",
              "description": "Inline template content (base64 for binary)"
            }
          }
        },
        "content": {
          "type": "object",
          "description": "Document content specification",
          "properties": {
            "title": { "type": "string", "maxLength": 500 },
            "subtitle": { "type": "string", "maxLength": 500 },
            "author": { "type": "string", "maxLength": 255 },
            "date": { "type": "string", "format": "date" },
            "sections": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "heading": { "type": "string" },
                  "level": { "type": "integer", "minimum": 1, "maximum": 6 },
                  "body": { "type": "string" },
                  "data": { "type": "object" }
                }
              }
            },
            "data": {
              "type": "object",
              "description": "Data for template interpolation",
              "additionalProperties": true
            },
            "raw_content": {
              "type": "string",
              "description": "Raw content (markdown, HTML, etc.)",
              "maxLength": 10485760
            }
          }
        },
        "styling": {
          "type": "object",
          "description": "Document styling options",
          "properties": {
            "theme": {
              "type": "string",
              "enum": ["default", "modern", "classic", "minimal", "corporate"]
            },
            "colors": {
              "type": "object",
              "properties": {
                "primary": { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$" },
                "secondary": { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$" },
                "accent": { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$" }
              }
            },
            "fonts": {
              "type": "object",
              "properties": {
                "heading": { "type": "string" },
                "body": { "type": "string" },
                "code": { "type": "string" }
              }
            },
            "page_size": {
              "type": "string",
              "enum": ["A4", "Letter", "Legal", "A3", "Tabloid"],
              "default": "A4"
            },
            "orientation": {
              "type": "string",
              "enum": ["portrait", "landscape"],
              "default": "portrait"
            },
            "margins": {
              "type": "object",
              "properties": {
                "top": { "type": "number" },
                "right": { "type": "number" },
                "bottom": { "type": "number" },
                "left": { "type": "number" }
              }
            }
          }
        },
        "assets": {
          "type": "array",
          "description": "Assets to include (images, charts, etc.)",
          "items": {
            "type": "object",
            "required": ["id"],
            "properties": {
              "id": { "type": "string" },
              "type": { 
                "type": "string",
                "enum": ["image", "chart", "table", "diagram"]
              },
              "url": { "type": "string", "format": "uri" },
              "content": { "type": "string" },
              "data": { "type": "object" }
            }
          },
          "maxItems": 100
        },
        "output": {
          "type": "object",
          "properties": {
            "filename": {
              "type": "string",
              "description": "Output filename",
              "maxLength": 255
            },
            "quality": {
              "type": "string",
              "enum": ["draft", "standard", "high", "print"],
              "default": "standard"
            },
            "compression": {
              "type": "boolean",
              "default": true
            },
            "password": {
              "type": "string",
              "description": "Password protect document",
              "maxLength": 128
            }
          }
        }
      }
    },
    
    "BrowserAutomateParams": {
      "type": "object",
      "description": "Parameters for browser automation",
      "required": ["actions"],
      "properties": {
        "initial_url": {
          "type": "string",
          "format": "uri",
          "description": "Starting URL"
        },
        "viewport": {
          "type": "object",
          "properties": {
            "width": { "type": "integer", "minimum": 320, "maximum": 3840, "default": 1920 },
            "height": { "type": "integer", "minimum": 240, "maximum": 2160, "default": 1080 },
            "device_scale_factor": { "type": "number", "minimum": 1, "maximum": 3, "default": 1 },
            "is_mobile": { "type": "boolean", "default": false },
            "has_touch": { "type": "boolean", "default": false }
          }
        },
        "user_agent": {
          "type": "string",
          "description": "Custom user agent string"
        },
        "headers": {
          "type": "object",
          "description": "Custom HTTP headers",
          "additionalProperties": { "type": "string" }
        },
        "cookies": {
          "type": "array",
          "description": "Cookies to set before navigation",
          "items": {
            "type": "object",
            "required": ["name", "value", "domain"],
            "properties": {
              "name": { "type": "string" },
              "value": { "type": "string" },
              "domain": { "type": "string" },
              "path": { "type": "string", "default": "/" },
              "secure": { "type": "boolean", "default": false },
              "httpOnly": { "type": "boolean", "default": false },
              "sameSite": { "type": "string", "enum": ["Strict", "Lax", "None"] },
              "expires": { "type": "integer" }
            }
          }
        },
        "actions": {
          "type": "array",
          "description": "Sequence of browser actions",
          "items": {
            "type": "object",
            "required": ["type"],
            "properties": {
              "type": {
                "type": "string",
                "enum": [
                  "navigate", "click", "type", "select", "hover",
                  "scroll", "wait", "screenshot", "pdf", "evaluate",
                  "wait_for_selector", "wait_for_navigation", "press_key",
                  "upload_file", "download", "extract_text", "extract_data"
                ]
              },
              "selector": {
                "type": "string",
                "description": "CSS selector or XPath"
              },
              "value": {
                "description": "Action-specific value",
                "oneOf": [
                  { "type": "string" },
                  { "type": "number" },
                  { "type": "object" },
                  { "type": "array" }
                ]
              },
              "options": {
                "type": "object",
                "description": "Action-specific options",
                "additionalProperties": true
              },
              "timeout_ms": {
                "type": "integer",
                "description": "Action-specific timeout",
                "minimum": 1000,
                "maximum": 120000,
                "default": 30000
              },
              "on_error": {
                "type": "string",
                "description": "Error handling strategy",
                "enum": ["fail", "skip", "retry"],
                "default": "fail"
              },
              "retry_count": {
                "type": "integer",
                "minimum": 0,
                "maximum": 5,
                "default": 0
              }
            }
          },
          "minItems": 1,
          "maxItems": 500
        },
        "capture": {
          "type": "object",
          "description": "What to capture during automation",
          "properties": {
            "screenshots": {
              "type": "object",
              "properties": {
                "on_action": { "type": "boolean", "default": false },
                "on_error": { "type": "boolean", "default": true },
                "final": { "type": "boolean", "default": true },
                "format": { "type": "string", "enum": ["png", "jpeg", "webp"], "default": "png" },
                "quality": { "type": "integer", "minimum": 1, "maximum": 100, "default": 80 },
                "full_page": { "type": "boolean", "default": false }
              }
            },
            "network": {
              "type": "object",
              "properties": {
                "requests": { "type": "boolean", "default": false },
                "responses": { "type": "boolean", "default": false },
                "filter": {
                  "type": "object",
                  "properties": {
                    "url_pattern": { "type": "string" },
                    "resource_types": {
                      "type": "array",
                      "items": {
                        "type": "string",
                        "enum": ["document", "stylesheet", "image", "media", "font", "script", "xhr", "fetch", "websocket"]
                      }
                    }
                  }
                }
              }
            },
            "console": { "type": "boolean", "default": true },
            "cookies": { "type": "boolean", "default": false },
            "local_storage": { "type": "boolean", "default": false },
            "html": { "type": "boolean", "default": false }
          }
        },
        "proxy": {
          "type": "object",
          "description": "Proxy configuration",
          "properties": {
            "server": { "type": "string" },
            "username": { "type": "string" },
            "password": { "type": "string" },
            "bypass": { "type": "array", "items": { "type": "string" } }
          }
        },
        "authentication": {
          "type": "object",
          "description": "HTTP authentication",
          "properties": {
            "username": { "type": "string" },
            "password": { "type": "string" }
          }
        },
        "geolocation": {
          "type": "object",
          "properties": {
            "latitude": { "type": "number", "minimum": -90, "maximum": 90 },
            "longitude": { "type": "number", "minimum": -180, "maximum": 180 },
            "accuracy": { "type": "number", "minimum": 0 }
          }
        },
        "timezone": {
          "type": "string",
          "description": "Timezone ID (e.g., 'Europe/Zurich')"
        },
        "locale": {
          "type": "string",
          "description": "Browser locale (e.g., 'de-CH')"
        }
      }
    },
    
    "LLMInvokeParams": {
      "type": "object",
      "description": "Parameters for LLM invocation",
      "required": ["messages"],
      "properties": {
        "model": {
          "type": "string",
          "description": "Model identifier",
          "default": "default"
        },
        "messages": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["role", "content"],
            "properties": {
              "role": {
                "type": "string",
                "enum": ["system", "user", "assistant", "tool"]
              },
              "content": {
                "oneOf": [
                  { "type": "string" },
                  {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "required": ["type"],
                      "properties": {
                        "type": {
                          "type": "string",
                          "enum": ["text", "image_url", "file_url"]
                        },
                        "text": { "type": "string" },
                        "image_url": {
                          "type": "object",
                          "properties": {
                            "url": { "type": "string" },
                            "detail": { "type": "string", "enum": ["auto", "low", "high"] }
                          }
                        },
                        "file_url": {
                          "type": "object",
                          "properties": {
                            "url": { "type": "string" },
                            "mime_type": { "type": "string" }
                          }
                        }
                      }
                    }
                  }
                ]
              },
              "name": { "type": "string" },
              "tool_call_id": { "type": "string" },
              "tool_calls": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "id": { "type": "string" },
                    "type": { "type": "string", "const": "function" },
                    "function": {
                      "type": "object",
                      "properties": {
                        "name": { "type": "string" },
                        "arguments": { "type": "string" }
                      }
                    }
                  }
                }
              }
            }
          },
          "minItems": 1
        },
        "temperature": {
          "type": "number",
          "minimum": 0,
          "maximum": 2,
          "default": 0.7
        },
        "max_tokens": {
          "type": "integer",
          "minimum": 1,
          "maximum": 128000
        },
        "top_p": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "frequency_penalty": {
          "type": "number",
          "minimum": -2,
          "maximum": 2
        },
        "presence_penalty": {
          "type": "number",
          "minimum": -2,
          "maximum": 2
        },
        "stop": {
          "oneOf": [
            { "type": "string" },
            { "type": "array", "items": { "type": "string" }, "maxItems": 4 }
          ]
        },
        "tools": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["type", "function"],
            "properties": {
              "type": { "type": "string", "const": "function" },
              "function": {
                "type": "object",
                "required": ["name"],
                "properties": {
                  "name": { "type": "string" },
                  "description": { "type": "string" },
                  "parameters": { "type": "object" }
                }
              }
            }
          }
        },
        "tool_choice": {
          "oneOf": [
            { "type": "string", "enum": ["none", "auto", "required"] },
            {
              "type": "object",
              "properties": {
                "type": { "type": "string", "const": "function" },
                "function": {
                  "type": "object",
                  "properties": {
                    "name": { "type": "string" }
                  }
                }
              }
            }
          ]
        },
        "response_format": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["text", "json_object", "json_schema"]
            },
            "json_schema": {
              "type": "object",
              "properties": {
                "name": { "type": "string" },
                "strict": { "type": "boolean" },
                "schema": { "type": "object" }
              }
            }
          }
        },
        "seed": {
          "type": "integer",
          "description": "Random seed for reproducibility"
        },
        "stream": {
          "type": "boolean",
          "default": false
        }
      }
    },
    
    "FileOperationParams": {
      "type": "object",
      "description": "Parameters for file operations",
      "required": ["action", "path"],
      "properties": {
        "action": {
          "type": "string",
          "enum": ["read", "write", "append", "delete", "copy", "move", "list", "stat", "mkdir"]
        },
        "path": {
          "type": "string",
          "description": "File or directory path",
          "maxLength": 1024
        },
        "destination": {
          "type": "string",
          "description": "Destination path (for copy/move)",
          "maxLength": 1024
        },
        "content": {
          "type": "string",
          "description": "Content to write (base64 for binary)"
        },
        "encoding": {
          "type": "string",
          "enum": ["utf8", "base64", "binary"],
          "default": "utf8"
        },
        "options": {
          "type": "object",
          "properties": {
            "recursive": { "type": "boolean", "default": false },
            "overwrite": { "type": "boolean", "default": false },
            "create_parents": { "type": "boolean", "default": true },
            "permissions": { "type": "string", "pattern": "^[0-7]{3,4}$" }
          }
        }
      }
    },
    
    "SearchParams": {
      "type": "object",
      "description": "Parameters for search operations",
      "required": ["type", "queries"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["info", "image", "api", "news", "tool", "data", "research"]
        },
        "queries": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1,
          "maxItems": 3
        },
        "time": {
          "type": "string",
          "enum": ["all", "past_day", "past_week", "past_month", "past_year"]
        },
        "max_results": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100,
          "default": 10
        },
        "language": {
          "type": "string",
          "description": "ISO 639-1 language code"
        },
        "region": {
          "type": "string",
          "description": "ISO 3166-1 country code"
        }
      }
    },
    
    "WorkflowExecuteParams": {
      "type": "object",
      "description": "Parameters for workflow execution",
      "required": ["workflow_id"],
      "properties": {
        "workflow_id": {
          "type": "string",
          "description": "Workflow definition ID"
        },
        "workflow_version": {
          "type": "string",
          "description": "Specific version (latest if not specified)"
        },
        "input": {
          "type": "object",
          "description": "Workflow input data",
          "additionalProperties": true
        },
        "start_from_step": {
          "type": "string",
          "description": "Step ID to start from (for resumption)"
        },
        "skip_steps": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Step IDs to skip"
        }
      }
    }
  }
}
```

---

## 4. Response Schemas by Operation Type

### 4.1 Base Response Structure

All responses follow this base structure:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://api.swissbrain.ch/schemas/base-response.json",
  "title": "BaseResponse",
  "type": "object",
  "required": ["request_id", "status", "timestamp"],
  "properties": {
    "request_id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique request identifier"
    },
    "status": {
      "type": "string",
      "enum": ["success", "partial", "failed", "cancelled", "timeout"],
      "description": "Overall execution status"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "Response timestamp (ISO 8601)"
    },
    "duration_ms": {
      "type": "integer",
      "description": "Total execution duration in milliseconds"
    },
    "idempotency_key": {
      "type": "string",
      "description": "Echo of provided idempotency key"
    },
    "trace_id": {
      "type": "string",
      "description": "Distributed tracing ID"
    },
    "metadata": {
      "type": "object",
      "description": "Echo of provided metadata"
    },
    "usage": {
      "type": "object",
      "description": "Resource usage metrics",
      "properties": {
        "credits_consumed": { "type": "number" },
        "compute_seconds": { "type": "number" },
        "memory_mb_seconds": { "type": "number" },
        "network_bytes": { "type": "integer" },
        "storage_bytes": { "type": "integer" }
      }
    },
    "result": {
      "type": "object",
      "description": "Operation-specific result (see below)"
    },
    "error": {
      "$ref": "#/$defs/ErrorObject"
    },
    "warnings": {
      "type": "array",
      "items": { "$ref": "#/$defs/WarningObject" }
    }
  },
  "$defs": {
    "ErrorObject": {
      "type": "object",
      "required": ["code", "message"],
      "properties": {
        "code": { "type": "string" },
        "message": { "type": "string" },
        "details": { "type": "object" },
        "retryable": { "type": "boolean" },
        "retry_after_ms": { "type": "integer" }
      }
    },
    "WarningObject": {
      "type": "object",
      "required": ["code", "message"],
      "properties": {
        "code": { "type": "string" },
        "message": { "type": "string" }
      }
    }
  }
}
```

### 4.2 Code Execution Response

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://api.swissbrain.ch/schemas/code-exec-response.json",
  "title": "CodeExecResponse",
  "type": "object",
  "properties": {
    "result": {
      "type": "object",
      "required": ["exit_code"],
      "properties": {
        "exit_code": {
          "type": "integer",
          "description": "Process exit code (0 = success)"
        },
        "stdout": {
          "type": "string",
          "description": "Standard output (may be truncated)"
        },
        "stderr": {
          "type": "string",
          "description": "Standard error (may be truncated)"
        },
        "stdout_truncated": {
          "type": "boolean",
          "description": "Whether stdout was truncated"
        },
        "stderr_truncated": {
          "type": "boolean",
          "description": "Whether stderr was truncated"
        },
        "execution_time_ms": {
          "type": "integer",
          "description": "Actual code execution time"
        },
        "memory_peak_mb": {
          "type": "number",
          "description": "Peak memory usage in MB"
        },
        "output_files": {
          "type": "array",
          "description": "Generated output files",
          "items": {
            "type": "object",
            "required": ["path", "size_bytes"],
            "properties": {
              "path": {
                "type": "string",
                "description": "File path in sandbox"
              },
              "size_bytes": {
                "type": "integer",
                "description": "File size in bytes"
              },
              "mime_type": {
                "type": "string",
                "description": "Detected MIME type"
              },
              "download_url": {
                "type": "string",
                "format": "uri",
                "description": "Temporary download URL (expires in 1 hour)"
              },
              "content": {
                "type": "string",
                "description": "Inline content (for small text files)"
              },
              "sha256": {
                "type": "string",
                "description": "SHA-256 hash of file content"
              }
            }
          }
        },
        "return_value": {
          "description": "Parsed return value (if applicable)",
          "oneOf": [
            { "type": "string" },
            { "type": "number" },
            { "type": "boolean" },
            { "type": "object" },
            { "type": "array" },
            { "type": "null" }
          ]
        },
        "logs": {
          "type": "array",
          "description": "Structured execution logs",
          "items": {
            "type": "object",
            "properties": {
              "timestamp": { "type": "string", "format": "date-time" },
              "level": { "type": "string", "enum": ["debug", "info", "warn", "error"] },
              "message": { "type": "string" },
              "source": { "type": "string" }
            }
          }
        },
        "sandbox_state": {
          "type": "object",
          "description": "Final sandbox state",
          "properties": {
            "working_directory": { "type": "string" },
            "environment_variables": { "type": "object" },
            "installed_packages": {
              "type": "array",
              "items": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

**Example Response:**

```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "success",
  "timestamp": "2026-01-12T14:30:00.000Z",
  "duration_ms": 2345,
  "trace_id": "abc123def456789012345678901234ab",
  "usage": {
    "credits_consumed": 0.5,
    "compute_seconds": 2.3,
    "memory_mb_seconds": 4600,
    "network_bytes": 0,
    "storage_bytes": 1024
  },
  "result": {
    "exit_code": 0,
    "stdout": "Hello, World!\nProcessing complete.\n",
    "stderr": "",
    "stdout_truncated": false,
    "stderr_truncated": false,
    "execution_time_ms": 1234,
    "memory_peak_mb": 128.5,
    "output_files": [
      {
        "path": "/home/sandbox/output/result.json",
        "size_bytes": 1024,
        "mime_type": "application/json",
        "download_url": "https://storage.swissbrain.ch/temp/abc123/result.json?token=xyz",
        "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      }
    ],
    "return_value": {
      "success": true,
      "items_processed": 42
    },
    "logs": [
      {
        "timestamp": "2026-01-12T14:29:58.000Z",
        "level": "info",
        "message": "Starting execution",
        "source": "runtime"
      },
      {
        "timestamp": "2026-01-12T14:30:00.000Z",
        "level": "info",
        "message": "Execution complete",
        "source": "runtime"
      }
    ]
  }
}
```

### 4.3 Document Generation Response

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://api.swissbrain.ch/schemas/document-generate-response.json",
  "title": "DocumentGenerateResponse",
  "type": "object",
  "properties": {
    "result": {
      "type": "object",
      "required": ["document"],
      "properties": {
        "document": {
          "type": "object",
          "required": ["id", "type", "size_bytes", "download_url"],
          "properties": {
            "id": {
              "type": "string",
              "description": "Document identifier"
            },
            "type": {
              "type": "string",
              "enum": ["pdf", "docx", "xlsx", "pptx", "html", "markdown", "image", "infographic"]
            },
            "filename": {
              "type": "string",
              "description": "Generated filename"
            },
            "size_bytes": {
              "type": "integer",
              "description": "File size in bytes"
            },
            "mime_type": {
              "type": "string",
              "description": "MIME type"
            },
            "download_url": {
              "type": "string",
              "format": "uri",
              "description": "Temporary download URL (expires in 24 hours)"
            },
            "preview_url": {
              "type": "string",
              "format": "uri",
              "description": "Preview URL (for supported types)"
            },
            "thumbnail_url": {
              "type": "string",
              "format": "uri",
              "description": "Thumbnail image URL"
            },
            "sha256": {
              "type": "string",
              "description": "SHA-256 hash"
            },
            "page_count": {
              "type": "integer",
              "description": "Number of pages (for paged documents)"
            },
            "word_count": {
              "type": "integer",
              "description": "Approximate word count"
            },
            "dimensions": {
              "type": "object",
              "description": "Dimensions (for images)",
              "properties": {
                "width": { "type": "integer" },
                "height": { "type": "integer" },
                "dpi": { "type": "integer" }
              }
            }
          }
        },
        "assets_used": {
          "type": "array",
          "description": "Assets included in document",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "type": { "type": "string" },
              "source": { "type": "string" }
            }
          }
        },
        "generation_details": {
          "type": "object",
          "properties": {
            "template_used": { "type": "string" },
            "styling_applied": { "type": "object" },
            "warnings": {
              "type": "array",
              "items": { "type": "string" }
            }
          }
        },
        "additional_outputs": {
          "type": "array",
          "description": "Additional generated files (e.g., source files)",
          "items": {
            "type": "object",
            "properties": {
              "type": { "type": "string" },
              "filename": { "type": "string" },
              "download_url": { "type": "string", "format": "uri" }
            }
          }
        }
      }
    }
  }
}
```

**Example Response:**

```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "success",
  "timestamp": "2026-01-12T14:35:00.000Z",
  "duration_ms": 8500,
  "usage": {
    "credits_consumed": 2.0,
    "compute_seconds": 8.5
  },
  "result": {
    "document": {
      "id": "doc_abc123xyz",
      "type": "pdf",
      "filename": "quarterly_report_q4_2025.pdf",
      "size_bytes": 2456789,
      "mime_type": "application/pdf",
      "download_url": "https://storage.swissbrain.ch/docs/abc123/quarterly_report_q4_2025.pdf?token=xyz&expires=1704153600",
      "preview_url": "https://preview.swissbrain.ch/docs/abc123",
      "thumbnail_url": "https://storage.swissbrain.ch/thumbs/abc123.png",
      "sha256": "a1b2c3d4e5f6...",
      "page_count": 24,
      "word_count": 5420
    },
    "assets_used": [
      { "id": "chart_revenue", "type": "chart", "source": "generated" },
      { "id": "logo", "type": "image", "source": "template" }
    ],
    "generation_details": {
      "template_used": "corporate_report_v2",
      "styling_applied": {
        "theme": "corporate",
        "colors": { "primary": "#1F4E79" }
      }
    },
    "additional_outputs": [
      {
        "type": "source",
        "filename": "quarterly_report_q4_2025.md",
        "download_url": "https://storage.swissbrain.ch/docs/abc123/source.md?token=xyz"
      }
    ]
  }
}
```

### 4.4 Browser Automation Response

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://api.swissbrain.ch/schemas/browser-automate-response.json",
  "title": "BrowserAutomateResponse",
  "type": "object",
  "properties": {
    "result": {
      "type": "object",
      "required": ["actions_executed", "final_url"],
      "properties": {
        "actions_executed": {
          "type": "integer",
          "description": "Number of actions successfully executed"
        },
        "actions_total": {
          "type": "integer",
          "description": "Total number of actions requested"
        },
        "final_url": {
          "type": "string",
          "format": "uri",
          "description": "Final page URL"
        },
        "final_title": {
          "type": "string",
          "description": "Final page title"
        },
        "action_results": {
          "type": "array",
          "description": "Results for each action",
          "items": {
            "type": "object",
            "required": ["action_index", "type", "status"],
            "properties": {
              "action_index": {
                "type": "integer",
                "description": "Index of action in request"
              },
              "type": {
                "type": "string",
                "description": "Action type"
              },
              "status": {
                "type": "string",
                "enum": ["success", "failed", "skipped"]
              },
              "duration_ms": {
                "type": "integer"
              },
              "result": {
                "description": "Action-specific result",
                "oneOf": [
                  { "type": "string" },
                  { "type": "object" },
                  { "type": "array" },
                  { "type": "null" }
                ]
              },
              "error": {
                "type": "object",
                "properties": {
                  "code": { "type": "string" },
                  "message": { "type": "string" }
                }
              },
              "screenshot_url": {
                "type": "string",
                "format": "uri",
                "description": "Screenshot taken after this action"
              }
            }
          }
        },
        "screenshots": {
          "type": "array",
          "description": "Captured screenshots",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "timestamp": { "type": "string", "format": "date-time" },
              "trigger": {
                "type": "string",
                "enum": ["action", "error", "final", "manual"]
              },
              "action_index": { "type": "integer" },
              "url": { "type": "string", "format": "uri" },
              "download_url": { "type": "string", "format": "uri" },
              "dimensions": {
                "type": "object",
                "properties": {
                  "width": { "type": "integer" },
                  "height": { "type": "integer" }
                }
              }
            }
          }
        },
        "downloads": {
          "type": "array",
          "description": "Downloaded files",
          "items": {
            "type": "object",
            "properties": {
              "filename": { "type": "string" },
              "size_bytes": { "type": "integer" },
              "mime_type": { "type": "string" },
              "download_url": { "type": "string", "format": "uri" },
              "source_url": { "type": "string", "format": "uri" }
            }
          }
        },
        "extracted_data": {
          "type": "object",
          "description": "Data extracted via extract_data actions",
          "additionalProperties": true
        },
        "extracted_text": {
          "type": "string",
          "description": "Text extracted via extract_text actions"
        },
        "network_log": {
          "type": "array",
          "description": "Network requests (if capture enabled)",
          "items": {
            "type": "object",
            "properties": {
              "timestamp": { "type": "string", "format": "date-time" },
              "method": { "type": "string" },
              "url": { "type": "string" },
              "status": { "type": "integer" },
              "resource_type": { "type": "string" },
              "size_bytes": { "type": "integer" },
              "duration_ms": { "type": "integer" }
            }
          }
        },
        "console_log": {
          "type": "array",
          "description": "Browser console messages",
          "items": {
            "type": "object",
            "properties": {
              "timestamp": { "type": "string", "format": "date-time" },
              "type": { "type": "string", "enum": ["log", "info", "warn", "error"] },
              "text": { "type": "string" },
              "url": { "type": "string" },
              "line": { "type": "integer" }
            }
          }
        },
        "cookies": {
          "type": "array",
          "description": "Final cookies (if capture enabled)",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "value": { "type": "string" },
              "domain": { "type": "string" },
              "path": { "type": "string" },
              "expires": { "type": "integer" },
              "secure": { "type": "boolean" },
              "httpOnly": { "type": "boolean" }
            }
          }
        },
        "local_storage": {
          "type": "object",
          "description": "Local storage contents (if capture enabled)",
          "additionalProperties": { "type": "string" }
        },
        "html": {
          "type": "string",
          "description": "Final page HTML (if capture enabled)"
        },
        "pdf": {
          "type": "object",
          "description": "Generated PDF (if pdf action used)",
          "properties": {
            "download_url": { "type": "string", "format": "uri" },
            "size_bytes": { "type": "integer" },
            "page_count": { "type": "integer" }
          }
        }
      }
    }
  }
}
```

**Example Response:**

```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440002",
  "status": "success",
  "timestamp": "2026-01-12T14:40:00.000Z",
  "duration_ms": 15000,
  "usage": {
    "credits_consumed": 3.0,
    "compute_seconds": 15
  },
  "result": {
    "actions_executed": 5,
    "actions_total": 5,
    "final_url": "https://example.com/dashboard",
    "final_title": "Dashboard - Example App",
    "action_results": [
      {
        "action_index": 0,
        "type": "navigate",
        "status": "success",
        "duration_ms": 2500
      },
      {
        "action_index": 1,
        "type": "type",
        "status": "success",
        "duration_ms": 500
      },
      {
        "action_index": 2,
        "type": "click",
        "status": "success",
        "duration_ms": 3000
      },
      {
        "action_index": 3,
        "type": "wait_for_selector",
        "status": "success",
        "duration_ms": 1500
      },
      {
        "action_index": 4,
        "type": "extract_data",
        "status": "success",
        "duration_ms": 200,
        "result": {
          "username": "john.doe",
          "account_balance": "$1,234.56"
        }
      }
    ],
    "screenshots": [
      {
        "id": "ss_001",
        "timestamp": "2026-01-12T14:40:00.000Z",
        "trigger": "final",
        "url": "https://example.com/dashboard",
        "download_url": "https://storage.swissbrain.ch/screenshots/abc123/final.png",
        "dimensions": { "width": 1920, "height": 1080 }
      }
    ],
    "extracted_data": {
      "username": "john.doe",
      "account_balance": "$1,234.56"
    },
    "console_log": [
      {
        "timestamp": "2026-01-12T14:39:55.000Z",
        "type": "log",
        "text": "App initialized",
        "url": "https://example.com/app.js",
        "line": 42
      }
    ]
  }
}
```

---

## 5. Streaming Specifications

### 5.1 Streaming Modes Comparison

| Mode | Transport | Use Case | Pros | Cons |
|------|-----------|----------|------|------|
| **SSE** | HTTP/1.1+ | Real-time logs, progress | Simple, firewall-friendly | Unidirectional |
| **WebSocket** | WS/WSS | Bidirectional, interactive | Full duplex | More complex |
| **Polling** | HTTP | Legacy support | Universal | Higher latency, more requests |

### 5.2 Server-Sent Events (SSE) - Recommended

**Endpoint:**
```
GET /v1/execute/stream/{request_id}
```

**Headers:**
```http
Accept: text/event-stream
Authorization: Bearer <token>
```

**Event Format:**

```
event: <event_type>
id: <sequence_number>
data: <json_payload>

```

**Event Types:**

| Event Type | Description | Data Schema |
|------------|-------------|-------------|
| `started` | Execution started | `{ "request_id": "...", "started_at": "..." }` |
| `progress` | Progress update | `{ "percent": 50, "message": "Processing..." }` |
| `log` | Log message | `{ "level": "info", "message": "...", "timestamp": "..." }` |
| `output` | Partial output | `{ "type": "stdout", "content": "..." }` |
| `file` | File generated | `{ "path": "...", "size_bytes": 1024 }` |
| `heartbeat` | Keep-alive | `{ "timestamp": "..." }` |
| `completed` | Execution complete | Full response object |
| `failed` | Execution failed | Error object |
| `cancelled` | Execution cancelled | `{ "reason": "..." }` |

**Example SSE Stream:**

```
event: started
id: 1
data: {"request_id":"550e8400-e29b-41d4-a716-446655440000","started_at":"2026-01-12T14:30:00.000Z"}

event: log
id: 2
data: {"level":"info","message":"Installing dependencies...","timestamp":"2026-01-12T14:30:01.000Z"}

event: progress
id: 3
data: {"percent":25,"message":"Dependencies installed"}

event: output
id: 4
data: {"type":"stdout","content":"Processing item 1 of 10...\n"}

event: heartbeat
id: 5
data: {"timestamp":"2026-01-12T14:30:15.000Z"}

event: output
id: 6
data: {"type":"stdout","content":"Processing complete.\n"}

event: file
id: 7
data: {"path":"/output/result.json","size_bytes":1024,"download_url":"https://..."}

event: completed
id: 8
data: {"request_id":"550e8400-e29b-41d4-a716-446655440000","status":"success","result":{...}}

```

### 5.3 WebSocket Protocol

**Endpoint:**
```
wss://api.swissbrain.ch/v1/ws
```

**Connection:**
```javascript
const ws = new WebSocket('wss://api.swissbrain.ch/v1/ws', {
  headers: {
    'Authorization': 'Bearer <token>'
  }
});
```

**Message Format:**

```json
{
  "type": "request" | "response" | "event" | "ping" | "pong",
  "id": "<message_id>",
  "payload": { ... }
}
```

**Client Messages:**

```json
// Execute request
{
  "type": "request",
  "id": "msg_001",
  "payload": {
    "action": "execute",
    "operation": "code_exec",
    "params": { ... }
  }
}

// Cancel request
{
  "type": "request",
  "id": "msg_002",
  "payload": {
    "action": "cancel",
    "request_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}

// Ping (keep-alive)
{
  "type": "ping",
  "id": "msg_003"
}
```

**Server Messages:**

```json
// Acknowledgment
{
  "type": "response",
  "id": "msg_001",
  "payload": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "accepted"
  }
}

// Event
{
  "type": "event",
  "id": "evt_001",
  "payload": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "event": "log",
    "data": { "level": "info", "message": "Processing..." }
  }
}

// Pong
{
  "type": "pong",
  "id": "msg_003"
}
```

### 5.4 Polling Fallback

**Endpoint:**
```
GET /v1/execute/{request_id}/status
```

**Response:**

```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "progress": {
    "percent": 50,
    "message": "Processing..."
  },
  "logs_since": "2026-01-12T14:30:00.000Z",
  "logs": [
    { "level": "info", "message": "Step 1 complete", "timestamp": "..." }
  ],
  "poll_interval_ms": 2000,
  "estimated_completion": "2026-01-12T14:31:00.000Z"
}
```

**Polling Strategy:**

| Status | Recommended Interval |
|--------|---------------------|
| `pending` | 5000ms |
| `running` | 2000ms |
| `completed` / `failed` | Stop polling |

---

## 6. Payload Limits

### 6.1 Request Limits

| Field | Limit | Notes |
|-------|-------|-------|
| **Total request body** | 50 MB | For standard requests |
| **Total request body (multipart)** | 500 MB | For file uploads |
| **Code content** | 1 MB | `params.code` field |
| **Single file content** | 10 MB | In `params.files[]` |
| **Total files size** | 100 MB | Sum of all files |
| **Number of files** | 100 | In `params.files[]` |
| **Stdin content** | 10 MB | `params.stdin` field |
| **Environment variables** | 100 | Key-value pairs |
| **Browser actions** | 500 | In `params.actions[]` |
| **Metadata object** | 50 | Properties |
| **String field (general)** | 1 MB | Unless specified |

### 6.2 Response Limits

| Field | Limit | Behavior |
|-------|-------|----------|
| **stdout** | 10 MB | Truncated, `stdout_truncated: true` |
| **stderr** | 10 MB | Truncated, `stderr_truncated: true` |
| **Output files (total)** | 1 GB | Excess files not captured |
| **Single output file** | 500 MB | Larger files split or excluded |
| **Screenshots** | 100 | Per automation request |
| **Network log entries** | 10,000 | Oldest entries dropped |
| **Console log entries** | 1,000 | Oldest entries dropped |

### 6.3 Rate Limits

| Tier | Requests/min | Concurrent | Burst |
|------|--------------|------------|-------|
| **Free** | 10 | 2 | 5 |
| **Starter** | 60 | 5 | 20 |
| **Professional** | 300 | 20 | 100 |
| **Enterprise** | Custom | Custom | Custom |

**Rate Limit Headers:**

```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 295
X-RateLimit-Reset: 1704067260
X-RateLimit-Retry-After: 5
```

---

## 7. Timeout Configuration

### 7.1 Timeout Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TIMEOUT HIERARCHY                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Request Timeout (client-specified, max 1 hour)                             │
│  └── Operation Timeout (operation-specific defaults)                        │
│      └── Step Timeout (for workflows)                                       │
│          └── Action Timeout (for browser automation)                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Default Timeouts by Operation

| Operation | Default | Minimum | Maximum |
|-----------|---------|---------|---------|
| **code_exec** | 5 min | 1 sec | 1 hour |
| **document_generate** | 5 min | 10 sec | 30 min |
| **browser_automate** | 10 min | 30 sec | 1 hour |
| **llm_invoke** | 2 min | 5 sec | 10 min |
| **file_operation** | 1 min | 1 sec | 10 min |
| **search** | 30 sec | 5 sec | 2 min |
| **workflow_execute** | 1 hour | 1 min | 24 hours |

### 7.3 Timeout Behavior

```json
{
  "execution_config": {
    "timeout_ms": 300000,
    "timeout_behavior": {
      "on_timeout": "cancel",
      "grace_period_ms": 5000,
      "capture_state": true,
      "return_partial": true
    }
  }
}
```

| Behavior | Description |
|----------|-------------|
| `cancel` | Immediately terminate execution |
| `graceful` | Send SIGTERM, wait grace period, then SIGKILL |
| `checkpoint` | Save state and return partial results |

### 7.4 Connection Timeouts

| Timeout Type | Value | Configurable |
|--------------|-------|--------------|
| **TCP connect** | 10 sec | No |
| **TLS handshake** | 10 sec | No |
| **Request send** | 60 sec | No |
| **Response first byte** | 120 sec | No |
| **SSE heartbeat** | 30 sec | Yes |
| **WebSocket ping** | 30 sec | Yes |
| **Idle connection** | 5 min | No |

---

## 8. Multi-File Output Handling

### 8.1 Output File Collection

When code execution or document generation produces multiple files, they are collected and returned in the response.

**Configuration:**

```json
{
  "params": {
    "capture_output": {
      "files": [
        "output/**/*",
        "*.pdf",
        "results/*.json"
      ],
      "max_files": 100,
      "max_total_size": 104857600,
      "include_hidden": false,
      "follow_symlinks": false
    }
  }
}
```

### 8.2 File Output Schema

```json
{
  "output_files": [
    {
      "path": "/home/sandbox/output/report.pdf",
      "relative_path": "output/report.pdf",
      "filename": "report.pdf",
      "size_bytes": 1048576,
      "mime_type": "application/pdf",
      "encoding": "binary",
      "download_url": "https://storage.swissbrain.ch/outputs/abc123/report.pdf?token=xyz",
      "expires_at": "2026-01-13T14:30:00.000Z",
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "created_at": "2026-01-12T14:30:00.000Z",
      "modified_at": "2026-01-12T14:30:00.000Z",
      "permissions": "644",
      "inline_content": null
    },
    {
      "path": "/home/sandbox/output/data.json",
      "relative_path": "output/data.json",
      "filename": "data.json",
      "size_bytes": 256,
      "mime_type": "application/json",
      "encoding": "utf8",
      "download_url": "https://storage.swissbrain.ch/outputs/abc123/data.json?token=xyz",
      "expires_at": "2026-01-13T14:30:00.000Z",
      "sha256": "abc123...",
      "inline_content": "{\"success\": true, \"count\": 42}"
    }
  ],
  "output_summary": {
    "total_files": 2,
    "total_size_bytes": 1048832,
    "truncated": false,
    "files_excluded": 0,
    "exclusion_reason": null
  }
}
```

### 8.3 Bulk Download

For multiple files, a ZIP archive can be requested:

**Endpoint:**
```
GET /v1/execute/{request_id}/outputs/archive
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | `zip` (default), `tar.gz` |
| `filter` | string | Glob pattern to filter files |
| `flatten` | boolean | Flatten directory structure |

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/zip
Content-Disposition: attachment; filename="outputs_550e8400.zip"
Content-Length: 2097152
X-Archive-Files: 15
X-Archive-Size-Uncompressed: 5242880
```

### 8.4 File Streaming

For large files, streaming download is supported:

**Endpoint:**
```
GET /v1/execute/{request_id}/outputs/{file_path}
```

**Headers:**

```http
Range: bytes=0-1048575
```

**Response:**

```http
HTTP/1.1 206 Partial Content
Content-Type: application/octet-stream
Content-Range: bytes 0-1048575/5242880
Accept-Ranges: bytes
```

### 8.5 Output Persistence

| Storage Tier | Retention | Access |
|--------------|-----------|--------|
| **Hot** | 24 hours | Instant |
| **Warm** | 7 days | < 1 sec |
| **Cold** | 30 days | < 10 sec |
| **Archive** | 1 year | Request required |

---

## 9. Error Responses

### 9.1 Error Code Structure

```
SB-<CATEGORY>-<SPECIFIC>

Categories:
- AUTH: Authentication/Authorization
- VAL: Validation
- EXEC: Execution
- RATE: Rate limiting
- SYS: System errors
- NET: Network errors
```

### 9.2 Standard Error Codes

| Code | HTTP Status | Description | Retryable |
|------|-------------|-------------|-----------|
| `SB-AUTH-001` | 401 | Invalid API key | No |
| `SB-AUTH-002` | 401 | Expired token | Yes (refresh) |
| `SB-AUTH-003` | 403 | Insufficient permissions | No |
| `SB-AUTH-004` | 403 | Resource access denied | No |
| `SB-VAL-001` | 400 | Invalid request body | No |
| `SB-VAL-002` | 400 | Missing required field | No |
| `SB-VAL-003` | 400 | Invalid field value | No |
| `SB-VAL-004` | 400 | Payload too large | No |
| `SB-EXEC-001` | 500 | Execution failed | Yes |
| `SB-EXEC-002` | 408 | Execution timeout | Yes |
| `SB-EXEC-003` | 500 | Sandbox error | Yes |
| `SB-EXEC-004` | 500 | Dependency installation failed | Yes |
| `SB-EXEC-005` | 400 | Invalid code | No |
| `SB-RATE-001` | 429 | Rate limit exceeded | Yes |
| `SB-RATE-002` | 429 | Concurrent limit exceeded | Yes |
| `SB-RATE-003` | 402 | Credit limit exceeded | No |
| `SB-SYS-001` | 500 | Internal server error | Yes |
| `SB-SYS-002` | 503 | Service unavailable | Yes |
| `SB-SYS-003` | 503 | Maintenance mode | Yes |
| `SB-NET-001` | 502 | Upstream error | Yes |
| `SB-NET-002` | 504 | Gateway timeout | Yes |

### 9.3 Error Response Format

```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "timestamp": "2026-01-12T14:30:00.000Z",
  "error": {
    "code": "SB-EXEC-002",
    "message": "Execution timeout after 300000ms",
    "details": {
      "timeout_ms": 300000,
      "elapsed_ms": 300000,
      "last_activity": "2026-01-12T14:29:55.000Z",
      "partial_output_available": true
    },
    "retryable": true,
    "retry_after_ms": 0,
    "documentation_url": "https://docs.swissbrain.ch/errors/SB-EXEC-002"
  },
  "partial_result": {
    "exit_code": null,
    "stdout": "Partial output before timeout...",
    "output_files": []
  }
}
```

---

## 10. OpenAPI Specification

The complete OpenAPI 3.1 specification is available at:

```
https://api.swissbrain.ch/v1/openapi.json
https://api.swissbrain.ch/v1/openapi.yaml
```

Interactive documentation:
```
https://docs.swissbrain.ch/api
```

### 10.1 SDK Generation

SDKs can be generated from the OpenAPI spec:

```bash
# TypeScript
npx openapi-generator-cli generate \
  -i https://api.swissbrain.ch/v1/openapi.json \
  -g typescript-fetch \
  -o ./sdk/typescript

# Python
openapi-generator generate \
  -i https://api.swissbrain.ch/v1/openapi.json \
  -g python \
  -o ./sdk/python

# Go
openapi-generator generate \
  -i https://api.swissbrain.ch/v1/openapi.json \
  -g go \
  -o ./sdk/go
```

### 10.2 Postman Collection

Import the API into Postman:

```
https://api.swissbrain.ch/v1/postman.json
```

---

## Appendix A: Request/Response Examples

### A.1 Complete Code Execution Example

**Request:**

```bash
curl -X POST https://api.swissbrain.ch/v1/execute \
  -H "Authorization: Bearer sb_live_abc123..." \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: user_123_task_456" \
  -d '{
    "operation": "code_exec",
    "params": {
      "language": "python",
      "code": "import pandas as pd\nimport json\n\ndata = {\"name\": [\"Alice\", \"Bob\"], \"age\": [30, 25]}\ndf = pd.DataFrame(data)\ndf.to_csv(\"/home/sandbox/output/result.csv\", index=False)\nprint(json.dumps({\"rows\": len(df)}))",
      "dependencies": {
        "packages": [
          {"name": "pandas", "version": ">=2.0.0"}
        ]
      },
      "capture_output": {
        "files": ["output/*.csv"]
      }
    },
    "execution_config": {
      "timeout_ms": 60000,
      "idempotency_key": "user_123_task_456"
    },
    "streaming": {
      "enabled": true,
      "mode": "sse",
      "include_logs": true
    }
  }'
```

**Response (final):**

```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "success",
  "timestamp": "2026-01-12T14:30:05.000Z",
  "duration_ms": 5000,
  "idempotency_key": "user_123_task_456",
  "trace_id": "abc123def456789012345678901234ab",
  "usage": {
    "credits_consumed": 0.25,
    "compute_seconds": 5,
    "memory_mb_seconds": 2560
  },
  "result": {
    "exit_code": 0,
    "stdout": "{\"rows\": 2}\n",
    "stderr": "",
    "execution_time_ms": 3500,
    "memory_peak_mb": 512,
    "output_files": [
      {
        "path": "/home/sandbox/output/result.csv",
        "relative_path": "output/result.csv",
        "filename": "result.csv",
        "size_bytes": 28,
        "mime_type": "text/csv",
        "download_url": "https://storage.swissbrain.ch/outputs/550e8400/result.csv?token=xyz",
        "expires_at": "2026-01-13T14:30:05.000Z",
        "inline_content": "name,age\nAlice,30\nBob,25\n"
      }
    ],
    "return_value": {"rows": 2}
  }
}
```

---

*This document provides the complete API contract specification for the SwissBrain platform. All schemas are validated against JSON Schema Draft 2020-12 and are available programmatically via the OpenAPI endpoint.*
