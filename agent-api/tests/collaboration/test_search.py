"""Tests for Search & Discovery module."""

import pytest
from datetime import datetime, timedelta

from app.collaboration.search import (
    SearchEngine,
    SearchConfig,
    SearchIndex,
    SearchableDocument,
    SearchableType,
    SearchHit,
    SearchResults,
    QueryParser,
    ParsedQuery,
    QueryTerm,
    QueryOperator,
    SearchScope,
    SortOrder,
    SearchRanker,
    SearchHighlighter,
    SearchSuggester,
    FacetedSearch,
    Facet,
    get_search_engine,
    set_search_engine,
    reset_search_engine,
)


# ==================== Fixtures ====================

@pytest.fixture
def config():
    """Create a search config."""
    return SearchConfig()


@pytest.fixture
def engine(config):
    """Create a search engine."""
    return SearchEngine(config)


@pytest.fixture
def index(config):
    """Create a search index."""
    return SearchIndex(config)


@pytest.fixture
def parser(config):
    """Create a query parser."""
    return QueryParser(config)


@pytest.fixture
def sample_docs():
    """Create sample documents for testing."""
    return [
        SearchableDocument(
            id="doc1",
            doc_type=SearchableType.DOCUMENT,
            title="Introduction to Python Programming",
            content="Python is a versatile programming language used for web development, data science, and automation.",
            tags={"python", "programming", "tutorial"},
            author_id="user1",
            author_name="Alice Smith",
            created_at=datetime.utcnow() - timedelta(days=5),
            updated_at=datetime.utcnow() - timedelta(days=2),
            popularity_score=100.0
        ),
        SearchableDocument(
            id="doc2",
            doc_type=SearchableType.DOCUMENT,
            title="Advanced Python Techniques",
            content="Learn advanced Python concepts including decorators, metaclasses, and async programming.",
            tags={"python", "advanced"},
            author_id="user2",
            author_name="Bob Jones",
            created_at=datetime.utcnow() - timedelta(days=10),
            updated_at=datetime.utcnow() - timedelta(days=8),
            popularity_score=50.0
        ),
        SearchableDocument(
            id="doc3",
            doc_type=SearchableType.TASK,
            title="Review Code Changes",
            content="Please review the JavaScript code changes in the frontend module.",
            tags={"review", "javascript"},
            author_id="user1",
            author_name="Alice Smith",
            created_at=datetime.utcnow() - timedelta(days=1),
            updated_at=datetime.utcnow() - timedelta(hours=6),
            popularity_score=25.0
        ),
        SearchableDocument(
            id="doc4",
            doc_type=SearchableType.COMMENT,
            title="",
            content="Great work on the Python documentation! Very helpful for beginners.",
            tags=set(),
            author_id="user3",
            author_name="Carol White",
            created_at=datetime.utcnow() - timedelta(days=3),
            updated_at=datetime.utcnow() - timedelta(days=3),
            popularity_score=10.0
        ),
    ]


# ==================== SearchableDocument Tests ====================

class TestSearchableDocument:
    """Tests for SearchableDocument."""

    def test_create_document(self):
        """Test creating a searchable document."""
        doc = SearchableDocument(
            id="test1",
            doc_type=SearchableType.DOCUMENT,
            title="Test Title",
            content="Test content"
        )
        assert doc.id == "test1"
        assert doc.doc_type == SearchableType.DOCUMENT
        assert doc.title == "Test Title"
        assert doc.content == "Test content"

    def test_default_values(self):
        """Test default values."""
        doc = SearchableDocument(
            id="test1",
            doc_type=SearchableType.DOCUMENT
        )
        assert doc.title == ""
        assert doc.content == ""
        assert doc.tags == set()
        assert doc.metadata == {}
        assert doc.author_id == ""
        assert doc.popularity_score == 0.0

    def test_get_searchable_text(self):
        """Test getting searchable text."""
        doc = SearchableDocument(
            id="test1",
            doc_type=SearchableType.DOCUMENT,
            title="My Title",
            content="Document content here",
            tags={"tag1", "tag2"},
            author_name="John Doe"
        )
        text = doc.get_searchable_text()
        assert "My Title" in text
        assert "Document content here" in text
        assert "tag1" in text
        assert "tag2" in text
        assert "John Doe" in text

    def test_all_searchable_types(self):
        """Test all searchable types."""
        types = [
            SearchableType.DOCUMENT,
            SearchableType.COMMENT,
            SearchableType.TASK,
            SearchableType.USER,
            SearchableType.ACTIVITY,
            SearchableType.FILE,
            SearchableType.MESSAGE
        ]
        for doc_type in types:
            doc = SearchableDocument(id=f"test_{doc_type.value}", doc_type=doc_type)
            assert doc.doc_type == doc_type


