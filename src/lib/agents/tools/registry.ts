import type { Tool, ToolRegistry } from './types';
import {
  shellExec,
  shellView,
  fileRead,
  fileWrite,
  fileEdit,
  fileDelete,
  browserNavigate,
  browserClick,
  browserType,
  browserScreenshot,
  searchWeb,
  searchCode,
  webdevInit,
  webdevPreview,
  planUpdate,
  planAdvance,
  messageInfo,
  messageAsk,
} from './implementations';

// Create the tool registry
export const toolRegistry: ToolRegistry = new Map<string, Tool>();

// Register all 15 tools (actually 16 to provide flexibility)
const allTools: Tool[] = [
  // Shell tools (2)
  shellExec,
  shellView,
  
  // File tools (4)
  fileRead,
  fileWrite,
  fileEdit,
  fileDelete,
  
  // Browser tools (4)
  browserNavigate,
  browserClick,
  browserType,
  browserScreenshot,
  
  // Search tools (2)
  searchWeb,
  searchCode,
  
  // Webdev tools (2)
  webdevInit,
  webdevPreview,
  
  // Plan tools (2)
  planUpdate,
  planAdvance,
  
  // Message tools (2)
  messageInfo,
  messageAsk,
];

// Populate registry
allTools.forEach(tool => {
  toolRegistry.set(tool.name, tool);
});

// Export tool count for verification
export const TOOL_COUNT = toolRegistry.size;

// Tool categories summary
export const toolCategories = {
  shell: ['shell.exec', 'shell.view'],
  file: ['file.read', 'file.write', 'file.edit', 'file.delete'],
  browser: ['browser.navigate', 'browser.click', 'browser.type', 'browser.screenshot'],
  search: ['search.web', 'search.code'],
  webdev: ['webdev.init', 'webdev.preview'],
  plan: ['plan.update', 'plan.advance'],
  message: ['message.info', 'message.ask'],
} as const;

// Safety classification summary
export const toolsBySafety = {
  safe: ['shell.view', 'file.read', 'browser.screenshot', 'search.web', 'search.code', 'plan.update', 'plan.advance', 'message.info', 'message.ask'],
  moderate: ['file.write', 'file.edit', 'browser.navigate', 'browser.click', 'browser.type', 'webdev.init', 'webdev.preview'],
  dangerous: ['shell.exec', 'file.delete'],
} as const;

// Tools requiring confirmation
export const toolsRequiringConfirmation = ['shell.exec', 'file.delete'] as const;

console.log(`[ToolRegistry] Registered ${TOOL_COUNT} tools across ${Object.keys(toolCategories).length} categories`);
