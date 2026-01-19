"""Healthcare Clinical Workflows

Automated clinical workflows for patient intake, visits, and prescriptions.
These workflows orchestrate multiple healthcare tools to complete complex tasks.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from app.healthcare.tools import HealthcareTools, PatientInput, RecordInput, AppointmentInput


class WorkflowStep(BaseModel):
    """A single step in a clinical workflow"""
    name: str
    status: str = "pending"  # pending, in_progress, completed, failed, skipped
    result: Optional[Dict] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class WorkflowResult(BaseModel):
    """Result of a workflow execution"""
    workflow_name: str
    status: str
    steps: List[WorkflowStep]
    data: Dict[str, Any] = Field(default_factory=dict)
    started_at: datetime
    completed_at: Optional[datetime] = None


class ClinicalWorkflowEngine:
    """Engine for executing clinical workflows"""

    def __init__(self, tools: HealthcareTools):
        self.tools = tools

    async def execute_workflow(
        self,
        workflow_name: str,
        steps: List[Dict],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Execute a generic workflow with steps"""
        result = WorkflowResult(
            workflow_name=workflow_name,
            status="in_progress",
            steps=[],
            data=context.copy(),
            started_at=datetime.utcnow()
        )

        for step_config in steps:
            step = WorkflowStep(name=step_config["name"])
            step.started_at = datetime.utcnow()
            step.status = "in_progress"
            result.steps.append(step)

            try:
                # Get the method to call
                method_name = step_config.get("method")
                if method_name and hasattr(self.tools, method_name):
                    method = getattr(self.tools, method_name)
                    # Build args from context
                    args = {}
                    for param, source in step_config.get("params", {}).items():
                        if source.startswith("$"):
                            # Reference to context data
                            key = source[1:]
                            args[param] = result.data.get(key)
                        else:
                            args[param] = source

                    step.result = await method(**args)

                    # Store result in context if specified
                    if "store_as" in step_config:
                        result.data[step_config["store_as"]] = step.result

                step.status = "completed"
                step.completed_at = datetime.utcnow()

            except Exception as e:
                step.status = "failed"
                step.error = str(e)
                step.completed_at = datetime.utcnow()

                # Check if workflow should continue on failure
                if step_config.get("required", True):
                    result.status = "failed"
                    break

        if result.status != "failed":
            result.status = "completed"

        result.completed_at = datetime.utcnow()
        return result


class PatientIntakeWorkflow:
    """Workflow for new patient intake"""

    def __init__(self, tools: HealthcareTools):
        self.tools = tools
        self.engine = ClinicalWorkflowEngine(tools)

    async def execute(
        self,
        patient_data: PatientInput,
        appointment_data: Optional[AppointmentInput] = None,
        initial_notes: Optional[str] = None
    ) -> WorkflowResult:
        """Execute patient intake workflow"""

        # Create patient
        patient_result = await self.tools.create_patient(patient_data)

        if not patient_result.get("success"):
            return WorkflowResult(
                workflow_name="patient_intake",
                status="failed",
                steps=[WorkflowStep(name="create_patient", status="failed", error="Failed to create patient")],
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow()
            )

        patient_id = patient_result.get("patient_id")
        result_data = {"patient_id": patient_id}
        steps = [WorkflowStep(name="create_patient", status="completed", result=patient_result)]

        # Schedule appointment if requested
        if appointment_data:
            appointment_data.patient_id = patient_id
            try:
                apt_result = await self.tools.create_appointment(appointment_data)
                steps.append(WorkflowStep(name="schedule_appointment", status="completed", result=apt_result))
                result_data["appointment_id"] = apt_result.get("appointment_id")
            except Exception as e:
                steps.append(WorkflowStep(name="schedule_appointment", status="failed", error=str(e)))

        # Create initial intake record if notes provided
        if initial_notes:
            try:
                record = RecordInput(
                    patient_id=patient_id,
                    record_type="visit_note",
                    content=initial_notes,
                    visit_date=datetime.utcnow().isoformat()
                )
                record_result = await self.tools.create_record(record)
                steps.append(WorkflowStep(name="create_intake_record", status="completed", result=record_result))
                result_data["record_id"] = record_result.get("record_id")
            except Exception as e:
                steps.append(WorkflowStep(name="create_intake_record", status="failed", error=str(e)))

        return WorkflowResult(
            workflow_name="patient_intake",
            status="completed",
            steps=steps,
            data=result_data,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )


