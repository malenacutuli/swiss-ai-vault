# AI Consensus & Decision-Making Framework

**Author**: Manus AI
**Date**: January 28, 2026
**Version**: 1.0

---

## 1. Overview

To achieve the target of 90%+ accuracy and eliminate single-agent hallucination, the **SwissBrAIn.ai** Orchestrator employs a **Voting-Based Council** for its core analytical tasks. This framework ensures that every recommendation is the result of a consensus between multiple, specialized AI agents, rather than the opinion of a single model.

This document details the technical implementation of the consensus mechanism as defined in Phase 3 of the Master Orchestrator Prompt.

## 2. Framework Protocol

The consensus process is executed by the Orchestrator after it has gathered sufficient information from the user (Phase 2).

### Step 1: Forming the Council

The Orchestrator dynamically assembles a council of specialist agents based on the primary symptoms reported by the user. This ensures that the most relevant experts are consulted.

**Logic**:
- A predefined mapping links common symptom keywords to a default council of agents.
- **Example**: If the user mentions "rash" or "itchy skin," the Orchestrator will form a council consisting of:
    - `General_Practitioner_Agent`
    - `Dermatologist_Agent`
    - `Allergist_Agent`

### Step 2: Parallel Dispatch

The Orchestrator dispatches the structured JSON of user information to every member of the council simultaneously. This parallel processing is crucial for delivering a timely response and scaling to millions of simultaneous consults.

**Conceptual Code**:
```python
import asyncio

async def get_council_opinions(council_agents, user_data):
    tasks = []
    for agent in council_agents:
        tasks.append(call_specialist_agent(agent.name, user_data))
    
    # Wait for all agents to return their analysis
    agent_outputs = await asyncio.gather(*tasks)
    return agent_outputs
```

### Step 3: Aggregating the Results

Once all agents have returned their analysis, the Orchestrator begins the aggregation process. It handles the two key fields—`differential_specialties` and `urgency_score`—separately.

#### 3.1. Specialty Consensus (Plurality Voting)

The goal is to find the single medical specialty that the council most agrees upon.

**Process**:
1.  Collect all `differential_specialties` lists from all agent outputs.
2.  Create a frequency map (or a vote count) for every specialty mentioned.
3.  The specialty with the highest vote count is declared the **Consensus Specialty**.

**Handling Ties**: If there is a tie for the highest vote count, the Orchestrator MUST default to `General Practice`. This is a safety measure to ensure the user is always routed to a professional who can perform a broader evaluation when the AI council is not in clear agreement.

#### 3.2. Urgency Consensus (Weighted Average)

The goal is to determine a reliable urgency score that reflects the council's collective assessment, giving more weight to more confident agents.

**Process**:
1.  For each agent's output, multiply its `urgency_score` by its `confidence_score`. This gives the `weighted_score`.
2.  Sum all `weighted_score` values.
3.  Sum all `confidence_score` values.
4.  Divide the total `weighted_score` by the total `confidence_score`.
5.  Round the result to the nearest integer to get the final **Consensus Urgency**.

**Formula**:

Consensus Urgency = round( Σ(urgency * confidence) / Σ(confidence) )

### Step 4: Final Decision and Confidence Check

Before presenting the recommendation to the user, the Orchestrator performs a final confidence check.

**Process**:
1.  Calculate the average confidence of the entire council by averaging all `confidence_score` values.
2.  **If the average confidence is below 0.70**: The council's consensus is considered weak. The Orchestrator MUST discard the specific specialty recommendation.
3.  **Action for Low Confidence**: In this case, the Orchestrator will recommend that the user see a **General Practitioner** for a more thorough evaluation, but it will still use the calculated **Consensus Urgency** to guide the user on how quickly to book an appointment.

This safety mechanism prevents the system from making overly specific recommendations based on ambiguous or conflicting AI analyses.

## 3. Pseudo-Code Implementation

This pseudo-code demonstrates the entire decision-making logic within the Orchestrator.

```python
def get_consensus_recommendation(agent_outputs):
    # Step 3.1: Specialty Voting
    specialty_votes = {}
    for output in agent_outputs:
        for specialty in output['differential_specialties']:
            specialty_votes[specialty] = specialty_votes.get(specialty, 0) + 1

    # Find the winning specialty
    if not specialty_votes:
        consensus_specialty = "General Practice"
    else:
        # Sort by votes to find the winner
        sorted_specialties = sorted(specialty_votes.items(), key=lambda item: item[1], reverse=True)
        
        # Handle ties: if top two have same votes, default to General Practice
        if len(sorted_specialties) > 1 and sorted_specialties[0][1] == sorted_specialties[1][1]:
            consensus_specialty = "General Practice"
        else:
            consensus_specialty = sorted_specialties[0][0]

    # Step 3.2: Urgency Weighted Average
    total_weighted_score = 0
    total_confidence = 0
    for output in agent_outputs:
        total_weighted_score += output['urgency_score'] * output['confidence_score']
        total_confidence += output['confidence_score']

    if total_confidence == 0:
        consensus_urgency = 3 # Default to a medium urgency if no confidence
    else:
        consensus_urgency = round(total_weighted_score / total_confidence)

    # Step 4: Final Confidence Check
    average_confidence = total_confidence / len(agent_outputs)
    if average_confidence < 0.70:
        # Override specialty if confidence is too low
        consensus_specialty = "General Practice"

    return {
        "consensus_specialty": consensus_specialty,
        "consensus_urgency": consensus_urgency
    }

```
