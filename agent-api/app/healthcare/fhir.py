"""FHIR (Fast Healthcare Interoperability Resources) Integration

Support for HL7 FHIR R4 standard for healthcare data exchange.
Enables interoperability with EHR systems, health information exchanges,
and other healthcare applications.
"""

import httpx
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, date
from pydantic import BaseModel, Field
import json


class FHIRResource(BaseModel):
    """Base FHIR resource"""
    resourceType: str
    id: Optional[str] = None
    meta: Optional[Dict] = None

    def to_json(self) -> str:
        return self.model_dump_json(exclude_none=True)

    @classmethod
    def from_json(cls, json_str: str) -> "FHIRResource":
        data = json.loads(json_str)
        return cls(**data)


class FHIRPatient(FHIRResource):
    """FHIR Patient resource"""
    resourceType: str = "Patient"
    identifier: List[Dict] = Field(default_factory=list)
    active: bool = True
    name: List[Dict] = Field(default_factory=list)
    telecom: List[Dict] = Field(default_factory=list)
    gender: Optional[str] = None
    birthDate: Optional[str] = None
    address: List[Dict] = Field(default_factory=list)
    contact: List[Dict] = Field(default_factory=list)

    @classmethod
    def from_healthcare_patient(cls, patient: Dict) -> "FHIRPatient":
        """Convert internal patient format to FHIR"""
        names = []
        if patient.get("first_name") or patient.get("last_name"):
            names.append({
                "use": "official",
                "family": patient.get("last_name", ""),
                "given": [patient.get("first_name", "")]
            })

        telecom = []
        if patient.get("phone"):
            telecom.append({
                "system": "phone",
                "value": patient["phone"],
                "use": "home"
            })
        if patient.get("email"):
            telecom.append({
                "system": "email",
                "value": patient["email"]
            })

        address = []
        if patient.get("address"):
            address.append({
                "use": "home",
                "text": patient["address"]
            })

        return cls(
            id=patient.get("id"),
            identifier=[{
                "system": "urn:swissbrain:patient",
                "value": patient.get("id", "")
            }],
            active=patient.get("is_active", True),
            name=names,
            telecom=telecom,
            gender=patient.get("gender"),
            birthDate=patient.get("dob"),
            address=address
        )


class FHIRCondition(FHIRResource):
    """FHIR Condition resource"""
    resourceType: str = "Condition"
    clinicalStatus: Optional[Dict] = None
    verificationStatus: Optional[Dict] = None
    code: Optional[Dict] = None
    subject: Dict = Field(default_factory=dict)
    recordedDate: Optional[str] = None

    @classmethod
    def from_icd10(cls, icd10_code: str, patient_id: str, description: str = "") -> "FHIRCondition":
        """Create condition from ICD-10 code"""
        return cls(
            clinicalStatus={
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": "active"
                }]
            },
            verificationStatus={
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                    "code": "confirmed"
                }]
            },
            code={
                "coding": [{
                    "system": "http://hl7.org/fhir/sid/icd-10-cm",
                    "code": icd10_code,
                    "display": description
                }]
            },
            subject={"reference": f"Patient/{patient_id}"},
            recordedDate=datetime.utcnow().date().isoformat()
        )


