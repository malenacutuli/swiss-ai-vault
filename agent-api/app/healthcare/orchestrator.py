"""Healthcare orchestrator with Claude API integration"""

import os
import time
import json
from typing import List, Optional, AsyncGenerator
import anthropic
from .config import HEALTHCARE_MODELS, TASK_MODEL_MAP, MAX_TOOL_ITERATIONS
from .models import (
    HealthcareQueryRequest,
    HealthcareQueryResponse,
    Citation,
    ToolResult,
    StreamChunk
)
from .tools import get_tool, get_claude_tools
from .prompts.system import HEALTHCARE_SYSTEM_PROMPT, TASK_PROMPTS


class HealthcareOrchestrator:
    """Orchestrates healthcare queries with Claude and tools"""

    def __init__(self):
        self.client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
        self.tools = get_claude_tools()

    def _get_model(self, task_type: str, preference: Optional[str] = None) -> str:
        """Select appropriate model for task"""
        if preference:
            return HEALTHCARE_MODELS.get(preference, HEALTHCARE_MODELS["default"])

        model_type = TASK_MODEL_MAP.get(task_type, "fast")
        return HEALTHCARE_MODELS[model_type]

    def _build_system_prompt(self, task_type: str) -> str:
        """Build system prompt with task-specific additions"""
        base = HEALTHCARE_SYSTEM_PROMPT
        task_addition = TASK_PROMPTS.get(task_type, TASK_PROMPTS["general_query"])
        return f"{base}\n\n## CURRENT TASK\n{task_addition}"

    def _build_messages(
        self,
        query: str,
        context_chunks: Optional[List[str]] = None,
        previous_messages: Optional[List[dict]] = None
    ) -> List[dict]:
        """Build message list for Claude"""
        messages = []

        # Add previous conversation if provided
        if previous_messages:
            messages.extend(previous_messages)

        # Build current user message
        user_content = query

        if context_chunks:
            context_text = "\n\n---\n\n".join(context_chunks)
            user_content = f"""## RELEVANT DOCUMENT CONTEXT
The following excerpts are from documents the user has uploaded (processed client-side):

{context_text}

---

## USER QUERY
{query}"""

        messages.append({"role": "user", "content": user_content})

        return messages

    async def _execute_tool(self, tool_name: str, tool_input: dict) -> dict:
        """Execute a healthcare tool"""
        tool = get_tool(tool_name)
        if not tool:
            return {"error": f"Unknown tool: {tool_name}"}

        return await tool.execute(**tool_input)

    def _extract_citations(self, tool_results: List[ToolResult]) -> List[Citation]:
        """Extract citations from tool results"""
        citations = []
        idx = 1

        for result in tool_results:
            output = result.output

            # Extract from PubMed results
            if result.tool == "search_pubmed" and "results" in output:
                for article in output["results"]:
                    citations.append(Citation(
                        index=idx,
                        source_type="pubmed",
                        url=article.get("url"),
                        title=article.get("title"),
                        authors=article.get("authors"),
                        date=article.get("year")
                    ))
                    idx += 1

            # Extract from ICD-10 results
            elif result.tool == "lookup_icd10" and output.get("source_url"):
                citations.append(Citation(
                    index=idx,
                    source_type="icd10",
                    url=output.get("source_url"),
                    title=f"ICD-10-CM Lookup: {result.input.get('search_term', '')}"
                ))
                idx += 1

            # Extract from NPI results
            elif result.tool == "verify_npi" and output.get("source_url"):
                citations.append(Citation(
                    index=idx,
                    source_type="npi",
                    url=output.get("source_url"),
                    title="NPPES NPI Registry"
                ))
                idx += 1

            # Extract from RxNorm results
            elif result.tool == "check_drug_interaction" and output.get("source_url"):
                citations.append(Citation(
                    index=idx,
                    source_type="rxnorm",
                    url=output.get("source_url"),
                    title="RxNav Drug Interaction"
                ))
                idx += 1

        return citations

    async def execute(self, request: HealthcareQueryRequest) -> HealthcareQueryResponse:
        """Execute a healthcare query with tool use loop"""

        start_time = time.time()
        model = self._get_model(request.task_type, request.model)
        system_prompt = self._build_system_prompt(request.task_type)
        messages = self._build_messages(
            request.query,
            request.context_chunks,
            request.previous_messages
        )

        tool_results: List[ToolResult] = []
        iterations = 0
        total_input_tokens = 0
        total_output_tokens = 0

        # Agentic loop with tool use
        while iterations < MAX_TOOL_ITERATIONS:
            iterations += 1

            # Call Claude
            response = self.client.messages.create(
                model=model,
                max_tokens=4096,
                system=system_prompt,
                tools=self.tools,
                messages=messages
            )

            total_input_tokens += response.usage.input_tokens
            total_output_tokens += response.usage.output_tokens

            # Check if Claude wants to use tools
            if response.stop_reason == "tool_use":
                # Process tool calls
                assistant_content = []
                tool_results_content = []

                for block in response.content:
                    if block.type == "tool_use":
                        # Execute tool
                        tool_output = await self._execute_tool(block.name, block.input)

                        tool_results.append(ToolResult(
                            tool=block.name,
                            input=block.input,
                            output=tool_output,
                            cached=False  # TODO: implement caching
                        ))

                        assistant_content.append({
                            "type": "tool_use",
                            "id": block.id,
                            "name": block.name,
                            "input": block.input
                        })
                        tool_results_content.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(tool_output)
                        })
                    elif block.type == "text":
                        assistant_content.append({
                            "type": "text",
                            "text": block.text
                        })

                # Add to messages for next iteration
                messages.append({"role": "assistant", "content": assistant_content})
                messages.append({"role": "user", "content": tool_results_content})

            else:
                # Claude is done - extract final response
                final_text = ""
                for block in response.content:
                    if hasattr(block, "text"):
                        final_text += block.text

                latency_ms = int((time.time() - start_time) * 1000)
                citations = self._extract_citations(tool_results)

                return HealthcareQueryResponse(
                    content=final_text,
                    citations=citations,
                    tool_results=tool_results,
                    model_used=model,
                    input_tokens=total_input_tokens,
                    output_tokens=total_output_tokens,
                    latency_ms=latency_ms
                )

        # Max iterations reached
        return HealthcareQueryResponse(
            content="Maximum tool iterations reached. Please try a more specific query.",
            citations=[],
            tool_results=tool_results,
            model_used=model,
            input_tokens=total_input_tokens,
            output_tokens=total_output_tokens,
            latency_ms=int((time.time() - start_time) * 1000)
        )

    async def stream(
        self,
        request: HealthcareQueryRequest
    ) -> AsyncGenerator[StreamChunk, None]:
        """Stream healthcare query response"""

        model = self._get_model(request.task_type, request.model)
        system_prompt = self._build_system_prompt(request.task_type)
        messages = self._build_messages(
            request.query,
            request.context_chunks,
            request.previous_messages
        )

        # Note: Tool use with streaming requires special handling
        # For now, yield text chunks from streaming response

        with self.client.messages.stream(
            model=model,
            max_tokens=4096,
            system=system_prompt,
            messages=messages
        ) as stream:
            for text in stream.text_stream:
                yield StreamChunk(type="text", content=text)

        yield StreamChunk(type="done")
