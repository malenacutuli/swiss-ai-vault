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