class VisitWorkflow:
    """Workflow for patient visits"""

    def __init__(self, tools: HealthcareTools):
        self.tools = tools

    async def start_visit(self, appointment_id: str) -> WorkflowResult:
        """Start a patient visit"""
        steps = []
        result_data = {"appointment_id": appointment_id}

        # Check in patient
        try:
            checkin_result = await self.tools.check_in_patient(appointment_id)
            steps.append(WorkflowStep(name="check_in", status="completed", result=checkin_result))
        except Exception as e:
            steps.append(WorkflowStep(name="check_in", status="failed", error=str(e)))

        # Start appointment
        try:
            start_result = await self.tools.start_appointment(appointment_id)
            steps.append(WorkflowStep(name="start_appointment", status="completed", result=start_result))
        except Exception as e:
            steps.append(WorkflowStep(name="start_appointment", status="failed", error=str(e)))

        # Get appointment details with patient info
        try:
            apt_details = await self.tools.get_appointment(appointment_id)
            steps.append(WorkflowStep(name="get_details", status="completed", result=apt_details))
            result_data["appointment"] = apt_details
            result_data["patient_id"] = apt_details.get("patient_id")
        except Exception as e:
            steps.append(WorkflowStep(name="get_details", status="failed", error=str(e)))

        # Get patient's recent records
        if result_data.get("patient_id"):
            try:
                records = await self.tools.list_records(patient_id=result_data["patient_id"], limit=10)
                steps.append(WorkflowStep(name="get_records", status="completed"))
                result_data["recent_records"] = records
            except Exception as e:
                steps.append(WorkflowStep(name="get_records", status="failed", error=str(e)))

            # Get active prescriptions
            try:
                prescriptions = await self.tools.list_prescriptions(
                    patient_id=result_data["patient_id"],
                    status="active"
                )
                steps.append(WorkflowStep(name="get_prescriptions", status="completed"))
                result_data["active_prescriptions"] = prescriptions
            except Exception as e:
                steps.append(WorkflowStep(name="get_prescriptions", status="failed", error=str(e)))

        return WorkflowResult(
            workflow_name="visit_start",
            status="completed",
            steps=steps,
            data=result_data,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )

    async def complete_visit(
        self,
        appointment_id: str,
        patient_id: str,
        visit_notes: str,
        diagnosis: Optional[str] = None,
        icd10_codes: Optional[List[str]] = None,
        treatment_plan: Optional[str] = None
    ) -> WorkflowResult:
        """Complete a patient visit with documentation"""
        steps = []
        result_data = {"appointment_id": appointment_id, "patient_id": patient_id}

        # Create visit record
        try:
            record = RecordInput(
                patient_id=patient_id,
                record_type="visit_note",
                content=visit_notes,
                diagnosis=diagnosis,
                icd10_codes=icd10_codes or [],
                visit_date=datetime.utcnow().isoformat()
            )
            record_result = await self.tools.create_record(record)
            steps.append(WorkflowStep(name="create_record", status="completed", result=record_result))
            result_data["record_id"] = record_result.get("record_id")
        except Exception as e:
            steps.append(WorkflowStep(name="create_record", status="failed", error=str(e)))
            return WorkflowResult(
                workflow_name="visit_complete",
                status="failed",
                steps=steps,
                data=result_data,
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow()
            )

        # Sign the record
        if result_data.get("record_id"):
            try:
                sign_result = await self.tools.sign_record(result_data["record_id"])
                steps.append(WorkflowStep(name="sign_record", status="completed", result=sign_result))
            except Exception as e:
                steps.append(WorkflowStep(name="sign_record", status="failed", error=str(e)))

        # Complete the appointment
        try:
            complete_result = await self.tools.complete_appointment(
                appointment_id,
                record_id=result_data.get("record_id")
            )
            steps.append(WorkflowStep(name="complete_appointment", status="completed", result=complete_result))
        except Exception as e:
            steps.append(WorkflowStep(name="complete_appointment", status="failed", error=str(e)))

        return WorkflowResult(
            workflow_name="visit_complete",
            status="completed",
            steps=steps,
            data=result_data,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )


