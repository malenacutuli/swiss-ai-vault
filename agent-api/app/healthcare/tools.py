"""Healthcare Agent Tools

HIPAA-compliant tools for healthcare agents to interact with patient data,
medical records, appointments, and prescriptions.
"""

import httpx
from typing import Any, Optional, Dict, List
from datetime import datetime, date
from pydantic import BaseModel, Field
import os


class PatientInput(BaseModel):
    """Input for patient operations"""
    first_name: str = Field(..., description="Patient's first name")
    last_name: str = Field(..., description="Patient's last name")
    dob: str = Field(..., description="Date of birth (YYYY-MM-DD)")
    ssn: Optional[str] = Field(None, description="Social Security Number")
    blood_type: Optional[str] = Field(None, description="Blood type")
    allergies: Optional[List[str]] = Field(default_factory=list, description="List of allergies")
    email: Optional[str] = Field(None, description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")


class RecordInput(BaseModel):
    """Input for medical record operations"""
    patient_id: str = Field(..., description="Patient UUID")
    record_type: str = Field(..., description="Type of record")
    content: str = Field(..., description="Record content")
    diagnosis: Optional[str] = Field(None, description="Diagnosis")
    icd10_codes: Optional[List[str]] = Field(default_factory=list, description="ICD-10 codes")
    cpt_codes: Optional[List[str]] = Field(default_factory=list, description="CPT codes")
    visit_date: str = Field(..., description="Visit date (ISO format)")


class AppointmentInput(BaseModel):
    """Input for appointment operations"""
    patient_id: str = Field(..., description="Patient UUID")
    appointment_type: str = Field(..., description="Type of appointment")
    scheduled_at: str = Field(..., description="Scheduled time (ISO format)")
    duration_minutes: int = Field(30, description="Duration in minutes")
    reason_for_visit: Optional[str] = Field(None, description="Reason for visit")
    is_telehealth: bool = Field(False, description="Is telehealth appointment")


class PrescriptionInput(BaseModel):
    """Input for prescription operations"""
    patient_id: str = Field(..., description="Patient UUID")
    medication_name: str = Field(..., description="Medication name")
    dosage: str = Field(..., description="Dosage")
    frequency: str = Field(..., description="Frequency")
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="End date")
    refills_authorized: int = Field(0, description="Number of refills")
    is_controlled_substance: bool = Field(False, description="Is controlled substance")


