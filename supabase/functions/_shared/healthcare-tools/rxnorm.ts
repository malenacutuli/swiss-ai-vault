// RxNorm Drug Interaction Tool

export interface DrugInfo {
  rxcui: string;
  name: string;
  synonym?: string;
  tty?: string;
}

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity?: string;
  description: string;
  source: string;
}

export interface RxNormResponse {
  drugs: DrugInfo[];
  interactions: DrugInteraction[];
  count: number;
  source: string;
  source_url: string;
  error?: string;
}

async function getRxCUI(drugName: string): Promise<string | null> {
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(drugName)}`;
    const response = await fetch(url);
    const data = await response.json();
    return data?.idGroup?.rxnormId?.[0] || null;
  } catch {
    return null;
  }
}

async function getDrugInfo(rxcui: string): Promise<DrugInfo | null> {
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`;
    const response = await fetch(url);
    const data = await response.json();
    const props = data?.properties;
    if (props) {
      return {
        rxcui: props.rxcui,
        name: props.name,
        synonym: props.synonym,
        tty: props.tty,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Alias for compatibility
export const checkDrugInteractions = checkDrugInteraction;

export async function checkDrugInteraction(params: {
  drugs?: string[];
  drug_name?: string;
}): Promise<RxNormResponse> {
  const { drugs, drug_name } = params;

  const drugList = drugs || (drug_name ? [drug_name] : []);

  if (drugList.length === 0) {
    return {
      drugs: [],
      interactions: [],
      count: 0,
      source: 'RxNav',
      source_url: 'https://rxnav.nlm.nih.gov/',
      error: 'At least one drug name is required',
    };
  }

  try {
    // Get RxCUIs for all drugs
    const rxcuis: string[] = [];
    const drugInfos: DrugInfo[] = [];

    for (const drugName of drugList) {
      const rxcui = await getRxCUI(drugName);
      if (rxcui) {
        rxcuis.push(rxcui);
        const info = await getDrugInfo(rxcui);
        if (info) {
          drugInfos.push(info);
        }
      }
    }

    // Check interactions if we have 2+ drugs
    const interactions: DrugInteraction[] = [];

    if (rxcuis.length >= 2) {
      const interactionUrl = `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${rxcuis.join('+')}`;
      const response = await fetch(interactionUrl);
      const data = await response.json();

      const interactionGroups = data?.fullInteractionTypeGroup || [];
      for (const group of interactionGroups) {
        for (const interactionType of group.fullInteractionType || []) {
          for (const pair of interactionType.interactionPair || []) {
            const concepts = pair.interactionConcept || [];
            if (concepts.length >= 2) {
              interactions.push({
                drug1: concepts[0]?.minConceptItem?.name || 'Unknown',
                drug2: concepts[1]?.minConceptItem?.name || 'Unknown',
                severity: pair.severity,
                description: pair.description || 'Interaction detected',
                source: group.sourceName || 'RxNav',
              });
            }
          }
        }
      }
    }

    return {
      drugs: drugInfos,
      interactions,
      count: interactions.length,
      source: 'RxNav',
      source_url: 'https://rxnav.nlm.nih.gov/',
    };
  } catch (error) {
    return {
      drugs: [],
      interactions: [],
      count: 0,
      source: 'RxNav',
      source_url: 'https://rxnav.nlm.nih.gov/',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// OpenFDA Drug Info Lookup
const FDA_API = 'https://api.fda.gov/drug/label.json';

export interface FDADrugInfo {
  success: boolean;
  data?: {
    brand_name?: string;
    generic_name?: string;
    manufacturer?: string;
    route?: string;
    indications?: string;
    contraindications?: string;
    warnings?: string;
    boxed_warning?: string;
  };
  error?: string;
  source: string;
  source_url: string;
}

export async function getDrugInfoFromFDA(params: {
  drug_name: string;
}): Promise<FDADrugInfo> {
  const { drug_name } = params;

  if (!drug_name) {
    return {
      success: false,
      error: 'drug_name is required',
      source: 'OpenFDA',
      source_url: 'https://open.fda.gov/'
    };
  }

  try {
    const query = `openfda.brand_name:"${drug_name}"+OR+openfda.generic_name:"${drug_name}"`;
    const url = `${FDA_API}?search=${encodeURIComponent(query)}&limit=1`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return {
        success: false,
        error: 'Drug not found in FDA database',
        source: 'OpenFDA',
        source_url: 'https://open.fda.gov/'
      };
    }

    const drug = data.results[0];
    const openfda = drug.openfda || {};

    return {
      success: true,
      data: {
        brand_name: openfda.brand_name?.[0],
        generic_name: openfda.generic_name?.[0],
        manufacturer: openfda.manufacturer_name?.[0],
        route: openfda.route?.[0],
        indications: drug.indications_and_usage?.[0]?.slice(0, 500),
        contraindications: drug.contraindications?.[0]?.slice(0, 500),
        warnings: drug.warnings?.[0]?.slice(0, 500),
        boxed_warning: drug.boxed_warning?.[0]?.slice(0, 500)
      },
      source: 'OpenFDA Drug Labels',
      source_url: 'https://open.fda.gov/'
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'OpenFDA',
      source_url: 'https://open.fda.gov/'
    };
  }
}
