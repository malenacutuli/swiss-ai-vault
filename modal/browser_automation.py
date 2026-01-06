"""
Browser Automation Worker for SwissVault
Headless browser automation using Playwright with Swiss proxy support
"""

import modal
import json
import base64
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime

# Define Modal app
app = modal.App("swissvault-browser-automation")

# Browser image with Playwright
browser_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "wget", "gnupg", "ca-certificates", "fonts-liberation",
        "libasound2", "libatk-bridge2.0-0", "libatk1.0-0", "libcups2",
        "libdbus-1-3", "libdrm2", "libgbm1", "libgtk-3-0", "libnspr4",
        "libnss3", "libx11-xcb1", "libxcomposite1", "libxdamage1",
        "libxfixes3", "libxrandr2", "xdg-utils"
    )
    .pip_install(
        "playwright==1.40.0",
        "httpx",
        "beautifulsoup4",
        "lxml",
    )
    .run_commands("playwright install chromium firefox")
)


class BrowserSession:
    """Manages a browser session with state"""
    
    def __init__(self, browser_type: str = "chromium", headless: bool = True):
        self.browser_type = browser_type
        self.headless = headless
        self.browser = None
        self.context = None
        self.page = None
        self.cookies: List[Dict] = []
        self.screenshots: List[str] = []
        self.logs: List[str] = []
        
    def log(self, message: str):
        timestamp = datetime.utcnow().isoformat()
        self.logs.append(f"[{timestamp}] {message}")
        print(f"[Browser] {message}")


