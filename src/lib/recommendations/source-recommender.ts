/**
 * Smart Source Recommendation Engine
 * 
 * Analyzes user's research patterns to suggest:
 * - Related sources they might have missed
 * - Topics to explore based on their interests
 * - Higher-quality alternatives to saved sources
 * - Research gaps in their knowledge base
 */

import type { WebSource } from '@/lib/trust/verified-search';

export interface UserResearchProfile {
  topics: {
    name: string;
    weight: number;
    lastActive: number;
    sourceCount: number;
  }[];
  
  preferredDomains: {
    domain: string;
    count: number;
    avgTrustScore: number;
  }[];
  
  sourcePreferences: {
    government: number;
    academic: number;
    news: number;
    reference: number;
    other: number;
  };
  
  patterns: {
    avgSourcesPerSession: number;
    prefersPeerReviewed: boolean;
    topKeywords: string[];
    activeHours: number[];
    researchFrequency: 'daily' | 'weekly' | 'occasional';
  };
  
  gaps: {
    topic: string;
    mentionCount: number;
    savedCount: number;
    suggestedSearches: string[];
  }[];
}

export interface SourceRecommendation {
  id: string;
  type: 'related' | 'higher-quality' | 'gap-fill' | 'trending' | 'deep-dive';
  title: string;
  description: string;
  suggestedQuery: string;
  relevanceScore: number;
  basedOn: string;
  priority: 'high' | 'medium' | 'low';
  domains?: string[];
  keywords?: string[];
}

export interface TopicSuggestion {
  topic: string;
  reason: string;
  relatedToExisting: string[];
  searchQueries: string[];
  estimatedSources: number;
}

export interface ResearchGap {
  topic: string;
  description: string;
  currentCoverage: 'none' | 'minimal' | 'partial';
  importance: 'high' | 'medium' | 'low';
  suggestedActions: string[];
  suggestedSearches: string[];
}

const TOPIC_PATTERNS: Record<string, RegExp[]> = {
  'artificial-intelligence': [
    /\bAI\b/i, /\bartificial intelligence\b/i, /\bmachine learning\b/i,
    /\bneural network\b/i, /\bdeep learning\b/i, /\bGPT\b/i, /\bLLM\b/i
  ],
  'finance': [
    /\binvestment\b/i, /\bstock\b/i, /\bportfolio\b/i, /\bmarket\b/i,
    /\btrading\b/i, /\bhedge fund\b/i, /\basset\b/i, /\bequity\b/i
  ],
  'legal': [
    /\blaw\b/i, /\blegal\b/i, /\bregulation\b/i, /\bcompliance\b/i,
    /\bcontract\b/i, /\blitigation\b/i, /\bcourt\b/i, /\bstatute\b/i
  ],
  'healthcare': [
    /\bmedical\b/i, /\bhealth\b/i, /\bpatient\b/i, /\bclinical\b/i,
    /\btreatment\b/i, /\bdrug\b/i, /\btherapy\b/i, /\bdiagnosis\b/i
  ],
  'technology': [
    /\bsoftware\b/i, /\bcloud\b/i, /\bcybersecurity\b/i, /\bdata\b/i,
    /\bAPI\b/i, /\binfrastructure\b/i, /\bdevops\b/i, /\bblockchain\b/i
  ],
  'privacy': [
    /\bprivacy\b/i, /\bGDPR\b/i, /\bdata protection\b/i, /\bencryption\b/i,
    /\bconsent\b/i, /\bPII\b/i, /\banonymization\b/i
  ],
  'business': [
    /\bstrategy\b/i, /\bmanagement\b/i, /\bstartup\b/i, /\bfunding\b/i,
    /\bM&A\b/i, /\bvaluation\b/i, /\bgrowth\b/i
  ],
  'science': [
    /\bresearch\b/i, /\bstudy\b/i, /\bexperiment\b/i, /\bhypothesis\b/i,
    /\bpeer.?review\b/i, /\bjournal\b/i, /\bscientific\b/i
  ]
};

