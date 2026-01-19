// NPI Provider Verification Tool

export interface NPIProvider {
  npi: string;
  name: string;
  credential?: string;
  specialty?: string;
  taxonomy_code?: string;
  state?: string;
  license?: string;
  status: string;
  address: {
    line1?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
}

export interface NPIResponse {
  results: NPIProvider[];
  count: number;
  verified: boolean;
  source: string;
  source_url: string;
  error?: string;
}

export async function verifyNPI(params: {
  npi?: string;
  provider_name?: string;
  state?: string;
}): Promise<NPIResponse> {
  const { npi, provider_name, state } = params;

  const baseUrl = 'https://npiregistry.cms.hhs.gov/api/';
  const searchParams = new URLSearchParams({ version: '2.1' });

  if (npi) {
    searchParams.set('number', npi);
  } else if (provider_name) {
    const nameParts = provider_name.split(' ');
    if (nameParts.length >= 2) {
      searchParams.set('first_name', nameParts[0]);
      searchParams.set('last_name', nameParts[nameParts.length - 1]);
    } else {
      searchParams.set('last_name', provider_name);
    }
    if (state) {
      searchParams.set('state', state);
    }
  } else {
    return {
      results: [],
      count: 0,
      verified: false,
      source: 'NPPES NPI Registry',
      source_url: 'https://npiregistry.cms.hhs.gov/',
      error: 'Either npi or provider_name is required',
    };
  }

  try {
    const response = await fetch(`${baseUrl}?${searchParams.toString()}`);
    const data = await response.json();

    const results: NPIProvider[] = [];

    for (const provider of data.results || []) {
      const basic = provider.basic || {};
      const addresses = provider.addresses || [];
      const taxonomies = provider.taxonomies || [];

      const primaryTaxonomy = taxonomies.find((t: any) => t.primary) || taxonomies[0] || {};
      const practiceAddress = addresses.find((a: any) => a.address_purpose === 'LOCATION') || addresses[0] || {};

      results.push({
        npi: provider.number,
        name: `${basic.first_name || ''} ${basic.last_name || ''}`.trim(),
        credential: basic.credential,
        specialty: primaryTaxonomy.desc,
        taxonomy_code: primaryTaxonomy.code,
        state: primaryTaxonomy.state,
        license: primaryTaxonomy.license,
        status: provider.number ? 'Active' : 'Unknown',
        address: {
          line1: practiceAddress.address_1,
          city: practiceAddress.city,
          state: practiceAddress.state,
          zip: practiceAddress.postal_code,
        },
      });
    }

    return {
      results,
      count: results.length,
      verified: results.length > 0,
      source: 'NPPES NPI Registry',
      source_url: 'https://npiregistry.cms.hhs.gov/',
    };
  } catch (error) {
    return {
      results: [],
      count: 0,
      verified: false,
      source: 'NPPES NPI Registry',
      source_url: 'https://npiregistry.cms.hhs.gov/',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
