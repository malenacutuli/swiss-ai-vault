"""NPI Provider Verification Tool"""

import httpx
from typing import Dict, Any
from .base import HealthcareTool


class NPIVerificationTool(HealthcareTool):
    name = "verify_npi"
    description = "Verify a healthcare provider's NPI number and retrieve their credentials, specialty, and practice information."
    cache_ttl = 86400  # 1 day

    @property
    def input_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "npi": {
                    "type": "string",
                    "description": "10-digit NPI number to verify"
                },
                "provider_name": {
                    "type": "string",
                    "description": "Provider name to search (if NPI not known)"
                },
                "state": {
                    "type": "string",
                    "description": "State code (e.g., CA, NY) to narrow search"
                }
            }
        }

    async def execute(
        self,
        npi: str = None,
        provider_name: str = None,
        state: str = None
    ) -> Dict[str, Any]:
        """Query NPPES NPI Registry"""

        base_url = "https://npiregistry.cms.hhs.gov/api/"
        params = {"version": "2.1"}

        if npi:
            params["number"] = npi
        elif provider_name:
            # Split name for search
            name_parts = provider_name.split()
            if len(name_parts) >= 2:
                params["first_name"] = name_parts[0]
                params["last_name"] = name_parts[-1]
            else:
                params["last_name"] = provider_name
            if state:
                params["state"] = state
        else:
            return {"error": "Either npi or provider_name is required", "results": []}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(base_url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()

                results = []
                for provider in data.get("results", []):
                    basic = provider.get("basic", {})
                    addresses = provider.get("addresses", [])
                    taxonomies = provider.get("taxonomies", [])

                    # Get primary taxonomy (specialty)
                    primary_taxonomy = next(
                        (t for t in taxonomies if t.get("primary")),
                        taxonomies[0] if taxonomies else {}
                    )

                    # Get practice address
                    practice_address = next(
                        (a for a in addresses if a.get("address_purpose") == "LOCATION"),
                        addresses[0] if addresses else {}
                    )

                    results.append({
                        "npi": provider.get("number"),
                        "name": f"{basic.get('first_name', '')} {basic.get('last_name', '')}".strip(),
                        "credential": basic.get("credential"),
                        "specialty": primary_taxonomy.get("desc"),
                        "taxonomy_code": primary_taxonomy.get("code"),
                        "state": primary_taxonomy.get("state"),
                        "license": primary_taxonomy.get("license"),
                        "status": "Active" if provider.get("number") else "Unknown",
                        "address": {
                            "line1": practice_address.get("address_1"),
                            "city": practice_address.get("city"),
                            "state": practice_address.get("state"),
                            "zip": practice_address.get("postal_code")
                        }
                    })

                return {
                    "results": results,
                    "count": len(results),
                    "verified": len(results) > 0,
                    "source": "NPPES NPI Registry",
                    "source_url": "https://npiregistry.cms.hhs.gov/"
                }

        except Exception as e:
            return {
                "error": str(e),
                "results": [],
                "verified": False,
                "source": "NPPES NPI Registry"
            }