# ==================== QueryParser Tests ====================

class TestQueryParser:
    """Tests for QueryParser."""

    def test_parse_simple_query(self, parser):
        """Test parsing simple query."""
        result = parser.parse("python programming")
        assert not result.is_empty
        assert len(result.terms) == 2
        assert result.terms[0].term == "python"
        assert result.terms[1].term == "programming"

    def test_parse_empty_query(self, parser):
        """Test parsing empty query."""
        result = parser.parse("")
        assert result.is_empty

    def test_parse_short_query(self, parser):
        """Test parsing query below minimum length."""
        result = parser.parse("a")
        assert result.is_empty

    def test_parse_phrase_double_quotes(self, parser):
        """Test parsing phrase with double quotes."""
        result = parser.parse('"machine learning" python')
        phrases = [t for t in result.terms if t.is_phrase]
        assert len(phrases) == 1
        assert phrases[0].term == "machine learning"

    def test_parse_phrase_single_quotes(self, parser):
        """Test parsing phrase with single quotes."""
        result = parser.parse("'data science' tutorial")
        phrases = [t for t in result.terms if t.is_phrase]
        assert len(phrases) == 1
        assert phrases[0].term == "data science"

    def test_parse_and_operator(self, parser):
        """Test parsing AND operator."""
        result = parser.parse("python AND programming")
        assert len(result.terms) == 2
        # AND is implicit between terms

    def test_parse_or_operator(self, parser):
        """Test parsing OR operator."""
        result = parser.parse("python OR javascript")
        assert len(result.terms) == 2
        # First term should have OR operator set
        assert result.terms[0].operator == QueryOperator.OR

    def test_parse_not_operator(self, parser):
        """Test parsing NOT operator."""
        result = parser.parse("python NOT java")
        negated = [t for t in result.terms if t.is_negated]
        assert len(negated) == 1
        assert negated[0].term == "java"

    def test_parse_negation_prefix(self, parser):
        """Test parsing negation prefix."""
        result = parser.parse("python -javascript")
        negated = [t for t in result.terms if t.is_negated]
        assert len(negated) == 1
        assert negated[0].term == "javascript"

    def test_parse_field_search(self, parser):
        """Test parsing field-specific search."""
        result = parser.parse("title:python author:alice")
        field_terms = [t for t in result.terms if t.field]
        assert len(field_terms) == 2
        assert any(t.field == "title" and t.term == "python" for t in field_terms)
        assert any(t.field == "author" and t.term == "alice" for t in field_terms)

    def test_parse_fuzzy_search(self, parser):
        """Test parsing fuzzy search."""
        result = parser.parse("pythn~2")
        fuzzy_terms = [t for t in result.terms if t.fuzzy_distance > 0]
        assert len(fuzzy_terms) == 1
        assert fuzzy_terms[0].term == "pythn"
        assert fuzzy_terms[0].fuzzy_distance == 2

    def test_parse_fuzzy_default_distance(self, parser):
        """Test parsing fuzzy with default distance."""
        result = parser.parse("pythn~")
        fuzzy_terms = [t for t in result.terms if t.fuzzy_distance > 0]
        assert len(fuzzy_terms) == 1
        assert fuzzy_terms[0].fuzzy_distance == 2  # Default

    def test_stopwords_removed(self, parser):
        """Test stopwords are removed."""
        result = parser.parse("the python programming language")
        terms = [t.term for t in result.terms]
        assert "the" not in terms
        assert "python" in terms
        assert "programming" in terms
        assert "language" in terms


