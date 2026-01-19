"""PubMed Medical Literature Search Tool"""

import httpx
from typing import Dict, Any
from .base import HealthcareTool


class PubMedSearchTool(HealthcareTool):
    name = "search_pubmed"
    description = "Search PubMed for medical research papers, clinical studies, and scientific literature."
    cache_ttl = 3600  # 1 hour

    @property
    def input_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query for medical literature"
                },
                "max_results": {
                    "type": "integer",
                    "default": 5,
                    "description": "Maximum number of results"
                },
                "date_range": {
                    "type": "string",
                    "enum": ["1y", "5y", "10y", "all"],
                    "description": "Filter by publication date"
                }
            },
            "required": ["query"]
        }

    async def execute(
        self,
        query: str,
        max_results: int = 5,
        date_range: str = "5y"
    ) -> Dict[str, Any]:
        """Search PubMed via E-utilities API"""

        # Map date range to days
        date_map = {"1y": 365, "5y": 1825, "10y": 3650, "all": None}
        reldate = date_map.get(date_range)

        results = []

        try:
            async with httpx.AsyncClient() as client:
                # Step 1: Search for PMIDs
                search_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
                search_params = {
                    "db": "pubmed",
                    "term": query,
                    "retmax": max_results,
                    "retmode": "json",
                    "sort": "relevance"
                }
                if reldate:
                    search_params["reldate"] = reldate
                    search_params["datetype"] = "pdat"

                search_response = await client.get(search_url, params=search_params, timeout=15)
                search_data = search_response.json()

                pmids = search_data.get("esearchresult", {}).get("idlist", [])

                if not pmids:
                    return {
                        "results": [],
                        "count": 0,
                        "source": "PubMed",
                        "source_url": "https://pubmed.ncbi.nlm.nih.gov/"
                    }

                # Step 2: Fetch summaries
                summary_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
                summary_params = {
                    "db": "pubmed",
                    "id": ",".join(pmids),
                    "retmode": "json"
                }

                summary_response = await client.get(summary_url, params=summary_params, timeout=15)
                summary_data = summary_response.json()

                for pmid in pmids:
                    article = summary_data.get("result", {}).get(pmid, {})

                    # Extract authors
                    authors = article.get("authors", [])
                    author_str = ", ".join(a.get("name", "") for a in authors[:3])
                    if len(authors) > 3:
                        author_str += " et al."

                    results.append({
                        "pmid": pmid,
                        "title": article.get("title", ""),
                        "authors": author_str,
                        "journal": article.get("source", ""),
                        "year": article.get("pubdate", "")[:4],
                        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                        "abstract_available": "hasabstract" in article.get("attributes", [])
                    })

                return {
                    "results": results,
                    "count": len(results),
                    "query": query,
                    "source": "PubMed",
                    "source_url": "https://pubmed.ncbi.nlm.nih.gov/"
                }

        except Exception as e:
            return {
                "error": str(e),
                "results": [],
                "source": "PubMed"
            }
