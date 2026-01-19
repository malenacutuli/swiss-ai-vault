"""RxNorm Drug Lookup and Interaction Tool"""

import httpx
from typing import Dict, Any, List
from .base import HealthcareTool


class DrugInteractionTool(HealthcareTool):
    name = "check_drug_interaction"
    description = "Check for drug interactions, lookup drug information via RxNorm. Use for medication safety checks."
    cache_ttl = 86400 * 7  # 7 days

    @property
    def input_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "drugs": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of drug names to check for interactions"
                },
                "drug_name": {
                    "type": "string",
                    "description": "Single drug name to look up"
                }
            }
        }

    async def execute(
        self,
        drugs: List[str] = None,
        drug_name: str = None
    ) -> Dict[str, Any]:
        """Query RxNorm for drug info and interactions"""

        results = {
            "drugs": [],
            "interactions": [],
            "source": "RxNorm / RxNav",
            "source_url": "https://rxnav.nlm.nih.gov/"
        }

        async with httpx.AsyncClient() as client:
            # Get RxCUI for each drug
            drug_list = drugs if drugs else ([drug_name] if drug_name else [])
            rxcuis = []

            for drug in drug_list:
                try:
                    # Search for drug
                    url = "https://rxnav.nlm.nih.gov/REST/drugs.json"
                    response = await client.get(url, params={"name": drug}, timeout=10)
                    data = response.json()

                    concept_group = data.get("drugGroup", {}).get("conceptGroup", [])
                    for group in concept_group:
                        props = group.get("conceptProperties", [])
                        if props:
                            rxcui = props[0].get("rxcui")
                            name = props[0].get("name")
                            if rxcui:
                                rxcuis.append(rxcui)
                                results["drugs"].append({
                                    "name": name,
                                    "rxcui": rxcui,
                                    "original_search": drug
                                })
                            break
                except Exception as e:
                    results["drugs"].append({
                        "name": drug,
                        "error": str(e)
                    })

            # Check interactions if we have multiple drugs
            if len(rxcuis) >= 2:
                try:
                    url = "https://rxnav.nlm.nih.gov/REST/interaction/list.json"
                    response = await client.get(
                        url,
                        params={"rxcuis": "+".join(rxcuis)},
                        timeout=10
                    )
                    data = response.json()

                    interaction_groups = data.get("fullInteractionTypeGroup", [])
                    for group in interaction_groups:
                        for itype in group.get("fullInteractionType", []):
                            for pair in itype.get("interactionPair", []):
                                results["interactions"].append({
                                    "description": pair.get("description"),
                                    "severity": pair.get("severity", "Unknown"),
                                    "drugs": [
                                        c.get("minConceptItem", {}).get("name")
                                        for c in pair.get("interactionConcept", [])
                                    ]
                                })
                except Exception as e:
                    results["interaction_error"] = str(e)

            results["interaction_count"] = len(results["interactions"])
            return results
