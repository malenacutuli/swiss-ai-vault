"""Medical Research Tools

Tools for searching medical literature, clinical trials, and drug information.
Integrates with PubMed, ClinicalTrials.gov, and drug interaction databases.
"""

import httpx
from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
import xml.etree.ElementTree as ET


class PubMedArticle(BaseModel):
    """PubMed article summary"""
    pmid: str
    title: str
    authors: List[str] = Field(default_factory=list)
    journal: Optional[str] = None
    pub_date: Optional[str] = None
    abstract: Optional[str] = None
    doi: Optional[str] = None
    pmc_id: Optional[str] = None


class ClinicalTrial(BaseModel):
    """Clinical trial summary"""
    nct_id: str
    title: str
    status: str
    phase: Optional[str] = None
    conditions: List[str] = Field(default_factory=list)
    interventions: List[str] = Field(default_factory=list)
    sponsor: Optional[str] = None
    start_date: Optional[str] = None
    completion_date: Optional[str] = None
    enrollment: Optional[int] = None
    locations: List[str] = Field(default_factory=list)


class DrugInteraction(BaseModel):
    """Drug interaction result"""
    drug1: str
    drug2: str
    severity: str  # major, moderate, minor
    description: str
    mechanism: Optional[str] = None
    management: Optional[str] = None


class MedicalResearchEngine:
    """Main medical research engine combining multiple sources"""

    def __init__(self):
        self.pubmed = PubMedSearch()
        self.trials = ClinicalTrialsSearch()
        self.drug_checker = DrugInteractionChecker()

    async def comprehensive_search(
        self,
        query: str,
        include_pubmed: bool = True,
        include_trials: bool = True,
        max_results: int = 10
    ) -> Dict[str, Any]:
        """Search multiple sources for medical information"""
        results = {
            "query": query,
            "searched_at": datetime.utcnow().isoformat(),
            "sources": []
        }

        if include_pubmed:
            try:
                pubmed_results = await self.pubmed.search(query, max_results=max_results)
                results["pubmed"] = pubmed_results
                results["sources"].append("pubmed")
            except Exception as e:
                results["pubmed_error"] = str(e)

        if include_trials:
            try:
                trial_results = await self.trials.search(query, max_results=max_results)
                results["clinical_trials"] = trial_results
                results["sources"].append("clinicaltrials.gov")
            except Exception as e:
                results["trials_error"] = str(e)

        return results

    async def check_drug_interactions(self, drugs: List[str]) -> List[DrugInteraction]:
        """Check for interactions between multiple drugs"""
        return await self.drug_checker.check_interactions(drugs)


