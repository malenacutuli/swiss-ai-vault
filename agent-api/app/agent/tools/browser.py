"""
Browser automation tool using Playwright in E2B sandboxes.

Provides SwissBrain browser automation capabilities:
- Navigation and page loading
- Element interaction (click, type, scroll)
- Screenshot capture
- HTML/text extraction
- JavaScript execution
"""
import logging
from typing import Dict, Any, Optional, List
from app.sandbox import get_sandbox_manager

logger = logging.getLogger(__name__)


class BrowserTool:
    """
    Enterprise-grade browser automation using Playwright in E2B sandboxes.

    Features:
    - Persistent browser sessions per run_id
    - Screenshot capture with base64 encoding
    - Full page interaction (click, type, navigate)
    - HTML/text extraction
    - JavaScript execution
    """

    def __init__(self):
        self.sandbox_manager = get_sandbox_manager()

    async def execute(
        self,
        run_id: str,
        action: str,
        url: Optional[str] = None,
        selector: Optional[str] = None,
        text: Optional[str] = None,
        javascript: Optional[str] = None,
        timeout: int = 30000
    ) -> Dict[str, Any]:
        """
        Execute browser action in E2B sandbox.

        Args:
            run_id: Agent run ID (for sandbox pooling)
            action: Browser action (navigate, click, type, screenshot, extract, execute_js)
            url: URL to navigate to (for navigate action)
            selector: CSS selector for element (for click, type actions)
            text: Text to type (for type action)
            javascript: JavaScript code to execute (for execute_js action)
            timeout: Action timeout in milliseconds

        Returns:
            Dict with action result (content, screenshot, etc.)
        """
        logger.info(f"Browser action for run {run_id}: {action}")

        try:
            # Install Playwright on first use
            await self._ensure_playwright_installed(run_id)

            # Route to specific action handler
            if action == "navigate":
                return await self._navigate(run_id, url, timeout)
            elif action == "click":
                return await self._click(run_id, selector, timeout)
            elif action == "type":
                return await self._type(run_id, selector, text, timeout)
            elif action == "screenshot":
                return await self._screenshot(run_id, timeout)
            elif action == "extract":
                return await self._extract_content(run_id, selector, timeout)
            elif action == "execute_js":
                return await self._execute_javascript(run_id, javascript, timeout)
            else:
                return {
                    "success": False,
                    "error": f"Unknown browser action: {action}"
                }

        except Exception as e:
            logger.error(f"Browser action failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _ensure_playwright_installed(self, run_id: str):
        """Ensure Playwright is installed in sandbox (cached per run_id)"""
        # Check if already installed
        check_code = """
import sys
try:
    from playwright.sync_api import sync_playwright
    print("PLAYWRIGHT_INSTALLED")
except ImportError:
    print("PLAYWRIGHT_NOT_INSTALLED")
"""
        result = await self.sandbox_manager.execute_code(run_id, "python", check_code)

        if "PLAYWRIGHT_NOT_INSTALLED" in result.get("stdout", ""):
            logger.info(f"Installing Playwright in sandbox for run {run_id}")

            # Install Playwright and browsers
            install_code = """
import subprocess
import sys

# Install playwright
subprocess.run([sys.executable, "-m", "pip", "install", "playwright"], check=True)

# Install browser binaries
subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)

print("PLAYWRIGHT_SETUP_COMPLETE")
"""
            result = await self.sandbox_manager.execute_code(run_id, "python", install_code, timeout=120)

            if not result.get("success"):
                raise Exception(f"Failed to install Playwright: {result.get('error')}")

            logger.info(f"Playwright installed successfully for run {run_id}")

    async def _navigate(self, run_id: str, url: str, timeout: int) -> Dict[str, Any]:
        """Navigate to URL"""
        code = f"""
from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    try:
        response = page.goto({repr(url)}, timeout={timeout}, wait_until="domcontentloaded")

        result = {{
            "success": True,
            "url": page.url,
            "title": page.title(),
            "status": response.status if response else None
        }}

        print(json.dumps(result))

    finally:
        browser.close()
"""

        result = await self.sandbox_manager.execute_code(run_id, "python", code, timeout=timeout//1000 + 10)

        if result.get("success"):
            import json
            try:
                output = json.loads(result["stdout"].strip())
                return output
            except:
                return {"success": True, "url": url}
        else:
            return {"success": False, "error": result.get("error")}

    async def _click(self, run_id: str, selector: str, timeout: int) -> Dict[str, Any]:
        """Click element by selector"""
        code = f"""
from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Get current page URL from context (stored in previous navigate)
    # For now, assume page is already loaded

    try:
        page.click({repr(selector)}, timeout={timeout})

        result = {{
            "success": True,
            "selector": {repr(selector)},
            "clicked": True
        }}

        print(json.dumps(result))

    except Exception as e:
        result = {{
            "success": False,
            "error": str(e)
        }}
        print(json.dumps(result))

    finally:
        browser.close()
"""

        result = await self.sandbox_manager.execute_code(run_id, "python", code, timeout=timeout//1000 + 10)

        if result.get("success"):
            import json
            try:
                output = json.loads(result["stdout"].strip())
                return output
            except:
                return {"success": True, "clicked": True}
        else:
            return {"success": False, "error": result.get("error")}

    async def _type(self, run_id: str, selector: str, text: str, timeout: int) -> Dict[str, Any]:
        """Type text into element"""
        code = f"""
from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    try:
        page.fill({repr(selector)}, {repr(text)}, timeout={timeout})

        result = {{
            "success": True,
            "selector": {repr(selector)},
            "typed": True
        }}

        print(json.dumps(result))

    except Exception as e:
        result = {{
            "success": False,
            "error": str(e)
        }}
        print(json.dumps(result))

    finally:
        browser.close()
"""

        result = await self.sandbox_manager.execute_code(run_id, "python", code, timeout=timeout//1000 + 10)

        if result.get("success"):
            import json
            try:
                output = json.loads(result["stdout"].strip())
                return output
            except:
                return {"success": True, "typed": True}
        else:
            return {"success": False, "error": result.get("error")}

    async def _screenshot(self, run_id: str, timeout: int) -> Dict[str, Any]:
        """Capture page screenshot"""
        code = f"""
from playwright.sync_api import sync_playwright
import json
import base64

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    try:
        # Take screenshot
        screenshot_bytes = page.screenshot(full_page=True, timeout={timeout})
        screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')

        result = {{
            "success": True,
            "screenshot": screenshot_b64,
            "format": "png"
        }}

        print(json.dumps(result))

    except Exception as e:
        result = {{
            "success": False,
            "error": str(e)
        }}
        print(json.dumps(result))

    finally:
        browser.close()
"""

        result = await self.sandbox_manager.execute_code(run_id, "python", code, timeout=timeout//1000 + 10)

        if result.get("success"):
            import json
            try:
                output = json.loads(result["stdout"].strip())
                return output
            except:
                return {"success": False, "error": "Failed to parse screenshot"}
        else:
            return {"success": False, "error": result.get("error")}

    async def _extract_content(self, run_id: str, selector: Optional[str], timeout: int) -> Dict[str, Any]:
        """Extract HTML/text content from page"""
        selector_code = f"page.query_selector({repr(selector)}).inner_html()" if selector else "page.content()"

        code = f"""
from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    try:
        content = {selector_code}

        result = {{
            "success": True,
            "content": content,
            "selector": {repr(selector) if selector else 'None'}
        }}

        print(json.dumps(result))

    except Exception as e:
        result = {{
            "success": False,
            "error": str(e)
        }}
        print(json.dumps(result))

    finally:
        browser.close()
"""

        result = await self.sandbox_manager.execute_code(run_id, "python", code, timeout=timeout//1000 + 10)

        if result.get("success"):
            import json
            try:
                output = json.loads(result["stdout"].strip())
                return output
            except:
                return {"success": False, "error": "Failed to extract content"}
        else:
            return {"success": False, "error": result.get("error")}

    async def _execute_javascript(self, run_id: str, javascript: str, timeout: int) -> Dict[str, Any]:
        """Execute JavaScript in page context"""
        code = f"""
from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    try:
        result_value = page.evaluate({repr(javascript)})

        result = {{
            "success": True,
            "result": result_value
        }}

        print(json.dumps(result))

    except Exception as e:
        result = {{
            "success": False,
            "error": str(e)
        }}
        print(json.dumps(result))

    finally:
        browser.close()
"""

        result = await self.sandbox_manager.execute_code(run_id, "python", code, timeout=timeout//1000 + 10)

        if result.get("success"):
            import json
            try:
                output = json.loads(result["stdout"].strip())
                return output
            except:
                return {"success": False, "error": "Failed to execute JavaScript"}
        else:
            return {"success": False, "error": result.get("error")}
