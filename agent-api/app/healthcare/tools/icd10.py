"""ICD-10 Code Lookup Tool"""

import httpx
from typing import Dict, Any
from .base import HealthcareTool


class ICD10LookupTool(HealthcareTool):
    name = "lookup_icd10"
    description = "Look up ICD-10 diagnosis or procedure codes. Use for medical coding, billing, and documentation validation."
    cache_ttl = 86400 * 7  # 7 days

    @property
    def input_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "search_term": {
                    "type": "string",
                    "description": "Medical condition, symptom, or procedure to search"
                },
                "code": {
                    "type": "string",
                    "description": "Specific ICD-10 code to look up (e.g., E11.9)"
                },
                "code_type": {
                    "type": "string",
                    "enum": ["diagnosis", "procedure"],
                    "description": "Type of code (default: diagnosis)"
                },
                "max_results": {
                    "type": "integer",
                    "default": 10,
                    "description": "Maximum results to return"
                }
            }
        }

    async def execute(
        self,
        search_term: str = None,
        code: str = None,
        code_type: str = "diagnosis",
        max_results: int = 10
    ) -> Dict[str, Any]:
        """Search ICD-10 codes via NLM Clinical Tables API"""

        results = []

        if code:
            # Direct code lookup
            url = "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search"
            params = {
                "sf": "code,name",
                "terms": code,
                "maxList": 1
            }
        elif search_term:
            # Search by term
            url = "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search"
            params = {
                "sf": "code,name",
                "terms": search_term,
                "maxList": max_results
            }
        else:
            return {"error": "Either search_term or code is required", "results": []}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()

                # Parse NLM response format: [count, codes, null, [display_strings]]
                if len(data) >= 4 and data[3]:
                    for item in data[3]:
                        if len(item) >= 2:
                            results.append({
                                "code": item[0],
                                "description": item[1],
                                "type": code_type
                            })

                return {
                    "results": results,
                    "count": len(results),
                    "source": "NLM ICD-10-CM",
                    "source_url": "https://clinicaltables.nlm.nih.gov/"
                }

        except Exception as e:
            return {
                "error": str(e),
                "results": [],
                "source": "NLM ICD-10-CM"
            }
