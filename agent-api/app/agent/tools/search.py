"""
Web search tool with multiple provider support.

Provides SwissBrain web search capabilities:
- Tavily Search API (primary)
- Serper API (fallback)
- Mock results (when no API keys configured)
"""
import logging
from typing import Dict, Any, List, Optional
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)


class WebSearchTool:
    """
    Enterprise-grade web search with multiple provider support.

    Features:
    - Multiple search providers (Tavily, Serper)
    - Automatic fallback on provider failure
    - Result caching (TODO)
    - Rate limiting (TODO)
    """

    def __init__(self):
        self.settings = get_settings()
        self.http_client = httpx.AsyncClient(timeout=30.0)

    async def search(
        self,
        query: str,
        max_results: int = 5,
        search_depth: str = "basic"  # basic or advanced
    ) -> Dict[str, Any]:
        """
        Execute web search with provider fallback.

        Args:
            query: Search query
            max_results: Maximum number of results to return
            search_depth: Search depth (basic or advanced)

        Returns:
            Dict with search results
        """
        logger.info(f"Web search: {query}")

        # Try providers in order
        providers = []

        if self.settings.tavily_api_key:
            providers.append(("tavily", self._search_tavily))

        if self.settings.serper_api_key:
            providers.append(("serper", self._search_serper))

        # Try each provider
        for provider_name, provider_func in providers:
            try:
                logger.info(f"Trying search provider: {provider_name}")
                results = await provider_func(query, max_results, search_depth)

                if results.get("success"):
                    logger.info(f"Search successful with provider: {provider_name}")
                    results["provider"] = provider_name
                    return results

            except Exception as e:
                logger.warning(f"Search provider {provider_name} failed: {e}")
                continue

        # All providers failed or no API keys configured, return mock
        logger.warning("All search providers failed, returning mock results")
        return self._mock_search(query, max_results)

    async def _search_tavily(
        self,
        query: str,
        max_results: int,
        search_depth: str
    ) -> Dict[str, Any]:
        """Search using Tavily API"""
        url = "https://api.tavily.com/search"

        payload = {
            "api_key": self.settings.tavily_api_key,
            "query": query,
            "max_results": max_results,
            "search_depth": search_depth,
            "include_answer": True,
            "include_raw_content": False,
            "include_images": False
        }

        response = await self.http_client.post(url, json=payload)
        response.raise_for_status()

        data = response.json()

        # Transform to standard format
        results = []
        for item in data.get("results", []):
            results.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "snippet": item.get("content", ""),
                "score": item.get("score", 0.0)
            })

        return {
            "success": True,
            "query": query,
            "results": results,
            "answer": data.get("answer"),  # Tavily provides direct answers
            "result_count": len(results)
        }

    async def _search_serper(
        self,
        query: str,
        max_results: int,
        search_depth: str
    ) -> Dict[str, Any]:
        """Search using Serper API"""
        url = "https://google.serper.dev/search"

        headers = {
            "X-API-KEY": self.settings.serper_api_key,
            "Content-Type": "application/json"
        }

        payload = {
            "q": query,
            "num": max_results
        }

        response = await self.http_client.post(url, json=payload, headers=headers)
        response.raise_for_status()

        data = response.json()

        # Transform to standard format
        results = []
        for item in data.get("organic", []):
            results.append({
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "snippet": item.get("snippet", ""),
                "score": 1.0  # Serper doesn't provide scores
            })

        # Extract answer box if available
        answer = None
        if "answerBox" in data:
            answer_box = data["answerBox"]
            if "answer" in answer_box:
                answer = answer_box["answer"]
            elif "snippet" in answer_box:
                answer = answer_box["snippet"]

        return {
            "success": True,
            "query": query,
            "results": results,
            "answer": answer,
            "result_count": len(results)
        }

    def _mock_search(self, query: str, max_results: int) -> Dict[str, Any]:
        """Return mock search results when no API keys configured"""
        logger.info("Using mock search results (no API keys configured)")

        mock_results = [
            {
                "title": f"Result {i+1} for: {query}",
                "url": f"https://example.com/result-{i+1}",
                "snippet": f"This is a mock search result for the query: {query}. To enable real web search, configure TAVILY_API_KEY or SERPER_API_KEY environment variables.",
                "score": 1.0 - (i * 0.1)
            }
            for i in range(min(max_results, 3))
        ]

        return {
            "success": True,
            "query": query,
            "results": mock_results,
            "answer": f"Mock answer for: {query}. Configure search API keys for real results.",
            "result_count": len(mock_results),
            "provider": "mock"
        }

    async def close(self):
        """Close HTTP client"""
        await self.http_client.aclose()
