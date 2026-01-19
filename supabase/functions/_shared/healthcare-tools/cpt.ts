// CPT/HCPCS Lookup - NLM Clinical Tables API

import { ToolResult } from './index.ts';

const NLM_HCPCS = 'https://clinicaltables.nlm.nih.gov/api/hcpcs/v3/search';

export async function lookupCPT(params: {
  search_term?: string;
  code?: string;
}): Promise<ToolResult> {
  const { search_term, code } = params;

  if (!search_term && !code) {
    return { success: false, error: 'Either search_term or code required' };
  }

  try {
    const url = new URL(NLM_HCPCS);
    url.searchParams.set('sf', 'code,display');
    url.searchParams.set('terms', code || search_term || '');
    url.searchParams.set('maxList', '20');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`NLM HCPCS API error: ${response.status}`);
    }

    const data = await response.json();

    const results: Array<{ code: string; description: string }> = [];

    if (data[3] && Array.isArray(data[3])) {
      for (const item of data[3]) {
        if (Array.isArray(item) && item.length >= 2) {
          results.push({
            code: item[0],
            description: item[1]
          });
        }
      }
    }

    return {
      success: true,
      data: {
        results,
        count: results.length,
        query: code || search_term
      },
      source: 'NLM HCPCS Clinical Tables',
      source_url: 'https://clinicaltables.nlm.nih.gov/',
      note: 'CPT codes are copyrighted by AMA. This returns HCPCS Level II codes.'
    };

  } catch (error) {
    return {
      success: false,
      error: String(error),
      source: 'NLM HCPCS'
    };
  }
}
