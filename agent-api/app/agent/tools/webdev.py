"""
WebDev Tools for Agent Execution
Implements webdev_init_project, webdev_check_status, webdev_save_checkpoint, etc.
"""
import logging
import uuid
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass

from app.agent.models.types import ToolResult, ToolContext
from app.agent.tools.e2b_executor import E2BSandboxExecutor
from app.config import get_settings

logger = logging.getLogger(__name__)


# Template definitions
TEMPLATES = {
    "web-static": {
        "name": "Static Website",
        "description": "Vite + React + Tailwind CSS static website",
        "repo": "https://github.com/swissbrain/template-web-static.git",
        "default_port": 5173,
        "features": [],
        "install_cmd": "pnpm install",
        "dev_cmd": "pnpm dev",
        "build_cmd": "pnpm build",
    },
    "web-db-user": {
        "name": "Full-Stack App",
        "description": "tRPC + Drizzle ORM + Manus Auth full-stack application",
        "repo": "https://github.com/swissbrain/template-web-db-user.git",
        "default_port": 3000,
        "features": ["db", "server", "user"],
        "install_cmd": "pnpm install",
        "dev_cmd": "pnpm dev",
        "build_cmd": "pnpm build",
    },
}


@dataclass
class WebdevProject:
    """Represents a webdev project in a sandbox"""
    project_name: str
    project_path: str
    template: str
    features: List[str]
    version_id: str
    dev_server_url: Optional[str] = None
    dev_server_port: Optional[int] = None
    status: str = "created"


