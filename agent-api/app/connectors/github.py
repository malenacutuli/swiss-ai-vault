"""
GitHub Connector - Full GitHub API integration

Operations:
- Repositories: list, get, create, search
- Issues: list, get, create, update, comment
- Pull Requests: list, get, create, review, merge
- Code: search, get file contents
- Branches: list, create, delete
"""

import base64
import logging
from typing import Any, Dict, List, Optional

from app.connectors.base import BaseConnector, ConnectorResult, ConnectorCredentials

logger = logging.getLogger(__name__)


class GitHubConnector(BaseConnector):
    """GitHub API connector"""

    PROVIDER = "github"
    BASE_URL = "https://api.github.com"

    def _get_auth_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.credentials.access_token}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def test_connection(self) -> ConnectorResult:
        """Test GitHub connection by fetching user info"""
        result = await self._request("GET", "/user")
        if result.success:
            await self._update_last_used()
        return result

    # =========================================================================
    # USER OPERATIONS
    # =========================================================================

    async def get_user(self) -> ConnectorResult:
        """Get authenticated user info"""
        return await self._request("GET", "/user")

    async def get_user_repos(
        self,
        visibility: str = "all",
        sort: str = "updated",
        per_page: int = 30,
        page: int = 1,
    ) -> ConnectorResult:
        """List repositories for authenticated user"""
        return await self._request(
            "GET",
            "/user/repos",
            params={
                "visibility": visibility,
                "sort": sort,
                "per_page": per_page,
                "page": page,
            },
        )

    # =========================================================================
    # REPOSITORY OPERATIONS
    # =========================================================================

    async def get_repo(self, owner: str, repo: str) -> ConnectorResult:
        """Get repository details"""
        return await self._request("GET", f"/repos/{owner}/{repo}")

    async def create_repo(
        self,
        name: str,
        description: Optional[str] = None,
        private: bool = False,
        auto_init: bool = True,
    ) -> ConnectorResult:
        """Create a new repository"""
        return await self._request(
            "POST",
            "/user/repos",
            json={
                "name": name,
                "description": description,
                "private": private,
                "auto_init": auto_init,
            },
        )

    async def search_repos(
        self,
        query: str,
        sort: str = "stars",
        order: str = "desc",
        per_page: int = 10,
    ) -> ConnectorResult:
        """Search repositories"""
        return await self._request(
            "GET",
            "/search/repositories",
            params={
                "q": query,
                "sort": sort,
                "order": order,
                "per_page": per_page,
            },
        )

    # =========================================================================
    # ISSUES OPERATIONS
    # =========================================================================

    async def list_issues(
        self,
        owner: str,
        repo: str,
        state: str = "open",
        labels: Optional[str] = None,
        sort: str = "created",
        per_page: int = 30,
        page: int = 1,
    ) -> ConnectorResult:
        """List issues for a repository"""
        params = {
            "state": state,
            "sort": sort,
            "per_page": per_page,
            "page": page,
        }
        if labels:
            params["labels"] = labels

        return await self._request("GET", f"/repos/{owner}/{repo}/issues", params=params)

    async def get_issue(self, owner: str, repo: str, issue_number: int) -> ConnectorResult:
        """Get a specific issue"""
        return await self._request("GET", f"/repos/{owner}/{repo}/issues/{issue_number}")

    async def create_issue(
        self,
        owner: str,
        repo: str,
        title: str,
        body: Optional[str] = None,
        labels: Optional[List[str]] = None,
        assignees: Optional[List[str]] = None,
    ) -> ConnectorResult:
        """Create a new issue"""
        data = {"title": title}
        if body:
            data["body"] = body
        if labels:
            data["labels"] = labels
        if assignees:
            data["assignees"] = assignees

        return await self._request("POST", f"/repos/{owner}/{repo}/issues", json=data)

    async def update_issue(
        self,
        owner: str,
        repo: str,
        issue_number: int,
        title: Optional[str] = None,
        body: Optional[str] = None,
        state: Optional[str] = None,
        labels: Optional[List[str]] = None,
    ) -> ConnectorResult:
        """Update an issue"""
        data = {}
        if title:
            data["title"] = title
        if body:
            data["body"] = body
        if state:
            data["state"] = state
        if labels is not None:
            data["labels"] = labels

        return await self._request("PATCH", f"/repos/{owner}/{repo}/issues/{issue_number}", json=data)

    async def add_issue_comment(
        self,
        owner: str,
        repo: str,
        issue_number: int,
        body: str,
    ) -> ConnectorResult:
        """Add a comment to an issue"""
        return await self._request(
            "POST",
            f"/repos/{owner}/{repo}/issues/{issue_number}/comments",
            json={"body": body},
        )

    # =========================================================================
    # PULL REQUEST OPERATIONS
    # =========================================================================

    async def list_pull_requests(
        self,
        owner: str,
        repo: str,
        state: str = "open",
        sort: str = "created",
        direction: str = "desc",
        per_page: int = 30,
        page: int = 1,
    ) -> ConnectorResult:
        """List pull requests"""
        return await self._request(
            "GET",
            f"/repos/{owner}/{repo}/pulls",
            params={
                "state": state,
                "sort": sort,
                "direction": direction,
                "per_page": per_page,
                "page": page,
            },
        )

    async def get_pull_request(self, owner: str, repo: str, pull_number: int) -> ConnectorResult:
        """Get a specific pull request"""
        return await self._request("GET", f"/repos/{owner}/{repo}/pulls/{pull_number}")

    async def create_pull_request(
        self,
        owner: str,
        repo: str,
        title: str,
        head: str,
        base: str,
        body: Optional[str] = None,
        draft: bool = False,
    ) -> ConnectorResult:
        """Create a pull request"""
        data = {
            "title": title,
            "head": head,
            "base": base,
            "draft": draft,
        }
        if body:
            data["body"] = body

        return await self._request("POST", f"/repos/{owner}/{repo}/pulls", json=data)

    async def merge_pull_request(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        commit_title: Optional[str] = None,
        commit_message: Optional[str] = None,
        merge_method: str = "merge",  # merge, squash, rebase
    ) -> ConnectorResult:
        """Merge a pull request"""
        data = {"merge_method": merge_method}
        if commit_title:
            data["commit_title"] = commit_title
        if commit_message:
            data["commit_message"] = commit_message

        return await self._request("PUT", f"/repos/{owner}/{repo}/pulls/{pull_number}/merge", json=data)

    async def add_pr_review(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        body: str,
        event: str = "COMMENT",  # APPROVE, REQUEST_CHANGES, COMMENT
    ) -> ConnectorResult:
        """Add a review to a pull request"""
        return await self._request(
            "POST",
            f"/repos/{owner}/{repo}/pulls/{pull_number}/reviews",
            json={"body": body, "event": event},
        )

    # =========================================================================
    # CODE/FILE OPERATIONS
    # =========================================================================

    async def get_file_contents(
        self,
        owner: str,
        repo: str,
        path: str,
        ref: Optional[str] = None,
    ) -> ConnectorResult:
        """Get file contents from a repository"""
        params = {}
        if ref:
            params["ref"] = ref

        result = await self._request("GET", f"/repos/{owner}/{repo}/contents/{path}", params=params)

        if result.success and result.data:
            # Decode base64 content
            if result.data.get("encoding") == "base64":
                try:
                    content = base64.b64decode(result.data["content"]).decode("utf-8")
                    result.data["decoded_content"] = content
                except Exception as e:
                    logger.warning(f"Failed to decode file content: {e}")

        return result

    async def create_or_update_file(
        self,
        owner: str,
        repo: str,
        path: str,
        content: str,
        message: str,
        branch: Optional[str] = None,
        sha: Optional[str] = None,  # Required for updates
    ) -> ConnectorResult:
        """Create or update a file in a repository"""
        data = {
            "message": message,
            "content": base64.b64encode(content.encode()).decode(),
        }
        if branch:
            data["branch"] = branch
        if sha:
            data["sha"] = sha

        return await self._request("PUT", f"/repos/{owner}/{repo}/contents/{path}", json=data)

    async def search_code(
        self,
        query: str,
        repo: Optional[str] = None,
        language: Optional[str] = None,
        per_page: int = 10,
    ) -> ConnectorResult:
        """Search code across repositories"""
        q = query
        if repo:
            q += f" repo:{repo}"
        if language:
            q += f" language:{language}"

        return await self._request(
            "GET",
            "/search/code",
            params={"q": q, "per_page": per_page},
        )

    # =========================================================================
    # BRANCH OPERATIONS
    # =========================================================================

    async def list_branches(
        self,
        owner: str,
        repo: str,
        per_page: int = 30,
        page: int = 1,
    ) -> ConnectorResult:
        """List branches"""
        return await self._request(
            "GET",
            f"/repos/{owner}/{repo}/branches",
            params={"per_page": per_page, "page": page},
        )

    async def get_branch(self, owner: str, repo: str, branch: str) -> ConnectorResult:
        """Get branch details"""
        return await self._request("GET", f"/repos/{owner}/{repo}/branches/{branch}")

    async def create_branch(
        self,
        owner: str,
        repo: str,
        branch_name: str,
        source_sha: str,
    ) -> ConnectorResult:
        """Create a new branch"""
        return await self._request(
            "POST",
            f"/repos/{owner}/{repo}/git/refs",
            json={
                "ref": f"refs/heads/{branch_name}",
                "sha": source_sha,
            },
        )

    # =========================================================================
    # COMMIT OPERATIONS
    # =========================================================================

    async def list_commits(
        self,
        owner: str,
        repo: str,
        sha: Optional[str] = None,
        path: Optional[str] = None,
        per_page: int = 30,
        page: int = 1,
    ) -> ConnectorResult:
        """List commits"""
        params = {"per_page": per_page, "page": page}
        if sha:
            params["sha"] = sha
        if path:
            params["path"] = path

        return await self._request("GET", f"/repos/{owner}/{repo}/commits", params=params)

    async def get_commit(self, owner: str, repo: str, ref: str) -> ConnectorResult:
        """Get a specific commit"""
        return await self._request("GET", f"/repos/{owner}/{repo}/commits/{ref}")
