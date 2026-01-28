# LangChain/LangGraph Implementation Guide for a 100+ Agent System

**Author**: Manus AI
**Date**: January 28, 2026

## 1. Introduction and Setup

This document provides a complete technical implementation guide for building the 100+ agent hierarchical system using LangChain and LangGraph. It translates the architectural concepts from the taxonomy and interaction pattern documents into executable Python code.

### Dependencies

Ensure the following libraries are included in your `agent-api/requirements.txt`:

```
langchain>=0.1.0
langgraph>=0.0.40
langchain_anthropic>=0.1.0
langchain_openai>=0.1.0
langchain_community
langchain_experimental
```

## 2. Central State Management

The foundation of a LangGraph application is its state. We define a central `AgentState` `TypedDict` that will be passed between all nodes in the graph. This state object contains the message history, the next agent to act, and a dictionary to accumulate results from different teams.

```python
# In a new file, e.g., agent-api/app/multi_agent_langgraph/state.py

from typing import List, TypedDict, Annotated, Dict, Any
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    """The central state for the multi-agent graph."""
    
    # The history of messages in the conversation
    messages: Annotated[list, add_messages]
    
    # The next agent or team to act
    next: str
    
    # A dictionary to store the outputs from different teams
    # e.g., {"revenue_cycle_output": "...", "clinical_ops_output": "..."}
    team_outputs: Dict[str, Any]
```

## 3. Level 3: Creating Worker Agents

Worker agents are the most numerous and specialized. They are created as simple, tool-using agents. We use `create_react_agent` for this, which builds a ReAct-style agent from a model and a set of tools.

```python
# In a new file, e.g., agent-api/app/multi_agent_langgraph/agents.py

from langchain_anthropic import ChatAnthropic
from langgraph.prebuilt import create_react_agent
from .tools import icd10_lookup_tool, cpt_lookup_tool # Example tools

# Use a cost-effective model for specialized workers
worker_llm = ChatAnthropic(model="claude-3-haiku-20240307")

# Create an ICD-10 Coder Agent
icd10_coder_agent = create_react_agent(
    llm=worker_llm,
    tools=[icd10_lookup_tool],
    system_message="You are an expert medical coder specializing in ICD-10-CM. Use your tools to find the correct codes."
)

# Create a CPT Coder Agent
cpt_coder_agent = create_react_agent(
    llm=worker_llm,
    tools=[cpt_lookup_tool],
    system_message="You are an expert medical coder specializing in CPT. Use your tools to find the correct codes."
)

# ... create all 100+ worker agents in a similar fashion ...
```

## 4. Level 2: Building a Team Supervisor Graph

A "Team" is a self-contained `StateGraph` that includes a supervisor and its worker agents. The supervisor's job is to route tasks to the correct worker within its team.

This example shows the **Revenue Cycle Team**.

```python
# In a new file, e.g., agent-api/app/multi_agent_langgraph/teams.py

from langgraph.graph import StateGraph, START, END
from .state import AgentState
from .agents import icd10_coder_agent, cpt_coder_agent
from .utils import create_supervisor_node, create_worker_node # Helper functions

# Define the members of the Revenue Cycle Team
revenue_cycle_members = ["ICD10_Coder", "CPT_Coder"]

# Create the supervisor for this team
# The supervisor LLM should be powerful, e.g., Sonnet or Opus
supervisor_llm = ChatAnthropic(model="claude-3-sonnet-20240229")
revenue_cycle_supervisor_node = create_supervisor_node(supervisor_llm, revenue_cycle_members)

# Define the graph for the Revenue Cycle Team
revenue_cycle_graph = StateGraph(AgentState)

# Add the supervisor node
revenue_cycle_graph.add_node("Revenue_Cycle_Supervisor", revenue_cycle_supervisor_node)

# Add the worker nodes
revenue_cycle_graph.add_node("ICD10_Coder", create_worker_node(icd10_coder_agent, "ICD10_Coder"))
revenue_cycle_graph.add_node("CPT_Coder", create_worker_node(cpt_coder_agent, "CPT_Coder"))

# Define the edges
# The supervisor decides which worker to call first
revenue_cycle_graph.add_conditional_edges(
    "Revenue_Cycle_Supervisor",
    lambda x: x["next"],
    {"ICD10_Coder": "ICD10_Coder", "CPT_Coder": "CPT_Coder", "FINISH": END}
)

# Workers always report back to the supervisor
revenue_cycle_graph.add_edge("ICD10_Coder", "Revenue_Cycle_Supervisor")
revenue_cycle_graph.add_edge("CPT_Coder", "Revenue_Cycle_Supervisor")

# The entry point is the supervisor
revenue_cycle_graph.set_entry_point("Revenue_Cycle_Supervisor")

# Compile the team graph into a runnable object
revenue_cycle_team = revenue_cycle_graph.compile()
```