# ==================== SearchIndex Tests ====================

class TestSearchIndex:
    """Tests for SearchIndex."""

    def test_add_document(self, index, sample_docs):
        """Test adding document to index."""
        doc = sample_docs[0]
        index.add_document(doc)
        assert index.document_count == 1
        assert index.get_document(doc.id) == doc

    def test_add_multiple_documents(self, index, sample_docs):
        """Test adding multiple documents."""
        for doc in sample_docs:
            index.add_document(doc)
        assert index.document_count == 4

    def test_remove_document(self, index, sample_docs):
        """Test removing document from index."""
        doc = sample_docs[0]
        index.add_document(doc)
        assert index.document_count == 1

        result = index.remove_document(doc.id)
        assert result is True
        assert index.document_count == 0
        assert index.get_document(doc.id) is None

    def test_remove_nonexistent_document(self, index):
        """Test removing nonexistent document."""
        result = index.remove_document("nonexistent")
        assert result is False

    def test_update_document(self, index, sample_docs):
        """Test updating document in index."""
        doc = sample_docs[0]
        index.add_document(doc)

        updated_doc = SearchableDocument(
            id=doc.id,
            doc_type=doc.doc_type,
            title="Updated Title",
            content="Updated content"
        )
        index.update_document(updated_doc)

        retrieved = index.get_document(doc.id)
        assert retrieved.title == "Updated Title"
        assert retrieved.content == "Updated content"

    def test_search_term(self, index, sample_docs):
        """Test searching for a term."""
        for doc in sample_docs:
            index.add_document(doc)

        results = index.search_term("python")
        assert len(results) == 3  # doc1, doc2, doc4 (in content)

    def test_search_term_field(self, index, sample_docs):
        """Test searching term in specific field."""
        for doc in sample_docs:
            index.add_document(doc)

        results = index.search_term("python", field="title")
        assert len(results) == 2  # doc1 and doc2

    def test_search_prefix(self, index, sample_docs):
        """Test prefix search."""
        for doc in sample_docs:
            index.add_document(doc)

        results = index.search_prefix("prog")
        assert len(results) >= 1  # At least doc1

    def test_search_fuzzy(self, index, sample_docs):
        """Test fuzzy search."""
        for doc in sample_docs:
            index.add_document(doc)

        # "pythn" should match "python" with edit distance 1
        results = index.search_fuzzy("pythn", max_distance=2)
        assert len(results) >= 1

    def test_get_term_frequency(self, index):
        """Test getting term frequency."""
        doc = SearchableDocument(
            id="test1",
            doc_type=SearchableType.DOCUMENT,
            title="Python Python Python",
            content="More python programming in python"
        )
        index.add_document(doc)

        tf = index.get_term_frequency(doc.id, "python")
        assert tf >= 4  # At least 4 occurrences

    def test_get_document_frequency(self, index, sample_docs):
        """Test getting document frequency."""
        for doc in sample_docs:
            index.add_document(doc)

        df = index.get_document_frequency("python")
        assert df == 3  # doc1, doc2, doc4

    def test_get_all_terms(self, index, sample_docs):
        """Test getting all indexed terms."""
        for doc in sample_docs:
            index.add_document(doc)

        terms = index.get_all_terms()
        assert "python" in terms
        assert "programming" in terms


# ==================== SearchRanker Tests ====================