@app.function(
    image=browser_image,
    timeout=300,
    memory=2048,
    secrets=[modal.Secret.from_name("swissvault-secrets", required_set=["SWISS_PROXY_URL"])],
)
async def execute_browser_action(
    action: str,
    url: Optional[str] = None,
    selector: Optional[str] = None,
    value: Optional[str] = None,
    options: Optional[Dict[str, Any]] = None,
    cookies: Optional[List[Dict]] = None,
    use_swiss_proxy: bool = False,
    browser_type: str = "chromium",
) -> Dict[str, Any]:
    """
    Execute a browser automation action
    
    Actions:
    - navigate: Go to URL
    - screenshot: Capture page screenshot
    - click: Click element
    - type: Type text into element
    - fill_form: Fill multiple form fields
    - extract: Extract content from page
    - get_cookies: Get all cookies
    - set_cookies: Set cookies
    - evaluate: Execute JavaScript
    - wait: Wait for selector/condition
    - scroll: Scroll page
    """
    from playwright.async_api import async_playwright
    import os
    
    options = options or {}
    result = {
        "success": False,
        "action": action,
        "timestamp": datetime.utcnow().isoformat(),
        "data": None,
        "error": None,
        "screenshot": None,
        "logs": [],
    }
    
    session = BrowserSession(browser_type=browser_type)
    
    try:
        async with async_playwright() as p:
            # Select browser
            browser_launcher = getattr(p, browser_type, p.chromium)
            
            # Configure proxy if Swiss proxy requested
            launch_options = {"headless": True}
            
            if use_swiss_proxy:
                proxy_url = os.environ.get("SWISS_PROXY_URL")
                if proxy_url:
                    launch_options["proxy"] = {"server": proxy_url}
                    session.log(f"Using Swiss proxy")
            
            session.log(f"Launching {browser_type} browser")
            session.browser = await browser_launcher.launch(**launch_options)
            
            # Create context with options
            context_options = {
                "viewport": options.get("viewport", {"width": 1920, "height": 1080}),
                "user_agent": options.get("user_agent", 
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
            }
            
            if options.get("locale"):
                context_options["locale"] = options["locale"]
            if options.get("timezone"):
                context_options["timezone_id"] = options["timezone"]
            
            session.context = await session.browser.new_context(**context_options)
            
            # Restore cookies if provided
            if cookies:
                await session.context.add_cookies(cookies)
                session.log(f"Restored {len(cookies)} cookies")
            
            session.page = await session.context.new_page()
            
            # Set default timeout
            session.page.set_default_timeout(options.get("timeout", 30000))
            
            # Execute action
            if action == "navigate":
                if not url:
                    raise ValueError("URL required for navigate action")
                session.log(f"Navigating to {url}")
                response = await session.page.goto(url, wait_until=options.get("wait_until", "networkidle"))
                result["data"] = {
                    "url": session.page.url,
                    "title": await session.page.title(),
                    "status": response.status if response else None,
                }
                
            elif action == "screenshot":
                session.log("Taking screenshot")
                screenshot_options = {
                    "full_page": options.get("full_page", False),
                    "type": options.get("format", "png"),
                }
                if selector:
                    element = await session.page.query_selector(selector)
                    if element:
                        screenshot_bytes = await element.screenshot(**screenshot_options)
                    else:
                        raise ValueError(f"Element not found: {selector}")
                else:
                    screenshot_bytes = await session.page.screenshot(**screenshot_options)
                result["screenshot"] = base64.b64encode(screenshot_bytes).decode()
                result["data"] = {"size": len(screenshot_bytes)}
                
            elif action == "click":
                if not selector:
                    raise ValueError("Selector required for click action")
                session.log(f"Clicking {selector}")
                await session.page.click(selector, **{
                    k: v for k, v in options.items() 
                    if k in ["button", "click_count", "delay", "force", "modifiers", "position"]
                })
                result["data"] = {"clicked": selector}
                
            elif action == "type":
                if not selector or value is None:
                    raise ValueError("Selector and value required for type action")
                session.log(f"Typing into {selector}")
                await session.page.fill(selector, "")  # Clear first
                await session.page.type(selector, value, delay=options.get("delay", 50))
                result["data"] = {"typed": len(value), "selector": selector}
                
            elif action == "fill_form":
                if not options.get("fields"):
                    raise ValueError("Fields required for fill_form action")
                session.log("Filling form fields")
                filled = []
                for field in options["fields"]:
                    field_selector = field.get("selector")
                    field_value = field.get("value")
                    field_type = field.get("type", "text")
                    
                    if field_type == "select":
                        await session.page.select_option(field_selector, field_value)
                    elif field_type == "checkbox":
                        if field_value:
                            await session.page.check(field_selector)
                        else:
                            await session.page.uncheck(field_selector)
                    elif field_type == "file":
                        await session.page.set_input_files(field_selector, field_value)
                    else:
                        await session.page.fill(field_selector, field_value)
                    filled.append(field_selector)
                result["data"] = {"filled": filled}
                
            elif action == "extract":
                session.log("Extracting content")
                extract_type = options.get("extract_type", "text")
                
                if extract_type == "text":
                    if selector:
                        element = await session.page.query_selector(selector)
                        content = await element.text_content() if element else None
                    else:
                        content = await session.page.content()
                elif extract_type == "html":
                    if selector:
                        element = await session.page.query_selector(selector)
                        content = await element.inner_html() if element else None
                    else:
                        content = await session.page.content()
                elif extract_type == "attribute":
                    attr_name = options.get("attribute", "href")
                    element = await session.page.query_selector(selector)
                    content = await element.get_attribute(attr_name) if element else None
                elif extract_type == "all":
                    elements = await session.page.query_selector_all(selector)
                    content = [await el.text_content() for el in elements]
                else:
                    content = await session.page.content()
                    
                result["data"] = {"content": content, "url": session.page.url}
                
            elif action == "get_cookies":
                session.log("Getting cookies")
                cookies = await session.context.cookies()
                result["data"] = {"cookies": cookies}
                
            elif action == "set_cookies":
                if not options.get("cookies"):
                    raise ValueError("Cookies required for set_cookies action")
                session.log("Setting cookies")
                await session.context.add_cookies(options["cookies"])
                result["data"] = {"set": len(options["cookies"])}
                
            elif action == "evaluate":
                if not value:
                    raise ValueError("JavaScript code required for evaluate action")
                session.log("Evaluating JavaScript")
                js_result = await session.page.evaluate(value)
                result["data"] = {"result": js_result}
                
            elif action == "wait":
                wait_type = options.get("wait_type", "selector")
                session.log(f"Waiting for {wait_type}")
                
                if wait_type == "selector":
                    await session.page.wait_for_selector(selector, state=options.get("state", "visible"))
                elif wait_type == "navigation":
                    await session.page.wait_for_navigation(wait_until=options.get("wait_until", "networkidle"))
                elif wait_type == "timeout":
                    await asyncio.sleep(options.get("duration", 1))
                elif wait_type == "load_state":
                    await session.page.wait_for_load_state(options.get("state", "networkidle"))
                    
                result["data"] = {"waited": wait_type}
                
            elif action == "scroll":
                direction = options.get("direction", "down")
                amount = options.get("amount", 500)
                session.log(f"Scrolling {direction} by {amount}")
                
                if direction == "down":
                    await session.page.evaluate(f"window.scrollBy(0, {amount})")
                elif direction == "up":
                    await session.page.evaluate(f"window.scrollBy(0, -{amount})")
                elif direction == "to_element" and selector:
                    await session.page.evaluate(f'document.querySelector("{selector}").scrollIntoView()')
                elif direction == "to_bottom":
                    await session.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                elif direction == "to_top":
                    await session.page.evaluate("window.scrollTo(0, 0)")
                    
                result["data"] = {"scrolled": direction, "amount": amount}
                
            elif action == "multi_step":
                # Execute multiple actions in sequence
                steps = options.get("steps", [])
                step_results = []
                
                for i, step in enumerate(steps):
                    session.log(f"Executing step {i+1}/{len(steps)}: {step.get('action')}")
                    step_action = step.get("action")
                    
                    if step_action == "navigate" and step.get("url"):
                        await session.page.goto(step["url"], wait_until="networkidle")
                        step_results.append({"step": i+1, "action": "navigate", "url": step["url"]})
                        
                    elif step_action == "click" and step.get("selector"):
                        await session.page.click(step["selector"])
                        step_results.append({"step": i+1, "action": "click", "selector": step["selector"]})
                        
                    elif step_action == "type" and step.get("selector"):
                        await session.page.fill(step["selector"], step.get("value", ""))
                        step_results.append({"step": i+1, "action": "type", "selector": step["selector"]})
                        
                    elif step_action == "wait":
                        if step.get("selector"):
                            await session.page.wait_for_selector(step["selector"])
                        else:
                            await asyncio.sleep(step.get("duration", 1))
                        step_results.append({"step": i+1, "action": "wait"})
                        
                    elif step_action == "screenshot":
                        screenshot_bytes = await session.page.screenshot(full_page=step.get("full_page", False))
                        step_results.append({
                            "step": i+1, 
                            "action": "screenshot",
                            "data": base64.b64encode(screenshot_bytes).decode()
                        })
                
                result["data"] = {"steps": step_results, "total": len(steps)}
                
            else:
                raise ValueError(f"Unknown action: {action}")
            
            result["success"] = True
            result["logs"] = session.logs
            
            # Capture final cookies
            result["cookies"] = await session.context.cookies()
            
    except Exception as e:
        result["error"] = str(e)
        result["logs"] = session.logs
        print(f"[Browser Error] {e}")
        
    finally:
        if session.browser:
            await session.browser.close()
            
    return result


@app.function(
    image=browser_image,
    timeout=600,
    memory=4096,
    secrets=[modal.Secret.from_name("swissvault-secrets", required_set=["SWISS_PROXY_URL"])],
)
async def scrape_with_browser(
    url: str,
    selectors: Dict[str, str],
    wait_for: Optional[str] = None,
    scroll_to_bottom: bool = False,
    take_screenshot: bool = True,
    use_swiss_proxy: bool = False,
) -> Dict[str, Any]:
    """
    Scrape a webpage with browser rendering
    
    Args:
        url: URL to scrape
        selectors: Dict mapping field names to CSS selectors
        wait_for: Optional selector to wait for before scraping
        scroll_to_bottom: Whether to scroll to bottom before scraping
        take_screenshot: Whether to capture a screenshot
        use_swiss_proxy: Whether to route through Swiss proxy
    """
    from playwright.async_api import async_playwright
    import os
    
    result = {
        "success": False,
        "url": url,
        "data": {},
        "screenshot": None,
        "error": None,
    }
    
    try:
        async with async_playwright() as p:
            launch_options = {"headless": True}
            
            if use_swiss_proxy:
                proxy_url = os.environ.get("SWISS_PROXY_URL")
                if proxy_url:
                    launch_options["proxy"] = {"server": proxy_url}
            
            browser = await p.chromium.launch(**launch_options)
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            page = await context.new_page()
            
            await page.goto(url, wait_until="networkidle")
            
            if wait_for:
                await page.wait_for_selector(wait_for, timeout=30000)
            
            if scroll_to_bottom:
                await page.evaluate("""
                    async () => {
                        await new Promise((resolve) => {
                            let totalHeight = 0;
                            const distance = 500;
                            const timer = setInterval(() => {
                                window.scrollBy(0, distance);
                                totalHeight += distance;
                                if (totalHeight >= document.body.scrollHeight) {
                                    clearInterval(timer);
                                    resolve();
                                }
                            }, 100);
                        });
                    }
                """)
                await asyncio.sleep(1)
            
            # Extract data using selectors
            for field_name, selector in selectors.items():
                try:
                    if selector.endswith("[]"):
                        # Extract multiple elements
                        actual_selector = selector[:-2]
                        elements = await page.query_selector_all(actual_selector)
                        result["data"][field_name] = [
                            await el.text_content() for el in elements
                        ]
                    else:
                        element = await page.query_selector(selector)
                        if element:
                            result["data"][field_name] = await element.text_content()
                except Exception as e:
                    result["data"][field_name] = None
                    print(f"Failed to extract {field_name}: {e}")
            
            if take_screenshot:
                screenshot_bytes = await page.screenshot(full_page=True)
                result["screenshot"] = base64.b64encode(screenshot_bytes).decode()
            
            result["success"] = True
            await browser.close()
            
    except Exception as e:
        result["error"] = str(e)
        
    return result


@app.function(
    image=browser_image,
    timeout=900,
    memory=4096,
    secrets=[modal.Secret.from_name("swissvault-secrets", required_set=["SWISS_PROXY_URL"])],
)
async def automate_workflow(
    workflow: List[Dict[str, Any]],
    initial_url: Optional[str] = None,
    initial_cookies: Optional[List[Dict]] = None,
    use_swiss_proxy: bool = False,
    capture_screenshots: bool = True,
) -> Dict[str, Any]:
    """
    Execute a complete browser automation workflow
    
    Workflow steps can include:
    - {"action": "navigate", "url": "..."}
    - {"action": "click", "selector": "..."}
    - {"action": "type", "selector": "...", "value": "..."}
    - {"action": "wait", "selector": "..." or "duration": N}
    - {"action": "screenshot", "name": "..."}
    - {"action": "extract", "selectors": {...}}
    - {"action": "if", "condition": "...", "then": [...], "else": [...]}
    """
    from playwright.async_api import async_playwright
    import os
    
    result = {
        "success": False,
        "steps_completed": 0,
        "total_steps": len(workflow),
        "extracted_data": {},
        "screenshots": {},
        "cookies": [],
        "error": None,
        "logs": [],
    }
    
    def log(msg):
        result["logs"].append(f"[{datetime.utcnow().isoformat()}] {msg}")
        print(f"[Workflow] {msg}")
    
    try:
        async with async_playwright() as p:
            launch_options = {"headless": True}
            
            if use_swiss_proxy:
                proxy_url = os.environ.get("SWISS_PROXY_URL")
                if proxy_url:
                    launch_options["proxy"] = {"server": proxy_url}
                    log("Using Swiss proxy")
            
            browser = await p.chromium.launch(**launch_options)
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            
            if initial_cookies:
                await context.add_cookies(initial_cookies)
                log(f"Restored {len(initial_cookies)} cookies")
            
            page = await context.new_page()
            
            if initial_url:
                log(f"Navigating to initial URL: {initial_url}")
                await page.goto(initial_url, wait_until="networkidle")
            
            # Execute workflow steps
            for i, step in enumerate(workflow):
                action = step.get("action")
                log(f"Step {i+1}/{len(workflow)}: {action}")
                
                try:
                    if action == "navigate":
                        await page.goto(step["url"], wait_until=step.get("wait_until", "networkidle"))
                        
                    elif action == "click":
                        await page.click(step["selector"])
                        
                    elif action == "type":
                        if step.get("clear", True):
                            await page.fill(step["selector"], "")
                        await page.type(step["selector"], step["value"], delay=step.get("delay", 30))
                        
                    elif action == "fill":
                        await page.fill(step["selector"], step["value"])
                        
                    elif action == "select":
                        await page.select_option(step["selector"], step["value"])
                        
                    elif action == "check":
                        await page.check(step["selector"])
                        
                    elif action == "uncheck":
                        await page.uncheck(step["selector"])
                        
                    elif action == "wait":
                        if step.get("selector"):
                            await page.wait_for_selector(
                                step["selector"], 
                                state=step.get("state", "visible"),
                                timeout=step.get("timeout", 30000)
                            )
                        elif step.get("duration"):
                            await asyncio.sleep(step["duration"])
                        else:
                            await page.wait_for_load_state("networkidle")
                            
                    elif action == "screenshot":
                        screenshot_bytes = await page.screenshot(
                            full_page=step.get("full_page", False)
                        )
                        name = step.get("name", f"step_{i+1}")
                        result["screenshots"][name] = base64.b64encode(screenshot_bytes).decode()
                        
                    elif action == "extract":
                        for field_name, selector in step.get("selectors", {}).items():
                            try:
                                element = await page.query_selector(selector)
                                if element:
                                    result["extracted_data"][field_name] = await element.text_content()
                            except:
                                pass
                                
                    elif action == "evaluate":
                        await page.evaluate(step["script"])
                        
                    elif action == "scroll":
                        if step.get("to_bottom"):
                            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        elif step.get("selector"):
                            await page.evaluate(f'document.querySelector("{step["selector"]}").scrollIntoView()')
                        else:
                            await page.evaluate(f"window.scrollBy(0, {step.get('amount', 500)})")
                            
                    elif action == "press":
                        await page.keyboard.press(step["key"])
                        
                    elif action == "hover":
                        await page.hover(step["selector"])
                    
                    result["steps_completed"] = i + 1
                    
                    # Auto-screenshot after each step if enabled
                    if capture_screenshots and action not in ["screenshot", "wait"]:
                        screenshot_bytes = await page.screenshot()
                        result["screenshots"][f"after_step_{i+1}"] = base64.b64encode(screenshot_bytes).decode()
                        
                except Exception as step_error:
                    log(f"Step {i+1} failed: {step_error}")
                    if not step.get("continue_on_error", False):
                        raise
            
            result["cookies"] = await context.cookies()
            result["success"] = True
            log("Workflow completed successfully")
            
            await browser.close()
            
    except Exception as e:
        result["error"] = str(e)
        log(f"Workflow failed: {e}")
        
    return result


# Health check endpoint
@app.function(image=browser_image)
def health_check() -> Dict[str, Any]:
    """Health check for browser automation worker"""
    return {
        "status": "healthy",
        "service": "browser-automation",
        "timestamp": datetime.utcnow().isoformat(),
        "capabilities": [
            "navigate",
            "screenshot",
            "click",
            "type",
            "fill_form",
            "extract",
            "cookies",
            "evaluate",
            "wait",
            "scroll",
            "multi_step",
            "workflow",
        ],
        "browsers": ["chromium", "firefox"],
        "features": ["swiss_proxy", "cookie_management", "form_automation"],
    }