## 5. Level 1: Composing the Global Orchestrator Graph

The key insight for the hierarchical structure is that **each compiled team graph can be treated as a tool** by the level above it. The `Global_Orchestrator` doesn't see individual worker agents; it only sees the teams.

```python
# In a new file, e.g., agent-api/app/multi_agent_langgraph/main_graph.py

from langchain_core.tools import tool
from .teams import revenue_cycle_team, clinical_ops_team # Assume clinical_ops_team is also defined

# Create tools from the compiled team graphs
@tool
def revenue_cycle_tool(task: str):
    """Use this tool for any tasks related to medical billing, coding, claims, or prior authorizations."""
    return revenue_cycle_team.invoke({"messages": [("user", task)]})

@tool
def clinical_ops_tool(task: str):
    """Use this tool for any tasks related to accessing and summarizing patient clinical data from EHRs."""
    return clinical_ops_team.invoke({"messages": [("user", task)]})

# ... create tools for all 5-10 teams ...

# The Global Orchestrator is a ReAct agent that uses the TEAM tools
global_orchestrator_llm = ChatAnthropic(model="claude-3-opus-20240229")
global_orchestrator_agent = create_react_agent(
    llm=global_orchestrator_llm,
    tools=[revenue_cycle_tool, clinical_ops_tool],
    system_message="You are a master healthcare AI orchestrator. Decompose the user's goal and delegate tasks to the appropriate teams using your tools."
)

# The final graph is a single node that runs the Global Orchestrator
main_graph = StateGraph(AgentState)
main_graph.add_node("Global_Orchestrator", create_worker_node(global_orchestrator_agent, "Global_Orchestrator"))
main_graph.set_entry_point("Global_Orchestrator")
main_graph.set_finish_point("Global_Orchestrator")

# Compile the final, top-level graph
app = main_graph.compile()
```

## 6. Running the Full System

With the `app` compiled, you can now invoke the entire hierarchical system with a single input. LangGraph handles the state transitions and routing through all the levels.

```python
# Example of how to run the entire system

initial_prompt = "Review the latest clinical note for patient ID 12345, identify the correct diagnosis and procedure codes, and estimate the reimbursement amount."

# Invoke the top-level graph
final_state = app.invoke({"messages": [("user", initial_prompt)]})

# The final answer is in the last message from the orchestrator
print(final_state['messages'][-1].content)
```

This implementation provides a scalable and maintainable structure for coordinating over 100 agents, leveraging LangGraph's ability to compose graphs within graphs.

## 7. Helper Utilities (`utils.py`)

This file contains the reusable functions `create_supervisor_node` and `create_worker_node`.

```python
# In agent-api/app/multi_agent_langgraph/utils.py

from typing import Literal
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage
from langgraph.graph import END
from .state import AgentState

def create_supervisor_node(llm: BaseChatModel, members: list[str]):
    # ... (code from research findings) ...
    # This function returns the supervisor_node
    return supervisor_node

def create_worker_node(agent, name: str):
    """Creates a node that executes a worker agent and returns control to the supervisor."""
    def worker_node(state: AgentState):
        result = agent.invoke(state)
        return {
            "messages": [HumanMessage(content=result["messages"][-1].content, name=name)]
        }
    return worker_node
```
