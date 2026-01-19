// ICD-10 Code Lookup Tool

export interface ICD10Result {
  code: string;
  description: string;
  type: 'diagnosis' | 'procedure';
}

export interface ICD10Response {
  results: ICD10Result[];
  count: number;
  source: string;
  source_url: string;
  error?: string;
}

export async function lookupICD10(params: {
  search_term?: string;
  code?: string;
  code_type?: 'diagnosis' | 'procedure';
  max_results?: number;
}): Promise<ICD10Response> {
  const { search_term, code, code_type = 'diagnosis', max_results = 10 } = params;

  const results: ICD10Result[] = [];

  try {
    // Search by specific code
    if (code) {
      const url = `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code&terms=${encodeURIComponent(code)}&maxList=${max_results}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data[3] && Array.isArray(data[3])) {
        for (const item of data[3]) {
          results.push({
            code: item[0],
            description: item[1],
            type: code_type,
          });
        }
      }
    }

    // Search by term
    if (search_term) {
      const endpoint = code_type === 'procedure' ? 'icd10pcs' : 'icd10cm';
      const url = `https://clinicaltables.nlm.nih.gov/api/${endpoint}/v3/search?terms=${encodeURIComponent(search_term)}&maxList=${max_results}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data[3] && Array.isArray(data[3])) {
        for (const item of data[3]) {
          results.push({
            code: item[0],
            description: item[1],
            type: code_type,
          });
        }
      }
    }

    return {
      results,
      count: results.length,
      source: 'NLM Clinical Tables API',
      source_url: 'https://clinicaltables.nlm.nih.gov/',
    };
  } catch (error) {
    return {
      results: [],
      count: 0,
      source: 'NLM Clinical Tables API',
      source_url: 'https://clinicaltables.nlm.nih.gov/',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