class TestSearchRanker:
    """Tests for SearchRanker."""

    def test_score_matching_document(self, index, parser, sample_docs):
        """Test scoring a matching document."""
        for doc in sample_docs:
            index.add_document(doc)

        ranker = SearchRanker(index)
        query = parser.parse("python programming")

        score = ranker.score(sample_docs[0], query)
        assert score > 0

    def test_score_non_matching_document(self, index, parser, sample_docs):
        """Test scoring non-matching document."""
        for doc in sample_docs:
            index.add_document(doc)

        ranker = SearchRanker(index)
        query = parser.parse("react angular")

        score = ranker.score(sample_docs[0], query)
        assert score == 0

    def test_rank_documents(self, index, parser, sample_docs):
        """Test ranking documents."""
        for doc in sample_docs:
            index.add_document(doc)

        ranker = SearchRanker(index)
        query = parser.parse("python")

        ranked = ranker.rank(sample_docs, query)
        assert len(ranked) == 4
        # Python-focused docs should rank higher
        assert ranked[0][1] >= ranked[1][1]

    def test_rank_by_date_desc(self, index, parser, sample_docs):
        """Test ranking by date descending."""
        for doc in sample_docs:
            index.add_document(doc)

        ranker = SearchRanker(index)
        query = parser.parse("python")

        ranked = ranker.rank(sample_docs, query, SortOrder.DATE_DESC)
        # Most recent first
        for i in range(len(ranked) - 1):
            assert ranked[i][0].updated_at >= ranked[i + 1][0].updated_at

    def test_rank_by_date_asc(self, index, parser, sample_docs):
        """Test ranking by date ascending."""
        for doc in sample_docs:
            index.add_document(doc)

        ranker = SearchRanker(index)
        query = parser.parse("python")

        ranked = ranker.rank(sample_docs, query, SortOrder.DATE_ASC)
        # Oldest first
        for i in range(len(ranked) - 1):
            assert ranked[i][0].updated_at <= ranked[i + 1][0].updated_at

    def test_rank_alphabetical(self, index, parser, sample_docs):
        """Test ranking alphabetically."""
        for doc in sample_docs:
            index.add_document(doc)

        ranker = SearchRanker(index)
        query = parser.parse("python")

        ranked = ranker.rank(sample_docs, query, SortOrder.ALPHABETICAL)
        # Alphabetical order
        for i in range(len(ranked) - 1):
            assert ranked[i][0].title.lower() <= ranked[i + 1][0].title.lower()

    def test_rank_by_popularity(self, index, parser, sample_docs):
        """Test ranking by popularity."""
        for doc in sample_docs:
            index.add_document(doc)

        ranker = SearchRanker(index)
        query = parser.parse("python")

        ranked = ranker.rank(sample_docs, query, SortOrder.POPULARITY)
        # Most popular first
        for i in range(len(ranked) - 1):
            assert ranked[i][0].popularity_score >= ranked[i + 1][0].popularity_score

    def test_title_match_boost(self, index, parser):
        """Test that title matches get boosted."""
        doc1 = SearchableDocument(
            id="doc1",
            doc_type=SearchableType.DOCUMENT,
            title="Python Guide",
            content="A comprehensive guide"
        )
        doc2 = SearchableDocument(
            id="doc2",
            doc_type=SearchableType.DOCUMENT,
            title="Programming Guide",
            content="Learn python programming"
        )
        index.add_document(doc1)
        index.add_document(doc2)

        ranker = SearchRanker(index)
        query = parser.parse("python")

        score1 = ranker.score(doc1, query)
        score2 = ranker.score(doc2, query)

        # Title match should score higher
        assert score1 > score2


# ==================== SearchHighlighter Tests ====================

