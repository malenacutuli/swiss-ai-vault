"""Tool Router for executing different tool types"""
import logging
import uuid
from typing import Dict, Any, Optional
from supabase import Client

from app.agent.models.types import ToolResult, ToolContext
from app.agent.tools.e2b_executor import E2BSandboxExecutor
from app.agent.tools.webdev import get_webdev_tools
from app.config import get_settings

logger = logging.getLogger(__name__)


class ToolRouter:
    """
    Routes and executes various agent tools.

    Hybrid Architecture:
    - Orchestration: Swiss K8s (Phase 2B worker infrastructure)
    - Tool Execution: E2B sandboxes (reliable networking, proven infrastructure)
    """

    def __init__(self, supabase: Client):
        self.supabase = supabase
        settings = get_settings()

        # Initialize E2B executor for tool execution
        self.e2b_api_key = settings.e2b_api_key
        if self.e2b_api_key:
            self.e2b_executor = E2BSandboxExecutor(self.e2b_api_key)
            logger.info("✓ E2B sandbox executor enabled")
        else:
            self.e2b_executor = None
            logger.warning("! E2B API key not configured - tools will run as mocks")

    async def execute(
        self,
        tool_name: str,
        input_data: Dict[str, Any],
        context: ToolContext,
    ) -> ToolResult:
        """Execute a tool and return result"""
        try:
            # Route to appropriate tool handler
            handlers = {
                "shell": self._execute_shell,
                "code": self._execute_code,
                "message": self._send_message,
                "search": self._web_search,
                "browser": self._browser_interaction,
                "file_read": self._file_read,
                "file_write": self._file_write,
                "file_list": self._file_list,
                "connector": self._connector_access,
                # Document generation tools
                "generate_document": self._generate_document,
                "generate_slides": self._generate_slides,
                "generate_spreadsheet": self._generate_spreadsheet,
                # WebDev tools
                "webdev_init_project": self._webdev_init_project,
                "webdev_check_status": self._webdev_check_status,
                "webdev_save_checkpoint": self._webdev_save_checkpoint,
                "webdev_restart_server": self._webdev_restart_server,
                "webdev_add_feature": self._webdev_add_feature,
            }

            handler = handlers.get(tool_name)
            if not handler:
                return ToolResult(
                    output=None,
                    success=False,
                    error=f"Unknown tool: {tool_name}",
                )

            return await handler(input_data, context)

        except Exception as e:
            logger.error(f"Tool execution error for {tool_name}: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
            )

    async def _execute_shell(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """Execute shell command in E2B sandbox"""
        command = input_data.get("command")
        working_dir = input_data.get("working_dir", "/workspace")
        timeout = input_data.get("timeout", 300)

        logger.info(f"[Shell] Command: {command}, Dir: {working_dir}, Timeout: {timeout}s")

        if not self.e2b_executor:
            logger.warning("E2B not configured, returning mock response")
            return ToolResult(
                output={
                    "stdout": f"E2B not configured. Would execute: {command}",
                    "stderr": "",
                    "exit_code": 0,
                },
                success=True,
                credits_used=1.0,
            )

        try:
            # Execute command in E2B sandbox (with pooling)
            result = await self.e2b_executor.execute_shell(
                command=command,
                run_id=context.run_id,
                timeout=timeout
            )

            success = result.get("exit_code", 1) == 0

            return ToolResult(
                output=result,
                success=success,
                credits_used=1.0,
                error=result.get("stderr") if not success else None
            )

        except Exception as e:
            logger.error(f"Shell execution failed: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
                credits_used=0.0
            )

    async def _execute_code(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """Execute code in E2B sandbox"""
        language = input_data.get("language", "python")
        code = input_data.get("code")
        timeout = input_data.get("timeout", 300)

        logger.info(f"[Code] Language: {language}, Timeout: {timeout}s, Code length: {len(code)} chars")

        if not self.e2b_executor:
            logger.warning("E2B not configured, returning mock response")
            return ToolResult(
                output={
                    "result": f"E2B not configured. Would execute {language} code",
                    "execution_time_ms": 0,
                },
                success=True,
                credits_used=2.0,
            )

        try:
            # Execute code in E2B sandbox (with pooling)
            result = await self.e2b_executor.execute_code(
                code=code,
                run_id=context.run_id,
                language=language,
                timeout=timeout
            )

            success = result.get("success", False)

            return ToolResult(
                output=result,
                success=success,
                credits_used=2.0,
                error=result.get("error") if not success else None
            )

        except Exception as e:
            logger.error(f"Code execution failed: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
                credits_used=0.0
            )

    async def _send_message(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """Send message to user"""
        message = input_data.get("message")

        try:
            self.supabase.table("agent_messages").insert({
                "run_id": context.run_id,
                "role": "assistant",
                "content": message,
            }).execute()

            return ToolResult(
                output={"sent": True, "message": message},
                success=True,
                credits_used=0,  # Messages are free
            )
        except Exception as e:
            return ToolResult(
                output=None,
                success=False,
                error=f"Failed to send message: {str(e)}",
            )

    async def _web_search(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """Perform web search using Tavily/Serper APIs"""
        from app.agent.tools.search import WebSearchTool

        query = input_data.get("query")
        max_results = input_data.get("max_results", 5)
        search_depth = input_data.get("search_depth", "basic")

        logger.info(f"[Search] Query: {query}, Max: {max_results}, Depth: {search_depth}")

        search_tool = WebSearchTool()

        try:
            result = await search_tool.search(
                query=query,
                max_results=max_results,
                search_depth=search_depth
            )

            success = result.get("success", False)

            return ToolResult(
                output=result,
                success=success,
                credits_used=1.0,
            )

        except Exception as e:
            logger.error(f"Web search error: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
                credits_used=0.0
            )
        finally:
            await search_tool.close()

    async def _browser_interaction(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """Interact with web browser using Playwright in E2B sandbox"""
        from app.agent.tools.browser import BrowserTool

        action = input_data.get("action")  # navigate, click, type, screenshot, extract, execute_js
        url = input_data.get("url")
        selector = input_data.get("selector")
        text = input_data.get("text")
        javascript = input_data.get("javascript")
        timeout = input_data.get("timeout", 30000)

        logger.info(f"[Browser] Action: {action}, URL: {url}")

        browser_tool = BrowserTool()

        try:
            result = await browser_tool.execute(
                run_id=context.run_id,
                action=action,
                url=url,
                selector=selector,
                text=text,
                javascript=javascript,
                timeout=timeout
            )

            success = result.get("success", False)

            # Build artifacts for screenshots
            artifacts = []
            if action == "screenshot" and result.get("screenshot"):
                artifacts.append({
                    "id": str(uuid.uuid4()),
                    "filename": "screenshot.png",
                    "file_type": "image",
                    "data": result["screenshot"],  # base64 encoded
                    "encoding": "base64"
                })

            return ToolResult(
                output=result,
                success=success,
                credits_used=3.0,
                artifacts=artifacts if artifacts else None
            )

        except Exception as e:
            logger.error(f"Browser interaction error: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
                credits_used=0.0
            )

    async def _file_read(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """Read file from S3 workspace"""
        from app.storage.s3_workspace import S3Workspace

        filepath = input_data.get("filepath")

        logger.info(f"[File Read] Path: {filepath}")

        workspace = S3Workspace(context.user_id, context.run_id)

        try:
            content = await workspace.read_file(filepath)
            return ToolResult(
                output={
                    "content": content.decode('utf-8'),
                    "filepath": filepath,
                },
                success=True,
                credits_used=1.0,
            )
        except FileNotFoundError:
            return ToolResult(
                output=None,
                success=False,
                error=f"File not found: {filepath}",
                credits_used=0,
            )
        except Exception as e:
            logger.error(f"File read error: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
                credits_used=0,
            )

    async def _file_write(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """Write file to S3 workspace"""
        from app.storage.s3_workspace import S3Workspace

        filepath = input_data.get("filepath")
        content = input_data.get("content", "")

        logger.info(f"[File Write] Path: {filepath}, Size: {len(content)} bytes")

        workspace = S3Workspace(context.user_id, context.run_id)

        try:
            success = await workspace.write_file(filepath, content.encode('utf-8'))

            if success:
                filename = filepath.split("/")[-1] if "/" in filepath else filepath

                return ToolResult(
                    output={
                        "written": True,
                        "filepath": filepath,
                        "bytes": len(content),
                    },
                    success=True,
                    credits_used=1.0,
                    artifacts=[
                        {
                            "id": str(uuid.uuid4()),
                            "filename": filename,
                            "file_type": self._get_file_type(filepath),
                            "url": f"storage://{filepath}",
                        }
                    ],
                )
            else:
                return ToolResult(
                    output=None,
                    success=False,
                    error="Failed to write file",
                    credits_used=0,
                )
        except Exception as e:
            logger.error(f"File write error: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
                credits_used=0,
            )

    async def _file_list(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """List files in S3 workspace directory"""
        from app.storage.s3_workspace import S3Workspace

        dirpath = input_data.get("dirpath", "")

        logger.info(f"[File List] Path: {dirpath}")

        workspace = S3Workspace(context.user_id, context.run_id)

        try:
            files = await workspace.list_files(dirpath)
            return ToolResult(
                output={
                    "files": files,
                    "dirpath": dirpath,
                },
                success=True,
                credits_used=1.0,
            )
        except Exception as e:
            logger.error(f"File list error: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
                credits_used=0,
            )

    async def _connector_access(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """Access external service via connector"""
        from app.connectors import ConnectorManager

        connector_type = input_data.get("connector_type")
        operation = input_data.get("operation")
        params = input_data.get("params", {})

        logger.info(f"[Connector] Type: {connector_type}, Operation: {operation}")

        # Validate connector type
        if not ConnectorManager.is_supported(connector_type):
            return ToolResult(
                output=None,
                success=False,
                error=f"Unsupported connector type: {connector_type}. Supported: {ConnectorManager.get_supported_providers()}",
            )

        try:
            # Get connector via manager
            manager = ConnectorManager(self.supabase)
            connector = await manager.get_connector(connector_type, context.user_id)

            if not connector:
                return ToolResult(
                    output=None,
                    success=False,
                    error=f"No active {connector_type} connection found for user. Please connect your account first.",
                )

            # Route to connector handler
            connector_handlers = {
                "github": self._github_connector,
                "slack": self._slack_connector,
                "google_drive": self._google_drive_connector,
            }

            handler = connector_handlers.get(connector_type)
            if not handler:
                return ToolResult(
                    output=None,
                    success=False,
                    error=f"Handler not implemented for: {connector_type}",
                )

            return await handler(operation, params, connector)

        except Exception as e:
            logger.error(f"Connector error for {connector_type}: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=f"Connector error: {str(e)}",
            )

    # Connector implementations
    async def _github_connector(self, operation: str, params: Dict, connector) -> ToolResult:
        """Execute GitHub connector operation"""
        from app.connectors import GitHubConnector

        logger.info(f"[GitHub] Operation: {operation}, Params: {list(params.keys())}")

        # Map operations to connector methods
        operations = {
            # User operations
            "get_user": connector.get_user,
            "get_user_repos": lambda: connector.get_user_repos(**params),

            # Repository operations
            "get_repo": lambda: connector.get_repo(params["owner"], params["repo"]),
            "create_repo": lambda: connector.create_repo(**params),
            "search_repos": lambda: connector.search_repos(**params),

            # Issue operations
            "list_issues": lambda: connector.list_issues(params["owner"], params["repo"], **{k: v for k, v in params.items() if k not in ["owner", "repo"]}),
            "get_issue": lambda: connector.get_issue(params["owner"], params["repo"], params["issue_number"]),
            "create_issue": lambda: connector.create_issue(params["owner"], params["repo"], **{k: v for k, v in params.items() if k not in ["owner", "repo"]}),
            "update_issue": lambda: connector.update_issue(params["owner"], params["repo"], params["issue_number"], **{k: v for k, v in params.items() if k not in ["owner", "repo", "issue_number"]}),
            "add_issue_comment": lambda: connector.add_issue_comment(params["owner"], params["repo"], params["issue_number"], params["body"]),

            # PR operations
            "list_pull_requests": lambda: connector.list_pull_requests(params["owner"], params["repo"], **{k: v for k, v in params.items() if k not in ["owner", "repo"]}),
            "get_pull_request": lambda: connector.get_pull_request(params["owner"], params["repo"], params["pull_number"]),
            "create_pull_request": lambda: connector.create_pull_request(params["owner"], params["repo"], **{k: v for k, v in params.items() if k not in ["owner", "repo"]}),
            "merge_pull_request": lambda: connector.merge_pull_request(params["owner"], params["repo"], params["pull_number"], **{k: v for k, v in params.items() if k not in ["owner", "repo", "pull_number"]}),

            # Code operations
            "get_file_contents": lambda: connector.get_file_contents(params["owner"], params["repo"], params["path"], params.get("ref")),
            "search_code": lambda: connector.search_code(**params),

            # Branch operations
            "list_branches": lambda: connector.list_branches(params["owner"], params["repo"]),
            "create_branch": lambda: connector.create_branch(params["owner"], params["repo"], params["branch_name"], params["source_sha"]),

            # Commit operations
            "list_commits": lambda: connector.list_commits(params["owner"], params["repo"], **{k: v for k, v in params.items() if k not in ["owner", "repo"]}),
            "get_commit": lambda: connector.get_commit(params["owner"], params["repo"], params["ref"]),
        }

        if operation not in operations:
            return ToolResult(
                output=None,
                success=False,
                error=f"Unknown GitHub operation: {operation}. Available: {list(operations.keys())}",
            )

        try:
            result = await operations[operation]()
            return ToolResult(
                output=result.data,
                success=result.success,
                error=result.error,
                credits_used=2.0,
            )
        except Exception as e:
            logger.error(f"GitHub connector error: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
                credits_used=0,
            )

    async def _slack_connector(self, operation: str, params: Dict, connector) -> ToolResult:
        """Execute Slack connector operation"""
        from app.connectors import SlackConnector

        logger.info(f"[Slack] Operation: {operation}, Params: {list(params.keys())}")

        # Map operations to connector methods
        operations = {
            # Auth/User operations
            "auth_test": connector.auth_test,
            "get_user_info": lambda: connector.get_user_info(params["user_id"]),
            "list_users": lambda: connector.list_users(**params),

            # Channel operations
            "list_channels": lambda: connector.list_channels(**params),
            "get_channel_info": lambda: connector.get_channel_info(params["channel_id"]),
            "create_channel": lambda: connector.create_channel(params["name"], params.get("is_private", False)),
            "join_channel": lambda: connector.join_channel(params["channel_id"]),
            "leave_channel": lambda: connector.leave_channel(params["channel_id"]),
            "archive_channel": lambda: connector.archive_channel(params["channel_id"]),
            "invite_to_channel": lambda: connector.invite_to_channel(params["channel_id"], params["user_ids"]),

            # Message operations
            "send_message": lambda: connector.send_message(params["channel"], params["text"], params.get("blocks"), params.get("thread_ts")),
            "update_message": lambda: connector.update_message(params["channel"], params["ts"], params["text"], params.get("blocks")),
            "delete_message": lambda: connector.delete_message(params["channel"], params["ts"]),
            "get_channel_history": lambda: connector.get_channel_history(params["channel"], **{k: v for k, v in params.items() if k != "channel"}),
            "get_thread_replies": lambda: connector.get_thread_replies(params["channel"], params["ts"]),
            "search_messages": lambda: connector.search_messages(**params),

            # Reaction operations
            "add_reaction": lambda: connector.add_reaction(params["channel"], params["timestamp"], params["name"]),
            "remove_reaction": lambda: connector.remove_reaction(params["channel"], params["timestamp"], params["name"]),

            # File operations
            "upload_file": lambda: connector.upload_file(**params),
            "list_files": lambda: connector.list_files(**params),
            "delete_file": lambda: connector.delete_file(params["file_id"]),
        }

        if operation not in operations:
            return ToolResult(
                output=None,
                success=False,
                error=f"Unknown Slack operation: {operation}. Available: {list(operations.keys())}",
            )

        try:
            result = await operations[operation]()
            return ToolResult(
                output=result.data,
                success=result.success,
                error=result.error,
                credits_used=2.0,
            )
        except Exception as e:
            logger.error(f"Slack connector error: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
                credits_used=0,
            )

    async def _google_drive_connector(self, operation: str, params: Dict, connector) -> ToolResult:
        """Execute Google Drive connector operation"""
        from app.connectors import GoogleDriveConnector

        logger.info(f"[Google Drive] Operation: {operation}, Params: {list(params.keys())}")

        # Map operations to connector methods
        operations = {
            # File operations
            "list_files": lambda: connector.list_files(**params),
            "get_file": lambda: connector.get_file(params["file_id"]),
            "create_file": lambda: connector.create_file(**params),
            "update_file": lambda: connector.update_file(params["file_id"], **{k: v for k, v in params.items() if k != "file_id"}),
            "delete_file": lambda: connector.delete_file(params["file_id"]),
            "copy_file": lambda: connector.copy_file(params["file_id"], params.get("name"), params.get("parent_id")),
            "export_file": lambda: connector.export_file(params["file_id"], params["mime_type"]),

            # Folder operations
            "create_folder": lambda: connector.create_folder(params["name"], params.get("parent_id")),
            "list_folder_contents": lambda: connector.list_folder_contents(params.get("folder_id", "root")),

            # Search operations
            "search_files": lambda: connector.search_files(params["query"], params.get("page_size", 100)),
            "search_by_type": lambda: connector.search_by_type(params["mime_type"]),

            # Permission operations
            "list_permissions": lambda: connector.list_permissions(params["file_id"]),
            "create_permission": lambda: connector.create_permission(params["file_id"], params["role"], params["permission_type"], params.get("email_address"), params.get("domain")),
            "delete_permission": lambda: connector.delete_permission(params["file_id"], params["permission_id"]),
            "transfer_ownership": lambda: connector.transfer_ownership(params["file_id"], params["email_address"]),

            # Comment operations
            "list_comments": lambda: connector.list_comments(params["file_id"]),
            "create_comment": lambda: connector.create_comment(params["file_id"], params["content"]),
            "delete_comment": lambda: connector.delete_comment(params["file_id"], params["comment_id"]),

            # About operations
            "get_about": connector.get_about,
            "get_storage_quota": connector.get_storage_quota,

            # Shared drive operations
            "list_shared_drives": lambda: connector.list_shared_drives(**params),
        }

        if operation not in operations:
            return ToolResult(
                output=None,
                success=False,
                error=f"Unknown Google Drive operation: {operation}. Available: {list(operations.keys())}",
            )

        try:
            result = await operations[operation]()
            return ToolResult(
                output=result.data,
                success=result.success,
                error=result.error,
                credits_used=2.0,
            )
        except Exception as e:
            logger.error(f"Google Drive connector error: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
                credits_used=0,
            )

    def _get_file_type(self, filepath: str) -> str:
        """Get file type from extension"""
        ext = filepath.split(".")[-1].lower() if "." in filepath else ""

        type_map = {
            "js": "javascript",
            "ts": "typescript",
            "py": "python",
            "java": "java",
            "cpp": "cpp",
            "c": "c",
            "go": "go",
            "rs": "rust",
            "rb": "ruby",
            "php": "php",
            "html": "html",
            "css": "css",
            "json": "json",
            "xml": "xml",
            "md": "markdown",
            "txt": "text",
            "pdf": "pdf",
            "png": "image",
            "jpg": "image",
            "jpeg": "image",
            "gif": "image",
            "svg": "image",
        }

        return type_map.get(ext, "unknown")

    # =========================================================================
    # Document Generation Tools
    # =========================================================================

    async def _generate_document(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """Generate a document (DOCX, PDF, Markdown)"""
        from app.document_generation.router import DocumentGenerationRouter, DocumentFormat
        from app.document_generation.base import DocumentContent, Section

        doc_type = input_data.get("format", "docx").lower()
        title = input_data.get("title", "Document")
        sections = input_data.get("sections", [])

        logger.info(f"[Document] Generating {doc_type}: {title}")

        try:
            # Convert sections to DocumentContent
            doc_sections = []
            for sec in sections:
                doc_sections.append(Section(
                    title=sec.get("title", ""),
                    content=sec.get("content", ""),
                    level=sec.get("level", 1),
                ))

            content = DocumentContent(
                title=title,
                sections=doc_sections,
                author=input_data.get("author"),
                description=input_data.get("description"),
            )

            # Map format
            format_map = {
                "docx": DocumentFormat.DOCX,
                "pdf": DocumentFormat.PDF,
                "markdown": DocumentFormat.MARKDOWN,
                "md": DocumentFormat.MARKDOWN,
            }

            doc_format = format_map.get(doc_type, DocumentFormat.DOCX)

            # Generate document
            router = DocumentGenerationRouter()
            filepath, metadata = router.generate(content, doc_format)

            # Upload to S3
            from app.storage.s3_workspace import S3Workspace
            workspace = S3Workspace(context.user_id, context.run_id)

            with open(filepath, 'rb') as f:
                await workspace.write_file(f"documents/{metadata.filename}", f.read())

            return ToolResult(
                output={
                    "filepath": f"documents/{metadata.filename}",
                    "format": doc_type,
                    "word_count": metadata.word_count,
                    "page_count": metadata.page_count,
                },
                success=True,
                credits_used=5.0,
                artifacts=[{
                    "id": str(uuid.uuid4()),
                    "filename": metadata.filename,
                    "file_type": doc_type,
                    "url": f"storage://documents/{metadata.filename}",
                }],
            )

        except Exception as e:
            logger.error(f"Document generation error: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
                credits_used=0,
            )

    async def _generate_slides(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """Generate a PowerPoint presentation"""
        from app.document_generation.router import DocumentGenerationRouter, DocumentFormat
        from app.document_generation.base import DocumentContent, Section

        title = input_data.get("title", "Presentation")
        slides = input_data.get("slides", [])

        logger.info(f"[Slides] Generating presentation: {title} ({len(slides)} slides)")

        try:
            # Convert slides to sections
            doc_sections = []
            for i, slide in enumerate(slides):
                doc_sections.append(Section(
                    title=slide.get("title", f"Slide {i+1}"),
                    content=slide.get("content", ""),
                    level=1,
                    metadata={
                        "bullet_points": slide.get("bullet_points", []),
                        "speaker_notes": slide.get("speaker_notes", ""),
                        "image_prompt": slide.get("image_prompt"),
                    },
                ))

            content = DocumentContent(
                title=title,
                sections=doc_sections,
                author=input_data.get("author"),
                description=input_data.get("description"),
            )

            # Generate PPTX
            router = DocumentGenerationRouter()
            filepath, metadata = router.generate(content, DocumentFormat.PPTX)

            # Upload to S3
            from app.storage.s3_workspace import S3Workspace
            workspace = S3Workspace(context.user_id, context.run_id)

            with open(filepath, 'rb') as f:
                await workspace.write_file(f"presentations/{metadata.filename}", f.read())

            return ToolResult(
                output={
                    "filepath": f"presentations/{metadata.filename}",
                    "format": "pptx",
                    "slide_count": len(slides),
                },
                success=True,
                credits_used=10.0,  # Slides are more expensive
                artifacts=[{
                    "id": str(uuid.uuid4()),
                    "filename": metadata.filename,
                    "file_type": "pptx",
                    "url": f"storage://presentations/{metadata.filename}",
                }],
            )

        except Exception as e:
            logger.error(f"Slides generation error: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
                credits_used=0,
            )

    async def _generate_spreadsheet(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """Generate an Excel spreadsheet"""
        from app.document_generation.router import DocumentGenerationRouter, DocumentFormat
        from app.document_generation.base import DocumentContent, Section

        title = input_data.get("title", "Spreadsheet")
        sheets = input_data.get("sheets", [])

        logger.info(f"[Spreadsheet] Generating: {title} ({len(sheets)} sheets)")

        try:
            # Convert sheets to sections
            doc_sections = []
            for sheet in sheets:
                doc_sections.append(Section(
                    title=sheet.get("name", "Sheet1"),
                    content="",  # Content is in metadata
                    level=1,
                    metadata={
                        "headers": sheet.get("headers", []),
                        "rows": sheet.get("rows", []),
                        "formulas": sheet.get("formulas", {}),
                        "charts": sheet.get("charts", []),
                    },
                ))

            content = DocumentContent(
                title=title,
                sections=doc_sections,
                description=input_data.get("description"),
            )

            # Generate XLSX
            router = DocumentGenerationRouter()
            filepath, metadata = router.generate(content, DocumentFormat.XLSX)

            # Upload to S3
            from app.storage.s3_workspace import S3Workspace
            workspace = S3Workspace(context.user_id, context.run_id)

            with open(filepath, 'rb') as f:
                await workspace.write_file(f"spreadsheets/{metadata.filename}", f.read())

            return ToolResult(
                output={
                    "filepath": f"spreadsheets/{metadata.filename}",
                    "format": "xlsx",
                    "sheet_count": len(sheets),
                },
                success=True,
                credits_used=5.0,
                artifacts=[{
                    "id": str(uuid.uuid4()),
                    "filename": metadata.filename,
                    "file_type": "xlsx",
                    "url": f"storage://spreadsheets/{metadata.filename}",
                }],
            )

        except Exception as e:
            logger.error(f"Spreadsheet generation error: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
                credits_used=0,
            )

    # =========================================================================
    # WebDev Tools
    # =========================================================================

    async def _webdev_init_project(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """Initialize a new web development project from template"""
        webdev = get_webdev_tools()
        return await webdev.init_project(input_data, context)

    async def _webdev_check_status(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """Check the status of the current project"""
        webdev = get_webdev_tools()
        return await webdev.check_status(input_data, context)

    async def _webdev_save_checkpoint(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """Save a checkpoint (git commit) of the current project state"""
        webdev = get_webdev_tools()
        return await webdev.save_checkpoint(input_data, context)

    async def _webdev_restart_server(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """Restart the development server"""
        webdev = get_webdev_tools()
        return await webdev.restart_server(input_data, context)

    async def _webdev_add_feature(self, input_data: Dict[str, Any], context: ToolContext) -> ToolResult:
        """Add a feature to the project (db, auth, stripe)"""
        webdev = get_webdev_tools()
        return await webdev.add_feature(input_data, context)
