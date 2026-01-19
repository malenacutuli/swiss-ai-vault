// PubMed Medical Literature Search Tool

export interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  url: string;
  abstract_available: boolean;
}

export interface PubMedResponse {
  results: PubMedArticle[];
  count: number;
  query: string;
  source: string;
  source_url: string;
  error?: string;
}

export async function searchPubMed(params: {
  query: string;
  max_results?: number;
  date_range?: '1y' | '5y' | '10y' | 'all';
}): Promise<PubMedResponse> {
  const { query, max_results = 5, date_range = '5y' } = params;

  if (!query) {
    return {
      results: [],
      count: 0,
      query: '',
      source: 'PubMed',
      source_url: 'https://pubmed.ncbi.nlm.nih.gov/',
      error: 'Query is required',
    };
  }

  const dateMap: Record<string, number | null> = {
    '1y': 365,
    '5y': 1825,
    '10y': 3650,
    'all': null,
  };
  const reldate = dateMap[date_range];

  try {
    // Step 1: Search for PMIDs
    const searchParams = new URLSearchParams({
      db: 'pubmed',
      term: query,
      retmax: max_results.toString(),
      retmode: 'json',
      sort: 'relevance',
    });

    if (reldate) {
      searchParams.set('reldate', reldate.toString());
      searchParams.set('datetype', 'pdat');
    }

    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams.toString()}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    const pmids = searchData?.esearchresult?.idlist || [];

    if (pmids.length === 0) {
      return {
        results: [],
        count: 0,
        query,
        source: 'PubMed',
        source_url: 'https://pubmed.ncbi.nlm.nih.gov/',
      };
    }

    // Step 2: Fetch summaries
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json`;
    const summaryResponse = await fetch(summaryUrl);
    const summaryData = await summaryResponse.json();

    const results: PubMedArticle[] = [];

    for (const pmid of pmids) {
      const article = summaryData?.result?.[pmid];
      if (!article) continue;

      const authors = article.authors || [];
      let authorStr = authors.slice(0, 3).map((a: any) => a.name).join(', ');
      if (authors.length > 3) {
        authorStr += ' et al.';
      }

      results.push({
        pmid,
        title: article.title || '',
        authors: authorStr,
        journal: article.source || '',
        year: (article.pubdate || '').slice(0, 4),
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        abstract_available: (article.attributes || []).includes('hasabstract'),
      });
    }

    return {
      results,
      count: results.length,
      query,
      source: 'PubMed',
      source_url: 'https://pubmed.ncbi.nlm.nih.gov/',
    };
  } catch (error) {
    return {
      results: [],
      count: 0,
      query,
      source: 'PubMed',
      source_url: 'https://pubmed.ncbi.nlm.nih.gov/',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