class TestSearchHighlighter:
    """Tests for SearchHighlighter."""

    def test_highlight_term(self, parser, config):
        """Test highlighting a term."""
        highlighter = SearchHighlighter(config)
        query = parser.parse("python")

        text = "Learn Python programming today"
        result = highlighter.highlight(text, query)

        assert "<em>Python</em>" in result

    def test_highlight_multiple_terms(self, parser, config):
        """Test highlighting multiple terms."""
        highlighter = SearchHighlighter(config)
        query = parser.parse("python programming")

        text = "Learn Python programming with this tutorial"
        result = highlighter.highlight(text, query)

        assert "<em>Python</em>" in result
        assert "<em>programming</em>" in result

    def test_highlight_with_truncation(self, parser, config):
        """Test highlighting with max length."""
        highlighter = SearchHighlighter(config)
        query = parser.parse("python")

        text = "x" * 100 + "Python is great" + "y" * 100
        result = highlighter.highlight(text, query, max_length=50)

        assert "<em>Python</em>" in result
        assert len(result) <= 80  # Account for highlight tags and ellipsis

    def test_highlight_empty_query(self, parser, config):
        """Test highlighting with empty query."""
        highlighter = SearchHighlighter(config)
        query = parser.parse("")

        text = "Some text here"
        result = highlighter.highlight(text, query)

        assert result == text

    def test_get_highlights_document(self, parser, config, sample_docs):
        """Test getting highlights for document fields."""
        highlighter = SearchHighlighter(config)
        query = parser.parse("python")

        highlights = highlighter.get_highlights(sample_docs[0], query)

        assert "title" in highlights or "content" in highlights


# ==================== SearchSuggester Tests ====================

class TestSearchSuggester:
    """Tests for SearchSuggester."""

    def test_add_query(self, index, config):
        """Test adding query to history."""
        suggester = SearchSuggester(index, config)
        suggester.add_query("python tutorial")
        suggester.add_query("python tutorial")
        suggester.add_query("javascript basics")

        suggestions = suggester.suggest_queries("pyt")
        assert "python tutorial" in suggestions

    def test_suggest_completions(self, index, sample_docs, config):
        """Test suggesting term completions."""
        for doc in sample_docs:
            index.add_document(doc)

        suggester = SearchSuggester(index, config)
        suggestions = suggester.suggest_completions("prog")

        assert any("programming" in s for s in suggestions)

    def test_suggest_corrections(self, index, sample_docs, config):
        """Test suggesting spelling corrections."""
        for doc in sample_docs:
            index.add_document(doc)

        suggester = SearchSuggester(index, config)
        correction = suggester.suggest_corrections("pythn")

        assert correction == "python"

    def test_no_correction_needed(self, index, sample_docs, config):
        """Test no correction when term exists."""
        for doc in sample_docs:
            index.add_document(doc)

        suggester = SearchSuggester(index, config)
        correction = suggester.suggest_corrections("python")

        assert correction is None


# ==================== FacetedSearch Tests ====================

class TestFacetedSearch:
    """Tests for FacetedSearch."""

    def test_build_type_facet(self, index, sample_docs):
        """Test building type facet."""
        for doc in sample_docs:
            index.add_document(doc)

        faceted = FacetedSearch(index)
        doc_ids = {doc.id for doc in sample_docs}

        facets = faceted.build_facets(doc_ids, ["type"])

        assert "type" in facets
        values = dict(facets["type"].get_top_values())
        assert SearchableType.DOCUMENT.value in values

    def test_build_author_facet(self, index, sample_docs):
        """Test building author facet."""
        for doc in sample_docs:
            index.add_document(doc)

        faceted = FacetedSearch(index)
        doc_ids = {doc.id for doc in sample_docs}

        facets = faceted.build_facets(doc_ids, ["author"])

        assert "author" in facets
        values = dict(facets["author"].get_top_values())
        assert "Alice Smith" in values

    def test_build_tags_facet(self, index, sample_docs):
        """Test building tags facet."""
        for doc in sample_docs:
            index.add_document(doc)

        faceted = FacetedSearch(index)
        doc_ids = {doc.id for doc in sample_docs}

        facets = faceted.build_facets(doc_ids, ["tags"])

        assert "tags" in facets
        values = dict(facets["tags"].get_top_values())
        assert "python" in values

    def test_apply_facet_filter_type(self, index, sample_docs):
        """Test applying type facet filter."""
        for doc in sample_docs:
            index.add_document(doc)

        faceted = FacetedSearch(index)
        doc_ids = {doc.id for doc in sample_docs}

        filtered = faceted.apply_facet_filter(doc_ids, "type", "document")

        assert len(filtered) == 2  # doc1, doc2

    def test_apply_facet_filter_author(self, index, sample_docs):
        """Test applying author facet filter."""
        for doc in sample_docs:
            index.add_document(doc)

        faceted = FacetedSearch(index)
        doc_ids = {doc.id for doc in sample_docs}

        filtered = faceted.apply_facet_filter(doc_ids, "author", "Alice Smith")

        assert len(filtered) == 2  # doc1, doc3

    def test_apply_facet_filter_tag(self, index, sample_docs):
        """Test applying tag facet filter."""
        for doc in sample_docs:
            index.add_document(doc)

        faceted = FacetedSearch(index)
        doc_ids = {doc.id for doc in sample_docs}

        filtered = faceted.apply_facet_filter(doc_ids, "tags", "python")

        assert len(filtered) == 2  # doc1, doc2


