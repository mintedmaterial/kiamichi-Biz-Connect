/**
 * Task Scheduling Tools
 * Tools for scheduling and managing delayed tasks
 */
import { tool } from "ai";
import { z } from "zod/v3";
import type { Chat } from "../server";
import { Agent, getCurrentAgent } from "agents";
import { scheduleSchema } from "agents/schedule";

/**
 * Schedule a task for later execution
 * Auto-executes without confirmation
 */
export const scheduleTask = tool({
  description: "Schedule a task to be executed at a later time (e.g., publish blog post in 2 hours, update content tomorrow)",
  inputSchema: scheduleSchema,
  execute: async ({ when, description }) => {
    const { agent } = getCurrentAgent<Agent>();

    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }

    const input =
      when.type === "scheduled"
        ? when.date
        : when.type === "delayed"
          ? when.delayInSeconds
          : when.type === "cron"
            ? when.cron
            : null;

    if (!input) {
      return "Invalid schedule input";
    }

    try {
      agent!.schedule(input, "executeTask", description);
      return `Task scheduled for ${when.type}: ${input}`;
    } catch (error) {
      console.error("Error scheduling task:", error);
      return `Error scheduling task: ${error}`;
    }
  }
});

/**
 * List all scheduled tasks
 * Auto-executes without confirmation
 */
export const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled for this business",
  inputSchema: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks:", error);
      return `Error: ${error}`;
    }
  }
});

/**
 * Cancel a scheduled task
 * Auto-executes without confirmation
 */
export const cancelScheduledTask = tool({
  description: "Cancel a previously scheduled task using its ID",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to cancel")
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling task:", error);
      return `Error: ${error}`;
    }
  }
});