class FHIRMedicationRequest(FHIRResource):
    """FHIR MedicationRequest resource"""
    resourceType: str = "MedicationRequest"
    status: str = "active"
    intent: str = "order"
    medicationCodeableConcept: Optional[Dict] = None
    subject: Dict = Field(default_factory=dict)
    authoredOn: Optional[str] = None
    requester: Optional[Dict] = None
    dosageInstruction: List[Dict] = Field(default_factory=list)
    dispenseRequest: Optional[Dict] = None

    @classmethod
    def from_prescription(cls, prescription: Dict, patient_id: str, provider_id: str) -> "FHIRMedicationRequest":
        """Convert internal prescription to FHIR MedicationRequest"""
        dosage = []
        if prescription.get("dosage") and prescription.get("frequency"):
            dosage.append({
                "text": f"{prescription['dosage']} {prescription['frequency']}",
                "timing": {
                    "code": {
                        "text": prescription["frequency"]
                    }
                },
                "doseAndRate": [{
                    "doseQuantity": {
                        "value": prescription["dosage"]
                    }
                }]
            })

        dispense = None
        if prescription.get("quantity") or prescription.get("refills_authorized"):
            dispense = {}
            if prescription.get("quantity"):
                dispense["quantity"] = {
                    "value": prescription["quantity"],
                    "unit": prescription.get("quantity_unit", "tablets")
                }
            if prescription.get("refills_authorized"):
                dispense["numberOfRepeatsAllowed"] = prescription["refills_authorized"]

        return cls(
            id=prescription.get("id"),
            status=prescription.get("status", "active"),
            medicationCodeableConcept={
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm" if prescription.get("medication_code") else None,
                    "code": prescription.get("medication_code"),
                    "display": prescription.get("medication_name")
                }],
                "text": prescription.get("medication_name")
            },
            subject={"reference": f"Patient/{patient_id}"},
            authoredOn=prescription.get("created_at"),
            requester={"reference": f"Practitioner/{provider_id}"},
            dosageInstruction=dosage,
            dispenseRequest=dispense
        )


class FHIRAppointment(FHIRResource):
    """FHIR Appointment resource"""
    resourceType: str = "Appointment"
    status: str = "booked"
    serviceType: List[Dict] = Field(default_factory=list)
    start: Optional[str] = None
    end: Optional[str] = None
    minutesDuration: Optional[int] = None
    participant: List[Dict] = Field(default_factory=list)

    @classmethod
    def from_appointment(cls, appointment: Dict) -> "FHIRAppointment":
        """Convert internal appointment to FHIR"""
        # Map internal status to FHIR status
        status_map = {
            "scheduled": "booked",
            "confirmed": "booked",
            "checked_in": "arrived",
            "in_progress": "arrived",
            "completed": "fulfilled",
            "cancelled": "cancelled",
            "no_show": "noshow"
        }

        participants = []
        if appointment.get("patient_id"):
            participants.append({
                "actor": {"reference": f"Patient/{appointment['patient_id']}"},
                "status": "accepted"
            })
        if appointment.get("provider_id"):
            participants.append({
                "actor": {"reference": f"Practitioner/{appointment['provider_id']}"},
                "status": "accepted"
            })

        return cls(
            id=appointment.get("id"),
            status=status_map.get(appointment.get("status", "scheduled"), "booked"),
            serviceType=[{
                "coding": [{
                    "display": appointment.get("appointment_type")
                }]
            }] if appointment.get("appointment_type") else [],
            start=appointment.get("scheduled_at"),
            end=appointment.get("end_at"),
            minutesDuration=appointment.get("duration_minutes"),
            participant=participants
        )


class FHIRBundle(FHIRResource):
    """FHIR Bundle resource for collections"""
    resourceType: str = "Bundle"
    type: str = "collection"
    total: Optional[int] = None
    entry: List[Dict] = Field(default_factory=list)

    def add_entry(self, resource: FHIRResource, full_url: Optional[str] = None):
        """Add a resource to the bundle"""
        entry = {"resource": resource.model_dump(exclude_none=True)}
        if full_url:
            entry["fullUrl"] = full_url
        self.entry.append(entry)
        self.total = len(self.entry)

    @classmethod
    def create_patient_summary(
        cls,
        patient: Dict,
        conditions: List[Dict] = None,
        medications: List[Dict] = None,
        appointments: List[Dict] = None
    ) -> "FHIRBundle":
        """Create a patient summary bundle"""
        bundle = cls(type="document")

        # Add patient
        fhir_patient = FHIRPatient.from_healthcare_patient(patient)
        bundle.add_entry(fhir_patient)

        # Add conditions
        for condition in (conditions or []):
            for code in condition.get("icd10_codes", []):
                fhir_condition = FHIRCondition.from_icd10(
                    code,
                    patient["id"],
                    condition.get("diagnosis", "")
                )
                bundle.add_entry(fhir_condition)

        # Add medications
        for med in (medications or []):
            fhir_med = FHIRMedicationRequest.from_prescription(
                med,
                patient["id"],
                med.get("provider_id", "")
            )
            bundle.add_entry(fhir_med)

        # Add appointments
        for apt in (appointments or []):
            fhir_apt = FHIRAppointment.from_appointment(apt)
            bundle.add_entry(fhir_apt)

        return bundle