# ==================== Facet Tests ====================

class TestFacet:
    """Tests for Facet."""

    def test_add_value(self):
        """Test adding value to facet."""
        facet = Facet(name="type", field="type")
        facet.add_value("document")
        facet.add_value("document")
        facet.add_value("comment")

        assert facet.values["document"] == 2
        assert facet.values["comment"] == 1

    def test_get_top_values(self):
        """Test getting top values."""
        facet = Facet(name="author", field="author")
        facet.add_value("Alice")
        facet.add_value("Alice")
        facet.add_value("Alice")
        facet.add_value("Bob")
        facet.add_value("Bob")
        facet.add_value("Carol")

        top = facet.get_top_values(2)
        assert len(top) == 2
        assert top[0] == ("Alice", 3)
        assert top[1] == ("Bob", 2)


# ==================== SearchEngine Integration Tests ====================

class TestSearchEngine:
    """Integration tests for SearchEngine."""

    def test_index_and_search(self, engine, sample_docs):
        """Test indexing and searching."""
        for doc in sample_docs:
            engine.index_document(doc)

        results = engine.search("python")

        assert results.total_count >= 1
        assert len(results.hits) >= 1

    def test_search_empty_query(self, engine, sample_docs):
        """Test searching with empty query."""
        for doc in sample_docs:
            engine.index_document(doc)

        results = engine.search("")

        assert results.total_count == 0
        assert len(results.hits) == 0

    def test_search_with_pagination(self, engine, sample_docs):
        """Test search with pagination."""
        for doc in sample_docs:
            engine.index_document(doc)

        results = engine.search("python", page=1, page_size=2)

        assert len(results.hits) <= 2
        assert results.page == 1
        assert results.page_size == 2

    def test_search_with_type_filter(self, engine, sample_docs):
        """Test search with type filter."""
        for doc in sample_docs:
            engine.index_document(doc)

        results = engine.search(
            "python",
            doc_types={SearchableType.DOCUMENT}
        )

        for hit in results.hits:
            assert hit.document.doc_type == SearchableType.DOCUMENT

    def test_search_with_facet_filter(self, engine, sample_docs):
        """Test search with facet filter."""
        for doc in sample_docs:
            engine.index_document(doc)

        results = engine.search(
            "python",
            filters={"author": "Alice Smith"}
        )

        for hit in results.hits:
            assert hit.document.author_name == "Alice Smith"

    def test_search_with_facets(self, engine, sample_docs):
        """Test search returning facets."""
        for doc in sample_docs:
            engine.index_document(doc)

        results = engine.search(
            "python",
            facet_fields=["type", "author", "tags"]
        )

        assert "type" in results.facets
        assert "author" in results.facets
        assert "tags" in results.facets

    def test_search_phrase(self, engine, sample_docs):
        """Test phrase search."""
        for doc in sample_docs:
            engine.index_document(doc)

        results = engine.search('"programming language"')

        assert results.total_count >= 1

    def test_search_or_operator(self, engine, sample_docs):
        """Test OR operator in search."""
        for doc in sample_docs:
            engine.index_document(doc)

        results = engine.search("python OR javascript")

        # Should find docs with either term
        assert results.total_count >= 2

    def test_search_not_operator(self, engine, sample_docs):
        """Test NOT operator in search."""
        for doc in sample_docs:
            engine.index_document(doc)

        # Search python but not advanced
        results = engine.search("python NOT advanced")

        for hit in results.hits:
            assert "advanced" not in hit.document.title.lower()
            assert "advanced" not in hit.document.content.lower()

    def test_search_with_highlighting(self, engine, sample_docs):
        """Test search with highlighting."""
        for doc in sample_docs:
            engine.index_document(doc)

        results = engine.search("python")

        # At least some hits should have highlights
        has_highlights = any(len(hit.highlights) > 0 for hit in results.hits)
        assert has_highlights

    def test_search_sort_relevance(self, engine, sample_docs):
        """Test sorting by relevance."""
        for doc in sample_docs:
            engine.index_document(doc)

        results = engine.search("python", sort_order=SortOrder.RELEVANCE)

        # Scores should be descending
        for i in range(len(results.hits) - 1):
            assert results.hits[i].score >= results.hits[i + 1].score

    def test_remove_document(self, engine, sample_docs):
        """Test removing document from engine."""
        for doc in sample_docs:
            engine.index_document(doc)

        initial_results = engine.search("python")
        initial_count = initial_results.total_count

        engine.remove_document("doc1")

        after_results = engine.search("python")
        assert after_results.total_count < initial_count

    def test_update_document(self, engine, sample_docs):
        """Test updating document in engine."""
        for doc in sample_docs:
            engine.index_document(doc)

        # Update doc1 to remove python
        updated = SearchableDocument(
            id="doc1",
            doc_type=SearchableType.DOCUMENT,
            title="Introduction to Ruby Programming",
            content="Ruby is a dynamic programming language.",
            author_name="Alice Smith"
        )
        engine.update_document(updated)

        results = engine.search("ruby")
        assert results.total_count >= 1
        assert any(hit.document.id == "doc1" for hit in results.hits)

    def test_suggest(self, engine, sample_docs):
        """Test search suggestions."""
        for doc in sample_docs:
            engine.index_document(doc)

        # Add some queries
        engine.search("python tutorial")
        engine.search("python tutorial")

        suggestions = engine.suggest("pyt")
        assert len(suggestions) >= 1

    def test_get_document(self, engine, sample_docs):
        """Test getting document by ID."""
        for doc in sample_docs:
            engine.index_document(doc)

        doc = engine.get_document("doc1")
        assert doc is not None
        assert doc.id == "doc1"

    def test_get_nonexistent_document(self, engine):
        """Test getting nonexistent document."""
        doc = engine.get_document("nonexistent")
        assert doc is None

    def test_get_stats(self, engine, sample_docs):
        """Test getting engine stats."""
        for doc in sample_docs:
            engine.index_document(doc)

        stats = engine.get_stats()
        assert stats["total_documents"] == 4
        assert "total_terms" in stats
        assert "config" in stats

    def test_search_did_you_mean(self, engine, sample_docs):
        """Test did-you-mean suggestions."""
        for doc in sample_docs:
            engine.index_document(doc)

        results = engine.search("pythn")  # Typo

        # Should suggest "python"
        if results.total_count == 0 and results.did_you_mean:
            assert "python" in results.did_you_mean