class WebdevTools:
    """
    WebDev tools for creating and managing web development projects.
    
    These tools enable agents to:
    - Initialize new projects from templates
    - Check project status (build, server, health)
    - Save checkpoints (git commits)
    - Add features (db, auth, stripe)
    - Manage dev servers
    """
    
    def __init__(self, e2b_executor: Optional[E2BSandboxExecutor] = None):
        self.e2b_executor = e2b_executor
        self.settings = get_settings()
        self.active_projects: Dict[str, WebdevProject] = {}
        
    async def init_project(
        self,
        input_data: Dict[str, Any],
        context: ToolContext,
    ) -> ToolResult:
        """
        Initialize a new web development project from template.
        
        Args:
            project_name: Name of the project (lowercase, alphanumeric with hyphens)
            template: Template to use (web-static, web-db-user)
            features: Additional features to enable (db, server, user, stripe)
            description: Optional project description
        """
        project_name = input_data.get("project_name", "").lower().strip()
        template = input_data.get("template", "web-static")
        features = input_data.get("features", [])
        description = input_data.get("description", "")
        
        logger.info(f"[WebDev] Initializing project: {project_name}, template: {template}")
        
        # Validate project name
        if not project_name or not project_name.replace("-", "").isalnum():
            return ToolResult(
                output=None,
                success=False,
                error="Project name must be lowercase alphanumeric with hyphens only",
            )
            
        # Validate template
        if template not in TEMPLATES:
            return ToolResult(
                output=None,
                success=False,
                error=f"Unknown template: {template}. Available: {list(TEMPLATES.keys())}",
            )
            
        template_config = TEMPLATES[template]
        project_path = f"/home/ubuntu/{project_name}"
        
        if not self.e2b_executor:
            # Mock response for testing
            version_id = str(uuid.uuid4())[:8]
            return ToolResult(
                output={
                    "project_name": project_name,
                    "project_path": project_path,
                    "version_id": version_id,
                    "features": features or template_config["features"],
                    "dev_server_url": f"https://localhost:{template_config['default_port']}",
                    "dev_server_port": template_config["default_port"],
                    "status": "running",
                    "created_files": ["package.json", "src/App.tsx", "src/main.tsx"],
                    "secrets": ["VITE_APP_ID", "DATABASE_URL"],
                    "readme": f"# {project_name}\n\nCreated from {template} template.",
                },
                success=True,
                credits_used=5.0,
            )
            
        try:
            # Execute in E2B sandbox
            sandbox = await self.e2b_executor.get_or_create_sandbox(context.run_id)
            
            # 1. Clone template repository
            clone_result = await sandbox.exec(
                f"git clone {template_config['repo']} {project_path}",
                timeout=60
            )
            if clone_result.get("exit_code", 1) != 0:
                return ToolResult(
                    output=None,
                    success=False,
                    error=f"Failed to clone template: {clone_result.get('stderr', '')}",
                )
                
            # 2. Remove .git and reinitialize
            await sandbox.exec(f"rm -rf {project_path}/.git && cd {project_path} && git init")
            
            # 3. Update package.json with project name
            await sandbox.exec(
                f"cd {project_path} && sed -i 's/\"name\": \".*\"/\"name\": \"{project_name}\"/' package.json"
            )
            
            # 4. Install dependencies
            install_result = await sandbox.exec(
                f"cd {project_path} && {template_config['install_cmd']}",
                timeout=120
            )
            if install_result.get("exit_code", 1) != 0:
                logger.warning(f"Install warning: {install_result.get('stderr', '')}")
                
            # 5. Create .env file with secrets
            env_content = self._generate_env_file(context.user_id, project_name, features)
            await sandbox.exec(f"cat > {project_path}/.env << 'EOF'\n{env_content}\nEOF")
            
            # 6. Start dev server
            dev_port = template_config["default_port"]
            await sandbox.exec(
                f"cd {project_path} && nohup {template_config['dev_cmd']} > /tmp/dev-server.log 2>&1 &",
                timeout=10
            )
            
            # Wait for server to start
            await asyncio.sleep(3)
            
            # 7. Create initial git commit
            version_id = str(uuid.uuid4())[:8]
            await sandbox.exec(
                f"cd {project_path} && git add -A && git commit -m 'Initial project setup' --allow-empty"
            )
            
            # 8. Get created files
            files_result = await sandbox.exec(f"cd {project_path} && find . -type f -name '*.tsx' -o -name '*.ts' | head -20")
            created_files = files_result.get("stdout", "").strip().split("\n")
            
            # 9. Read README
            readme_result = await sandbox.exec(f"cat {project_path}/README.md 2>/dev/null || echo '# {project_name}'")
            readme = readme_result.get("stdout", f"# {project_name}")
            
            # Get dev server URL (E2B provides public URL)
            dev_server_url = f"https://{sandbox.id}-{dev_port}.e2b.dev"
            
            # Store project info
            project = WebdevProject(
                project_name=project_name,
                project_path=project_path,
                template=template,
                features=features or template_config["features"],
                version_id=version_id,
                dev_server_url=dev_server_url,
                dev_server_port=dev_port,
                status="running",
            )
            self.active_projects[context.run_id] = project
            
            return ToolResult(
                output={
                    "project_name": project_name,
                    "project_path": project_path,
                    "version_id": version_id,
                    "features": project.features,
                    "dev_server_url": dev_server_url,
                    "dev_server_port": dev_port,
                    "status": "running",
                    "created_files": created_files,
                    "secrets": ["VITE_APP_ID", "DATABASE_URL", "JWT_SECRET"],
                    "readme": readme,
                },
                success=True,
                credits_used=5.0,
            )
            
        except Exception as e:
            logger.error(f"webdev_init_project failed: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
            )
            
    async def check_status(
        self,
        input_data: Dict[str, Any],
        context: ToolContext,
    ) -> ToolResult:
        """
        Check the status of the current project.
        
        Returns:
            - Dev server status (running, stopped, error)
            - Build status (success, error, not_built)
            - Health checks (dependencies, typescript, lsp)
        """
        project_path = input_data.get("project_path", "/home/ubuntu/project")
        
        logger.info(f"[WebDev] Checking status for: {project_path}")
        
        if not self.e2b_executor:
            # Mock response
            return ToolResult(
                output={
                    "dev_server": {
                        "status": "running",
                        "port": 5173,
                        "url": "https://localhost:5173",
                    },
                    "build": {
                        "status": "success",
                        "errors": [],
                        "warnings": ["Chunk size warning"],
                    },
                    "health": {
                        "dependencies": "ok",
                        "typescript": "ok",
                        "lsp": "ok",
                    },
                },
                success=True,
                credits_used=1.0,
            )
            
        try:
            sandbox = await self.e2b_executor.get_or_create_sandbox(context.run_id)
            
            # Check if dev server is running
            ps_result = await sandbox.exec("pgrep -f 'vite|next' || echo 'not_running'")
            server_running = "not_running" not in ps_result.get("stdout", "")
            
            # Check for build errors
            build_result = await sandbox.exec(f"cd {project_path} && pnpm build 2>&1 | tail -20")
            build_output = build_result.get("stdout", "")
            build_success = build_result.get("exit_code", 1) == 0
            
            # Check TypeScript
            tsc_result = await sandbox.exec(f"cd {project_path} && pnpm tsc --noEmit 2>&1 | head -20")
            tsc_output = tsc_result.get("stdout", "")
            tsc_success = tsc_result.get("exit_code", 1) == 0
            
            # Get recent server logs
            logs_result = await sandbox.exec("tail -50 /tmp/dev-server.log 2>/dev/null || echo 'No logs'")
            recent_logs = logs_result.get("stdout", "")
            
            return ToolResult(
                output={
                    "dev_server": {
                        "status": "running" if server_running else "stopped",
                        "recent_logs": recent_logs,
                    },
                    "build": {
                        "status": "success" if build_success else "error",
                        "output": build_output,
                    },
                    "typescript": {
                        "status": "ok" if tsc_success else "error",
                        "output": tsc_output,
                    },
                },
                success=True,
                credits_used=1.0,
            )
            
        except Exception as e:
            logger.error(f"webdev_check_status failed: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
            )
            
    async def save_checkpoint(
        self,
        input_data: Dict[str, Any],
        context: ToolContext,
    ) -> ToolResult:
        """
        Save a checkpoint (git commit) of the current project state.
        
        Args:
            project_path: Path to the project
            description: Commit message describing the checkpoint
        """
        project_path = input_data.get("project_path", "/home/ubuntu/project")
        description = input_data.get("description", "Checkpoint")
        
        logger.info(f"[WebDev] Saving checkpoint: {description}")
        
        if not self.e2b_executor:
            version_id = str(uuid.uuid4())[:8]
            return ToolResult(
                output={
                    "version_id": version_id,
                    "description": description,
                    "timestamp": datetime.utcnow().isoformat(),
                    "files_changed": 5,
                },
                success=True,
                credits_used=2.0,
            )
            
        try:
            sandbox = await self.e2b_executor.get_or_create_sandbox(context.run_id)
            
            # Stage all changes
            await sandbox.exec(f"cd {project_path} && git add -A")
            
            # Get diff stats
            diff_result = await sandbox.exec(f"cd {project_path} && git diff --cached --stat | tail -1")
            diff_stats = diff_result.get("stdout", "").strip()
            
            # Commit
            version_id = str(uuid.uuid4())[:8]
            commit_result = await sandbox.exec(
                f"cd {project_path} && git commit -m '{description}' --allow-empty"
            )
            
            if commit_result.get("exit_code", 1) != 0:
                return ToolResult(
                    output=None,
                    success=False,
                    error=f"Failed to create checkpoint: {commit_result.get('stderr', '')}",
                )
                
            # Get commit hash
            hash_result = await sandbox.exec(f"cd {project_path} && git rev-parse --short HEAD")
            commit_hash = hash_result.get("stdout", version_id).strip()
            
            return ToolResult(
                output={
                    "version_id": commit_hash,
                    "description": description,
                    "timestamp": datetime.utcnow().isoformat(),
                    "diff_stats": diff_stats,
                },
                success=True,
                credits_used=2.0,
            )
            
        except Exception as e:
            logger.error(f"webdev_save_checkpoint failed: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
            )
            
    async def restart_server(
        self,
        input_data: Dict[str, Any],
        context: ToolContext,
    ) -> ToolResult:
        """
        Restart the development server.
        
        Args:
            project_path: Path to the project
        """
        project_path = input_data.get("project_path", "/home/ubuntu/project")
        
        logger.info(f"[WebDev] Restarting server for: {project_path}")
        
        if not self.e2b_executor:
            return ToolResult(
                output={
                    "status": "running",
                    "port": 5173,
                    "message": "Dev server restarted",
                },
                success=True,
                credits_used=1.0,
            )
            
        try:
            sandbox = await self.e2b_executor.get_or_create_sandbox(context.run_id)
            
            # Kill existing server
            await sandbox.exec("pkill -f 'vite|next' || true")
            await asyncio.sleep(1)
            
            # Determine dev command based on package.json
            pkg_result = await sandbox.exec(f"cat {project_path}/package.json | grep -o '\"dev\"' || echo 'not_found'")
            has_dev = "dev" in pkg_result.get("stdout", "")
            
            dev_cmd = "pnpm dev" if has_dev else "pnpm start"
            
            # Start server
            await sandbox.exec(
                f"cd {project_path} && nohup {dev_cmd} > /tmp/dev-server.log 2>&1 &",
                timeout=10
            )
            
            # Wait for server to start
            await asyncio.sleep(3)
            
            # Verify server is running
            ps_result = await sandbox.exec("pgrep -f 'vite|next' || echo 'not_running'")
            server_running = "not_running" not in ps_result.get("stdout", "")
            
            return ToolResult(
                output={
                    "status": "running" if server_running else "failed",
                    "message": "Dev server restarted" if server_running else "Failed to start server",
                },
                success=server_running,
                credits_used=1.0,
            )
            
        except Exception as e:
            logger.error(f"webdev_restart_server failed: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
            )
            
    async def add_feature(
        self,
        input_data: Dict[str, Any],
        context: ToolContext,
    ) -> ToolResult:
        """
        Add a feature to the project (db, auth, stripe).
        
        Args:
            project_path: Path to the project
            feature: Feature to add (web-db-user, stripe)
        """
        project_path = input_data.get("project_path", "/home/ubuntu/project")
        feature = input_data.get("feature", "")
        
        logger.info(f"[WebDev] Adding feature: {feature}")
        
        if feature not in ["web-db-user", "stripe"]:
            return ToolResult(
                output=None,
                success=False,
                error=f"Unknown feature: {feature}. Available: web-db-user, stripe",
            )
            
        if not self.e2b_executor:
            return ToolResult(
                output={
                    "feature": feature,
                    "status": "added",
                    "next_steps": [
                        "Run pnpm db:push to apply database migrations",
                        "Update .env with required secrets",
                    ],
                },
                success=True,
                credits_used=3.0,
            )
            
        try:
            sandbox = await self.e2b_executor.get_or_create_sandbox(context.run_id)
            
            if feature == "web-db-user":
                # Install database and auth dependencies
                await sandbox.exec(f"cd {project_path} && pnpm add drizzle-orm @auth/core")
                await sandbox.exec(f"cd {project_path} && pnpm add -D drizzle-kit")
                
                # Create drizzle config
                drizzle_config = """
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
"""
                await sandbox.exec(f"cat > {project_path}/drizzle.config.ts << 'EOF'\n{drizzle_config}\nEOF")
                
            elif feature == "stripe":
                # Install Stripe
                await sandbox.exec(f"cd {project_path} && pnpm add stripe @stripe/stripe-js")
                
            return ToolResult(
                output={
                    "feature": feature,
                    "status": "added",
                    "next_steps": [
                        f"Feature '{feature}' scaffolding added",
                        "Run pnpm db:push to apply database migrations" if feature == "web-db-user" else "Configure Stripe keys in .env",
                    ],
                },
                success=True,
                credits_used=3.0,
            )
            
        except Exception as e:
            logger.error(f"webdev_add_feature failed: {e}")
            return ToolResult(
                output=None,
                success=False,
                error=str(e),
            )
            
    def _generate_env_file(self, user_id: str, project_name: str, features: List[str]) -> str:
        """Generate .env file content"""
        env_vars = [
            f"VITE_APP_ID={project_name}",
            f"VITE_APP_TITLE={project_name.replace('-', ' ').title()}",
            "VITE_APP_LOGO=/logo.svg",
            f"JWT_SECRET={uuid.uuid4().hex}",
        ]
        
        if "db" in features:
            env_vars.append("DATABASE_URL=mysql://user:password@localhost:3306/db")
            
        if "stripe" in features:
            env_vars.append("STRIPE_SECRET_KEY=sk_test_xxx")
            env_vars.append("VITE_STRIPE_PUBLIC_KEY=pk_test_xxx")
            
        return "\n".join(env_vars)


# Singleton instance
_webdev_tools: Optional[WebdevTools] = None


def get_webdev_tools() -> WebdevTools:
    """Get or create WebdevTools singleton"""
    global _webdev_tools
    if _webdev_tools is None:
        settings = get_settings()
        e2b_executor = None
        if settings.e2b_api_key:
            e2b_executor = E2BSandboxExecutor(settings.e2b_api_key)
        _webdev_tools = WebdevTools(e2b_executor)
    return _webdev_tools