class FHIRClient:
    """Client for interacting with FHIR servers"""

    def __init__(
        self,
        base_url: str,
        auth_token: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None
    ):
        self.base_url = base_url.rstrip("/")
        self.auth_token = auth_token
        self.client_id = client_id
        self.client_secret = client_secret

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/fhir+json",
            "Accept": "application/fhir+json"
        }
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        return headers

    async def read(self, resource_type: str, resource_id: str) -> Dict:
        """Read a resource by ID"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/{resource_type}/{resource_id}",
                headers=self._get_headers(),
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()

    async def search(
        self,
        resource_type: str,
        params: Dict[str, str]
    ) -> FHIRBundle:
        """Search for resources"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/{resource_type}",
                params=params,
                headers=self._get_headers(),
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            return FHIRBundle(**data)

    async def create(self, resource: FHIRResource) -> Dict:
        """Create a new resource"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/{resource.resourceType}",
                content=resource.to_json(),
                headers=self._get_headers(),
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()

    async def update(self, resource: FHIRResource) -> Dict:
        """Update an existing resource"""
        if not resource.id:
            raise ValueError("Resource must have an ID for update")

        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{self.base_url}/{resource.resourceType}/{resource.id}",
                content=resource.to_json(),
                headers=self._get_headers(),
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()

    async def delete(self, resource_type: str, resource_id: str) -> bool:
        """Delete a resource"""
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.base_url}/{resource_type}/{resource_id}",
                headers=self._get_headers(),
                timeout=30.0
            )
            return response.status_code in (200, 204)

    async def get_patient_everything(self, patient_id: str) -> FHIRBundle:
        """Get all resources for a patient ($everything operation)"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/Patient/{patient_id}/$everything",
                headers=self._get_headers(),
                timeout=60.0
            )
            response.raise_for_status()
            data = response.json()
            return FHIRBundle(**data)

    async def validate(self, resource: FHIRResource) -> Dict:
        """Validate a resource against the FHIR specification"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/{resource.resourceType}/$validate",
                content=resource.to_json(),
                headers=self._get_headers(),
                timeout=30.0
            )
            return response.json()

    async def capability_statement(self) -> Dict:
        """Get the server's capability statement"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/metadata",
                headers=self._get_headers(),
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()


# Utility functions for FHIR data conversion
def healthcare_to_fhir_patient(patient: Dict) -> FHIRPatient:
    """Convert SwissBrain healthcare patient to FHIR Patient"""
    return FHIRPatient.from_healthcare_patient(patient)


def fhir_to_healthcare_patient(fhir_patient: FHIRPatient) -> Dict:
    """Convert FHIR Patient to SwissBrain healthcare patient format"""
    result = {
        "id": fhir_patient.id,
        "is_active": fhir_patient.active
    }

    # Extract name
    if fhir_patient.name:
        official_name = next(
            (n for n in fhir_patient.name if n.get("use") == "official"),
            fhir_patient.name[0]
        )
        result["first_name"] = official_name.get("given", [""])[0]
        result["last_name"] = official_name.get("family", "")

    # Extract contact info
    for telecom in fhir_patient.telecom:
        if telecom.get("system") == "phone":
            result["phone"] = telecom.get("value")
        elif telecom.get("system") == "email":
            result["email"] = telecom.get("value")

    # Extract address
    if fhir_patient.address:
        result["address"] = fhir_patient.address[0].get("text", "")

    result["gender"] = fhir_patient.gender
    result["dob"] = fhir_patient.birthDate

    return result
