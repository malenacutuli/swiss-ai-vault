"""
Tests for the Knowledge Base & Documentation module.
"""

import pytest
from datetime import datetime, timedelta

from app.collaboration.knowledge_base import (
    KnowledgeBaseManager,
    KnowledgeBaseRegistry,
    KnowledgeBaseSettings,
    Article,
    ArticleStatus,
    ArticleVisibility,
    ArticleVersion,
    ArticleContributor,
    ArticleReaction,
    ArticleView,
    ArticleComment,
    ArticleAttachment,
    ArticleLink,
    ArticleTemplate,
    Category,
    CategoryStatus,
    ContentType,
    ReactionType,
    ContributorRole,
    SearchResult,
    get_knowledge_base_manager,
    set_knowledge_base_manager,
    reset_knowledge_base_manager,
)


class TestArticleVersion:
    """Tests for ArticleVersion."""

    def test_create_version(self):
        """Test creating an article version."""
        version = ArticleVersion(
            id="v1",
            article_id="art1",
            version_number=1,
            title="Test Article",
            content="This is the content of the article.",
            author_id="user1",
        )

        assert version.id == "v1"
        assert version.article_id == "art1"
        assert version.version_number == 1
        assert version.title == "Test Article"
        assert version.word_count == 7

    def test_version_to_dict(self):
        """Test version to_dict."""
        version = ArticleVersion(
            id="v1",
            article_id="art1",
            version_number=1,
            title="Test",
            content="Content",
        )

        data = version.to_dict()
        assert data["id"] == "v1"
        assert data["version_number"] == 1


class TestArticleContributor:
    """Tests for ArticleContributor."""

    def test_create_contributor(self):
        """Test creating a contributor."""
        contributor = ArticleContributor(
            id="c1",
            article_id="art1",
            user_id="user1",
            role=ContributorRole.AUTHOR,
        )

        assert contributor.id == "c1"
        assert contributor.user_id == "user1"
        assert contributor.role == ContributorRole.AUTHOR
        assert contributor.contribution_count == 0

    def test_record_contribution(self):
        """Test recording a contribution."""
        contributor = ArticleContributor(
            id="c1",
            article_id="art1",
            user_id="user1",
        )

        contributor.record_contribution()
        assert contributor.contribution_count == 1
        assert contributor.last_contribution_at is not None


class TestArticleReaction:
    """Tests for ArticleReaction."""

    def test_create_reaction(self):
        """Test creating a reaction."""
        reaction = ArticleReaction(
            id="r1",
            article_id="art1",
            user_id="user1",
            reaction_type=ReactionType.LIKE,
        )

        assert reaction.id == "r1"
        assert reaction.reaction_type == ReactionType.LIKE


class TestArticleComment:
    """Tests for ArticleComment."""

    def test_create_comment(self):
        """Test creating a comment."""
        comment = ArticleComment(
            id="c1",
            article_id="art1",
            author_id="user1",
            content="Great article!",
        )

        assert comment.id == "c1"
        assert comment.content == "Great article!"
        assert not comment.is_resolved

    def test_update_comment(self):
        """Test updating a comment."""
        comment = ArticleComment(
            id="c1",
            article_id="art1",
            author_id="user1",
            content="Original",
        )

        comment.update("Updated content")
        assert comment.content == "Updated content"
        assert comment.updated_at is not None

    def test_resolve_comment(self):
        """Test resolving a comment."""
        comment = ArticleComment(
            id="c1",
            article_id="art1",
            author_id="user1",
            content="Fix this",
        )

        comment.resolve("admin1")
        assert comment.is_resolved
        assert comment.resolved_by == "admin1"
        assert comment.resolved_at is not None

    def test_unresolve_comment(self):
        """Test unresolving a comment."""
        comment = ArticleComment(
            id="c1",
            article_id="art1",
            author_id="user1",
            content="Fix this",
        )

        comment.resolve("admin1")
        comment.unresolve()
        assert not comment.is_resolved
        assert comment.resolved_by is None

    def test_comment_reactions(self):
        """Test comment reactions."""
        comment = ArticleComment(
            id="c1",
            article_id="art1",
            author_id="user1",
            content="Comment",
        )

        comment.add_reaction("user2", "thumbsup")
        assert "thumbsup" in comment.reactions
        assert "user2" in comment.reactions["thumbsup"]

        comment.remove_reaction("user2", "thumbsup")
        assert "user2" not in comment.reactions.get("thumbsup", set())


class TestArticle:
    """Tests for Article."""

    def test_create_article(self):
        """Test creating an article."""
        article = Article(
            id="art1",
            title="Getting Started",
            slug="getting-started",
            author_id="user1",
            content="This is a getting started guide.",
        )

        assert article.id == "art1"
        assert article.title == "Getting Started"
        assert article.slug == "getting-started"
        assert article.status == ArticleStatus.DRAFT
        assert article.word_count == 6
        assert article.reading_time_minutes == 1

    def test_update_content(self):
        """Test updating article content."""
        article = Article(
            id="art1",
            title="Test",
            slug="test",
            author_id="user1",
            content="Short",
        )

        old_version = article.version
        article.update_content("This is a much longer content " * 50)

        assert article.version == old_version + 1
        assert article.updated_at is not None
        assert article.word_count > 100

    def test_publish_article(self):
        """Test publishing an article."""
        article = Article(
            id="art1",
            title="Test",
            slug="test",
            author_id="user1",
        )

        assert article.is_draft
        article.publish()
        assert article.is_published
        assert article.published_at is not None

    def test_archive_article(self):
        """Test archiving an article."""
        article = Article(
            id="art1",
            title="Test",
            slug="test",
            author_id="user1",
        )

        article.archive()
        assert article.is_archived
        assert article.archived_at is not None

    def test_submit_for_review(self):
        """Test submitting article for review."""
        article = Article(
            id="art1",
            title="Test",
            slug="test",
            author_id="user1",
        )

        article.submit_for_review()
        assert article.status == ArticleStatus.IN_REVIEW

    def test_article_tags(self):
        """Test article tags."""
        article = Article(
            id="art1",
            title="Test",
            slug="test",
            author_id="user1",
        )

        article.add_tag("Python")
        article.add_tag("Tutorial")
        assert "python" in article.tags
        assert "tutorial" in article.tags

        article.remove_tag("PYTHON")
        assert "python" not in article.tags

    def test_article_counters(self):
        """Test article counters."""
        article = Article(
            id="art1",
            title="Test",
            slug="test",
            author_id="user1",
        )

        article.increment_view()
        article.increment_view()
        assert article.view_count == 2

        article.increment_like()
        assert article.like_count == 1
        article.decrement_like()
        assert article.like_count == 0

        article.increment_bookmark()
        assert article.bookmark_count == 1

        article.increment_comment()
        article.increment_comment()
        assert article.comment_count == 2
        article.decrement_comment()
        assert article.comment_count == 1

    def test_article_to_dict(self):
        """Test article to_dict."""
        article = Article(
            id="art1",
            title="Test",
            slug="test",
            author_id="user1",
            tags={"python", "guide"},
        )

        data = article.to_dict()
        assert data["id"] == "art1"
        assert data["title"] == "Test"
        assert set(data["tags"]) == {"python", "guide"}


