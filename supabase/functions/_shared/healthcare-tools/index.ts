// Healthcare Tools for Claude Tool Use
// Each tool implements a real API call

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  source?: string;
  source_url?: string;
  note?: string;
  cached?: boolean;
}

// Re-export all tools
export { lookupICD10 } from './icd10.ts';
export { lookupCPT } from './cpt.ts';
export { verifyNPI } from './npi.ts';
export { checkDrugInteraction, checkDrugInteractions, getDrugInfoFromFDA } from './rxnorm.ts';
export { searchPubMed } from './pubmed.ts';
export { executeHealthcareTool, executeTool } from './executor.ts';

// Tool definitions for Claude
export const HEALTHCARE_TOOL_DEFINITIONS = [
  {
    name: "lookup_icd10",
    description: "Search ICD-10-CM diagnosis codes. Use this to find accurate medical codes - never guess codes without using this tool.",
    input_schema: {
      type: "object",
      properties: {
        search_term: {
          type: "string",
          description: "Medical condition, symptom, or diagnosis to search (e.g., 'type 2 diabetes', 'chest pain', 'hypertension')"
        },
        code: {
          type: "string",
          description: "Specific ICD-10 code to look up details (e.g., 'E11.9', 'I10')"
        }
      }
    }
  },
  {
    name: "lookup_cpt",
    description: "Search CPT procedure codes. Use for billing and procedure validation.",
    input_schema: {
      type: "object",
      properties: {
        search_term: {
          type: "string",
          description: "Procedure name or description"
        },
        code: {
          type: "string",
          description: "Specific CPT code to look up"
        }
      }
    }
  },
  {
    name: "verify_npi",
    description: "Verify a healthcare provider's NPI number and retrieve their credentials, specialty, and practice information from the NPPES registry.",
    input_schema: {
      type: "object",
      properties: {
        npi: {
          type: "string",
          description: "10-digit NPI number to verify"
        },
        provider_name: {
          type: "string",
          description: "Provider name to search if NPI is unknown"
        },
        state: {
          type: "string",
          description: "State code to narrow search (e.g., 'CA', 'NY')"
        }
      }
    }
  },
  {
    name: "check_drug_interaction",
    description: "Check for drug-drug interactions using RxNorm. Always use this before discussing medication combinations.",
    input_schema: {
      type: "object",
      properties: {
        drugs: {
          type: "array",
          items: { type: "string" },
          description: "List of drug names to check for interactions"
        }
      },
      required: ["drugs"]
    }
  },
  {
    name: "search_pubmed",
    description: "Search PubMed for medical literature, clinical studies, and guidelines.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for medical literature"
        },
        max_results: {
          type: "integer",
          default: 5,
          description: "Maximum number of results (1-20)"
        },
        date_range: {
          type: "string",
          enum: ["1y", "5y", "10y", "all"],
          description: "Publication date filter"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_drug_info",
    description: "Get drug information including indications, warnings, and FDA alerts from OpenFDA.",
    input_schema: {
      type: "object",
      properties: {
        drug_name: {
          type: "string",
          description: "Drug name (brand or generic)"
        }
      },
      required: ["drug_name"]
    }
  },
  {
    name: "lookup_coverage_policy",
    description: "Look up Medicare coverage policy (LCD/NCD) for a procedure. Essential for prior authorization.",
    input_schema: {
      type: "object",
      properties: {
        cpt_code: {
          type: "string",
          description: "CPT code to check coverage"
        },
        state: {
          type: "string",
          description: "State for local coverage determination"
        }
      },
      required: ["cpt_code"]
    }
  }
];

// System Prompt
export const HEALTHCARE_SYSTEM_PROMPT = `You are SwissVault Health, a healthcare AI assistant for medical professionals.

You have access to the following tools - USE THEM:
- lookup_icd10: Search ICD-10 diagnosis codes (ALWAYS use this for code questions)
- lookup_cpt: Search CPT procedure codes
- verify_npi: Verify provider credentials
- check_drug_interaction: Check medication interactions
- search_pubmed: Search medical literature
- lookup_coverage_policy: Check Medicare coverage policies

IMPORTANT:
- Never guess medical codes - always use lookup_icd10 or lookup_cpt
- Always verify NPIs before discussing provider credentials
- Always check drug interactions before discussing medication combinations
- Cite PubMed sources when discussing medical evidence

Be precise, thorough, and always use tools to verify information.`;

