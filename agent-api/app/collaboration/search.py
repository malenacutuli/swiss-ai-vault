"""
Search & Discovery Module

Implements search functionality with:
- Full-text search with indexing
- Query parsing with operators (AND, OR, NOT, phrases)
- Faceted search with filters
- Ranking and relevance scoring
- Autocomplete and suggestions
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
import re
import time
import math
from collections import defaultdict


# ==================== Enums ====================

class SearchableType(Enum):
    """Types of searchable content."""
    DOCUMENT = "document"
    COMMENT = "comment"
    TASK = "task"
    USER = "user"
    ACTIVITY = "activity"
    FILE = "file"
    MESSAGE = "message"


class QueryOperator(Enum):
    """Query operators."""
    AND = "and"
    OR = "or"
    NOT = "not"
    PHRASE = "phrase"
    WILDCARD = "wildcard"
    FUZZY = "fuzzy"


class SortOrder(Enum):
    """Sort order options."""
    RELEVANCE = "relevance"
    DATE_DESC = "date_desc"
    DATE_ASC = "date_asc"
    ALPHABETICAL = "alphabetical"
    POPULARITY = "popularity"


class SearchScope(Enum):
    """Search scope options."""
    ALL = "all"
    TITLE = "title"
    CONTENT = "content"
    TAGS = "tags"
    METADATA = "metadata"


# ==================== Data Classes ====================

@dataclass
class SearchableDocument:
    """A document that can be indexed and searched."""
    id: str
    doc_type: SearchableType
    title: str = ""
    content: str = ""
    tags: Set[str] = field(default_factory=set)
    metadata: Dict[str, Any] = field(default_factory=dict)
    author_id: str = ""
    author_name: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    url: str = ""
    popularity_score: float = 0.0

    def get_searchable_text(self) -> str:
        """Get all searchable text combined."""
        parts = [self.title, self.content]
        parts.extend(self.tags)
        parts.append(self.author_name)
        return " ".join(filter(None, parts))


@dataclass
class QueryTerm:
    """A single term in a search query."""
    term: str
    operator: QueryOperator = QueryOperator.AND
    field: Optional[str] = None  # Specific field to search
    boost: float = 1.0
    is_phrase: bool = False
    is_negated: bool = False
    fuzzy_distance: int = 0


@dataclass
class ParsedQuery:
    """A parsed search query."""
    original_query: str
    terms: List[QueryTerm] = field(default_factory=list)
    filters: Dict[str, Any] = field(default_factory=dict)
    scope: SearchScope = SearchScope.ALL

    @property
    def is_empty(self) -> bool:
        """Check if query is empty."""
        return len(self.terms) == 0


@dataclass
class SearchHit:
    """A single search result."""
    document: SearchableDocument
    score: float = 0.0
    highlights: Dict[str, List[str]] = field(default_factory=dict)
    matched_terms: Set[str] = field(default_factory=set)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.document.id,
            "type": self.document.doc_type.value,
            "title": self.document.title,
            "content_preview": self.document.content[:200] if self.document.content else "",
            "score": self.score,
            "highlights": self.highlights,
            "author": self.document.author_name,
            "created_at": self.document.created_at.isoformat(),
            "url": self.document.url,
        }


@dataclass
class Facet:
    """A facet for filtered search."""
    name: str
    field: str
    values: Dict[str, int] = field(default_factory=dict)  # value -> count

    def add_value(self, value: str) -> None:
        """Add a value to the facet."""
        self.values[value] = self.values.get(value, 0) + 1

    def get_top_values(self, limit: int = 10) -> List[Tuple[str, int]]:
        """Get top values by count."""
        sorted_values = sorted(
            self.values.items(),
            key=lambda x: x[1],
            reverse=True
        )
        return sorted_values[:limit]


@dataclass
class SearchResults:
    """Search results with metadata."""
    hits: List[SearchHit] = field(default_factory=list)
    total_count: int = 0
    page: int = 1
    page_size: int = 20
    query_time_ms: float = 0.0
    facets: Dict[str, Facet] = field(default_factory=dict)
    suggestions: List[str] = field(default_factory=list)
    did_you_mean: Optional[str] = None

    @property
    def has_more(self) -> bool:
        """Check if there are more results."""
        return self.page * self.page_size < self.total_count

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "hits": [h.to_dict() for h in self.hits],
            "total_count": self.total_count,
            "page": self.page,
            "page_size": self.page_size,
            "query_time_ms": self.query_time_ms,
            "has_more": self.has_more,
            "facets": {
                name: facet.get_top_values()
                for name, facet in self.facets.items()
            },
            "suggestions": self.suggestions,
            "did_you_mean": self.did_you_mean,
        }


@dataclass
class SearchConfig:
    """Configuration for search engine."""
    max_results: int = 1000
    default_page_size: int = 20
    max_page_size: int = 100
    min_query_length: int = 2
    enable_fuzzy: bool = True
    fuzzy_distance: int = 2
    enable_highlighting: bool = True
    highlight_tag_open: str = "<em>"
    highlight_tag_close: str = "</em>"
    snippet_length: int = 150
    enable_suggestions: bool = True
    max_suggestions: int = 5
    stopwords: Set[str] = field(default_factory=lambda: {
        "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
        "being", "have", "has", "had", "do", "does", "did", "will", "would",
        "could", "should", "may", "might", "must", "shall", "can", "need",
        "it", "its", "this", "that", "these", "those", "i", "you", "he", "she",
        "we", "they", "what", "which", "who", "whom", "when", "where", "why", "how"
    })


# ==================== Query Parser ====================

class QueryParser:
    """Parses search queries into structured format."""

    def __init__(self, config: Optional[SearchConfig] = None):
        self.config = config or SearchConfig()

    def parse(self, query: str) -> ParsedQuery:
        """Parse a search query string."""
        parsed = ParsedQuery(original_query=query)

        if not query or len(query.strip()) < self.config.min_query_length:
            return parsed

        # Extract phrases (quoted strings)
        phrases = self._extract_phrases(query)
        remaining = self._remove_phrases(query)

        # Add phrase terms
        for phrase in phrases:
            parsed.terms.append(QueryTerm(
                term=phrase,
                is_phrase=True,
                operator=QueryOperator.PHRASE
            ))

        # Parse remaining terms
        tokens = self._tokenize(remaining)
        i = 0
        while i < len(tokens):
            token = tokens[i].lower()

            # Check for operators
            if token == "and" and i + 1 < len(tokens):
                i += 1
                continue
            elif token == "or" and i + 1 < len(tokens):
                if parsed.terms:
                    parsed.terms[-1].operator = QueryOperator.OR
                i += 1
                continue
            elif token == "not" and i + 1 < len(tokens):
                i += 1
                if i < len(tokens):
                    parsed.terms.append(QueryTerm(
                        term=tokens[i].lower(),
                        is_negated=True,
                        operator=QueryOperator.NOT
                    ))
                i += 1
                continue
            elif token.startswith("-"):
                # Negation prefix
                term = token[1:]
                if term:
                    parsed.terms.append(QueryTerm(
                        term=term,
                        is_negated=True,
                        operator=QueryOperator.NOT
                    ))
                i += 1
                continue

            # Check for field-specific search
            if ":" in token:
                field, value = token.split(":", 1)
                if value:
                    parsed.terms.append(QueryTerm(
                        term=value,
                        field=field
                    ))
                i += 1
                continue

            # Check for fuzzy search (~)
            fuzzy_distance = 0
            if "~" in token:
                parts = token.split("~")
                token = parts[0]
                fuzzy_distance = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else self.config.fuzzy_distance

            # Skip stopwords unless it's the only term
            if token in self.config.stopwords and len(tokens) > 1:
                i += 1
                continue

            # Add regular term
            if token and len(token) >= self.config.min_query_length:
                parsed.terms.append(QueryTerm(
                    term=token,
                    fuzzy_distance=fuzzy_distance
                ))

            i += 1

        return parsed

    def _extract_phrases(self, query: str) -> List[str]:
        """Extract quoted phrases from query."""
        phrases = []
        pattern = r'"([^"]+)"'
        matches = re.findall(pattern, query)
        phrases.extend(matches)

        pattern = r"'([^']+)'"
        matches = re.findall(pattern, query)
        phrases.extend(matches)

        return phrases

    def _remove_phrases(self, query: str) -> str:
        """Remove quoted phrases from query."""
        query = re.sub(r'"[^"]+"', '', query)
        query = re.sub(r"'[^']+'", '', query)
        return query

    def _tokenize(self, text: str) -> List[str]:
        """Tokenize text into terms."""
        # Split on whitespace and punctuation (except special chars)
        tokens = re.findall(r'[\w\-:~]+', text)
        return [t for t in tokens if t]


# ==================== Search Index ====================

class SearchIndex:
    """Inverted index for fast text search."""

    def __init__(self, config: Optional[SearchConfig] = None):
        self.config = config or SearchConfig()
        self._documents: Dict[str, SearchableDocument] = {}
        self._inverted_index: Dict[str, Set[str]] = defaultdict(set)  # term -> doc_ids
        self._field_index: Dict[str, Dict[str, Set[str]]] = defaultdict(lambda: defaultdict(set))
        self._term_frequencies: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self._document_frequencies: Dict[str, int] = defaultdict(int)

    def add_document(self, doc: SearchableDocument) -> None:
        """Add a document to the index."""
        self._documents[doc.id] = doc

        # Index title
        title_terms = self._tokenize(doc.title)
        for term in title_terms:
            self._inverted_index[term].add(doc.id)
            self._field_index["title"][term].add(doc.id)
            self._term_frequencies[doc.id][term] += 1

        # Index content
        content_terms = self._tokenize(doc.content)
        for term in content_terms:
            self._inverted_index[term].add(doc.id)
            self._field_index["content"][term].add(doc.id)
            self._term_frequencies[doc.id][term] += 1

        # Index tags
        for tag in doc.tags:
            tag_lower = tag.lower()
            self._inverted_index[tag_lower].add(doc.id)
            self._field_index["tags"][tag_lower].add(doc.id)
            self._term_frequencies[doc.id][tag_lower] += 1

        # Index author
        author_terms = self._tokenize(doc.author_name)
        for term in author_terms:
            self._inverted_index[term].add(doc.id)
            self._field_index["author"][term].add(doc.id)

        # Update document frequencies
        unique_terms = set(title_terms + content_terms + [t.lower() for t in doc.tags])
        for term in unique_terms:
            self._document_frequencies[term] += 1

    def remove_document(self, doc_id: str) -> bool:
        """Remove a document from the index."""
        if doc_id not in self._documents:
            return False

        doc = self._documents[doc_id]

        # Remove from inverted index
        all_terms = self._tokenize(doc.title) + self._tokenize(doc.content)
        all_terms.extend([t.lower() for t in doc.tags])
        all_terms.extend(self._tokenize(doc.author_name))

        for term in set(all_terms):
            self._inverted_index[term].discard(doc_id)
            if not self._inverted_index[term]:
                del self._inverted_index[term]
            self._document_frequencies[term] = max(0, self._document_frequencies[term] - 1)

        # Remove from field indexes
        for field_name in self._field_index:
            for term in list(self._field_index[field_name].keys()):
                self._field_index[field_name][term].discard(doc_id)

        # Remove from term frequencies
        if doc_id in self._term_frequencies:
            del self._term_frequencies[doc_id]

        del self._documents[doc_id]
        return True

    def update_document(self, doc: SearchableDocument) -> None:
        """Update a document in the index."""
        self.remove_document(doc.id)
        self.add_document(doc)

    def get_document(self, doc_id: str) -> Optional[SearchableDocument]:
        """Get a document by ID."""
        return self._documents.get(doc_id)

    def search_term(self, term: str, field: Optional[str] = None) -> Set[str]:
        """Search for documents containing a term."""
        term_lower = term.lower()
        if field:
            return self._field_index.get(field, {}).get(term_lower, set())
        return self._inverted_index.get(term_lower, set())

    def search_prefix(self, prefix: str, field: Optional[str] = None) -> Set[str]:
        """Search for documents with terms starting with prefix."""
        prefix_lower = prefix.lower()
        results = set()

        index = self._field_index.get(field, self._inverted_index) if field else self._inverted_index

        for term, doc_ids in index.items():
            if term.startswith(prefix_lower):
                results.update(doc_ids)

        return results

    def search_fuzzy(self, term: str, max_distance: int = 2) -> Set[str]:
        """Search for documents with fuzzy matching."""
        term_lower = term.lower()
        results = set()

        for indexed_term, doc_ids in self._inverted_index.items():
            if self._levenshtein_distance(term_lower, indexed_term) <= max_distance:
                results.update(doc_ids)

        return results

    def get_term_frequency(self, doc_id: str, term: str) -> int:
        """Get term frequency in a document."""
        return self._term_frequencies.get(doc_id, {}).get(term.lower(), 0)

    def get_document_frequency(self, term: str) -> int:
        """Get number of documents containing term."""
        return self._document_frequencies.get(term.lower(), 0)

    @property
    def document_count(self) -> int:
        """Get total number of indexed documents."""
        return len(self._documents)

    def get_all_terms(self) -> Set[str]:
        """Get all indexed terms."""
        return set(self._inverted_index.keys())

    def _tokenize(self, text: str) -> List[str]:
        """Tokenize text for indexing."""
        if not text:
            return []
        # Split on non-word characters
        tokens = re.findall(r'\w+', text.lower())
        # Filter stopwords and short terms
        return [t for t in tokens if t not in self.config.stopwords and len(t) >= 2]

    def _levenshtein_distance(self, s1: str, s2: str) -> int:
        """Calculate Levenshtein distance between two strings."""
        if len(s1) < len(s2):
            return self._levenshtein_distance(s2, s1)
        if len(s2) == 0:
            return len(s1)

        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row

        return previous_row[-1]


# ==================== Search Ranker ====================

class SearchRanker:
    """Ranks search results by relevance."""

    def __init__(self, index: SearchIndex, config: Optional[SearchConfig] = None):
        self.index = index
        self.config = config or SearchConfig()

    def score(
        self,
        doc: SearchableDocument,
        query: ParsedQuery
    ) -> float:
        """Calculate relevance score for a document."""
        if query.is_empty:
            return 0.0

        score = 0.0
        matched_terms = set()

        for query_term in query.terms:
            if query_term.is_negated:
                continue

            term = query_term.term.lower()
            term_score = self._score_term(doc, term, query_term)

            if term_score > 0:
                matched_terms.add(term)
                score += term_score * query_term.boost

        # Apply field boost for title matches
        title_lower = doc.title.lower()
        for query_term in query.terms:
            if not query_term.is_negated and query_term.term.lower() in title_lower:
                score *= 1.5  # Title match boost

        # Apply recency boost
        age_days = (datetime.utcnow() - doc.updated_at).days
        recency_boost = 1.0 / (1.0 + age_days / 30.0)  # Decay over 30 days
        score *= (0.5 + 0.5 * recency_boost)

        # Apply popularity boost
        if doc.popularity_score > 0:
            score *= (1.0 + math.log1p(doc.popularity_score) * 0.1)

        return score

    def _score_term(
        self,
        doc: SearchableDocument,
        term: str,
        query_term: QueryTerm
    ) -> float:
        """Score a single term match."""
        # TF-IDF scoring
        tf = self.index.get_term_frequency(doc.id, term)
        if tf == 0:
            # Check for partial match
            if query_term.fuzzy_distance > 0:
                for doc_term in self._get_doc_terms(doc):
                    if self.index._levenshtein_distance(term, doc_term) <= query_term.fuzzy_distance:
                        tf = 1
                        break
            if tf == 0:
                return 0.0

        # Calculate IDF
        df = self.index.get_document_frequency(term)
        n = max(1, self.index.document_count)
        idf = math.log((n + 1) / (df + 1)) + 1

        # TF-IDF score
        tf_normalized = 1 + math.log1p(tf)
        return tf_normalized * idf

    def _get_doc_terms(self, doc: SearchableDocument) -> Set[str]:
        """Get all terms in a document."""
        text = doc.get_searchable_text().lower()
        return set(re.findall(r'\w+', text))

    def rank(
        self,
        docs: List[SearchableDocument],
        query: ParsedQuery,
        sort_order: SortOrder = SortOrder.RELEVANCE
    ) -> List[Tuple[SearchableDocument, float]]:
        """Rank a list of documents."""
        scored = [(doc, self.score(doc, query)) for doc in docs]

        if sort_order == SortOrder.RELEVANCE:
            scored.sort(key=lambda x: x[1], reverse=True)
        elif sort_order == SortOrder.DATE_DESC:
            scored.sort(key=lambda x: x[0].updated_at, reverse=True)
        elif sort_order == SortOrder.DATE_ASC:
            scored.sort(key=lambda x: x[0].updated_at)
        elif sort_order == SortOrder.ALPHABETICAL:
            scored.sort(key=lambda x: x[0].title.lower())
        elif sort_order == SortOrder.POPULARITY:
            scored.sort(key=lambda x: x[0].popularity_score, reverse=True)

        return scored


# ==================== Highlighter ====================

class SearchHighlighter:
    """Highlights search terms in results."""

    def __init__(self, config: Optional[SearchConfig] = None):
        self.config = config or SearchConfig()

    def highlight(
        self,
        text: str,
        query: ParsedQuery,
        max_length: int = 0
    ) -> str:
        """Highlight query terms in text."""
        if not text or query.is_empty:
            return text[:max_length] if max_length else text

        terms = [t.term for t in query.terms if not t.is_negated]

        # Find best snippet around first match
        text_lower = text.lower()
        first_match = -1
        for term in terms:
            pos = text_lower.find(term.lower())
            if pos != -1 and (first_match == -1 or pos < first_match):
                first_match = pos

        # Extract snippet
        if max_length and len(text) > max_length:
            if first_match > 0:
                start = max(0, first_match - max_length // 4)
                end = min(len(text), start + max_length)
            else:
                start = 0
                end = max_length
            snippet = text[start:end]
            if start > 0:
                snippet = "..." + snippet
            if end < len(text):
                snippet = snippet + "..."
        else:
            snippet = text

        # Highlight terms
        for term in terms:
            pattern = re.compile(re.escape(term), re.IGNORECASE)
            snippet = pattern.sub(
                f"{self.config.highlight_tag_open}\\g<0>{self.config.highlight_tag_close}",
                snippet
            )

        return snippet

    def get_highlights(
        self,
        doc: SearchableDocument,
        query: ParsedQuery
    ) -> Dict[str, List[str]]:
        """Get highlighted snippets for each field."""
        highlights = {}

        if doc.title:
            title_highlight = self.highlight(
                doc.title, query, self.config.snippet_length
            )
            if title_highlight != doc.title:
                highlights["title"] = [title_highlight]

        if doc.content:
            content_highlight = self.highlight(
                doc.content, query, self.config.snippet_length
            )
            highlights["content"] = [content_highlight]

        return highlights


# ==================== Search Suggester ====================

class SearchSuggester:
    """Provides search suggestions and autocomplete."""

    def __init__(self, index: SearchIndex, config: Optional[SearchConfig] = None):
        self.index = index
        self.config = config or SearchConfig()
        self._query_history: List[Tuple[str, int]] = []  # (query, count)

    def add_query(self, query: str) -> None:
        """Record a search query."""
        query_lower = query.lower().strip()
        for i, (q, count) in enumerate(self._query_history):
            if q == query_lower:
                self._query_history[i] = (q, count + 1)
                return
        self._query_history.append((query_lower, 1))

    def suggest_completions(self, prefix: str, limit: int = 5) -> List[str]:
        """Suggest query completions based on prefix."""
        if len(prefix) < 2:
            return []

        prefix_lower = prefix.lower()
        suggestions = []

        # Suggest from indexed terms
        for term in self.index.get_all_terms():
            if term.startswith(prefix_lower):
                suggestions.append(term)

        # Sort by document frequency
        suggestions.sort(
            key=lambda t: self.index.get_document_frequency(t),
            reverse=True
        )

        return suggestions[:limit]

    def suggest_queries(self, prefix: str, limit: int = 5) -> List[str]:
        """Suggest queries based on history."""
        if len(prefix) < 2:
            return []

        prefix_lower = prefix.lower()
        matching = [
            (q, count) for q, count in self._query_history
            if q.startswith(prefix_lower)
        ]
        matching.sort(key=lambda x: x[1], reverse=True)
        return [q for q, _ in matching[:limit]]

    def suggest_corrections(self, term: str) -> Optional[str]:
        """Suggest spelling correction for a term."""
        term_lower = term.lower()

        # If term exists, no correction needed
        if self.index.get_document_frequency(term_lower) > 0:
            return None

        # Find closest term by edit distance
        best_term = None
        best_distance = float('inf')
        best_frequency = 0

        for indexed_term in self.index.get_all_terms():
            distance = self.index._levenshtein_distance(term_lower, indexed_term)
            if distance <= 2:  # Max 2 edits
                freq = self.index.get_document_frequency(indexed_term)
                if distance < best_distance or (distance == best_distance and freq > best_frequency):
                    best_term = indexed_term
                    best_distance = distance
                    best_frequency = freq

        return best_term


# ==================== Faceted Search ====================

class FacetedSearch:
    """Provides faceted/filtered search capabilities."""

    def __init__(self, index: SearchIndex):
        self.index = index

    def build_facets(
        self,
        doc_ids: Set[str],
        facet_fields: List[str]
    ) -> Dict[str, Facet]:
        """Build facets from search results."""
        facets = {}

        for field in facet_fields:
            facet = Facet(name=field, field=field)
            facets[field] = facet

        for doc_id in doc_ids:
            doc = self.index.get_document(doc_id)
            if not doc:
                continue

            for field in facet_fields:
                if field == "type":
                    facets[field].add_value(doc.doc_type.value)
                elif field == "author":
                    if doc.author_name:
                        facets[field].add_value(doc.author_name)
                elif field == "tags":
                    for tag in doc.tags:
                        facets[field].add_value(tag)
                elif field == "date":
                    # Group by month
                    month = doc.created_at.strftime("%Y-%m")
                    facets[field].add_value(month)

        return facets

    def apply_facet_filter(
        self,
        doc_ids: Set[str],
        facet_field: str,
        facet_value: str
    ) -> Set[str]:
        """Filter documents by facet value."""
        filtered = set()

        for doc_id in doc_ids:
            doc = self.index.get_document(doc_id)
            if not doc:
                continue

            if facet_field == "type":
                if doc.doc_type.value == facet_value:
                    filtered.add(doc_id)
            elif facet_field == "author":
                if doc.author_name == facet_value:
                    filtered.add(doc_id)
            elif facet_field == "tags":
                if facet_value in doc.tags:
                    filtered.add(doc_id)
            elif facet_field == "date":
                month = doc.created_at.strftime("%Y-%m")
                if month == facet_value:
                    filtered.add(doc_id)

        return filtered


# ==================== Search Engine ====================

class SearchEngine:
    """Main search engine combining all components."""

    def __init__(self, config: Optional[SearchConfig] = None):
        self.config = config or SearchConfig()
        self._index = SearchIndex(self.config)
        self._parser = QueryParser(self.config)
        self._ranker = SearchRanker(self._index, self.config)
        self._highlighter = SearchHighlighter(self.config)
        self._suggester = SearchSuggester(self._index, self.config)
        self._faceted = FacetedSearch(self._index)

    def index_document(self, doc: SearchableDocument) -> None:
        """Index a document for searching."""
        self._index.add_document(doc)

    def remove_document(self, doc_id: str) -> bool:
        """Remove a document from the index."""
        return self._index.remove_document(doc_id)

    def update_document(self, doc: SearchableDocument) -> None:
        """Update a document in the index."""
        self._index.update_document(doc)

    def get_document(self, doc_id: str) -> Optional[SearchableDocument]:
        """Get a document by ID."""
        return self._index.get_document(doc_id)

    def search(
        self,
        query: str,
        page: int = 1,
        page_size: Optional[int] = None,
        doc_types: Optional[Set[SearchableType]] = None,
        filters: Optional[Dict[str, str]] = None,
        facet_fields: Optional[List[str]] = None,
        sort_order: SortOrder = SortOrder.RELEVANCE
    ) -> SearchResults:
        """Execute a search query."""
        start_time = time.time()
        page_size = min(page_size or self.config.default_page_size, self.config.max_page_size)

        # Parse query
        parsed = self._parser.parse(query)

        if parsed.is_empty:
            return SearchResults(
                query_time_ms=(time.time() - start_time) * 1000
            )

        # Record query for suggestions
        if self.config.enable_suggestions:
            self._suggester.add_query(query)

        # Find matching documents
        candidate_ids = self._find_candidates(parsed)

        # Apply type filter
        if doc_types:
            candidate_ids = {
                doc_id for doc_id in candidate_ids
                if self._index.get_document(doc_id) and
                self._index.get_document(doc_id).doc_type in doc_types
            }

        # Apply additional filters
        if filters:
            for field, value in filters.items():
                candidate_ids = self._faceted.apply_facet_filter(
                    candidate_ids, field, value
                )

        # Build facets before pagination
        facets = {}
        if facet_fields:
            facets = self._faceted.build_facets(candidate_ids, facet_fields)

        # Get documents and rank
        candidates = [
            self._index.get_document(doc_id)
            for doc_id in candidate_ids
            if self._index.get_document(doc_id)
        ]

        ranked = self._ranker.rank(candidates, parsed, sort_order)

        # Paginate
        total_count = len(ranked)
        start = (page - 1) * page_size
        end = start + page_size
        page_results = ranked[start:end]

        # Build search hits with highlights
        hits = []
        for doc, score in page_results:
            highlights = {}
            if self.config.enable_highlighting:
                highlights = self._highlighter.get_highlights(doc, parsed)

            matched_terms = {
                t.term for t in parsed.terms
                if not t.is_negated and t.term.lower() in doc.get_searchable_text().lower()
            }

            hits.append(SearchHit(
                document=doc,
                score=score,
                highlights=highlights,
                matched_terms=matched_terms
            ))

        # Get suggestions
        suggestions = []
        did_you_mean = None
        if self.config.enable_suggestions and total_count == 0:
            # Suggest corrections if no results
            for term in parsed.terms:
                correction = self._suggester.suggest_corrections(term.term)
                if correction:
                    did_you_mean = query.replace(term.term, correction)
                    break

        query_time = (time.time() - start_time) * 1000

        return SearchResults(
            hits=hits,
            total_count=total_count,
            page=page,
            page_size=page_size,
            query_time_ms=query_time,
            facets=facets,
            suggestions=suggestions,
            did_you_mean=did_you_mean
        )

    def suggest(self, prefix: str, limit: int = 5) -> List[str]:
        """Get search suggestions."""
        completions = self._suggester.suggest_completions(prefix, limit)
        queries = self._suggester.suggest_queries(prefix, limit)

        # Combine and dedupe
        seen = set()
        suggestions = []
        for s in queries + completions:
            if s not in seen:
                suggestions.append(s)
                seen.add(s)
            if len(suggestions) >= limit:
                break

        return suggestions

    def _find_candidates(self, query: ParsedQuery) -> Set[str]:
        """Find candidate documents matching query."""
        if query.is_empty:
            return set()

        # Start with all documents for OR queries, empty for AND
        result = None
        has_positive_terms = False
        prev_operator = QueryOperator.AND

        # Get non-negated terms
        positive_terms = [t for t in query.terms if not t.is_negated]

        for i, term in enumerate(positive_terms):
            has_positive_terms = True
            term_matches = self._match_term(term)

            if result is None:
                result = term_matches
            elif prev_operator == QueryOperator.OR:
                result = result.union(term_matches)
            else:  # AND
                result = result.intersection(term_matches)

            # Store this term's operator for next iteration
            prev_operator = term.operator

        if not has_positive_terms:
            # All terms are negated, start with all docs
            result = set(self._index._documents.keys())

        # Apply NOT terms
        for term in query.terms:
            if term.is_negated and result:
                term_matches = self._match_term(term)
                result = result - term_matches

        return result or set()

    def _match_term(self, term: QueryTerm) -> Set[str]:
        """Find documents matching a term."""
        if term.is_phrase:
            return self._match_phrase(term.term)

        if term.fuzzy_distance > 0 and self.config.enable_fuzzy:
            return self._index.search_fuzzy(term.term, term.fuzzy_distance)

        if "*" in term.term:
            prefix = term.term.replace("*", "")
            return self._index.search_prefix(prefix, term.field)

        return self._index.search_term(term.term, term.field)

    def _match_phrase(self, phrase: str) -> Set[str]:
        """Find documents containing exact phrase."""
        phrase_lower = phrase.lower()
        matches = set()

        for doc_id, doc in self._index._documents.items():
            text = doc.get_searchable_text().lower()
            if phrase_lower in text:
                matches.add(doc_id)

        return matches

    def get_stats(self) -> Dict[str, Any]:
        """Get search engine statistics."""
        return {
            "total_documents": self._index.document_count,
            "total_terms": len(self._index.get_all_terms()),
            "config": {
                "enable_fuzzy": self.config.enable_fuzzy,
                "enable_suggestions": self.config.enable_suggestions,
            }
        }


# ==================== Global Instances ====================

_search_engine: Optional[SearchEngine] = None


def get_search_engine() -> Optional[SearchEngine]:
    """Get the global search engine."""
    return _search_engine


def set_search_engine(engine: SearchEngine) -> None:
    """Set the global search engine."""
    global _search_engine
    _search_engine = engine


def reset_search_engine() -> None:
    """Reset the global search engine."""
    global _search_engine
    _search_engine = None