class TestCategory:
    """Tests for Category."""

    def test_create_category(self):
        """Test creating a category."""
        category = Category(
            id="cat1",
            name="Tutorials",
            slug="tutorials",
            description="Tutorial articles",
        )

        assert category.id == "cat1"
        assert category.name == "Tutorials"
        assert category.status == CategoryStatus.ACTIVE

    def test_update_category(self):
        """Test updating a category."""
        category = Category(
            id="cat1",
            name="Tutorials",
            slug="tutorials",
        )

        category.update(name="Guides", description="Guide articles")
        assert category.name == "Guides"
        assert category.description == "Guide articles"
        assert category.updated_at is not None

    def test_archive_category(self):
        """Test archiving a category."""
        category = Category(
            id="cat1",
            name="Tutorials",
            slug="tutorials",
        )

        category.archive()
        assert category.status == CategoryStatus.ARCHIVED

        category.activate()
        assert category.status == CategoryStatus.ACTIVE

    def test_category_article_count(self):
        """Test category article count."""
        category = Category(
            id="cat1",
            name="Tutorials",
            slug="tutorials",
        )

        category.increment_article_count()
        category.increment_article_count()
        assert category.article_count == 2

        category.decrement_article_count()
        assert category.article_count == 1


class TestKnowledgeBaseSettings:
    """Tests for KnowledgeBaseSettings."""

    def test_default_settings(self):
        """Test default settings."""
        settings = KnowledgeBaseSettings(workspace_id="ws1")

        assert settings.workspace_id == "ws1"
        assert settings.default_visibility == ArticleVisibility.INTERNAL
        assert settings.enable_versioning
        assert settings.enable_comments
        assert settings.max_attachment_size_mb == 10

    def test_settings_to_dict(self):
        """Test settings to_dict."""
        settings = KnowledgeBaseSettings(workspace_id="ws1")
        data = settings.to_dict()

        assert data["workspace_id"] == "ws1"
        assert data["enable_versioning"]