class HealthcareTools:
    """Main healthcare tools class for agent use"""

    def __init__(
        self,
        supabase_url: str,
        supabase_key: str,
        user_token: str,
        access_reason: str = "agent_task"
    ):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.user_token = user_token
        self.access_reason = access_reason
        self.base_url = f"{supabase_url}/functions/v1"

    async def _request(
        self,
        function_name: str,
        method: str = "GET",
        params: Optional[Dict] = None,
        json_data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make authenticated request to healthcare edge function"""
        url = f"{self.base_url}/{function_name}"

        if params is None:
            params = {}
        params["reason"] = self.access_reason

        headers = {
            "Authorization": f"Bearer {self.user_token}",
            "apikey": self.supabase_key,
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            if method == "GET":
                response = await client.get(url, params=params, headers=headers)
            elif method == "POST":
                response = await client.post(url, params=params, json=json_data, headers=headers)
            elif method == "PUT":
                response = await client.put(url, params=params, json=json_data, headers=headers)
            elif method == "DELETE":
                response = await client.delete(url, params=params, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            response.raise_for_status()
            return response.json()

    # Patient Tools
    async def list_patients(self, search: Optional[str] = None, limit: int = 50) -> List[Dict]:
        """List patients for the authenticated provider"""
        params = {"limit": str(limit)}
        if search:
            params["search"] = search
        result = await self._request("healthcare-patients", params=params)
        return result.get("patients", [])

    async def get_patient(self, patient_id: str) -> Dict:
        """Get a single patient's details"""
        result = await self._request("healthcare-patients", params={"id": patient_id})
        return result.get("patient", {})

    async def create_patient(self, patient: PatientInput) -> Dict:
        """Create a new patient"""
        result = await self._request(
            "healthcare-patients",
            method="POST",
            json_data=patient.model_dump(exclude_none=True)
        )
        return result

    async def update_patient(self, patient_id: str, updates: Dict) -> Dict:
        """Update patient information"""
        result = await self._request(
            "healthcare-patients",
            method="PUT",
            params={"id": patient_id},
            json_data=updates
        )
        return result

    # Medical Record Tools
    async def list_records(
        self,
        patient_id: Optional[str] = None,
        record_type: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict]:
        """List medical records"""
        params = {"limit": str(limit)}
        if patient_id:
            params["patient_id"] = patient_id
        if record_type:
            params["type"] = record_type
        result = await self._request("healthcare-records", params=params)
        return result.get("records", [])

    async def get_record(self, record_id: str) -> Dict:
        """Get a single medical record"""
        result = await self._request("healthcare-records", params={"id": record_id})
        return result.get("record", {})

    async def create_record(self, record: RecordInput) -> Dict:
        """Create a new medical record"""
        result = await self._request(
            "healthcare-records",
            method="POST",
            json_data=record.model_dump(exclude_none=True)
        )
        return result

    async def sign_record(self, record_id: str) -> Dict:
        """Sign/finalize a medical record"""
        result = await self._request(
            "healthcare-records",
            method="PUT",
            params={"id": record_id, "action": "sign"}
        )
        return result

    # Appointment Tools
    async def list_appointments(
        self,
        patient_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Dict]:
        """List appointments"""
        params = {}
        if patient_id:
            params["patient_id"] = patient_id
        if start_date:
            params["start"] = start_date
        if end_date:
            params["end"] = end_date
        if status:
            params["status"] = status
        result = await self._request("healthcare-appointments", params=params)
        return result.get("appointments", [])

    async def get_appointment(self, appointment_id: str) -> Dict:
        """Get appointment details"""
        result = await self._request("healthcare-appointments", params={"id": appointment_id})
        return result.get("appointment", {})

    async def create_appointment(self, appointment: AppointmentInput) -> Dict:
        """Schedule a new appointment"""
        result = await self._request(
            "healthcare-appointments",
            method="POST",
            json_data=appointment.model_dump(exclude_none=True)
        )
        return result

    async def check_in_patient(self, appointment_id: str) -> Dict:
        """Check in patient for appointment"""
        result = await self._request(
            "healthcare-appointments",
            method="PUT",
            params={"id": appointment_id, "action": "check-in"}
        )
        return result

    async def start_appointment(self, appointment_id: str) -> Dict:
        """Start an appointment"""
        result = await self._request(
            "healthcare-appointments",
            method="PUT",
            params={"id": appointment_id, "action": "start"}
        )
        return result

    async def complete_appointment(self, appointment_id: str, record_id: Optional[str] = None) -> Dict:
        """Complete an appointment"""
        result = await self._request(
            "healthcare-appointments",
            method="PUT",
            params={"id": appointment_id, "action": "complete"},
            json_data={"record_id": record_id} if record_id else {}
        )
        return result

    async def cancel_appointment(self, appointment_id: str, reason: str) -> Dict:
        """Cancel an appointment"""
        result = await self._request(
            "healthcare-appointments",
            method="PUT",
            params={"id": appointment_id, "action": "cancel"},
            json_data={"reason": reason}
        )
        return result

    # Prescription Tools
    async def list_prescriptions(
        self,
        patient_id: Optional[str] = None,
        status: Optional[str] = None,
        controlled_only: bool = False
    ) -> List[Dict]:
        """List prescriptions"""
        params = {}
        if patient_id:
            params["patient_id"] = patient_id
        if status:
            params["status"] = status
        if controlled_only:
            params["controlled"] = "true"
        result = await self._request("healthcare-prescriptions", params=params)
        return result.get("prescriptions", [])

    async def get_prescription(self, prescription_id: str) -> Dict:
        """Get prescription details"""
        result = await self._request("healthcare-prescriptions", params={"id": prescription_id})
        return result.get("prescription", {})

    async def create_prescription(self, prescription: PrescriptionInput) -> Dict:
        """Create a new prescription"""
        result = await self._request(
            "healthcare-prescriptions",
            method="POST",
            json_data=prescription.model_dump(exclude_none=True)
        )
        return result

    async def refill_prescription(self, prescription_id: str) -> Dict:
        """Process prescription refill"""
        result = await self._request(
            "healthcare-prescriptions",
            method="PUT",
            params={"id": prescription_id, "action": "refill"}
        )
        return result

    async def discontinue_prescription(self, prescription_id: str, reason: str) -> Dict:
        """Discontinue a prescription"""
        result = await self._request(
            "healthcare-prescriptions",
            method="PUT",
            params={"id": prescription_id, "action": "discontinue"},
            json_data={"reason": reason}
        )
        return result

    async def e_prescribe(self, prescription_id: str) -> Dict:
        """Send prescription electronically"""
        result = await self._request(
            "healthcare-prescriptions",
            method="PUT",
            params={"id": prescription_id, "action": "e-prescribe"}
        )
        return result

    # Audit Tools
    async def search_audit_logs(
        self,
        patient_id: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Search audit logs"""
        params = {"action": "search", "limit": str(limit)}
        if patient_id:
            params["patient_id"] = patient_id
        if action:
            params["filter_action"] = action
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        result = await self._request("healthcare-audit", params=params)
        return result.get("logs", [])

    async def get_patient_access_summary(self, patient_id: str, days: int = 30) -> Dict:
        """Get patient access summary for compliance"""
        result = await self._request(
            "healthcare-audit",
            params={"action": "patient-summary", "patient_id": patient_id, "days": str(days)}
        )
        return result.get("summary", {})

    async def get_provider_summary(self, days: int = 30) -> Dict:
        """Get provider activity summary"""
        result = await self._request(
            "healthcare-audit",
            params={"action": "provider-summary", "days": str(days)}
        )
        return result.get("summary", {})


# Convenience classes for direct tool use
PatientTool = HealthcareTools
RecordTool = HealthcareTools
AppointmentTool = HealthcareTools
PrescriptionTool = HealthcareTools
AuditTool = HealthcareTools
