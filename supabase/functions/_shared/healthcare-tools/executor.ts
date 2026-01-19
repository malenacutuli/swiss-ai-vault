// Tool Executor - Routes tool calls to implementations

import { lookupICD10 } from './icd10.ts';
import { verifyNPI } from './npi.ts';
import { checkDrugInteraction } from './rxnorm.ts';
import { searchPubMed } from './pubmed.ts';
import { ToolResult } from './index.ts';

export async function executeHealthcareTool(
  toolName: string,
  toolInput: Record<string, any>
): Promise<ToolResult> {
  switch (toolName) {
    case 'lookup_icd10':
      return await lookupICD10(toolInput);

    case 'lookup_cpt':
      // CPT codes are copyrighted by AMA - provide guidance
      return {
        success: true,
        data: {
          note: "CPT codes are copyrighted by the American Medical Association. For official CPT code lookup, please use:",
          resources: [
            "AMA CPT Code Lookup: https://www.ama-assn.org/practice-management/cpt",
            "CMS HCPCS Search: https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system",
            "Your practice management or EHR system's integrated CPT search"
          ],
          search_term: toolInput.search_term || toolInput.code,
          common_codes: getCommonCPTCodes(toolInput.search_term || toolInput.code)
        },
        source: "System (CPT codes require licensed access)"
      };

    case 'verify_npi':
      return await verifyNPI(toolInput);

    case 'check_drug_interaction':
      return await checkDrugInteraction(toolInput);

    case 'search_pubmed':
      return await searchPubMed(toolInput);

    case 'lookup_coverage_policy':
      return await lookupCoveragePolicy(toolInput);

    default:
      return {
        success: false,
        error: `Unknown tool: ${toolName}`
      };
  }
}

// Helper for common CPT code categories (educational only)
function getCommonCPTCodes(searchTerm?: string): Array<{ category: string; range: string; description: string }> {
  const categories = [
    { category: "E/M Services", range: "99201-99499", description: "Evaluation and Management" },
    { category: "Anesthesia", range: "00100-01999", description: "Anesthesia services" },
    { category: "Surgery", range: "10004-69990", description: "Surgical procedures" },
    { category: "Radiology", range: "70010-79999", description: "Imaging and radiation" },
    { category: "Pathology/Lab", range: "80047-89398", description: "Laboratory services" },
    { category: "Medicine", range: "90281-99607", description: "Medical services and procedures" }
  ];

  if (!searchTerm) return categories;

  const term = searchTerm.toLowerCase();
  return categories.filter(c =>
    c.category.toLowerCase().includes(term) ||
    c.description.toLowerCase().includes(term)
  );
}

// Medicare Coverage Policy Lookup
async function lookupCoveragePolicy(params: {
  cpt_code: string;
  state?: string;
}): Promise<ToolResult> {
  const { cpt_code, state } = params;

  if (!cpt_code) {
    return { success: false, error: "CPT code is required" };
  }

  try {
    // CMS Medicare Coverage Database search
    // Note: Direct API access requires registration; providing guidance and links
    const macContractors: Record<string, { name: string; states: string[]; url: string }> = {
      "Noridian": {
        name: "Noridian Healthcare Solutions",
        states: ["AK", "AZ", "CA", "HI", "ID", "MT", "ND", "NV", "OR", "SD", "UT", "WA", "WY"],
        url: "https://med.noridianmedicare.com/"
      },
      "CGS": {
        name: "CGS Administrators",
        states: ["KY", "OH"],
        url: "https://www.cgsmedicare.com/"
      },
      "Novitas": {
        name: "Novitas Solutions",
        states: ["AR", "CO", "DE", "LA", "MD", "MS", "NJ", "NM", "OK", "PA", "TX", "DC"],
        url: "https://www.novitas-solutions.com/"
      },
      "Palmetto": {
        name: "Palmetto GBA",
        states: ["NC", "SC", "VA", "WV"],
        url: "https://www.palmettogba.com/"
      },
      "WPS": {
        name: "WPS Government Health Administrators",
        states: ["IA", "IN", "KS", "MI", "MO", "NE"],
        url: "https://www.wpsgha.com/"
      },
      "NGS": {
        name: "National Government Services",
        states: ["CT", "IL", "MA", "ME", "MN", "NH", "NY", "RI", "VT", "WI"],
        url: "https://www.ngsmedicare.com/"
      },
      "First Coast": {
        name: "First Coast Service Options",
        states: ["FL", "PR", "VI"],
        url: "https://medicare.fcso.com/"
      }
    };

    // Find MAC for state
    let applicableMac = null;
    if (state) {
      for (const [key, mac] of Object.entries(macContractors)) {
        if (mac.states.includes(state.toUpperCase())) {
          applicableMac = { key, ...mac };
          break;
        }
      }
    }

    return {
      success: true,
      data: {
        cpt_code,
        state: state || "Not specified",
        coverage_resources: {
          national: {
            name: "CMS Medicare Coverage Database",
            url: `https://www.cms.gov/medicare-coverage-database/search.aspx?q=${cpt_code}`,
            description: "Search NCDs (National Coverage Determinations)"
          },
          local: applicableMac ? {
            mac_name: applicableMac.name,
            mac_url: applicableMac.url,
            states_covered: applicableMac.states,
            description: "Search LCDs (Local Coverage Determinations) for your region"
          } : {
            note: "Provide state code to identify your Medicare Administrative Contractor (MAC)"
          }
        },
        mac_contractors: Object.entries(macContractors).map(([key, mac]) => ({
          name: mac.name,
          states: mac.states.join(", "),
          url: mac.url
        })),
        tips: [
          "NCDs apply nationally and override LCDs",
          "LCDs vary by MAC region - check your local MAC",
          "Coverage articles provide additional guidance",
          "Check both Part A and Part B coverage as applicable"
        ]
      },
      source: "CMS Medicare Coverage Database Reference"
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      source: "Medicare Coverage Lookup"
    };
  }
}
