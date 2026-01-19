"""Healthcare tools registry"""

from .icd10 import ICD10LookupTool
from .npi import NPIVerificationTool
from .rxnorm import DrugInteractionTool
from .pubmed import PubMedSearchTool

# Tool registry
HEALTHCARE_TOOLS = {
    "lookup_icd10": ICD10LookupTool(),
    "verify_npi": NPIVerificationTool(),
    "check_drug_interaction": DrugInteractionTool(),
    "search_pubmed": PubMedSearchTool(),
}


def get_tool(name: str):
    """Get tool by name"""
    return HEALTHCARE_TOOLS.get(name)


def get_all_tools():
    """Get all tools"""
    return list(HEALTHCARE_TOOLS.values())


def get_claude_tools():
    """Get tools in Claude API format"""
    return [tool.to_claude_tool() for tool in HEALTHCARE_TOOLS.values()]


__all__ = [
    "ICD10LookupTool",
    "NPIVerificationTool",
    "DrugInteractionTool",
    "PubMedSearchTool",
    "HEALTHCARE_TOOLS",
    "get_tool",
    "get_all_tools",
    "get_claude_tools",
]
