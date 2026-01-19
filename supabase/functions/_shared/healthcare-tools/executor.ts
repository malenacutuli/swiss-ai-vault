// Tool Executor - Routes tool calls to implementations

import { lookupICD10 } from './icd10.ts';
import { lookupCPT } from './cpt.ts';
import { verifyNPI } from './npi.ts';
import { checkDrugInteraction, getDrugInfoFromFDA } from './rxnorm.ts';
import { searchPubMed } from './pubmed.ts';
import { ToolResult } from './index.ts';

// Alias for spec compatibility
export const executeTool = executeHealthcareTool;

export async function executeHealthcareTool(
  toolName: string,
  toolInput: Record<string, any>
): Promise<ToolResult> {
  switch (toolName) {
    case 'lookup_icd10': {
      const result = await lookupICD10(toolInput as any);
      return {
        success: !result.error,
        data: result,
        error: result.error,
        source: result.source,
        source_url: result.source_url
      };
    }

    case 'lookup_cpt':
      return await lookupCPT(toolInput as any);

    case 'verify_npi': {
      const result = await verifyNPI(toolInput as any);
      return {
        success: !result.error && result.verified,
        data: result,
        error: result.error,
        source: result.source,
        source_url: result.source_url
      };
    }

    case 'check_drug_interaction':
    case 'check_drug_interactions': {
      const result = await checkDrugInteraction(toolInput as any);
      return {
        success: !result.error,
        data: result,
        error: result.error,
        source: result.source,
        source_url: result.source_url
      };
    }

    case 'get_drug_info':
      return await getDrugInfoFromFDA(toolInput as any);

    case 'search_pubmed': {
      const result = await searchPubMed(toolInput as any);
      return {
        success: !result.error,
        data: result,
        error: result.error,
        source: result.source,
        source_url: result.source_url
      };
    }

    case 'lookup_coverage_policy':
      return await lookupCoveragePolicy(toolInput as any);

    default:
      return {
        success: false,
        error: `Unknown tool: ${toolName}`
      };
  }
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