class PubMedSearch:
    """Search PubMed for medical literature"""

    BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    async def search(
        self,
        query: str,
        max_results: int = 10,
        sort: str = "relevance",
        date_range: Optional[tuple] = None
    ) -> List[PubMedArticle]:
        """Search PubMed for articles"""
        # Build search query
        params = {
            "db": "pubmed",
            "term": query,
            "retmax": max_results,
            "sort": sort,
            "retmode": "json"
        }

        if self.api_key:
            params["api_key"] = self.api_key

        if date_range:
            params["mindate"] = date_range[0]
            params["maxdate"] = date_range[1]
            params["datetype"] = "pdat"

        async with httpx.AsyncClient() as client:
            # Search for IDs
            search_response = await client.get(
                f"{self.BASE_URL}/esearch.fcgi",
                params=params,
                timeout=30.0
            )
            search_response.raise_for_status()
            search_data = search_response.json()

            id_list = search_data.get("esearchresult", {}).get("idlist", [])
            if not id_list:
                return []

            # Fetch article details
            fetch_params = {
                "db": "pubmed",
                "id": ",".join(id_list),
                "rettype": "abstract",
                "retmode": "xml"
            }
            if self.api_key:
                fetch_params["api_key"] = self.api_key

            fetch_response = await client.get(
                f"{self.BASE_URL}/efetch.fcgi",
                params=fetch_params,
                timeout=30.0
            )
            fetch_response.raise_for_status()

            return self._parse_pubmed_xml(fetch_response.text)

    def _parse_pubmed_xml(self, xml_text: str) -> List[PubMedArticle]:
        """Parse PubMed XML response"""
        articles = []
        try:
            root = ET.fromstring(xml_text)

            for article_elem in root.findall(".//PubmedArticle"):
                # Get PMID
                pmid_elem = article_elem.find(".//PMID")
                pmid = pmid_elem.text if pmid_elem is not None else ""

                # Get title
                title_elem = article_elem.find(".//ArticleTitle")
                title = title_elem.text if title_elem is not None else ""

                # Get authors
                authors = []
                for author in article_elem.findall(".//Author"):
                    lastname = author.find("LastName")
                    forename = author.find("ForeName")
                    if lastname is not None:
                        name = lastname.text or ""
                        if forename is not None and forename.text:
                            name = f"{forename.text} {name}"
                        authors.append(name)

                # Get journal
                journal_elem = article_elem.find(".//Journal/Title")
                journal = journal_elem.text if journal_elem is not None else None

                # Get publication date
                pub_date = None
                pub_date_elem = article_elem.find(".//PubDate")
                if pub_date_elem is not None:
                    year = pub_date_elem.find("Year")
                    month = pub_date_elem.find("Month")
                    if year is not None:
                        pub_date = year.text
                        if month is not None and month.text:
                            pub_date = f"{month.text} {pub_date}"

                # Get abstract
                abstract_elem = article_elem.find(".//AbstractText")
                abstract = abstract_elem.text if abstract_elem is not None else None

                # Get DOI
                doi = None
                for article_id in article_elem.findall(".//ArticleId"):
                    if article_id.get("IdType") == "doi":
                        doi = article_id.text
                        break

                # Get PMC ID
                pmc_id = None
                for article_id in article_elem.findall(".//ArticleId"):
                    if article_id.get("IdType") == "pmc":
                        pmc_id = article_id.text
                        break

                articles.append(PubMedArticle(
                    pmid=pmid,
                    title=title,
                    authors=authors,
                    journal=journal,
                    pub_date=pub_date,
                    abstract=abstract,
                    doi=doi,
                    pmc_id=pmc_id
                ))

        except ET.ParseError:
            pass

        return articles

    async def get_article(self, pmid: str) -> Optional[PubMedArticle]:
        """Get a specific article by PMID"""
        params = {
            "db": "pubmed",
            "id": pmid,
            "rettype": "abstract",
            "retmode": "xml"
        }
        if self.api_key:
            params["api_key"] = self.api_key

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/efetch.fcgi",
                params=params,
                timeout=30.0
            )
            response.raise_for_status()
            articles = self._parse_pubmed_xml(response.text)
            return articles[0] if articles else None


