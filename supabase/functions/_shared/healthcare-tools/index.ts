// Healthcare Tools - Index and Definitions

// Re-export all tools
export { lookupICD10 } from './icd10.ts';
export { verifyNPI } from './npi.ts';
export { checkDrugInteraction } from './rxnorm.ts';
export { searchPubMed } from './pubmed.ts';
export { executeHealthcareQuery } from './executor.ts';

// Claude Tool Definitions
export const HEALTHCARE_TOOLS = [
  {
    name: 'lookup_icd10',
    description: 'Look up ICD-10 diagnosis or procedure codes. Use for medical coding, billing, and documentation validation.',
    input_schema: {
      type: 'object',
      properties: {
        search_term: {
          type: 'string',
          description: 'Medical condition, symptom, or procedure to search',
        },
        code: {
          type: 'string',
          description: 'Specific ICD-10 code to look up (e.g., E11.9)',
        },
        code_type: {
          type: 'string',
          enum: ['diagnosis', 'procedure'],
          description: 'Type of code (default: diagnosis)',
        },
        max_results: {
          type: 'integer',
          description: 'Maximum results to return (default: 10)',
        },
      },
    },
  },
  {
    name: 'verify_npi',
    description: "Verify a healthcare provider's NPI number and retrieve their credentials, specialty, and practice information.",
    input_schema: {
      type: 'object',
      properties: {
        npi: {
          type: 'string',
          description: '10-digit NPI number to verify',
        },
        provider_name: {
          type: 'string',
          description: 'Provider name to search (if NPI not known)',
        },
        state: {
          type: 'string',
          description: 'State code (e.g., CA, NY) to narrow search',
        },
      },
    },
  },
  {
    name: 'check_drug_interaction',
    description: 'Check for drug interactions, lookup drug information via RxNorm. Use for medication safety checks.',
    input_schema: {
      type: 'object',
      properties: {
        drugs: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of drug names to check for interactions',
        },
        drug_name: {
          type: 'string',
          description: 'Single drug name to look up',
        },
      },
    },
  },
  {
    name: 'search_pubmed',
    description: 'Search PubMed for medical research papers, clinical studies, and scientific literature.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for medical literature',
        },
        max_results: {
          type: 'integer',
          description: 'Maximum number of results (default: 5)',
        },
        date_range: {
          type: 'string',
          enum: ['1y', '5y', '10y', 'all'],
          description: 'Filter by publication date',
        },
      },
      required: ['query'],
    },
  },
];

// System Prompt
export const HEALTHCARE_SYSTEM_PROMPT = `You are a healthcare AI assistant specialized in medical administration, coding, and clinical decision support. You operate within Swiss data protection standards and provide evidence-based information.

## CAPABILITIES
- ICD-10 code lookup and validation
- NPI provider verification
- Drug interaction checking via RxNorm
- PubMed medical literature search
- Prior authorization review assistance
- Claims appeal analysis
- Clinical documentation support

## GUIDELINES
1. **Accuracy First**: Always verify medical codes and information using the available tools
2. **Evidence-Based**: Cite sources for clinical recommendations (PubMed, clinical guidelines)
3. **Safety**: Flag potential drug interactions and contraindications
4. **Compliance**: Follow HIPAA/Swiss data protection principles
5. **Clarity**: Use clear, professional medical terminology
6. **Limitations**: Clearly state when something requires physician review

## RESPONSE FORMAT
- Use markdown formatting for readability
- Include citation numbers [1], [2] etc. for sources
- Structure complex responses with headers
- Highlight critical safety information
- End with confidence level (High/Medium/Low) when making clinical assessments

## IMPORTANT DISCLAIMERS
- This is for informational purposes only
- Does not replace professional medical judgment
- All clinical decisions require licensed provider review`;

// Task-Specific Prompts
export const TASK_PROMPTS: Record<string, string> = {
  prior_auth_review: `You are reviewing a prior authorization request. Focus on:
- Validating ICD-10 codes and medical necessity
- Checking coverage policy requirements
- Identifying missing documentation
- Recommending approval/denial with rationale
- Suggesting alternative treatments if applicable`,

  claims_appeal: `You are analyzing a claims denial for appeal. Focus on:
- Understanding the denial reason
- Gathering supporting clinical evidence
- Building a compelling medical necessity argument
- Citing relevant clinical guidelines and literature
- Drafting appeal letter components`,

  icd10_lookup: `You are helping with ICD-10 code lookup. Focus on:
- Finding the most specific applicable code
- Explaining code hierarchies and relationships
- Noting coding guidelines and conventions
- Suggesting related codes when appropriate`,

  drug_interaction: `You are checking drug interactions. Focus on:
- Identifying all potential interactions
- Rating severity (major, moderate, minor)
- Explaining clinical significance
- Suggesting alternatives when issues found
- Noting any monitoring requirements`,

  literature_search: `You are searching medical literature. Focus on:
- Finding relevant, recent research
- Prioritizing systematic reviews and RCTs
- Summarizing key findings
- Noting study limitations
- Providing citation details`,

  clinical_documentation: `You are assisting with clinical documentation. Focus on:
- Ensuring completeness and accuracy
- Using appropriate medical terminology
- Meeting regulatory requirements
- Supporting medical necessity
- Maintaining clear, concise language`,

  care_coordination: `You are helping with care coordination. Focus on:
- Identifying care team members and roles
- Tracking pending actions and follow-ups
- Ensuring communication continuity
- Flagging urgent items
- Maintaining care plan alignment`,

  general_query: `You are answering a general healthcare query. Focus on:
- Providing accurate, evidence-based information
- Using appropriate tools to verify facts
- Citing sources for clinical information
- Noting when physician consultation is needed`,
};
