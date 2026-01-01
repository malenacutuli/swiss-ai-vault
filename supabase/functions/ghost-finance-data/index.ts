import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface FinanceDataRequest {
  type: 'predictions' | 'earnings' | 'crypto' | 'markets' | 'watchlist' | 'screener';
  region?: string;
  language?: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  ja: 'Japanese',
  ru: 'Russian',
  ca: 'Catalan',
};

// Get current date in ISO format for consistent date handling
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Get current year for validation
function getCurrentYear(): number {
  return new Date().getFullYear();
}

async function fetchWithAI(prompt: string, language: string = 'en') {
  const currentDate = getCurrentDate();
  const currentYear = getCurrentYear();
  const languageName = LANGUAGE_NAMES[language] || 'English';
  const languageInstruction = language !== 'en' 
    ? `IMPORTANT: You MUST respond entirely in ${languageName}. All text, descriptions, and explanations must be in ${languageName}.`
    : '';

  const dateValidationInstruction = `CRITICAL: Today's date is ${currentDate}. The current year is ${currentYear}. 
You MUST provide ONLY current, real-time data. Do NOT return any mock data, placeholder data, or historical data from previous years (2024, 2025, etc.). 
All dates in your response must be from ${currentYear} or later. If you cannot fetch real-time data, indicate this clearly rather than providing outdated information.`;

  // Try Perplexity first for real-time web data
  if (PERPLEXITY_API_KEY) {
    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            { 
              role: 'system', 
              content: `You are a financial data assistant providing LIVE, REAL-TIME market data. ${dateValidationInstruction} ${languageInstruction} Always return data in the exact JSON format requested. Never use mock or sample data.`
            },
            { role: 'user', content: prompt }
          ],
          search_recency_filter: 'day',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          content: data.choices[0].message.content,
          citations: data.citations || [],
          source: 'perplexity'
        };
      }
    } catch (error) {
      console.error('Perplexity API error:', error);
    }
  }

  // Fallback to Lovable AI
  if (LOVABLE_API_KEY) {
    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { 
              role: 'system', 
              content: `You are a financial data assistant. ${dateValidationInstruction} ${languageInstruction} Provide realistic market data based on current ${currentYear} market conditions. Always return data in the exact JSON format requested. All prices and data must reflect current market values.`
            },
            { role: 'user', content: prompt }
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          content: data.choices[0].message.content,
          citations: [],
          source: 'lovable-ai'
        };
      }
    } catch (error) {
      console.error('Lovable AI error:', error);
    }
  }

  throw new Error('No AI service available');
}

function parseJSONFromResponse(content: string): any {
  // Try to extract JSON from markdown code blocks or raw JSON
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || 
                    content.match(/(\{[\s\S]*\})/) ||
                    content.match(/(\[[\s\S]*\])/);
  
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch (e) {
      console.error('JSON parse error:', e);
    }
  }
  
  // Try parsing the entire content
  try {
    return JSON.parse(content);
  } catch (e) {
    console.error('Failed to parse JSON:', content);
    return null;
  }
}

async function getPredictionMarkets(language: string) {
  const currentDate = getCurrentDate();
  const currentYear = getCurrentYear();
  
  const prompt = `Get the top 4 CURRENT prediction markets from Polymarket and Kalshi as of ${currentDate}.

IMPORTANT: Only return markets that are currently active in ${currentYear}. Do NOT include any historical or closed markets.

Return JSON array with this exact structure:
[
  {
    "question": "Question text",
    "category": "Category (Economics, Crypto, Markets, Earnings, Politics)",
    "volume": "$XXM",
    "options": [
      { "label": "Option name", "probability": 85 }
    ],
    "source": "Polymarket or Kalshi"
  }
]

Focus on major financial, economic, and market predictions that are currently active today (${currentDate}). Include current probability percentages from live markets.`;

  const result = await fetchWithAI(prompt, language);
  const data = parseJSONFromResponse(result.content);
  
  return {
    data: data || [],
    citations: result.citations,
    source: result.source,
    lastUpdated: new Date().toISOString()
  };
}

async function getEarningsCalendar(language: string) {
  const today = new Date();
  const currentDate = getCurrentDate();
  const currentYear = getCurrentYear();
  const nextWeek = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  
  const prompt = `Get upcoming earnings reports for major companies in the next 2 weeks starting from TODAY ${currentDate} to ${nextWeek.toISOString().split('T')[0]}.

CRITICAL: Today is ${currentDate}. All dates must be in ${currentYear}. Do NOT provide any dates from 2024 or 2025.

Also include 2-3 recent earnings that happened within the last 7 days (after ${new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}).

Return JSON with this exact structure:
{
  "upcoming": [
    {
      "company": "Company Name",
      "symbol": "TICKER",
      "date": "January XX, ${currentYear}",
      "time": "afterClose or beforeOpen",
      "estimate": "$X.XX"
    }
  ],
  "recent": [
    {
      "company": "Company Name",
      "symbol": "TICKER", 
      "date": "December XX, ${currentYear - 1} or January XX, ${currentYear}",
      "time": "afterClose or beforeOpen",
      "estimate": "$X.XX",
      "actual": "$X.XX"
    }
  ]
}

Focus on major tech, financial, and consumer companies with actual scheduled earnings dates.`;

  const result = await fetchWithAI(prompt, language);
  const data = parseJSONFromResponse(result.content);
  
  return {
    data: data || { upcoming: [], recent: [] },
    citations: result.citations,
    source: result.source,
    lastUpdated: new Date().toISOString()
  };
}

