# 100+ Agent Taxonomy for a Hierarchical Healthcare AI Platform

**Author**: Manus AI
**Date**: January 28, 2026

## 1. Architectural Overview

This document outlines a hierarchical taxonomy for a multi-agent system of over 100 agents, designed for the `swiss-ai-vault` healthcare platform. The architecture is based on the **Hierarchical Agent Teams** pattern, inspired by research from LangChain and the AutoGen paper [1].

The system is structured into three primary levels:

1.  **Level 1: Global Orchestrator (1 Agent)**: The central "brain" that receives user requests, decomposes them into high-level tasks, and routes them to the appropriate specialized teams.
2.  **Level 2: Team Supervisors (5-10 Agents)**: Each supervisor leads a specialized team (e.g., Clinical Data, Revenue Cycle). They receive tasks from the Global Orchestrator, break them down further, and manage a pool of worker agents.
3.  **Level 3: Worker Agents (100+ Agents)**: Highly specialized agents that perform a single, well-defined task using a specific set of tools. These are the "hands" of the system.

This hierarchical structure provides scalability, modularity, and clear lines of responsibility, making it possible to coordinate a large number of agents effectively.

## 2. Agent Taxonomy

Below is a detailed breakdown of the agent roles across the three levels.

### Level 1: Global Orchestrator

| Agent Name | Role | Responsibilities |
| :--- | :--- | :--- |
| **`Global_Orchestrator`** | Master Coordinator | - Receives all incoming user prompts and high-level goals.<br>- Decomposes goals into multi-step plans involving different teams.<br>- Routes tasks to the appropriate Level 2 Team Supervisors.<br>- Manages the overall state of the task.<br>- Synthesizes the final, comprehensive response from the outputs of the various teams. |

### Level 2: Team Supervisors

These agents act as mid-level managers, orchestrating the work within their domain of expertise.

| Team | Supervisor Agent | Responsibilities |
| :--- | :--- | :--- |
| **Clinical Operations** | `Clinical_Ops_Supervisor` | Manages tasks related to patient data, clinical notes, and medical history. |
| **Revenue Cycle** | `Revenue_Cycle_Supervisor` | Manages tasks related to billing, coding, prior authorizations, and claims. |
| **Pharmacy & Meds** | `Pharmacy_Supervisor` | Manages tasks related to medications, drug interactions, and formularies. |
| **Research & Guidelines** | `Research_Supervisor` | Manages tasks related to medical literature searches and clinical guideline lookups. |
| **Patient Engagement** | `Patient_Engagement_Supervisor` | Manages tasks related to patient communication, scheduling, and education. |
| **Quality & Compliance** | `Quality_Supervisor` | Manages tasks related to quality measure reporting and compliance checks. |

### Level 3: Worker Agents (100+)

This level contains a large and extensible pool of specialized worker agents. The following is a representative, non-exhaustive list.

#### Clinical Operations Team Workers (25+ Agents)

- **FHIR Data Agents (15+)**: `FHIR_Patient_Reader`, `FHIR_Observation_Reader`, `FHIR_Condition_Reader`, `FHIR_Procedure_Reader`, `FHIR_MedicationRequest_Reader`, `FHIR_AllergyIntolerance_Reader`, `FHIR_DiagnosticReport_Reader`, etc. (one for each key FHIR resource).
- **Clinical Note Agents (5+)**: `Note_Summarizer`, `Problem_List_Extractor`, `Medication_List_Extractor`, `Social_History_Extractor`, `Family_History_Extractor`.
- **Data Analysis Agents (5+)**: `Lab_Trend_Analyzer`, `Vitals_Spike_Detector`, `Readmission_Risk_Scorer`, `Appointment_NoShow_Predictor`, `Gaps_In_Care_Identifier`.

#### Revenue Cycle Team Workers (30+ Agents)

- **Coding Agents (10+)**: `ICD10_CM_Coder` (Diagnosis), `ICD10_PCS_Coder` (Inpatient Procedure), `CPT_Coder` (Outpatient Procedure), `HCPCS_Coder` (Supplies/Drugs), `DRG_Grouper`, `HCC_Coder` (Risk Adjustment).
- **Prior Authorization Agents (5+)**: `PA_Criteria_Fetcher`, `PA_Form_Filler`, `PA_Status_Checker`, `PA_Appeal_Drafter`.
- **Claims Management Agents (10+)**: `Claim_Scrubber`, `Claim_Status_Checker`, `Denial_Reason_Classifier`, `Remittance_Advice_Parser`, `Appeal_Letter_Generator`.
- **Billing Agents (5+)**: `Charge_Capture_Validator`, `Patient_Statement_Generator`, `Eligibility_Verifier`.

#### Pharmacy & Meds Team Workers (15+ Agents)

- **Interaction & Safety Agents (5+)**: `Drug_Drug_Interaction_Checker`, `Drug_Allergy_Interaction_Checker`, `Drug_Food_Interaction_Checker`, `Duplicate_Therapy_Detector`.
- **Formulary & Cost Agents (5+)**: `Formulary_Status_Checker`, `Alternative_Medication_Suggester`, `Medication_Cost_Estimator`.
- **Adherence & Education Agents (5+)**: `Medication_Adherence_Tracker`, `Patient_Medication_Handout_Generator`, `Refill_Reminder_Agent`.

#### Research & Guidelines Team Workers (15+ Agents)

- **Literature Search Agents (5+)**: `PubMed_Searcher`, `ClinicalTrials_gov_Searcher`, `Google_Scholar_Searcher`, `Web_Scraper_Agent`.
- **Guideline Agents (5+)**: `NCCN_Guideline_Fetcher` (Oncology), `AHA_Guideline_Fetcher` (Cardiology), `USPSTF_Guideline_Fetcher` (Preventive Care).
- **Synthesis Agents (5+)**: `Evidence_Summarizer`, `Citation_Formatter`, `Research_Outline_Generator`.

#### Patient Engagement Team Workers (15+ Agents)

- **Communication Agents (5+)**: `Appointment_Reminder_Sender`, `Lab_Result_Notifier` (for normal results), `Patient_Survey_Distributor`.
- **Scheduling Agents (5+)**: `Appointment_Scheduler`, `Appointment_Rescheduler`, `Waitlist_Manager`.
- **Education Agents (5+)**: `Condition_Explainer`, `Procedure_Explainer`, `Medication_Explainer`.

This taxonomy provides a clear path to scaling beyond 100 agents by simply adding more specialized workers to each team as new use cases are identified.

## 3. References

[1] Wu, Q., et al. (2023). *AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation*. [arXiv:2308.08155](https://arxiv.org/abs/2308.08155)