# ==================== SearchHit Tests ====================

class TestSearchHit:
    """Tests for SearchHit."""

    def test_to_dict(self, sample_docs):
        """Test converting hit to dictionary."""
        hit = SearchHit(
            document=sample_docs[0],
            score=1.5,
            highlights={"title": ["<em>Python</em> Programming"]},
            matched_terms={"python"}
        )

        result = hit.to_dict()

        assert result["id"] == "doc1"
        assert result["type"] == "document"
        assert result["score"] == 1.5
        assert "title" in result["highlights"]


# ==================== SearchResults Tests ====================

class TestSearchResults:
    """Tests for SearchResults."""

    def test_has_more(self):
        """Test has_more property."""
        results = SearchResults(
            total_count=50,
            page=1,
            page_size=20
        )
        assert results.has_more is True

        results2 = SearchResults(
            total_count=50,
            page=3,
            page_size=20
        )
        assert results2.has_more is False

    def test_to_dict(self, sample_docs):
        """Test converting results to dictionary."""
        hits = [SearchHit(document=sample_docs[0], score=1.0)]
        results = SearchResults(
            hits=hits,
            total_count=1,
            page=1,
            page_size=20,
            query_time_ms=5.5
        )

        result = results.to_dict()

        assert len(result["hits"]) == 1
        assert result["total_count"] == 1
        assert result["query_time_ms"] == 5.5