const RELATED_TOPICS: Record<string, string[]> = {
  'artificial-intelligence': ['technology', 'privacy', 'business', 'science'],
  'finance': ['legal', 'business', 'technology'],
  'legal': ['finance', 'privacy', 'business'],
  'healthcare': ['legal', 'science', 'technology', 'privacy'],
  'technology': ['artificial-intelligence', 'privacy', 'business'],
  'privacy': ['legal', 'technology', 'healthcare'],
  'business': ['finance', 'legal', 'technology'],
  'science': ['healthcare', 'artificial-intelligence', 'technology']
};

const AUTHORITATIVE_DOMAINS_BY_TOPIC: Record<string, string[]> = {
  'artificial-intelligence': [
    'arxiv.org', 'openai.com', 'deepmind.com', 'ai.google', 
    'research.microsoft.com', 'papers.nips.cc'
  ],
  'finance': [
    'sec.gov', 'federalreserve.gov', 'imf.org', 'worldbank.org',
    'bis.org', 'finra.org', 'investor.gov'
  ],
  'legal': [
    'law.cornell.edu', 'supremecourt.gov', 'uscourts.gov',
    'justice.gov', 'courtlistener.com', 'justia.com'
  ],
  'healthcare': [
    'nih.gov', 'cdc.gov', 'who.int', 'fda.gov',
    'pubmed.ncbi.nlm.nih.gov', 'cochranelibrary.com'
  ],
  'technology': [
    'nist.gov', 'cisa.gov', 'w3.org', 'ietf.org',
    'acm.org', 'ieee.org'
  ],
  'privacy': [
    'edpb.europa.eu', 'ico.org.uk', 'iapp.org',
    'privacyinternational.org', 'eff.org'
  ],
  'business': [
    'hbr.org', 'mckinsey.com', 'bcg.com', 'bain.com',
    'economist.com', 'ft.com'
  ],
  'science': [
    'nature.com', 'science.org', 'pnas.org', 'cell.com',
    'sciencedirect.com', 'springer.com'
  ]
};

export function extractTopics(text: string): string[] {
  const foundTopics: string[] = [];
  
  for (const [topic, patterns] of Object.entries(TOPIC_PATTERNS)) {
    const matches = patterns.filter(p => p.test(text)).length;
    if (matches >= 1) {
      foundTopics.push(topic);
    }
  }
  
  return foundTopics;
}

function generateTopicSearches(topic: string): string[] {
  const baseSearches: Record<string, string[]> = {
    'artificial-intelligence': [
      'AI regulation 2024',
      'machine learning best practices',
      'AI safety guidelines',
      'enterprise AI implementation'
    ],
    'finance': [
      'financial regulation updates',
      'investment compliance requirements',
      'market analysis methodology',
      'portfolio risk management'
    ],
    'legal': [
      'legal compliance checklist',
      'contract law fundamentals',
      'regulatory updates',
      'litigation best practices'
    ],
    'healthcare': [
      'clinical guidelines update',
      'healthcare compliance HIPAA',
      'medical research methodology',
      'patient data protection'
    ],
    'technology': [
      'cybersecurity best practices',
      'cloud architecture guidelines',
      'software development standards',
      'technology compliance frameworks'
    ],
    'privacy': [
      'GDPR compliance guide',
      'data protection requirements',
      'privacy by design principles',
      'consent management best practices'
    ],
    'business': [
      'business strategy frameworks',
      'market analysis methods',
      'startup best practices',
      'business valuation guide'
    ],
    'science': [
      'research methodology standards',
      'peer review process',
      'scientific writing guidelines',
      'data analysis best practices'
    ]
  };
  
  return baseSearches[topic] || [
    `${topic} best practices`,
    `${topic} guidelines`,
    `${topic} research`
  ];
}