class PrescriptionWorkflow:
    """Workflow for prescription management"""

    def __init__(self, tools: HealthcareTools):
        self.tools = tools

    async def new_prescription(
        self,
        patient_id: str,
        medication_name: str,
        dosage: str,
        frequency: str,
        duration_days: int,
        refills: int = 0,
        is_controlled: bool = False,
        dea_schedule: Optional[str] = None,
        instructions: Optional[str] = None,
        pharmacy: Optional[Dict] = None,
        e_prescribe: bool = True
    ) -> WorkflowResult:
        """Create and optionally e-prescribe a new prescription"""
        from app.healthcare.tools import PrescriptionInput
        steps = []
        result_data = {"patient_id": patient_id}

        # Create prescription
        try:
            prescription = PrescriptionInput(
                patient_id=patient_id,
                medication_name=medication_name,
                dosage=dosage,
                frequency=frequency,
                start_date=datetime.utcnow().date().isoformat(),
                end_date=(datetime.utcnow().date() + timedelta(days=duration_days)).isoformat() if duration_days else None,
                refills_authorized=refills,
                is_controlled_substance=is_controlled
            )
            if dea_schedule:
                prescription.dea_schedule = dea_schedule

            rx_result = await self.tools.create_prescription(prescription)
            steps.append(WorkflowStep(name="create_prescription", status="completed", result=rx_result))
            result_data["prescription_id"] = rx_result.get("prescription_id")
        except Exception as e:
            steps.append(WorkflowStep(name="create_prescription", status="failed", error=str(e)))
            return WorkflowResult(
                workflow_name="new_prescription",
                status="failed",
                steps=steps,
                data=result_data,
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow()
            )

        # E-prescribe if requested
        if e_prescribe and result_data.get("prescription_id"):
            try:
                eprescribe_result = await self.tools.e_prescribe(result_data["prescription_id"])
                steps.append(WorkflowStep(name="e_prescribe", status="completed", result=eprescribe_result))
                result_data["e_prescribed"] = True
            except Exception as e:
                steps.append(WorkflowStep(name="e_prescribe", status="failed", error=str(e)))
                result_data["e_prescribed"] = False

        return WorkflowResult(
            workflow_name="new_prescription",
            status="completed",
            steps=steps,
            data=result_data,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )

    async def refill_request(self, prescription_id: str) -> WorkflowResult:
        """Process a refill request"""
        steps = []
        result_data = {"prescription_id": prescription_id}

        # Get prescription details
        try:
            rx_details = await self.tools.get_prescription(prescription_id)
            steps.append(WorkflowStep(name="get_details", status="completed", result=rx_details))
            result_data["prescription"] = rx_details
        except Exception as e:
            steps.append(WorkflowStep(name="get_details", status="failed", error=str(e)))
            return WorkflowResult(
                workflow_name="refill_request",
                status="failed",
                steps=steps,
                data=result_data,
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow()
            )

        # Check refills remaining
        refills_remaining = rx_details.get("refills_remaining", 0)
        if refills_remaining <= 0:
            steps.append(WorkflowStep(
                name="check_refills",
                status="failed",
                error="No refills remaining"
            ))
            result_data["refill_available"] = False
            return WorkflowResult(
                workflow_name="refill_request",
                status="failed",
                steps=steps,
                data=result_data,
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow()
            )

        # Process refill
        try:
            refill_result = await self.tools.refill_prescription(prescription_id)
            steps.append(WorkflowStep(name="process_refill", status="completed", result=refill_result))
            result_data["refills_remaining"] = refill_result.get("refills_remaining")
        except Exception as e:
            steps.append(WorkflowStep(name="process_refill", status="failed", error=str(e)))

        return WorkflowResult(
            workflow_name="refill_request",
            status="completed",
            steps=steps,
            data=result_data,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