class TestKnowledgeBaseRegistry:
    """Tests for KnowledgeBaseRegistry."""

    @pytest.fixture
    def registry(self):
        """Create a fresh registry."""
        return KnowledgeBaseRegistry()

    def test_create_article(self, registry):
        """Test creating an article."""
        article = registry.create_article(
            title="Getting Started",
            slug="getting-started",
            author_id="user1",
            content="Welcome to the knowledge base.",
        )

        assert article.id is not None
        assert article.title == "Getting Started"
        assert article.slug == "getting-started"

    def test_create_article_duplicate_slug(self, registry):
        """Test creating article with duplicate slug."""
        registry.create_article(
            title="Article 1",
            slug="test-slug",
            author_id="user1",
        )

        with pytest.raises(ValueError, match="already exists"):
            registry.create_article(
                title="Article 2",
                slug="test-slug",
                author_id="user1",
            )

    def test_get_article(self, registry):
        """Test getting an article by ID."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        retrieved = registry.get_article(article.id)
        assert retrieved is not None
        assert retrieved.id == article.id

    def test_get_article_by_slug(self, registry):
        """Test getting an article by slug."""
        article = registry.create_article(
            title="Test",
            slug="my-article",
            author_id="user1",
        )

        retrieved = registry.get_article_by_slug("my-article")
        assert retrieved is not None
        assert retrieved.slug == "my-article"

    def test_update_article(self, registry):
        """Test updating an article."""
        article = registry.create_article(
            title="Original Title",
            slug="test",
            author_id="user1",
            content="Original content",
        )

        updated = registry.update_article(
            article_id=article.id,
            title="New Title",
            content="New content",
            editor_id="user1",
            change_description="Updated title and content",
        )

        assert updated is not None
        assert updated.title == "New Title"
        assert updated.content == "New content"

    def test_delete_article(self, registry):
        """Test deleting an article."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        result = registry.delete_article(article.id)
        assert result

        retrieved = registry.get_article(article.id)
        assert retrieved is None

    def test_list_articles(self, registry):
        """Test listing articles."""
        registry.create_article(title="Article 1", slug="art1", author_id="user1")
        registry.create_article(title="Article 2", slug="art2", author_id="user2")
        registry.create_article(title="Article 3", slug="art3", author_id="user1")

        articles = registry.list_articles()
        assert len(articles) == 3

        by_author = registry.list_articles(author_id="user1")
        assert len(by_author) == 2

    def test_list_articles_by_status(self, registry):
        """Test listing articles by status."""
        art1 = registry.create_article(title="Draft", slug="draft", author_id="user1")
        art2 = registry.create_article(title="Published", slug="pub", author_id="user1")
        registry.publish_article(art2.id)

        drafts = registry.list_articles(status=ArticleStatus.DRAFT)
        assert len(drafts) == 1

        published = registry.list_articles(status=ArticleStatus.PUBLISHED)
        assert len(published) == 1

    def test_list_articles_by_tags(self, registry):
        """Test listing articles by tags."""
        art1 = registry.create_article(
            title="Python Guide",
            slug="python",
            author_id="user1",
            tags={"python", "tutorial"},
        )
        art2 = registry.create_article(
            title="JavaScript Guide",
            slug="js",
            author_id="user1",
            tags={"javascript", "tutorial"},
        )

        python_articles = registry.list_articles(tags={"python"})
        assert len(python_articles) == 1

        tutorials = registry.list_articles(tags={"tutorial"})
        assert len(tutorials) == 2

    def test_search_articles(self, registry):
        """Test searching articles."""
        registry.create_article(
            title="Python Tutorial",
            slug="python-tutorial",
            author_id="user1",
            content="Learn Python programming basics.",
            summary="A beginner's guide to Python",
        )
        registry.create_article(
            title="JavaScript Guide",
            slug="js-guide",
            author_id="user1",
            content="Master JavaScript development.",
        )

        results = registry.search_articles("Python")
        assert len(results) >= 1
        assert results[0].title == "Python Tutorial"

    def test_publish_article(self, registry):
        """Test publishing an article."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        registry.publish_article(article.id)
        updated = registry.get_article(article.id)
        assert updated.status == ArticleStatus.PUBLISHED

    def test_archive_article(self, registry):
        """Test archiving an article."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        registry.archive_article(article.id)
        updated = registry.get_article(article.id)
        assert updated.status == ArticleStatus.ARCHIVED

    def test_article_versions(self, registry):
        """Test article version history."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
            content="Initial content",
        )

        # Initial version is created
        versions = registry.get_article_versions(article.id)
        assert len(versions) == 1

        # Update creates new version
        registry.update_article(
            article.id,
            content="Updated content",
            editor_id="user1",
        )

        versions = registry.get_article_versions(article.id)
        assert len(versions) == 2

    def test_get_version(self, registry):
        """Test getting a specific version."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
            content="Version 1",
        )

        registry.update_article(article.id, content="Version 2", editor_id="user1")

        v1 = registry.get_version(article.id, 1)
        assert v1 is not None
        assert v1.content == "Version 1"

        v2 = registry.get_version(article.id, 2)
        assert v2 is not None
        assert v2.content == "Version 2"

    def test_restore_version(self, registry):
        """Test restoring to a previous version."""
        article = registry.create_article(
            title="Original",
            slug="test",
            author_id="user1",
            content="Original content",
        )

        registry.update_article(article.id, content="New content", editor_id="user1")

        restored = registry.restore_version(article.id, 1, "user1")
        assert restored.content == "Original content"

    def test_add_contributor(self, registry):
        """Test adding a contributor."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        contributor = registry.add_contributor(
            article.id, "user2", ContributorRole.EDITOR, "user1"
        )
        assert contributor is not None
        assert contributor.user_id == "user2"
        assert contributor.role == ContributorRole.EDITOR

    def test_get_contributors(self, registry):
        """Test getting contributors."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        registry.add_contributor(article.id, "user2", ContributorRole.EDITOR, "user1")

        contributors = registry.get_contributors(article.id)
        assert len(contributors) == 2  # Author + editor

    def test_remove_contributor(self, registry):
        """Test removing a contributor."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        registry.add_contributor(article.id, "user2", ContributorRole.EDITOR, "user1")

        result = registry.remove_contributor(article.id, "user2")
        assert result

        contributors = registry.get_contributors(article.id)
        assert len(contributors) == 1

    def test_add_reaction(self, registry):
        """Test adding a reaction."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        reaction = registry.add_reaction(article.id, "user2", ReactionType.LIKE)
        assert reaction is not None

        updated = registry.get_article(article.id)
        assert updated.like_count == 1

    def test_remove_reaction(self, registry):
        """Test removing a reaction."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        registry.add_reaction(article.id, "user2", ReactionType.LIKE)
        registry.remove_reaction(article.id, "user2", ReactionType.LIKE)

        updated = registry.get_article(article.id)
        assert updated.like_count == 0

    def test_get_user_bookmarks(self, registry):
        """Test getting user bookmarks."""
        art1 = registry.create_article(title="Art 1", slug="art1", author_id="user1")
        art2 = registry.create_article(title="Art 2", slug="art2", author_id="user1")

        registry.add_reaction(art1.id, "user2", ReactionType.BOOKMARK)
        registry.add_reaction(art2.id, "user2", ReactionType.BOOKMARK)

        bookmarks = registry.get_user_bookmarks("user2")
        assert len(bookmarks) == 2

    def test_record_view(self, registry):
        """Test recording a view."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        view = registry.record_view(article.id, "user2", duration_seconds=60)
        assert view is not None

        updated = registry.get_article(article.id)
        assert updated.view_count == 1

    def test_get_view_stats(self, registry):
        """Test getting view statistics."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        registry.record_view(article.id, "user1", duration_seconds=30)
        registry.record_view(article.id, "user2", duration_seconds=60)
        registry.record_view(article.id, "user1", duration_seconds=45)

        stats = registry.get_view_stats(article.id)
        assert stats["total_views"] == 3
        assert stats["unique_viewers"] == 2
        assert stats["total_duration_seconds"] == 135

    def test_add_comment(self, registry):
        """Test adding a comment."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        comment = registry.add_comment(article.id, "user2", "Great article!")
        assert comment is not None
        assert comment.content == "Great article!"

        updated = registry.get_article(article.id)
        assert updated.comment_count == 1

    def test_comment_thread(self, registry):
        """Test comment threading."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        parent = registry.add_comment(article.id, "user2", "Parent comment")
        child = registry.add_comment(
            article.id, "user3", "Reply", parent_id=parent.id
        )

        assert child.parent_id == parent.id

    def test_update_comment(self, registry):
        """Test updating a comment."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        comment = registry.add_comment(article.id, "user2", "Original")
        updated = registry.update_comment(comment.id, "Updated content")

        assert updated.content == "Updated content"

    def test_delete_comment(self, registry):
        """Test deleting a comment."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        comment = registry.add_comment(article.id, "user2", "Comment")
        result = registry.delete_comment(comment.id)

        assert result
        updated = registry.get_article(article.id)
        assert updated.comment_count == 0

    def test_resolve_comment(self, registry):
        """Test resolving a comment."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        comment = registry.add_comment(article.id, "user2", "Fix this issue")
        resolved = registry.resolve_comment(comment.id, "user1")

        assert resolved.is_resolved
        assert resolved.resolved_by == "user1"

    def test_get_comments(self, registry):
        """Test getting comments."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        c1 = registry.add_comment(article.id, "user2", "Comment 1")
        c2 = registry.add_comment(article.id, "user3", "Comment 2")
        registry.resolve_comment(c1.id, "user1")

        all_comments = registry.get_comments(article.id)
        assert len(all_comments) == 2

        unresolved = registry.get_comments(article.id, include_resolved=False)
        assert len(unresolved) == 1

    def test_add_attachment(self, registry):
        """Test adding an attachment."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        attachment = registry.add_attachment(
            article.id,
            filename="doc.pdf",
            file_path="/uploads/doc.pdf",
            uploaded_by="user1",
            file_size=1024,
            mime_type="application/pdf",
        )

        assert attachment is not None
        assert attachment.filename == "doc.pdf"

    def test_get_attachments(self, registry):
        """Test getting attachments."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        registry.add_attachment(article.id, "file1.pdf", "/path1", "user1")
        registry.add_attachment(article.id, "file2.png", "/path2", "user1")

        attachments = registry.get_attachments(article.id)
        assert len(attachments) == 2

    def test_delete_attachment(self, registry):
        """Test deleting an attachment."""
        article = registry.create_article(
            title="Test",
            slug="test",
            author_id="user1",
        )

        attachment = registry.add_attachment(article.id, "file.pdf", "/path", "user1")
        result = registry.delete_attachment(attachment.id)

        assert result
        attachments = registry.get_attachments(article.id)
        assert len(attachments) == 0

    def test_add_link(self, registry):
        """Test adding a link between articles."""
        art1 = registry.create_article(title="Art 1", slug="art1", author_id="user1")
        art2 = registry.create_article(title="Art 2", slug="art2", author_id="user1")

        link = registry.add_link(art1.id, art2.id, "related", "user1")
        assert link is not None
        assert link.source_article_id == art1.id
        assert link.target_article_id == art2.id

    def test_get_links(self, registry):
        """Test getting article links."""
        art1 = registry.create_article(title="Art 1", slug="art1", author_id="user1")
        art2 = registry.create_article(title="Art 2", slug="art2", author_id="user1")
        art3 = registry.create_article(title="Art 3", slug="art3", author_id="user1")

        registry.add_link(art1.id, art2.id, "related", "user1")
        registry.add_link(art1.id, art3.id, "see_also", "user1")

        links = registry.get_links(art1.id)
        assert len(links) == 2

    def test_get_backlinks(self, registry):
        """Test getting backlinks to an article."""
        art1 = registry.create_article(title="Art 1", slug="art1", author_id="user1")
        art2 = registry.create_article(title="Art 2", slug="art2", author_id="user1")
        art3 = registry.create_article(title="Art 3", slug="art3", author_id="user1")

        registry.add_link(art2.id, art1.id, "related", "user1")
        registry.add_link(art3.id, art1.id, "related", "user1")

        backlinks = registry.get_backlinks(art1.id)
        assert len(backlinks) == 2

    def test_create_category(self, registry):
        """Test creating a category."""
        category = registry.create_category(
            name="Tutorials",
            slug="tutorials",
            description="Tutorial articles",
            icon="book",
            color="#3498db",
        )

        assert category.id is not None
        assert category.name == "Tutorials"
        assert category.slug == "tutorials"

    def test_create_category_duplicate_slug(self, registry):
        """Test creating category with duplicate slug."""
        registry.create_category(name="Cat 1", slug="test-cat")

        with pytest.raises(ValueError, match="already exists"):
            registry.create_category(name="Cat 2", slug="test-cat")

    def test_get_category(self, registry):
        """Test getting a category."""
        category = registry.create_category(name="Test", slug="test")

        retrieved = registry.get_category(category.id)
        assert retrieved is not None
        assert retrieved.id == category.id

    def test_get_category_by_slug(self, registry):
        """Test getting a category by slug."""
        category = registry.create_category(name="Test", slug="my-category")

        retrieved = registry.get_category_by_slug("my-category")
        assert retrieved is not None
        assert retrieved.slug == "my-category"

    def test_update_category(self, registry):
        """Test updating a category."""
        category = registry.create_category(name="Old Name", slug="test")

        updated = registry.update_category(
            category.id,
            name="New Name",
            description="Updated description",
        )

        assert updated.name == "New Name"
        assert updated.description == "Updated description"

    def test_delete_category(self, registry):
        """Test deleting a category."""
        category = registry.create_category(name="Test", slug="test")

        result = registry.delete_category(category.id)
        assert result

        retrieved = registry.get_category(category.id)
        assert retrieved is None

    def test_list_categories(self, registry):
        """Test listing categories."""
        registry.create_category(name="Cat 1", slug="cat1", workspace_id="ws1")
        registry.create_category(name="Cat 2", slug="cat2", workspace_id="ws1")
        registry.create_category(name="Cat 3", slug="cat3", workspace_id="ws2")

        all_cats = registry.list_categories()
        assert len(all_cats) == 3

        ws1_cats = registry.list_categories(workspace_id="ws1")
        assert len(ws1_cats) == 2

    def test_category_tree(self, registry):
        """Test getting category tree."""
        parent = registry.create_category(name="Parent", slug="parent")
        child1 = registry.create_category(name="Child 1", slug="child1", parent_id=parent.id)
        child2 = registry.create_category(name="Child 2", slug="child2", parent_id=parent.id)

        tree = registry.get_category_tree()
        assert len(tree) == 1
        assert len(tree[0]["children"]) == 2

    def test_category_article_count(self, registry):
        """Test category article count updates."""
        category = registry.create_category(name="Test", slug="test")

        art1 = registry.create_article(
            title="Art 1",
            slug="art1",
            author_id="user1",
            category_id=category.id,
        )

        updated_cat = registry.get_category(category.id)
        assert updated_cat.article_count == 1

        registry.delete_article(art1.id)
        updated_cat = registry.get_category(category.id)
        assert updated_cat.article_count == 0

    def test_get_settings(self, registry):
        """Test getting settings."""
        settings = registry.get_settings("ws1")
        assert settings.workspace_id == "ws1"
        assert settings.enable_versioning

    def test_update_settings(self, registry):
        """Test updating settings."""
        settings = registry.update_settings(
            "ws1",
            require_review=True,
            max_attachment_size_mb=20,
        )

        assert settings.require_review
        assert settings.max_attachment_size_mb == 20

    def test_get_stats(self, registry):
        """Test getting statistics."""
        art1 = registry.create_article(title="Art 1", slug="art1", author_id="user1")
        art2 = registry.create_article(title="Art 2", slug="art2", author_id="user1")
        registry.publish_article(art2.id)

        registry.create_category(name="Cat 1", slug="cat1")

        stats = registry.get_stats()
        assert stats["total_articles"] == 2
        assert stats["total_categories"] == 1
        assert stats["published_articles"] == 1
        assert stats["draft_articles"] == 1


class TestKnowledgeBaseManager:
    """Tests for KnowledgeBaseManager."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager."""
        return KnowledgeBaseManager()

    def test_create_article(self, manager):
        """Test creating an article."""
        article = manager.create_article(
            title="Getting Started Guide",
            author_id="user1",
            content="Welcome to the platform!",
        )

        assert article.id is not None
        assert article.title == "Getting Started Guide"
        assert article.slug == "getting-started-guide"

    def test_create_article_auto_slug(self, manager):
        """Test automatic slug generation."""
        article = manager.create_article(
            title="How to Use Python!",
            author_id="user1",
        )

        assert article.slug == "how-to-use-python"

    def test_create_article_slug_uniqueness(self, manager):
        """Test slug uniqueness."""
        art1 = manager.create_article(title="Test Article", author_id="user1")
        art2 = manager.create_article(title="Test Article", author_id="user1")

        assert art1.slug != art2.slug
        assert art2.slug == "test-article-1"

    def test_get_article(self, manager):
        """Test getting an article."""
        article = manager.create_article(title="Test", author_id="user1")

        retrieved = manager.get_article(article.id)
        assert retrieved is not None
        assert retrieved.id == article.id

    def test_get_article_by_slug(self, manager):
        """Test getting an article by slug."""
        article = manager.create_article(title="My Article", author_id="user1")

        retrieved = manager.get_article_by_slug("my-article")
        assert retrieved is not None

    def test_update_article(self, manager):
        """Test updating an article."""
        article = manager.create_article(
            title="Original",
            author_id="user1",
            content="Original content",
        )

        updated = manager.update_article(
            article.id,
            editor_id="user1",
            title="Updated",
            content="New content",
        )

        assert updated.title == "Updated"
        assert updated.content == "New content"

    def test_delete_article(self, manager):
        """Test deleting an article."""
        article = manager.create_article(title="Test", author_id="user1")

        result = manager.delete_article(article.id)
        assert result

        retrieved = manager.get_article(article.id)
        assert retrieved is None

    def test_publish_article(self, manager):
        """Test publishing an article."""
        article = manager.create_article(title="Test", author_id="user1")

        published = manager.publish_article(article.id)
        assert published.status == ArticleStatus.PUBLISHED

    def test_archive_article(self, manager):
        """Test archiving an article."""
        article = manager.create_article(title="Test", author_id="user1")

        archived = manager.archive_article(article.id)
        assert archived.status == ArticleStatus.ARCHIVED

    def test_submit_for_review(self, manager):
        """Test submitting for review."""
        article = manager.create_article(title="Test", author_id="user1")

        submitted = manager.submit_for_review(article.id)
        assert submitted.status == ArticleStatus.IN_REVIEW

    def test_list_articles(self, manager):
        """Test listing articles."""
        manager.create_article(title="Art 1", author_id="user1")
        manager.create_article(title="Art 2", author_id="user2")

        articles = manager.list_articles()
        assert len(articles) == 2

    def test_search_articles(self, manager):
        """Test searching articles."""
        manager.create_article(
            title="Python Guide",
            author_id="user1",
            content="Learn Python programming",
        )

        results = manager.search_articles("Python")
        assert len(results) >= 1

    def test_get_featured_articles(self, manager):
        """Test getting featured articles."""
        art1 = manager.create_article(title="Regular", author_id="user1")
        art2 = manager.create_article(title="Featured", author_id="user1")

        art2.featured = True
        manager.publish_article(art2.id)

        featured = manager.get_featured_articles()
        assert len(featured) == 1

    def test_get_recent_articles(self, manager):
        """Test getting recent articles."""
        art1 = manager.create_article(title="Art 1", author_id="user1")
        art2 = manager.create_article(title="Art 2", author_id="user1")
        manager.publish_article(art1.id)
        manager.publish_article(art2.id)

        recent = manager.get_recent_articles(limit=5)
        assert len(recent) == 2

    def test_get_popular_articles(self, manager):
        """Test getting popular articles."""
        art1 = manager.create_article(title="Popular", author_id="user1")
        art2 = manager.create_article(title="Less Popular", author_id="user1")

        manager.publish_article(art1.id)
        manager.publish_article(art2.id)

        # Record views
        for _ in range(10):
            manager.record_view(art1.id, "user1")
        for _ in range(5):
            manager.record_view(art2.id, "user1")

        popular = manager.get_popular_articles(limit=10)
        assert popular[0].id == art1.id

    def test_get_article_versions(self, manager):
        """Test getting article versions."""
        article = manager.create_article(
            title="Test",
            author_id="user1",
            content="V1",
        )

        manager.update_article(article.id, editor_id="user1", content="V2")

        versions = manager.get_article_versions(article.id)
        assert len(versions) == 2

    def test_compare_versions(self, manager):
        """Test comparing versions."""
        article = manager.create_article(
            title="Test",
            author_id="user1",
            content="Version 1 content",
        )

        manager.update_article(
            article.id,
            editor_id="user1",
            content="Version 2 content with more words",
        )

        comparison = manager.compare_versions(article.id, 1, 2)
        assert comparison is not None
        assert comparison["content_changed"]
        assert comparison["word_count_diff"] > 0

    def test_restore_version(self, manager):
        """Test restoring a version."""
        article = manager.create_article(
            title="Original",
            author_id="user1",
            content="Original",
        )

        manager.update_article(article.id, editor_id="user1", content="Changed")

        restored = manager.restore_version(article.id, 1, "user1")
        assert restored.content == "Original"

    def test_add_contributor(self, manager):
        """Test adding a contributor."""
        article = manager.create_article(title="Test", author_id="user1")

        contributor = manager.add_contributor(
            article.id, "user2", ContributorRole.EDITOR, "user1"
        )

        assert contributor is not None
        assert contributor.role == ContributorRole.EDITOR

    def test_get_contributors(self, manager):
        """Test getting contributors."""
        article = manager.create_article(title="Test", author_id="user1")
        manager.add_contributor(article.id, "user2", ContributorRole.REVIEWER, "user1")

        contributors = manager.get_contributors(article.id)
        assert len(contributors) == 2

    def test_like_article(self, manager):
        """Test liking an article."""
        article = manager.create_article(title="Test", author_id="user1")

        reaction = manager.like_article(article.id, "user2")
        assert reaction is not None

        updated = manager.get_article(article.id)
        assert updated.like_count == 1

    def test_unlike_article(self, manager):
        """Test unliking an article."""
        article = manager.create_article(title="Test", author_id="user1")

        manager.like_article(article.id, "user2")
        manager.unlike_article(article.id, "user2")

        updated = manager.get_article(article.id)
        assert updated.like_count == 0

    def test_bookmark_article(self, manager):
        """Test bookmarking an article."""
        article = manager.create_article(title="Test", author_id="user1")

        manager.bookmark_article(article.id, "user2")
        bookmarks = manager.get_user_bookmarks("user2")

        assert len(bookmarks) == 1

    def test_unbookmark_article(self, manager):
        """Test unbookmarking an article."""
        article = manager.create_article(title="Test", author_id="user1")

        manager.bookmark_article(article.id, "user2")
        manager.unbookmark_article(article.id, "user2")

        bookmarks = manager.get_user_bookmarks("user2")
        assert len(bookmarks) == 0

    def test_mark_outdated(self, manager):
        """Test marking article as outdated."""
        article = manager.create_article(title="Test", author_id="user1")

        reaction = manager.mark_outdated(article.id, "user2")
        assert reaction.reaction_type == ReactionType.OUTDATED

    def test_record_view(self, manager):
        """Test recording a view."""
        article = manager.create_article(title="Test", author_id="user1")

        view = manager.record_view(article.id, "user2", duration_seconds=30)
        assert view is not None

    def test_get_view_stats(self, manager):
        """Test getting view stats."""
        article = manager.create_article(title="Test", author_id="user1")

        manager.record_view(article.id, "user1", duration_seconds=30)
        manager.record_view(article.id, "user2", duration_seconds=60)

        stats = manager.get_view_stats(article.id)
        assert stats["total_views"] == 2
        assert stats["unique_viewers"] == 2

    def test_add_comment(self, manager):
        """Test adding a comment."""
        article = manager.create_article(title="Test", author_id="user1")

        comment = manager.add_comment(article.id, "user2", "Great article!")
        assert comment is not None

    def test_get_comment_thread(self, manager):
        """Test getting comment thread."""
        article = manager.create_article(title="Test", author_id="user1")

        parent = manager.add_comment(article.id, "user2", "Parent")
        manager.add_comment(article.id, "user3", "Reply 1", parent_id=parent.id)
        manager.add_comment(article.id, "user4", "Reply 2", parent_id=parent.id)

        thread = manager.get_comment_thread(article.id)
        assert len(thread) == 1
        assert len(thread[0]["replies"]) == 2

    def test_resolve_comment(self, manager):
        """Test resolving a comment."""
        article = manager.create_article(title="Test", author_id="user1")
        comment = manager.add_comment(article.id, "user2", "Fix this")

        resolved = manager.resolve_comment(comment.id, "user1")
        assert resolved.is_resolved

    def test_add_attachment(self, manager):
        """Test adding an attachment."""
        article = manager.create_article(title="Test", author_id="user1")

        attachment = manager.add_attachment(
            article.id,
            filename="doc.pdf",
            file_path="/uploads/doc.pdf",
            uploaded_by="user1",
        )

        assert attachment is not None

    def test_get_attachments(self, manager):
        """Test getting attachments."""
        article = manager.create_article(title="Test", author_id="user1")

        manager.add_attachment(article.id, "file1.pdf", "/path1", "user1")
        manager.add_attachment(article.id, "file2.png", "/path2", "user1")

        attachments = manager.get_attachments(article.id)
        assert len(attachments) == 2

    def test_add_link(self, manager):
        """Test adding a link between articles."""
        art1 = manager.create_article(title="Art 1", author_id="user1")
        art2 = manager.create_article(title="Art 2", author_id="user1")

        link = manager.add_link(art1.id, art2.id, "related", "user1")
        assert link is not None

    def test_get_related_articles(self, manager):
        """Test getting related articles."""
        art1 = manager.create_article(title="Art 1", author_id="user1")
        art2 = manager.create_article(title="Art 2", author_id="user1")
        art3 = manager.create_article(title="Art 3", author_id="user1")

        manager.add_link(art1.id, art2.id, "related", "user1")
        manager.add_link(art1.id, art3.id, "related", "user1")

        related = manager.get_related_articles(art1.id)
        assert len(related) == 2

    def test_get_articles_linking_to(self, manager):
        """Test getting articles that link to an article."""
        art1 = manager.create_article(title="Art 1", author_id="user1")
        art2 = manager.create_article(title="Art 2", author_id="user1")
        art3 = manager.create_article(title="Art 3", author_id="user1")

        manager.add_link(art2.id, art1.id, "related", "user1")
        manager.add_link(art3.id, art1.id, "related", "user1")

        linking = manager.get_articles_linking_to(art1.id)
        assert len(linking) == 2

    def test_create_category(self, manager):
        """Test creating a category."""
        category = manager.create_category(
            name="Tutorials",
            description="Tutorial articles",
        )

        assert category.id is not None
        assert category.slug == "tutorials"

    def test_create_category_auto_slug(self, manager):
        """Test auto slug generation for categories."""
        category = manager.create_category(name="Getting Started Guides")
        assert category.slug == "getting-started-guides"

    def test_get_category(self, manager):
        """Test getting a category."""
        category = manager.create_category(name="Test")

        retrieved = manager.get_category(category.id)
        assert retrieved is not None

    def test_update_category(self, manager):
        """Test updating a category."""
        category = manager.create_category(name="Old Name")

        updated = manager.update_category(category.id, name="New Name")
        assert updated.name == "New Name"

    def test_delete_category(self, manager):
        """Test deleting a category."""
        category = manager.create_category(name="Test")

        result = manager.delete_category(category.id)
        assert result

    def test_list_categories(self, manager):
        """Test listing categories."""
        manager.create_category(name="Cat 1")
        manager.create_category(name="Cat 2")

        categories = manager.list_categories()
        assert len(categories) == 2

    def test_get_category_tree(self, manager):
        """Test getting category tree."""
        parent = manager.create_category(name="Parent")
        manager.create_category(name="Child 1", parent_id=parent.id)
        manager.create_category(name="Child 2", parent_id=parent.id)

        tree = manager.get_category_tree()
        assert len(tree) == 1
        assert len(tree[0]["children"]) == 2

    def test_get_category_articles(self, manager):
        """Test getting category articles."""
        category = manager.create_category(name="Test")

        manager.create_article(title="Art 1", author_id="user1", category_id=category.id)
        manager.create_article(title="Art 2", author_id="user1", category_id=category.id)

        articles = manager.get_category_articles(category.id)
        assert len(articles) == 2

    def test_get_category_articles_with_subcategories(self, manager):
        """Test getting articles including subcategories."""
        parent = manager.create_category(name="Parent")
        child = manager.create_category(name="Child", parent_id=parent.id)

        manager.create_article(title="Parent Art", author_id="user1", category_id=parent.id)
        manager.create_article(title="Child Art", author_id="user1", category_id=child.id)

        articles = manager.get_category_articles(parent.id, include_subcategories=True)
        assert len(articles) == 2

    def test_get_settings(self, manager):
        """Test getting settings."""
        settings = manager.get_settings("ws1")
        assert settings.workspace_id == "ws1"

    def test_update_settings(self, manager):
        """Test updating settings."""
        settings = manager.update_settings("ws1", require_review=True)
        assert settings.require_review

    def test_get_stats(self, manager):
        """Test getting stats."""
        manager.create_article(title="Art 1", author_id="user1")
        manager.create_category(name="Cat 1")

        stats = manager.get_stats()
        assert stats["total_articles"] == 1
        assert stats["total_categories"] == 1

    def test_get_author_stats(self, manager):
        """Test getting author stats."""
        art1 = manager.create_article(title="Art 1", author_id="user1")
        art2 = manager.create_article(title="Art 2", author_id="user1")
        manager.publish_article(art1.id)

        manager.record_view(art1.id, "user2")
        manager.like_article(art1.id, "user2")

        stats = manager.get_author_stats("user1")
        assert stats["total_articles"] == 2
        assert stats["published_articles"] == 1
        assert stats["total_views"] == 1
        assert stats["total_likes"] == 1

    def test_get_trending_tags(self, manager):
        """Test getting trending tags."""
        art1 = manager.create_article(
            title="Python",
            author_id="user1",
            tags={"python", "tutorial"},
        )
        art2 = manager.create_article(
            title="JavaScript",
            author_id="user1",
            tags={"javascript", "tutorial"},
        )
        manager.publish_article(art1.id)
        manager.publish_article(art2.id)

        trending = manager.get_trending_tags(limit=5)
        assert len(trending) >= 2

        tag_names = [t["tag"] for t in trending]
        assert "tutorial" in tag_names


