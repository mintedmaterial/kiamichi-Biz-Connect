/**
 * Business Listing Agent Tools - Index
 * Central export for all tool modules
 */
import type { ToolSet } from "ai";

// Import Facebook/Social Media tools
import {
  generateSocialPostDraft,
  generateSocialImage,
  publishSocialPost,
  facebookToolExecutions
} from "./facebooktools";

// Import Database tools
import {
  getBusinessInfo,
  listDatabaseTables,
  queryDatabase,
  getTableSchema,
  delegateToRagAgent,
  dbExecutions
} from "./dbtools";

// Import Content tools
import {
  updateComponent,
  generateBlogPost,
  optimizeSEO,
  generateImage,
  contentExecutions
} from "./contenttools";

// Import Schedule tools
import {
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask
} from "./scheduletools";

// Import Page Editing tools
import {
  selectComponentTemplate,
  updateComponentContent,
  removeComponent,
  reorderComponents,
  listPageComponents,
  getComponentDetails,
  publishChanges,
  rollbackToSnapshot,
  listPageSnapshots,
  pageToolExecutions
} from "./pagetools";

/**
 * Export all available tools
 */
export const tools = {
  // Facebook & Social Media (3-step workflow)
  generateSocialPostDraft,  // Step 1: Generate text
  generateSocialImage,      // Step 2: Generate image
  publishSocialPost,        // Step 3: Publish (requires confirmation)

  // Database
  getBusinessInfo,
  listDatabaseTables,
  queryDatabase,
  getTableSchema,
  delegateToRagAgent,

  // Content Generation & Management
  updateComponent,
  generateBlogPost,
  optimizeSEO,
  // generateImage removed - was causing confusion with generateSocialImage
  // Use generateSocialImage for social media, not this generic tool

  // Page Editing Tools
  selectComponentTemplate,
  updateComponentContent,
  removeComponent,
  reorderComponents,
  listPageComponents,
  getComponentDetails,
  publishChanges,
  rollbackToSnapshot,
  listPageSnapshots,

  // Scheduling
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask
} satisfies ToolSet;

/**
 * Execution implementations for tools requiring human confirmation
 * These contain the actual logic that runs after user approval
 */
export const executions = {
  ...facebookToolExecutions,
  ...dbExecutions,
  ...contentExecutions,
  ...pageToolExecutions
};