async function getCryptoMarkets(language: string) {
  const currentDate = getCurrentDate();
  
  const prompt = `Get CURRENT LIVE prices and 24h changes for top 6 cryptocurrencies (BTC, ETH, SOL, BNB, XRP, ADA) as of right now (${currentDate}).

CRITICAL: Provide REAL-TIME market prices, not historical or mock data. These should reflect today's actual trading prices.

Return JSON array with this exact structure:
[
  {
    "symbol": "BTC",
    "name": "Bitcoin",
    "price": 95000.50,
    "change": -1245.30,
    "changePercent": -1.30,
    "marketCap": "$1.87T"
  }
]

Use current real market prices from today (${currentDate}).`;

  const result = await fetchWithAI(prompt, language);
  const data = parseJSONFromResponse(result.content);
  
  return {
    data: data || [],
    citations: result.citations,
    source: result.source,
    lastUpdated: new Date().toISOString()
  };
}

async function getRegionalMarkets(region: string, language: string) {
  const currentDate = getCurrentDate();
  const currentYear = getCurrentYear();
  
  const regionPrompts: Record<string, string> = {
    us: 'US stock market indices: S&P 500, Dow Jones, Nasdaq, Russell 2000',
    europe: 'European stock market indices: DAX, CAC 40, FTSE 100, Euro Stoxx 50',
    asia: 'Asian stock market indices: Nikkei 225, Hang Seng, Shanghai Composite, KOSPI',
    swiss: 'Swiss market: SMI index, Nestlé, Novartis, UBS',
    mena: 'MENA stock market indices: Saudi Tadawul, Dubai DFM, Abu Dhabi ADX, Qatar QSE',
    latam: 'Latin American stock market indices: Brazil Bovespa, Mexico IPC, Argentina Merval, Chile IPSA'
  };

  const regionDesc = regionPrompts[region] || regionPrompts.us;
  
  const prompt = `Get CURRENT LIVE market data for ${regionDesc} as of today (${currentDate}).

CRITICAL: Provide REAL-TIME market values from today's trading session. Do NOT use historical data from 2024 or 2025. Current year is ${currentYear}.

Return JSON with this structure:
{
  "markets": [
    {
      "symbol": "INDEX_SYMBOL",
      "name": "Index Name",
      "price": 12345.67,
      "change": 123.45,
      "changePercent": 1.02
    }
  ],
  "summary": "Brief 2-3 sentence market summary explaining today's (${currentDate}) performance and key drivers."
}

Use current real market values from today's session and provide an accurate summary of today's market conditions.`;

  const result = await fetchWithAI(prompt, language);
  const data = parseJSONFromResponse(result.content);
  
  return {
    data: data || { markets: [], summary: '' },
    citations: result.citations,
    source: result.source,
    lastUpdated: new Date().toISOString()
  };
}

async function getStockScreener(language: string) {
  const currentDate = getCurrentDate();
  const currentYear = getCurrentYear();
  
  const prompt = `Get CURRENT stock data for 6 major stocks across technology, healthcare, and finance sectors as of today (${currentDate}).

CRITICAL: Provide REAL-TIME stock prices from today's market. Do NOT use historical data from 2024 or 2025. Current year is ${currentYear}.

Return JSON array with this exact structure:
[
  {
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "price": 190.53,
    "change": 1.02,
    "marketCap": "$2.95T",
    "pe": 28.4,
    "dividend": 0.52,
    "sector": "technology"
  }
]

Include: AAPL, MSFT, NVDA, JNJ, JPM, V with current real-time data from today's trading.`;

  const result = await fetchWithAI(prompt, language);
  const data = parseJSONFromResponse(result.content);
  
  return {
    data: data || [],
    citations: result.citations,
    source: result.source,
    lastUpdated: new Date().toISOString()
  };
}

async function getWatchlistData(language: string) {
  const currentDate = getCurrentDate();
  const currentYear = getCurrentYear();
  
  const prompt = `Get CURRENT LIVE stock prices for popular watchlist stocks: TSLA, NVDA, META, GOOGL, AAPL, AMZN as of right now (${currentDate}).

CRITICAL: Provide REAL-TIME market prices from today's trading session. Do NOT use historical data from 2024 or 2025. Current year is ${currentYear}.

Return JSON array with this exact structure:
[
  {
    "symbol": "TSLA",
    "name": "Tesla, Inc.",
    "price": 475.19,
    "change": -10.23,
    "changePercent": -2.10
  }
]

Use current real market prices from today's live trading.`;

  const result = await fetchWithAI(prompt, language);
  const data = parseJSONFromResponse(result.content);
  
  return {
    data: data || [],
    citations: result.citations,
    source: result.source,
    lastUpdated: new Date().toISOString()
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, region = 'us', language = 'en' }: FinanceDataRequest = await req.json();

    console.log(`[ghost-finance-data] Fetching ${type} data for region: ${region}, language: ${language}, date: ${getCurrentDate()}`);

    let result;

    switch (type) {
      case 'predictions':
        result = await getPredictionMarkets(language);
        break;
      case 'earnings':
        result = await getEarningsCalendar(language);
        break;
      case 'crypto':
        result = await getCryptoMarkets(language);
        break;
      case 'markets':
        result = await getRegionalMarkets(region, language);
        break;
      case 'screener':
        result = await getStockScreener(language);
        break;
      case 'watchlist':
        result = await getWatchlistData(language);
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`[ghost-finance-data] Successfully fetched ${type} data from ${result.source}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ghost-finance-data] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        data: null 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