class TestGlobalInstances:
    """Tests for global instance management."""

    def test_set_and_get_manager(self):
        """Test setting and getting global manager."""
        reset_knowledge_base_manager()

        manager = KnowledgeBaseManager()
        set_knowledge_base_manager(manager)

        retrieved = get_knowledge_base_manager()
        assert retrieved is manager

        reset_knowledge_base_manager()

    def test_get_creates_default(self):
        """Test that get creates default manager."""
        reset_knowledge_base_manager()

        manager = get_knowledge_base_manager()
        assert manager is not None

        reset_knowledge_base_manager()


class TestKnowledgeBaseWorkflows:
    """Integration tests for complete workflows."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager."""
        return KnowledgeBaseManager()

    def test_complete_article_lifecycle(self, manager):
        """Test complete article lifecycle."""
        # Create draft
        article = manager.create_article(
            title="Getting Started with Python",
            author_id="author1",
            content="Learn Python programming basics.",
            tags={"python", "beginner"},
        )

        assert article.status == ArticleStatus.DRAFT

        # Add collaborators
        manager.add_contributor(article.id, "editor1", ContributorRole.EDITOR, "author1")
        manager.add_contributor(article.id, "reviewer1", ContributorRole.REVIEWER, "author1")

        # Update content
        manager.update_article(
            article.id,
            editor_id="editor1",
            content="Updated content with more details.",
            change_description="Added more examples",
        )

        # Check versions
        versions = manager.get_article_versions(article.id)
        assert len(versions) == 2

        # Submit for review
        manager.submit_for_review(article.id)
        article = manager.get_article(article.id)
        assert article.status == ArticleStatus.IN_REVIEW

        # Publish
        manager.publish_article(article.id)
        article = manager.get_article(article.id)
        assert article.status == ArticleStatus.PUBLISHED

        # Record engagement
        manager.record_view(article.id, "reader1", duration_seconds=120)
        manager.like_article(article.id, "reader1")
        manager.bookmark_article(article.id, "reader1")

        # Add comment
        comment = manager.add_comment(article.id, "reader1", "Very helpful!")
        manager.resolve_comment(comment.id, "author1")

        # Check final state
        article = manager.get_article(article.id)
        assert article.view_count == 1
        assert article.like_count == 1
        assert article.bookmark_count == 1
        assert article.comment_count == 1

    def test_category_organization(self, manager):
        """Test organizing articles in categories."""
        # Create category hierarchy
        programming = manager.create_category(
            name="Programming",
            description="Programming tutorials",
        )
        python = manager.create_category(
            name="Python",
            parent_id=programming.id,
        )
        javascript = manager.create_category(
            name="JavaScript",
            parent_id=programming.id,
        )

        # Create articles
        manager.create_article(
            title="Python Basics",
            author_id="user1",
            category_id=python.id,
        )
        manager.create_article(
            title="Advanced Python",
            author_id="user1",
            category_id=python.id,
        )
        manager.create_article(
            title="JavaScript Guide",
            author_id="user1",
            category_id=javascript.id,
        )

        # Get category tree
        tree = manager.get_category_tree()
        assert len(tree) == 1
        assert tree[0]["category"]["name"] == "Programming"
        assert len(tree[0]["children"]) == 2

        # Get all articles in programming (including subcategories)
        articles = manager.get_category_articles(programming.id, include_subcategories=True)
        assert len(articles) == 3

    def test_search_and_discovery(self, manager):
        """Test search and discovery features."""
        # Create articles
        art1 = manager.create_article(
            title="Introduction to Machine Learning",
            author_id="user1",
            content="Machine learning is a subset of AI...",
            tags={"ml", "ai", "beginner"},
        )
        art2 = manager.create_article(
            title="Deep Learning Tutorial",
            author_id="user1",
            content="Deep learning uses neural networks...",
            tags={"ml", "deep-learning", "advanced"},
        )
        art3 = manager.create_article(
            title="Web Development Guide",
            author_id="user1",
            content="Build modern web applications...",
            tags={"web", "frontend"},
        )

        # Publish articles
        manager.publish_article(art1.id)
        manager.publish_article(art2.id)
        manager.publish_article(art3.id)

        # Search
        ml_results = manager.search_articles("machine learning")
        assert len(ml_results) >= 1
        assert ml_results[0].article_id == art1.id

        # Get by tags
        ml_articles = manager.list_articles(tags={"ml"}, status=ArticleStatus.PUBLISHED)
        assert len(ml_articles) == 2

        # Get trending tags
        trending = manager.get_trending_tags()
        assert len(trending) > 0

    def test_version_control_workflow(self, manager):
        """Test version control workflow."""
        # Create article
        article = manager.create_article(
            title="API Documentation",
            author_id="author1",
            content="Version 1: Basic API info",
        )

        # Multiple updates
        manager.update_article(
            article.id,
            editor_id="author1",
            content="Version 2: Added endpoints",
            change_description="Added endpoint documentation",
        )

        manager.update_article(
            article.id,
            editor_id="author1",
            content="Version 3: Added examples",
            change_description="Added code examples",
        )

        # Check versions
        versions = manager.get_article_versions(article.id)
        assert len(versions) == 3

        # Compare versions
        comparison = manager.compare_versions(article.id, 1, 3)
        assert comparison["content_changed"]

        # Restore old version
        restored = manager.restore_version(article.id, 2, "author1")
        assert "endpoints" in restored.content

        # New version created
        versions = manager.get_article_versions(article.id)
        assert len(versions) == 4

    def test_related_articles_workflow(self, manager):
        """Test related articles workflow."""
        # Create articles
        intro = manager.create_article(
            title="Introduction to REST APIs",
            author_id="user1",
        )
        auth = manager.create_article(
            title="API Authentication",
            author_id="user1",
        )
        errors = manager.create_article(
            title="API Error Handling",
            author_id="user1",
        )

        # Create links
        manager.add_link(intro.id, auth.id, "next", "user1")
        manager.add_link(intro.id, errors.id, "related", "user1")
        manager.add_link(auth.id, errors.id, "next", "user1")

        # Get related from intro
        related = manager.get_related_articles(intro.id)
        assert len(related) == 2

        # Get articles linking to errors
        linking = manager.get_articles_linking_to(errors.id)
        assert len(linking) == 2