export function buildResearchProfile(
  sources: Array<{
    title: string;
    domain: string;
    trustScore: number;
    savedAt: number;
    tags?: string[];
    isGovernment?: boolean;
    isAcademic?: boolean;
    isPeerReviewed?: boolean;
  }>,
  sessions: Array<{
    query: string;
    createdAt: number;
    sources: string[];
  }>
): UserResearchProfile {
  const topicCounts: Record<string, { count: number; lastActive: number }> = {};
  
  for (const session of sessions) {
    const topics = extractTopics(session.query);
    for (const topic of topics) {
      if (!topicCounts[topic]) {
        topicCounts[topic] = { count: 0, lastActive: 0 };
      }
      topicCounts[topic].count++;
      topicCounts[topic].lastActive = Math.max(
        topicCounts[topic].lastActive,
        session.createdAt
      );
    }
  }
  
  for (const source of sources) {
    const topics = extractTopics(source.title + ' ' + (source.tags?.join(' ') || ''));
    for (const topic of topics) {
      if (!topicCounts[topic]) {
        topicCounts[topic] = { count: 0, lastActive: 0 };
      }
      topicCounts[topic].count++;
      topicCounts[topic].lastActive = Math.max(
        topicCounts[topic].lastActive,
        source.savedAt
      );
    }
  }
  
  const maxCount = Math.max(...Object.values(topicCounts).map(t => t.count), 1);
  const topics = Object.entries(topicCounts)
    .map(([name, data]) => ({
      name,
      weight: data.count / maxCount,
      lastActive: data.lastActive,
      sourceCount: data.count
    }))
    .sort((a, b) => b.weight - a.weight);
  
  const domainStats: Record<string, { count: number; totalTrust: number }> = {};
  for (const source of sources) {
    if (!domainStats[source.domain]) {
      domainStats[source.domain] = { count: 0, totalTrust: 0 };
    }
    domainStats[source.domain].count++;
    domainStats[source.domain].totalTrust += source.trustScore;
  }
  
  const preferredDomains = Object.entries(domainStats)
    .map(([domain, stats]) => ({
      domain,
      count: stats.count,
      avgTrustScore: stats.totalTrust / stats.count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  const totalSources = sources.length || 1;
  const sourcePreferences = {
    government: (sources.filter(s => s.isGovernment).length / totalSources) * 100,
    academic: (sources.filter(s => s.isAcademic).length / totalSources) * 100,
    news: 0,
    reference: 0,
    other: 0
  };
  sourcePreferences.other = 100 - sourcePreferences.government - sourcePreferences.academic;
  
  const avgSourcesPerSession = sessions.length > 0
    ? sessions.reduce((sum, s) => sum + s.sources.length, 0) / sessions.length
    : 0;
  
  const prefersPeerReviewed = sources.filter(s => s.isPeerReviewed).length > sources.length * 0.3;
  
  const allQueries = sessions.map(s => s.query).join(' ');
  const words = allQueries.toLowerCase().split(/\s+/);
  const wordCounts: Record<string, number> = {};
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when', 'where', 'who']);
  
  for (const word of words) {
    if (word.length > 3 && !stopWords.has(word)) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  }
  
  const topKeywords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
  
  const now = Date.now();
  const recentSessions = sessions.filter(s => s.createdAt > now - 7 * 24 * 60 * 60 * 1000);
  let researchFrequency: 'daily' | 'weekly' | 'occasional' = 'occasional';
  if (recentSessions.length >= 7) researchFrequency = 'daily';
  else if (recentSessions.length >= 2) researchFrequency = 'weekly';
  
  const gaps: UserResearchProfile['gaps'] = [];
  for (const [topic] of Object.entries(topicCounts)) {
    const mentionCount = sessions.filter(s => extractTopics(s.query).includes(topic)).length;
    const savedCount = sources.filter(s => 
      extractTopics(s.title + ' ' + (s.tags?.join(' ') || '')).includes(topic)
    ).length;
    
    if (mentionCount > savedCount * 2 && savedCount < 5) {
      gaps.push({
        topic,
        mentionCount,
        savedCount,
        suggestedSearches: generateTopicSearches(topic)
      });
    }
  }
  
  return {
    topics,
    preferredDomains,
    sourcePreferences,
    patterns: {
      avgSourcesPerSession,
      prefersPeerReviewed,
      topKeywords,
      activeHours: [],
      researchFrequency
    },
    gaps: gaps.slice(0, 5)
  };
}

function formatTopicName(topic: string): string {
  return topic
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function generateRecommendations(
  profile: UserResearchProfile,
  currentSources: Array<{ domain: string; title: string; trustScore: number }>
): SourceRecommendation[] {
  const recommendations: SourceRecommendation[] = [];
  
  for (const topic of profile.topics.slice(0, 3)) {
    const relatedTopics = RELATED_TOPICS[topic.name] || [];
    
    for (const relatedTopic of relatedTopics.slice(0, 2)) {
      const existingCoverage = profile.topics.find(t => t.name === relatedTopic);
      
      if (!existingCoverage || existingCoverage.weight < 0.3) {
        const domains = AUTHORITATIVE_DOMAINS_BY_TOPIC[relatedTopic] || [];
        
        recommendations.push({
          id: `related-${topic.name}-${relatedTopic}`,
          type: 'related',
          title: `Explore ${formatTopicName(relatedTopic)}`,
          description: `Based on your interest in ${formatTopicName(topic.name)}, you might find ${formatTopicName(relatedTopic)} research valuable.`,
          suggestedQuery: generateTopicSearches(relatedTopic)[0],
          relevanceScore: Math.round(topic.weight * 70),
          basedOn: `Your ${formatTopicName(topic.name)} research`,
          priority: topic.weight > 0.5 ? 'high' : 'medium',
          domains: domains.slice(0, 3),
          keywords: [relatedTopic.replace('-', ' ')]
        });
      }
    }
  }
  
  const lowTrustSources = currentSources.filter(s => s.trustScore < 60);
  if (lowTrustSources.length > 0) {
    const topTopics = profile.topics.slice(0, 2).map(t => t.name);
    
    for (const topic of topTopics) {
      const authoritativeDomains = AUTHORITATIVE_DOMAINS_BY_TOPIC[topic] || [];
      const userDomains = new Set(currentSources.map(s => s.domain));
      const missingDomains = authoritativeDomains.filter(d => !userDomains.has(d));
      
      if (missingDomains.length > 0) {
        recommendations.push({
          id: `quality-${topic}`,
          type: 'higher-quality',
          title: `Authoritative ${formatTopicName(topic)} Sources`,
          description: `Enhance your ${formatTopicName(topic)} research with official government and academic sources.`,
          suggestedQuery: `${topic.replace('-', ' ')} site:${missingDomains[0]}`,
          relevanceScore: 85,
          basedOn: 'Your source quality analysis',
          priority: 'high',
          domains: missingDomains.slice(0, 3)
        });
      }
    }
  }
  
  for (const gap of profile.gaps) {
    const domains = AUTHORITATIVE_DOMAINS_BY_TOPIC[gap.topic] || [];
    
    recommendations.push({
      id: `gap-${gap.topic}`,
      type: 'gap-fill',
      title: `Complete Your ${formatTopicName(gap.topic)} Knowledge`,
      description: `You've researched ${formatTopicName(gap.topic)} ${gap.mentionCount} times but only saved ${gap.savedCount} sources.`,
      suggestedQuery: gap.suggestedSearches[0],
      relevanceScore: Math.min(95, 60 + gap.mentionCount * 5),
      basedOn: 'Research gap analysis',
      priority: gap.mentionCount > 5 ? 'high' : 'medium',
      domains: domains.slice(0, 3),
      keywords: gap.suggestedSearches.slice(0, 3)
    });
  }
  
  if (profile.topics.length > 0) {
    const topTopic = profile.topics[0];
    const domains = AUTHORITATIVE_DOMAINS_BY_TOPIC[topTopic.name] || [];
    
    recommendations.push({
      id: `deep-dive-${topTopic.name}`,
      type: 'deep-dive',
      title: `Deep Dive: Advanced ${formatTopicName(topTopic.name)}`,
      description: `You have ${topTopic.sourceCount} sources on ${formatTopicName(topTopic.name)}. Ready for advanced research?`,
      suggestedQuery: `${topTopic.name.replace('-', ' ')} advanced research methodology`,
      relevanceScore: 75,
      basedOn: 'Your top research area',
      priority: 'medium',
      domains,
      keywords: [`advanced ${topTopic.name}`, `${topTopic.name} methodology`]
    });
  }
  
  return recommendations
    .sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.relevanceScore - a.relevanceScore;
    })
    .slice(0, 10);
}

export function generateTopicSuggestions(
  profile: UserResearchProfile
): TopicSuggestion[] {
  const suggestions: TopicSuggestion[] = [];
  const existingTopics = new Set(profile.topics.map(t => t.name));
  
  for (const topic of profile.topics.slice(0, 5)) {
    const related = RELATED_TOPICS[topic.name] || [];
    
    for (const relatedTopic of related) {
      if (!existingTopics.has(relatedTopic)) {
        existingTopics.add(relatedTopic);
        
        suggestions.push({
          topic: formatTopicName(relatedTopic),
          reason: `Complements your ${formatTopicName(topic.name)} research`,
          relatedToExisting: [formatTopicName(topic.name)],
          searchQueries: generateTopicSearches(relatedTopic),
          estimatedSources: 50
        });
      }
    }
  }
  
  return suggestions.slice(0, 5);
}

export function analyzeResearchGaps(
  profile: UserResearchProfile,
  sources: Array<{ domain: string; isGovernment?: boolean; isAcademic?: boolean; isPeerReviewed?: boolean }>
): ResearchGap[] {
  const gaps: ResearchGap[] = [];
  
  if (profile.sourcePreferences.government < 20 && profile.topics.some(t => 
    ['legal', 'finance', 'healthcare'].includes(t.name)
  )) {
    gaps.push({
      topic: 'Government Sources',
      description: 'Your research in regulated areas could benefit from more official government sources.',
      currentCoverage: profile.sourcePreferences.government < 5 ? 'none' : 'minimal',
      importance: 'high',
      suggestedActions: [
        'Search government databases directly',
        'Filter for .gov domains',
        'Look for official regulatory guidance'
      ],
      suggestedSearches: [
        'site:gov regulation',
        'official guidance',
        'regulatory requirements'
      ]
    });
  }
  
  if (profile.sourcePreferences.academic < 15 && profile.patterns.prefersPeerReviewed) {
    gaps.push({
      topic: 'Academic Sources',
      description: 'You prefer peer-reviewed content but have few academic sources.',
      currentCoverage: 'minimal',
      importance: 'medium',
      suggestedActions: [
        'Search academic databases',
        'Look for .edu and journal sources',
        'Filter for peer-reviewed articles'
      ],
      suggestedSearches: [
        'site:edu research',
        'peer reviewed study',
        'academic journal'
      ]
    });
  }
  
  for (const gap of profile.gaps) {
    gaps.push({
      topic: formatTopicName(gap.topic),
      description: `You've researched ${formatTopicName(gap.topic)} frequently but saved few authoritative sources.`,
      currentCoverage: gap.savedCount === 0 ? 'none' : gap.savedCount < 3 ? 'minimal' : 'partial',
      importance: gap.mentionCount > 5 ? 'high' : 'medium',
      suggestedActions: [
        `Save more ${formatTopicName(gap.topic)} sources`,
        'Focus on authoritative domains',
        'Create a dedicated research session'
      ],
      suggestedSearches: gap.suggestedSearches
    });
  }
  
  const uniqueDomains = new Set(sources.map(s => s.domain)).size;
  if (uniqueDomains < 5 && sources.length > 10) {
    gaps.push({
      topic: 'Source Diversity',
      description: 'Your sources come from few domains. Diversifying could provide broader perspectives.',
      currentCoverage: 'partial',
      importance: 'low',
      suggestedActions: [
        'Explore different authoritative sources',
        'Compare perspectives across domains',
        'Balance official and expert sources'
      ],
      suggestedSearches: profile.topics.slice(0, 2).map(t => 
        `${t.name.replace('-', ' ')} different perspectives`
      )
    });
  }
  
  return gaps.sort((a, b) => {
    const importanceOrder = { high: 3, medium: 2, low: 1 };
    return importanceOrder[b.importance] - importanceOrder[a.importance];
  });
}

export function getPersonalizedSearchSuggestions(
  profile: UserResearchProfile
): string[] {
  const suggestions: string[] = [];
  
  for (const topic of profile.topics.slice(0, 3)) {
    const searches = generateTopicSearches(topic.name);
    suggestions.push(...searches.slice(0, 2));
  }
  
  for (const gap of profile.gaps.slice(0, 2)) {
    suggestions.push(...gap.suggestedSearches.slice(0, 1));
  }
  
  for (const keyword of profile.patterns.topKeywords.slice(0, 3)) {
    suggestions.push(`${keyword} best practices`);
  }
  
  return [...new Set(suggestions)].slice(0, 10);
}