// Task-Specific Prompts
export const HEALTHCARE_PROMPTS: Record<string, string> = {
  prior_auth_review: `You are SwissVault Health, reviewing a prior authorization request.

USE YOUR TOOLS to verify:
1. ICD-10 diagnosis codes are valid and specific
2. CPT procedure codes are appropriate
3. Provider NPI is valid and specialty matches
4. Coverage policy supports medical necessity

Structure your review:
- Patient Information Summary
- Diagnosis & Procedure Code Validation
- Medical Necessity Assessment
- Coverage Policy Match
- Recommendation (Approve/Deny/Request Info)
- Required Documentation Checklist`,

  claims_appeal: `You are SwissVault Health, analyzing a claims denial for appeal.

USE YOUR TOOLS to:
1. Verify correct coding (ICD-10 and CPT)
2. Search PubMed for supporting evidence
3. Check coverage policies
4. Find clinical guidelines

Structure your analysis:
- Denial Reason Analysis
- Coding Review
- Medical Necessity Evidence
- Relevant Clinical Guidelines
- Appeal Argument Points
- Suggested Documentation`,

  icd10_lookup: `You are SwissVault Health, helping with ICD-10 code lookup.

ALWAYS use the lookup_icd10 tool to search codes. Never guess.

Provide:
- Most specific applicable code(s)
- Code hierarchy explanation
- Documentation requirements
- Common coding mistakes to avoid
- Related codes that might apply`,

  drug_interaction: `You are SwissVault Health, checking drug interactions.

ALWAYS use check_drug_interaction tool before making any statements.

For each interaction found, explain:
- Clinical significance
- Mechanism of interaction
- Risk level (major/moderate/minor)
- Recommended action
- Alternative medications if applicable
- Monitoring requirements`,

  literature_search: `You are SwissVault Health, searching medical literature.

USE search_pubmed to find relevant studies.

Provide:
- Summary of key findings
- Study quality assessment
- Clinical applicability
- Limitations
- Full citations with PMIDs`,

  clinical_documentation: `You are SwissVault Health, assisting with clinical documentation.

USE YOUR TOOLS to ensure:
- Diagnosis codes are specific and supported
- Documentation meets medical necessity
- Required elements are present

Provide guidance on:
- Required documentation elements
- Coding specificity requirements
- Medical necessity language
- Compliance considerations`,

  care_coordination: `You are SwissVault Health, helping with care coordination.

USE YOUR TOOLS to:
- Verify provider credentials (NPI)
- Check medication lists for interactions
- Find relevant clinical resources

Assist with:
- Care team communication
- Referral requirements
- Follow-up tracking
- Patient education resources`,

  general_query: `You are SwissVault Health, a healthcare AI assistant for medical professionals.

You have access to the following tools - USE THEM:
- lookup_icd10: Search ICD-10 diagnosis codes (ALWAYS use this for code questions)
- lookup_cpt: Search CPT procedure codes
- verify_npi: Verify provider credentials
- check_drug_interaction: Check medication interactions
- search_pubmed: Search medical literature
- lookup_coverage_policy: Check Medicare coverage policies

IMPORTANT:
- Never guess medical codes - always use lookup_icd10 or lookup_cpt
- Always verify NPIs before discussing provider credentials
- Always check drug interactions before discussing medication combinations
- Cite PubMed sources when discussing medical evidence

Be precise, thorough, and always use tools to verify information.`
};

export const BASE_DISCLAIMER = `\n\n---\n*For informational purposes only. Clinical decisions should be made by qualified healthcare providers.*`;

// Alias for spec compatibility
export const HEALTHCARE_TOOLS = HEALTHCARE_TOOL_DEFINITIONS;