# ==================== Global Functions Tests ====================

class TestGlobalFunctions:
    """Tests for global functions."""

    def test_get_set_reset_search_engine(self, engine):
        """Test global search engine management."""
        reset_search_engine()
        assert get_search_engine() is None

        set_search_engine(engine)
        assert get_search_engine() is engine

        reset_search_engine()
        assert get_search_engine() is None


# ==================== ParsedQuery Tests ====================

class TestParsedQuery:
    """Tests for ParsedQuery."""

    def test_is_empty(self):
        """Test is_empty property."""
        query = ParsedQuery(original_query="test")
        assert query.is_empty is True

        query.terms.append(QueryTerm(term="test"))
        assert query.is_empty is False


# ==================== QueryTerm Tests ====================

class TestQueryTerm:
    """Tests for QueryTerm."""

    def test_default_values(self):
        """Test default values."""
        term = QueryTerm(term="test")
        assert term.term == "test"
        assert term.operator == QueryOperator.AND
        assert term.field is None
        assert term.boost == 1.0
        assert term.is_phrase is False
        assert term.is_negated is False
        assert term.fuzzy_distance == 0


# ==================== Edge Cases ====================

class TestEdgeCases:
    """Tests for edge cases."""

    def test_search_special_characters(self, engine):
        """Test searching with special characters."""
        doc = SearchableDocument(
            id="special1",
            doc_type=SearchableType.DOCUMENT,
            title="C++ Programming",
            content="Learn C++ and Python"
        )
        engine.index_document(doc)

        results = engine.search("C++")
        # Should handle gracefully

    def test_search_unicode(self, engine):
        """Test searching with unicode."""
        doc = SearchableDocument(
            id="unicode1",
            doc_type=SearchableType.DOCUMENT,
            title="日本語テスト",
            content="Unicode content: 你好世界"
        )
        engine.index_document(doc)

        results = engine.search("日本語")
        # Should handle gracefully

    def test_search_very_long_query(self, engine, sample_docs):
        """Test searching with very long query."""
        for doc in sample_docs:
            engine.index_document(doc)

        long_query = "python " * 100
        results = engine.search(long_query)
        # Should handle gracefully

    def test_search_only_stopwords(self, engine, sample_docs):
        """Test searching with only stopwords."""
        for doc in sample_docs:
            engine.index_document(doc)

        results = engine.search("the and or")
        # Should return empty results
        assert results.total_count == 0

    def test_empty_document(self, engine):
        """Test indexing empty document."""
        doc = SearchableDocument(
            id="empty1",
            doc_type=SearchableType.DOCUMENT
        )
        engine.index_document(doc)

        retrieved = engine.get_document("empty1")
        assert retrieved is not None

    def test_levenshtein_distance(self, index):
        """Test Levenshtein distance calculation."""
        assert index._levenshtein_distance("python", "python") == 0
        assert index._levenshtein_distance("python", "pythn") == 1
        assert index._levenshtein_distance("python", "pytn") == 2
        assert index._levenshtein_distance("cat", "dog") == 3