class ClinicalTrialsSearch:
    """Search ClinicalTrials.gov for clinical trials"""

    BASE_URL = "https://clinicaltrials.gov/api/v2"

    async def search(
        self,
        query: str,
        max_results: int = 10,
        status: Optional[List[str]] = None,
        phase: Optional[List[str]] = None
    ) -> List[ClinicalTrial]:
        """Search for clinical trials"""
        params = {
            "query.term": query,
            "pageSize": max_results,
            "format": "json"
        }

        if status:
            params["filter.overallStatus"] = ",".join(status)

        if phase:
            params["filter.phase"] = ",".join(phase)

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/studies",
                params=params,
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()

            trials = []
            for study in data.get("studies", []):
                protocol = study.get("protocolSection", {})
                identification = protocol.get("identificationModule", {})
                status_module = protocol.get("statusModule", {})
                design = protocol.get("designModule", {})
                sponsor = protocol.get("sponsorCollaboratorsModule", {})
                conditions_module = protocol.get("conditionsModule", {})
                interventions_module = protocol.get("armsInterventionsModule", {})
                locations_module = protocol.get("contactsLocationsModule", {})

                # Get locations
                locations = []
                for loc in locations_module.get("locations", [])[:5]:  # Limit to 5 locations
                    city = loc.get("city", "")
                    country = loc.get("country", "")
                    if city and country:
                        locations.append(f"{city}, {country}")

                # Get interventions
                interventions = []
                for intervention in interventions_module.get("interventions", []):
                    name = intervention.get("name", "")
                    if name:
                        interventions.append(name)

                trials.append(ClinicalTrial(
                    nct_id=identification.get("nctId", ""),
                    title=identification.get("briefTitle", ""),
                    status=status_module.get("overallStatus", ""),
                    phase=",".join(design.get("phases", [])),
                    conditions=conditions_module.get("conditions", []),
                    interventions=interventions,
                    sponsor=sponsor.get("leadSponsor", {}).get("name"),
                    start_date=status_module.get("startDateStruct", {}).get("date"),
                    completion_date=status_module.get("completionDateStruct", {}).get("date"),
                    enrollment=design.get("enrollmentInfo", {}).get("count"),
                    locations=locations
                ))

            return trials

    async def get_trial(self, nct_id: str) -> Optional[ClinicalTrial]:
        """Get a specific trial by NCT ID"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/studies/{nct_id}",
                params={"format": "json"},
                timeout=30.0
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()

            data = response.json()
            # Parse same as search results
            # Simplified for brevity
            protocol = data.get("protocolSection", {})
            identification = protocol.get("identificationModule", {})
            status_module = protocol.get("statusModule", {})

            return ClinicalTrial(
                nct_id=nct_id,
                title=identification.get("briefTitle", ""),
                status=status_module.get("overallStatus", "")
            )


class DrugInteractionChecker:
    """Check for drug-drug interactions"""

    # In production, integrate with a proper drug database (RxNorm, DrugBank, etc.)
    # This is a simplified implementation

    # Common drug interactions (simplified database)
    KNOWN_INTERACTIONS = {
        ("warfarin", "aspirin"): DrugInteraction(
            drug1="warfarin",
            drug2="aspirin",
            severity="major",
            description="Increased risk of bleeding when used together",
            mechanism="Both drugs affect blood clotting through different mechanisms",
            management="Monitor closely, consider alternative antiplatelet if possible"
        ),
        ("metformin", "contrast dye"): DrugInteraction(
            drug1="metformin",
            drug2="contrast dye",
            severity="major",
            description="Risk of lactic acidosis with IV contrast",
            mechanism="Contrast may cause acute kidney injury, impairing metformin clearance",
            management="Hold metformin 48 hours before and after contrast administration"
        ),
        ("ssri", "maoi"): DrugInteraction(
            drug1="SSRI",
            drug2="MAOI",
            severity="major",
            description="Risk of serotonin syndrome",
            mechanism="Both increase serotonin levels",
            management="Do not use together, allow adequate washout period"
        ),
        ("simvastatin", "grapefruit"): DrugInteraction(
            drug1="simvastatin",
            drug2="grapefruit",
            severity="moderate",
            description="Increased statin levels and risk of myopathy",
            mechanism="Grapefruit inhibits CYP3A4 metabolism",
            management="Avoid grapefruit while taking simvastatin"
        ),
    }

    async def check_interactions(self, drugs: List[str]) -> List[DrugInteraction]:
        """Check for interactions between a list of drugs"""
        interactions = []

        # Normalize drug names
        normalized = [d.lower().strip() for d in drugs]

        # Check all pairs
        for i, drug1 in enumerate(normalized):
            for drug2 in normalized[i+1:]:
                # Check both orderings
                key1 = (drug1, drug2)
                key2 = (drug2, drug1)

                if key1 in self.KNOWN_INTERACTIONS:
                    interactions.append(self.KNOWN_INTERACTIONS[key1])
                elif key2 in self.KNOWN_INTERACTIONS:
                    interactions.append(self.KNOWN_INTERACTIONS[key2])

                # Check for drug class interactions
                interaction = self._check_class_interaction(drug1, drug2)
                if interaction:
                    interactions.append(interaction)

        return interactions

    def _check_class_interaction(self, drug1: str, drug2: str) -> Optional[DrugInteraction]:
        """Check for drug class interactions"""
        # Drug class mappings
        nsaids = ["ibuprofen", "naproxen", "diclofenac", "celecoxib", "meloxicam"]
        ace_inhibitors = ["lisinopril", "enalapril", "ramipril", "benazepril"]
        anticoagulants = ["warfarin", "heparin", "rivaroxaban", "apixaban", "dabigatran"]

        # NSAID + Anticoagulant
        if (drug1 in nsaids and drug2 in anticoagulants) or \
           (drug2 in nsaids and drug1 in anticoagulants):
            return DrugInteraction(
                drug1=drug1,
                drug2=drug2,
                severity="major",
                description="Increased risk of GI bleeding",
                mechanism="NSAIDs inhibit platelet function and can cause GI erosion",
                management="Avoid combination if possible, use PPI if necessary"
            )

        # NSAID + ACE Inhibitor
        if (drug1 in nsaids and drug2 in ace_inhibitors) or \
           (drug2 in nsaids and drug1 in ace_inhibitors):
            return DrugInteraction(
                drug1=drug1,
                drug2=drug2,
                severity="moderate",
                description="NSAIDs may reduce effectiveness of ACE inhibitors and increase risk of kidney damage",
                mechanism="NSAIDs reduce prostaglandin synthesis, affecting renal blood flow",
                management="Monitor blood pressure and kidney function"
            )

        return None

    async def get_drug_info(self, drug_name: str) -> Dict[str, Any]:
        """Get basic drug information"""
        # In production, integrate with RxNorm or similar
        return {
            "name": drug_name,
            "note": "For detailed drug information, please consult a pharmaceutical database"
        }
