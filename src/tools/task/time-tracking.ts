/**
 * Task time tracking tools
 * 
 * This module provides tools for time tracking operations on ClickUp tasks:
 * - Get time entries for a task
 * - Get aggregated time report for a member
 * - Start time tracking on a task
 * - Stop time tracking
 * - Add a manual time entry
 * - Delete a time entry
 */

import { timeTrackingService, workspaceService, taskService } from "../../services/shared.js";
import { getTaskId } from "./utilities.js";
import { Logger } from "../../logger.js";
import { ErrorCode } from "../../services/clickup/base.js";
import { formatDueDate, parseDueDate, parseDateRangeForReport } from "../../utils/date-utils.js";
import { sponsorService } from "../../utils/sponsor-service.js";
import config from "../../config.js";

// Logger instance
const logger = new Logger('TimeTrackingTools');

/**
 * Tool definition for getting time entries
 */
export const getTaskTimeEntriesTool = {
  name: "get_task_time_entries",
  description: "Gets all time entries for a task with filtering options. Use taskId (preferred) or taskName + optional listName. Returns all tracked time with user info, descriptions, tags, start/end times, and durations.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "ID of the task to get time entries for. Works with both regular task IDs and custom IDs."
      },
      taskName: {
        type: "string",
        description: "Name of the task to get time entries for. When using this parameter, it's recommended to also provide listName."
      },
      listName: {
        type: "string",
        description: "Name of the list containing the task. Helps find the right task when using taskName."
      },
      startDate: {
        type: "string",
        description: "Optional start date filter. Supports Unix timestamps (in milliseconds) and natural language expressions like 'yesterday', 'last week', etc."
      },
      endDate: {
        type: "string",
        description: "Optional end date filter. Supports Unix timestamps (in milliseconds) and natural language expressions."
      }
    }
  }
};

/**
 * Tool definition for starting time tracking
 */
export const startTimeTrackingTool = {
  name: "start_time_tracking",
  description: "Starts time tracking on a task. Use taskId (preferred) or taskName + optional listName. Optional fields: description, billable status, and tags. Only one timer can be running at a time.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "ID of the task to start tracking time on. Works with both regular task IDs and custom IDs."
      },
      taskName: {
        type: "string",
        description: "Name of the task to start tracking time on. When using this parameter, it's recommended to also provide listName."
      },
      listName: {
        type: "string",
        description: "Name of the list containing the task. Helps find the right task when using taskName."
      },
      description: {
        type: "string",
        description: "Optional description for the time entry."
      },
      billable: {
        type: "boolean",
        description: "Whether this time is billable. Default is workspace setting."
      },
      tags: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Optional array of tag names to assign to the time entry."
      }
    }
  }
};

/**
 * Tool definition for stopping time tracking
 */
export const stopTimeTrackingTool = {
  name: "stop_time_tracking",
  description: "Stops the currently running time tracker. Optional fields: description and tags. Returns the completed time entry details.",
  inputSchema: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "Optional description to update or add to the time entry."
      },
      tags: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Optional array of tag names to assign to the time entry."
      }
    }
  }
};

/**
 * Tool definition for adding a manual time entry
 */
export const addTimeEntryTool = {
  name: "add_time_entry",
  description: "Adds a manual time entry to a task. Use taskId (preferred) or taskName + optional listName. Required: start time, duration. Optional: description, billable, tags.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "ID of the task to add time entry to. Works with both regular task IDs and custom IDs."
      },
      taskName: {
        type: "string",
        description: "Name of the task to add time entry to. When using this parameter, it's recommended to also provide listName."
      },
      listName: {
        type: "string",
        description: "Name of the list containing the task. Helps find the right task when using taskName."
      },
      start: {
        type: "string",
        description: "Start time for the entry. Supports Unix timestamps (in milliseconds) and natural language expressions like '2 hours ago', 'yesterday 9am', etc."
      },
      duration: {
        type: "string",
        description: "Duration of the time entry. Format as 'Xh Ym' (e.g., '1h 30m') or just minutes (e.g., '90m')."
      },
      description: {
        type: "string",
        description: "Optional description for the time entry."
      },
      billable: {
        type: "boolean",
        description: "Whether this time is billable. Default is workspace setting."
      },
      tags: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Optional array of tag names to assign to the time entry."
      }
    },
    required: ["start", "duration"]
  }
};

/**
 * Tool definition for deleting a time entry
 */
export const deleteTimeEntryTool = {
  name: "delete_time_entry",
  description: "Deletes a time entry. Required: time entry ID.",
  inputSchema: {
    type: "object",
    properties: {
      timeEntryId: {
        type: "string",
        description: "ID of the time entry to delete."
      }
    },
    required: ["timeEntryId"]
  }
};

/**
 * Tool definition for getting current time entry
 */
export const getCurrentTimeEntryTool = {
  name: "get_current_time_entry",
  description: "Gets the currently running time entry, if any. No parameters needed.",
  inputSchema: {
    type: "object",
    properties: {}
  }
};

/**
 * Tool definition for getting a member time report
 */
export const getMemberTimeReportTool = {
  name: "get_member_time_report",
  description: "Gets an aggregated time report for a ClickUp user across all tasks within the given date range. You can provide a member name/email for automatic lookup, or use assigneeId directly. Supports keywords like 'today', 'yesterday', 'this week' for date ranges.",
  inputSchema: {
    type: "object",
    properties: {
      memberName: {
        type: "string",
        description: "Name of the member to report on (e.g., 'muhammad kashif'). Will be auto-resolved to ClickUp user ID."
      },
      memberEmail: {
        type: "string",
        description: "Email of the member to report on. Will be auto-resolved to ClickUp user ID."
      },
      assigneeId: {
        type: "string",
        description: "ClickUp user ID of the assignee. Only needed if memberName/memberEmail is not provided."
      },
      startDate: {
        type: "string",
        description: "Start date. Supports keywords like 'today', 'yesterday', 'this week', or specific dates/timestamps."
      },
      endDate: {
        type: "string",
        description: "End date. Supports keywords like 'today', 'yesterday', 'now', or specific dates/timestamps."
      },
      timezone: {
        type: "string",
        description: "Timezone for date calculations (e.g., 'Asia/Karachi', 'PKT', 'GMT+5'). Defaults to 'Asia/Karachi' (GMT+5)."
      }
    },
    required: ["startDate", "endDate"]
  }
};

/**
 * Tool definition for getting team time report grouped by team leads
 */
export const getTeamTimeReportTool = {
  name: "get_team_time_report",
  description: "Gets aggregated time reports for all team members, grouped by their Team Lead. Uses the ClickUp Allocation list to determine team structure. Supports different detail levels: 'detailed' (task breakdown), 'summary' (task list), or 'totals_only' (just hours).",
  inputSchema: {
    type: "object",
    properties: {
      startDate: {
        type: "string",
        description: "Start date. Supports keywords like 'today', 'yesterday', 'this week', or specific dates."
      },
      endDate: {
        type: "string",
        description: "End date. Supports keywords like 'today', 'yesterday', 'now', or specific dates."
      },
      detailLevel: {
        type: "string",
        enum: ["detailed", "summary", "totals_only"],
        description: "Level of detail: 'detailed' = full task breakdown with times, 'summary' = task names + total, 'totals_only' = just hours per member. Default: 'summary'"
      },
      timezone: {
        type: "string",
        description: "Timezone for date calculations. Defaults to 'Asia/Karachi' (GMT+5)."
      },
      allocationListId: {
        type: "string",
        description: "Override the allocation list ID (default from config)."
      }
    },
    required: ["startDate", "endDate"]
  }
};

/**
 * Handle get task time entries tool
 */
export async function handleGetTaskTimeEntries(params: any) {
  logger.info("Handling request to get task time entries", params);

  try {
    // Resolve task ID
    const taskId = await getTaskId(params.taskId, params.taskName, params.listName);
    if (!taskId) {
      return sponsorService.createErrorResponse("Task not found. Please provide a valid taskId or taskName + listName combination.");
    }

    // Parse date filters
    let startDate: number | undefined;
    let endDate: number | undefined;

    if (params.startDate) {
      startDate = parseDueDate(params.startDate);
    }

    if (params.endDate) {
      endDate = parseDueDate(params.endDate);
    }

    // Get time entries
    const result = await timeTrackingService.getTimeEntries(taskId, startDate, endDate);

    if (!result.success) {
      return sponsorService.createErrorResponse(result.error?.message || "Failed to get time entries");
    }

    const timeEntries = result.data || [];

    // Format the response
    return sponsorService.createResponse({
      success: true,
      count: timeEntries.length,
      time_entries: timeEntries.map(entry => ({
        id: entry.id,
        description: entry.description || "",
        start: entry.start,
        end: entry.end,
        duration: formatDuration(entry.duration || 0),
        duration_ms: entry.duration || 0,
        billable: entry.billable || false,
        tags: entry.tags || [],
        user: entry.user ? {
          id: entry.user.id,
          username: entry.user.username
        } : null,
        task: entry.task ? {
          id: entry.task.id,
          name: entry.task.name,
          status: entry.task.status?.status || "Unknown"
        } : null
      }))
    }, true);
  } catch (error) {
    logger.error("Error getting task time entries", error);
    return sponsorService.createErrorResponse((error as Error).message || "An unknown error occurred");
  }
}

/**
 * Handle start time tracking tool
 */
export async function handleStartTimeTracking(params: any) {
  logger.info("Handling request to start time tracking", params);

  try {
    // Resolve task ID
    const taskId = await getTaskId(params.taskId, params.taskName, params.listName);
    if (!taskId) {
      return sponsorService.createErrorResponse("Task not found. Please provide a valid taskId or taskName + listName combination.");
    }

    // Check for currently running timer
    const currentTimerResult = await timeTrackingService.getCurrentTimeEntry();
    if (currentTimerResult.success && currentTimerResult.data) {
      return sponsorService.createErrorResponse("A timer is already running. Please stop the current timer before starting a new one.", {
        timer: {
          id: currentTimerResult.data.id,
          task: {
            id: currentTimerResult.data.task.id,
            name: currentTimerResult.data.task.name
          },
          start: currentTimerResult.data.start,
          description: currentTimerResult.data.description
        }
      });
    }

    // Prepare request data
    const requestData = {
      tid: taskId,
      description: params.description,
      billable: params.billable,
      tags: params.tags
    };

    // Start time tracking
    const result = await timeTrackingService.startTimeTracking(requestData);

    if (!result.success) {
      return sponsorService.createErrorResponse(result.error?.message || "Failed to start time tracking");
    }

    const timeEntry = result.data;
    if (!timeEntry) {
      return sponsorService.createErrorResponse("No time entry data returned from API");
    }

    // Format the response
    return sponsorService.createResponse({
      success: true,
      message: "Time tracking started successfully",
      time_entry: {
        id: timeEntry.id,
        description: timeEntry.description,
        start: timeEntry.start,
        end: timeEntry.end,
        task: {
          id: timeEntry.task.id,
          name: timeEntry.task.name
        },
        billable: timeEntry.billable,
        tags: timeEntry.tags
      }
    }, true);
  } catch (error) {
    logger.error("Error starting time tracking", error);
    return sponsorService.createErrorResponse((error as Error).message || "An unknown error occurred");
  }
}

/**
 * Handle stop time tracking tool
 */
export async function handleStopTimeTracking(params: any) {
  logger.info("Handling request to stop time tracking", params);

  try {
    // Check for currently running timer
    const currentTimerResult = await timeTrackingService.getCurrentTimeEntry();
    if (currentTimerResult.success && !currentTimerResult.data) {
      return sponsorService.createErrorResponse("No timer is currently running. Start a timer before trying to stop it.");
    }

    // Prepare request data
    const requestData = {
      description: params.description,
      tags: params.tags
    };

    // Stop time tracking
    const result = await timeTrackingService.stopTimeTracking(requestData);

    if (!result.success) {
      return sponsorService.createErrorResponse(result.error?.message || "Failed to stop time tracking");
    }

    const timeEntry = result.data;
    if (!timeEntry) {
      return sponsorService.createErrorResponse("No time entry data returned from API");
    }

    // Format the response
    return sponsorService.createResponse({
      success: true,
      message: "Time tracking stopped successfully",
      time_entry: {
        id: timeEntry.id,
        description: timeEntry.description,
        start: timeEntry.start,
        end: timeEntry.end,
        duration: formatDuration(timeEntry.duration),
        duration_ms: timeEntry.duration,
        task: {
          id: timeEntry.task.id,
          name: timeEntry.task.name
        },
        billable: timeEntry.billable,
        tags: timeEntry.tags
      }
    }, true);
  } catch (error) {
    logger.error("Error stopping time tracking", error);
    return sponsorService.createErrorResponse((error as Error).message || "An unknown error occurred");
  }
}

/**
 * Handle add time entry tool
 */
export async function handleAddTimeEntry(params: any) {
  logger.info("Handling request to add time entry", params);

  try {
    // Resolve task ID
    const taskId = await getTaskId(params.taskId, params.taskName, params.listName);
    if (!taskId) {
      return sponsorService.createErrorResponse("Task not found. Please provide a valid taskId or taskName + listName combination.");
    }

    // Parse start time
    const startTime = parseDueDate(params.start);
    if (!startTime) {
      return sponsorService.createErrorResponse("Invalid start time format. Use a Unix timestamp (in milliseconds) or a natural language date string.");
    }

    // Parse duration
    const durationMs = parseDuration(params.duration);
    if (durationMs === 0) {
      return sponsorService.createErrorResponse("Invalid duration format. Use 'Xh Ym' format (e.g., '1h 30m') or just minutes (e.g., '90m').");
    }

    // Prepare request data
    const requestData = {
      tid: taskId,
      start: startTime,
      duration: durationMs,
      description: params.description,
      billable: params.billable,
      tags: params.tags
    };

    // Add time entry
    const result = await timeTrackingService.addTimeEntry(requestData);

    if (!result.success) {
      return sponsorService.createErrorResponse(result.error?.message || "Failed to add time entry");
    }

    const timeEntry = result.data;
    if (!timeEntry) {
      return sponsorService.createErrorResponse("No time entry data returned from API");
    }

    // Format the response
    return sponsorService.createResponse({
      success: true,
      message: "Time entry added successfully",
      time_entry: {
        id: timeEntry.id,
        description: timeEntry.description,
        start: timeEntry.start,
        end: timeEntry.end,
        duration: formatDuration(timeEntry.duration),
        duration_ms: timeEntry.duration,
        task: {
          id: timeEntry.task.id,
          name: timeEntry.task.name
        },
        billable: timeEntry.billable,
        tags: timeEntry.tags
      }
    }, true);
  } catch (error) {
    logger.error("Error adding time entry", error);
    return sponsorService.createErrorResponse((error as Error).message || "An unknown error occurred");
  }
}

/**
 * Handle delete time entry tool
 */
export async function handleDeleteTimeEntry(params: any) {
  logger.info("Handling request to delete time entry", params);

  try {
    const { timeEntryId } = params;

    if (!timeEntryId) {
      return sponsorService.createErrorResponse("Time entry ID is required.");
    }

    // Delete time entry
    const result = await timeTrackingService.deleteTimeEntry(timeEntryId);

    if (!result.success) {
      return sponsorService.createErrorResponse(result.error?.message || "Failed to delete time entry");
    }

    // Format the response
    return sponsorService.createResponse({
      success: true,
      message: "Time entry deleted successfully."
    }, true);
  } catch (error) {
    logger.error("Error deleting time entry", error);
    return sponsorService.createErrorResponse((error as Error).message || "An unknown error occurred");
  }
}

/**
 * Handle get current time entry tool
 */
export async function handleGetCurrentTimeEntry(params?: any) {
  logger.info("Handling request to get current time entry");

  try {
    // Get current time entry
    const result = await timeTrackingService.getCurrentTimeEntry();

    if (!result.success) {
      return sponsorService.createErrorResponse(result.error?.message || "Failed to get current time entry");
    }

    const timeEntry = result.data;

    // If no timer is running
    if (!timeEntry) {
      return sponsorService.createResponse({
        success: true,
        timer_running: false,
        message: "No timer is currently running."
      }, true);
    }

    // Format the response
    const elapsedTime = calculateElapsedTime(timeEntry.start);

    return sponsorService.createResponse({
      success: true,
      timer_running: true,
      time_entry: {
        id: timeEntry.id,
        description: timeEntry.description,
        start: timeEntry.start,
        elapsed: formatDuration(elapsedTime),
        elapsed_ms: elapsedTime,
        task: {
          id: timeEntry.task.id,
          name: timeEntry.task.name
        },
        billable: timeEntry.billable,
        tags: timeEntry.tags
      }
    }, true);
  } catch (error) {
    logger.error("Error getting current time entry", error);
    return sponsorService.createErrorResponse((error as Error).message || "An unknown error occurred");
  }
}

/**
 * Handle get member time report tool
 */
export async function handleGetMemberTimeReport(params: any) {
  logger.info("Handling request to get member time report", params);

  try {
    const { memberName, memberEmail, assigneeId, startDate, endDate, timezone = 'Asia/Karachi' } = params || {};

    if (!startDate || !endDate) {
      return sponsorService.createErrorResponse("Both startDate and endDate are required.");
    }

    // Resolve member ID from name/email if not provided directly
    let resolvedAssigneeId = assigneeId;
    let memberInfo: { id: number; username: string; email: string } | null = null;

    if (!resolvedAssigneeId) {
      if (!memberName && !memberEmail) {
        return sponsorService.createErrorResponse(
          "Please provide either memberName, memberEmail, or assigneeId to identify the user."
        );
      }

      // Look up member in workspace
      try {
        const members = await workspaceService.getWorkspaceMembers();
        const searchTerm = (memberName || memberEmail || '').toLowerCase();
        
        memberInfo = members.find((m: any) => 
          m.email?.toLowerCase() === searchTerm ||
          m.username?.toLowerCase() === searchTerm ||
          m.username?.toLowerCase().includes(searchTerm) ||
          (m.username?.toLowerCase().replace(/\s+/g, '') === searchTerm.replace(/\s+/g, ''))
        ) || null;

        if (!memberInfo) {
          // Try partial name match
          memberInfo = members.find((m: any) => {
            const memberUsername = (m.username || '').toLowerCase();
            const memberEmail = (m.email || '').toLowerCase();
            return memberUsername.includes(searchTerm) || 
                   searchTerm.includes(memberUsername) ||
                   memberEmail.includes(searchTerm);
          }) || null;
        }

        if (!memberInfo) {
          return sponsorService.createErrorResponse(
            `Member not found: ${memberName || memberEmail}. Use get_workspace_members to see available members.`
          );
        }

        resolvedAssigneeId = String(memberInfo.id);
        logger.info(`Resolved member "${memberName || memberEmail}" to ID ${resolvedAssigneeId}`);
      } catch (lookupError) {
        logger.error("Failed to lookup member", lookupError);
        return sponsorService.createErrorResponse(
          `Failed to lookup member: ${(lookupError as Error).message}`
        );
      }
    }

    // Parse date range with timezone-aware handling
    let dateRange;
    try {
      dateRange = parseDateRangeForReport(startDate, endDate, timezone);
      logger.info(`Date range for report: ${dateRange.startFormatted} to ${dateRange.endFormatted}`);
    } catch (dateError) {
      return sponsorService.createErrorResponse(
        `Invalid date range: ${(dateError as Error).message}`
      );
    }

    const { startMs, endMs, startFormatted, endFormatted } = dateRange;

    if (startMs > endMs) {
      return sponsorService.createErrorResponse("startDate must be before or equal to endDate.");
    }

    logger.info(`Fetching time entries for assignee ${resolvedAssigneeId} from ${startMs} to ${endMs}`);
    const result = await timeTrackingService.getTeamTimeEntries(resolvedAssigneeId, startMs, endMs);

    if (!result.success) {
      return sponsorService.createErrorResponse(result.error?.message || "Failed to get team time entries");
    }

    const timeEntries = result.data || [];
    logger.info(`Retrieved ${timeEntries.length} time entries`);

    // Aggregate by task
    const taskMap: Record<string, {
      id: string;
      code: string;
      name: string;
      status: string;
      url: string;
      timeMs: number;
    }> = {};

    let totalTimeMs = 0;

    for (const entry of timeEntries) {
      const task = entry.task;
      if (!task?.id) continue;

      const taskId = String(task.id);
      const taskName = task.name || "Unnamed Task";
      const taskCode = task.custom_id || taskId;
      const taskStatus = task.status?.status || "Unknown";
      const taskUrl = `https://app.clickup.com/t/${task.custom_id || task.id}`;
      const duration = Number(entry.duration || 0);

      totalTimeMs += duration;

      if (!taskMap[taskId]) {
        taskMap[taskId] = {
          id: taskId,
          code: taskCode,
          name: taskName,
          status: taskStatus,
          url: taskUrl,
          timeMs: 0
        };
      }

      taskMap[taskId].timeMs += duration;
    }

    const summaryLines = Object.values(taskMap).map(task => {
      const hrs = (task.timeMs / 3_600_000).toFixed(2);
      const safeName = sanitizeTitle(task.name);
      return `- [${task.code}: ${safeName}](${task.url}) — ${task.status} — ⏱ ${hrs} hrs`;
    });

    const totalTimeHrs = (totalTimeMs / 3_600_000).toFixed(2);
    
    // Format total time as hours and minutes for easier reading
    const hours = Math.floor(totalTimeMs / 3_600_000);
    const minutes = Math.floor((totalTimeMs % 3_600_000) / 60_000);
    const totalTimeFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    return sponsorService.createResponse({
      success: true,
      member: memberInfo ? {
        id: memberInfo.id,
        username: memberInfo.username,
        email: memberInfo.email
      } : null,
      assignee_id: resolvedAssigneeId,
      date_range: {
        start: startFormatted,
        end: endFormatted,
        timezone
      },
      total_time_ms: totalTimeMs,
      total_time_hours: Number(totalTimeHrs),
      total_time_formatted: totalTimeFormatted,
      task_count: Object.keys(taskMap).length,
      summary_lines: summaryLines,
      summary_markdown: summaryLines.length > 0 
        ? `**Total: ${totalTimeFormatted}**\n\n${summaryLines.join("\n")}`
        : "No tasks logged in the given range.",
      tasks: Object.values(taskMap).map(task => ({
        id: task.id,
        code: task.code,
        name: task.name,
        status: task.status,
        url: task.url,
        time_ms: task.timeMs,
        time_hours: Number((task.timeMs / 3_600_000).toFixed(2))
      }))
    }, true);
  } catch (error) {
    logger.error("Error getting member time report", error);
    return sponsorService.createErrorResponse((error as Error).message || "An unknown error occurred");
  }
}

/**
 * Handle get team time report tool - groups by team lead
 */
export async function handleGetTeamTimeReport(params: any) {
  logger.info("Handling request to get team time report", params);

  try {
    const { 
      startDate, 
      endDate, 
      detailLevel = 'summary',
      timezone = 'Asia/Karachi',
      allocationListId 
    } = params || {};

    if (!startDate || !endDate) {
      return sponsorService.createErrorResponse("Both startDate and endDate are required.");
    }

    // Parse date range
    let dateRange;
    try {
      dateRange = parseDateRangeForReport(startDate, endDate, timezone);
      logger.info(`Team report date range: ${dateRange.startFormatted} to ${dateRange.endFormatted}`);
    } catch (dateError) {
      return sponsorService.createErrorResponse(`Invalid date range: ${(dateError as Error).message}`);
    }

    const { startMs, endMs, startFormatted, endFormatted } = dateRange;

    // Get allocation list ID from config or params
    const listId = allocationListId || config.clickupAllocationListId;
    const tlTierId = config.clickupTeamLeadTierId;

    logger.info(`Fetching allocation from list ${listId}`);

    // Fetch all tasks from the allocation list
    let allocationTasks: any[];
    try {
      allocationTasks = await taskService.getTasks(listId, { 
        include_closed: true,
        subtasks: false 
      });
      logger.info(`Retrieved ${allocationTasks.length} allocation records`);
    } catch (listError) {
      return sponsorService.createErrorResponse(
        `Failed to fetch allocation list: ${(listError as Error).message}. Check if the list ID ${listId} is correct.`
      );
    }

    // Parse team structure from custom fields
    interface Employee {
      name: string;
      email: string | null;
      clickupId: string | null;
    }

    interface TeamLead {
      name: string;
      email: string;
      employees: Employee[];
    }

    const teamLeadMap: Record<string, TeamLead> = {};
    const teamLeadEmployees: { employee: Employee; teamLeadEmail: string }[] = [];

    // First pass: identify team leads
    for (const task of allocationTasks) {
      const customFields = task.custom_fields || [];
      
      // Check if this is a team lead
      const tierField = customFields.find((f: any) => f.name === 'Tier');
      const isTeamLead = Array.isArray(tierField?.value) && tierField.value.includes(tlTierId);
      
      const emailField = customFields.find((f: any) => f.name === 'Phaedra Email');
      const email = emailField?.value?.toLowerCase() || null;
      
      if (isTeamLead && email) {
        teamLeadMap[email] = {
          name: task.name,
          email: email,
          employees: []
        };
      }
    }

    // Second pass: assign employees to team leads
    for (const task of allocationTasks) {
      const customFields = task.custom_fields || [];
      
      const emailField = customFields.find((f: any) => f.name === 'Phaedra Email');
      const clickupIdField = customFields.find((f: any) => f.name === 'Clickup ID');
      const teamLeadField = customFields.find((f: any) => f.name === 'Team Lead');
      
      const employeeEmail = emailField?.value?.toLowerCase() || null;
      const clickupId = clickupIdField?.value || null;
      const teamLeadEmail = teamLeadField?.value?.[0]?.email?.toLowerCase() || null;
      
      if (clickupId) {
        const employee: Employee = {
          name: task.name,
          email: employeeEmail,
          clickupId: clickupId
        };

        if (teamLeadEmail && teamLeadMap[teamLeadEmail]) {
          teamLeadMap[teamLeadEmail].employees.push(employee);
        } else if (teamLeadEmail) {
          // Team lead not found in map yet, store for later
          teamLeadEmployees.push({ employee, teamLeadEmail });
        } else {
          // No team lead assigned - create "Unassigned" group
          if (!teamLeadMap['unassigned']) {
            teamLeadMap['unassigned'] = {
              name: 'Unassigned',
              email: 'unassigned',
              employees: []
            };
          }
          teamLeadMap['unassigned'].employees.push(employee);
        }
      }
    }

    // Add any remaining employees to their team leads
    for (const { employee, teamLeadEmail } of teamLeadEmployees) {
      if (teamLeadMap[teamLeadEmail]) {
        teamLeadMap[teamLeadEmail].employees.push(employee);
      }
    }

    logger.info(`Parsed ${Object.keys(teamLeadMap).length} teams`);

    // Fetch time entries for each employee
    interface MemberReport {
      name: string;
      email: string | null;
      clickupId: string;
      totalTimeMs: number;
      totalTimeFormatted: string;
      tasks: Array<{
        id: string;
        name: string;
        status: string;
        timeMs: number;
        timeHours: number;
      }>;
      taskNames: string[];
      error?: string;
    }

    interface TeamReport {
      teamLead: { name: string; email: string };
      teamTotalMs: number;
      teamTotalFormatted: string;
      members: MemberReport[];
    }

    const teamReports: TeamReport[] = [];
    let organizationTotalMs = 0;

    for (const [tlEmail, teamLead] of Object.entries(teamLeadMap)) {
      const teamReport: TeamReport = {
        teamLead: { name: teamLead.name, email: teamLead.email },
        teamTotalMs: 0,
        teamTotalFormatted: '',
        members: []
      };

      for (const employee of teamLead.employees) {
        if (!employee.clickupId) {
          teamReport.members.push({
            name: employee.name,
            email: employee.email,
            clickupId: '',
            totalTimeMs: 0,
            totalTimeFormatted: '0m',
            tasks: [],
            taskNames: [],
            error: 'No ClickUp ID configured'
          });
          continue;
        }

        try {
          const result = await timeTrackingService.getTeamTimeEntries(
            employee.clickupId,
            startMs,
            endMs
          );

          if (!result.success) {
            teamReport.members.push({
              name: employee.name,
              email: employee.email,
              clickupId: employee.clickupId,
              totalTimeMs: 0,
              totalTimeFormatted: '0m',
              tasks: [],
              taskNames: [],
              error: result.error?.message || 'Failed to fetch time entries'
            });
            continue;
          }

          const timeEntries = result.data || [];
          
          // Aggregate by task
          const taskMap: Record<string, { id: string; name: string; status: string; timeMs: number }> = {};
          let memberTotalMs = 0;

          for (const entry of timeEntries) {
            const task = entry.task;
            if (!task?.id) continue;

            const taskId = String(task.id);
            const duration = Number(entry.duration || 0);
            memberTotalMs += duration;

            if (!taskMap[taskId]) {
              taskMap[taskId] = {
                id: taskId,
                name: task.name || 'Unnamed Task',
                status: task.status?.status || 'Unknown',
                timeMs: 0
              };
            }
            taskMap[taskId].timeMs += duration;
          }

          const hours = Math.floor(memberTotalMs / 3_600_000);
          const minutes = Math.floor((memberTotalMs % 3_600_000) / 60_000);
          const totalTimeFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

          teamReport.members.push({
            name: employee.name,
            email: employee.email,
            clickupId: employee.clickupId,
            totalTimeMs: memberTotalMs,
            totalTimeFormatted,
            tasks: Object.values(taskMap).map(t => ({
              ...t,
              timeHours: Number((t.timeMs / 3_600_000).toFixed(2))
            })),
            taskNames: Object.values(taskMap).map(t => t.name)
          });

          teamReport.teamTotalMs += memberTotalMs;
        } catch (fetchError) {
          logger.error(`Failed to fetch time for ${employee.name}`, fetchError);
          teamReport.members.push({
            name: employee.name,
            email: employee.email,
            clickupId: employee.clickupId || '',
            totalTimeMs: 0,
            totalTimeFormatted: '0m',
            tasks: [],
            taskNames: [],
            error: (fetchError as Error).message
          });
        }
      }

      // Format team total
      const teamHours = Math.floor(teamReport.teamTotalMs / 3_600_000);
      const teamMinutes = Math.floor((teamReport.teamTotalMs % 3_600_000) / 60_000);
      teamReport.teamTotalFormatted = teamHours > 0 ? `${teamHours}h ${teamMinutes}m` : `${teamMinutes}m`;

      organizationTotalMs += teamReport.teamTotalMs;
      teamReports.push(teamReport);
    }

    // Format organization total
    const orgHours = Math.floor(organizationTotalMs / 3_600_000);
    const orgMinutes = Math.floor((organizationTotalMs % 3_600_000) / 60_000);
    const organizationTotalFormatted = orgHours > 0 ? `${orgHours}h ${orgMinutes}m` : `${orgMinutes}m`;

    // Format output based on detail level
    let formattedTeams;
    if (detailLevel === 'totals_only') {
      formattedTeams = teamReports.map(team => ({
        team_lead: team.teamLead,
        team_total_hours: Number((team.teamTotalMs / 3_600_000).toFixed(2)),
        team_total_formatted: team.teamTotalFormatted,
        members: team.members.map(m => ({
          name: m.name,
          total_hours: Number((m.totalTimeMs / 3_600_000).toFixed(2)),
          total_formatted: m.totalTimeFormatted,
          error: m.error
        }))
      }));
    } else if (detailLevel === 'summary') {
      formattedTeams = teamReports.map(team => ({
        team_lead: team.teamLead,
        team_total_hours: Number((team.teamTotalMs / 3_600_000).toFixed(2)),
        team_total_formatted: team.teamTotalFormatted,
        members: team.members.map(m => ({
          name: m.name,
          email: m.email,
          total_hours: Number((m.totalTimeMs / 3_600_000).toFixed(2)),
          total_formatted: m.totalTimeFormatted,
          tasks_worked_on: m.taskNames,
          task_count: m.taskNames.length,
          error: m.error
        }))
      }));
    } else {
      // detailed
      formattedTeams = teamReports.map(team => ({
        team_lead: team.teamLead,
        team_total_hours: Number((team.teamTotalMs / 3_600_000).toFixed(2)),
        team_total_formatted: team.teamTotalFormatted,
        members: team.members.map(m => ({
          name: m.name,
          email: m.email,
          clickup_id: m.clickupId,
          total_hours: Number((m.totalTimeMs / 3_600_000).toFixed(2)),
          total_formatted: m.totalTimeFormatted,
          tasks: m.tasks.map(t => ({
            id: t.id,
            name: t.name,
            status: t.status,
            hours: t.timeHours
          })),
          error: m.error
        }))
      }));
    }

    return sponsorService.createResponse({
      success: true,
      date_range: {
        start: startFormatted,
        end: endFormatted,
        timezone
      },
      detail_level: detailLevel,
      organization_total_hours: Number((organizationTotalMs / 3_600_000).toFixed(2)),
      organization_total_formatted: organizationTotalFormatted,
      team_count: teamReports.length,
      total_members: teamReports.reduce((sum, t) => sum + t.members.length, 0),
      teams: formattedTeams
    }, true);
  } catch (error) {
    logger.error("Error getting team time report", error);
    return sponsorService.createErrorResponse((error as Error).message || "An unknown error occurred");
  }
}

/**
 * Calculate elapsed time in milliseconds from a start time string to now
 */
function calculateElapsedTime(startTimeString: string): number {
  const startTime = new Date(startTimeString).getTime();
  const now = Date.now();
  return Math.max(0, now - startTime);
}

/**
 * Format duration in milliseconds to a human-readable string
 */
function formatDuration(durationMs: number): string {
  if (!durationMs) return "0m";

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  } else if (remainingMinutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${remainingMinutes}m`;
  }
}

/**
 * Sanitize task titles for safe markdown output
 * Mirrors the behavior used in the existing n8n workflow.
 */
function sanitizeTitle(input: string, options: { maxLen?: number } = {}): string {
  const { maxLen = 140 } = options;
  if (typeof input !== "string") return "";

  // 1) Normalize and remove diacritics
  let s = input.normalize("NFKD").replace(/\p{M}+/gu, "");
  // 2) Replace newlines/tabs with spaces
  s = s.replace(/[\r\n\t]+/g, " ");
  // 3) Keep only safe characters
  s = s.replace(/[^A-Za-z0-9 \-_.:/|&+]/g, "");
  // 4) Collapse spaces and trim
  s = s.replace(/\s{2,}/g, " ").trim();
  // 5) Length cap
  return s.slice(0, maxLen);
}

/**
 * Parse duration string to milliseconds
 */
function parseDuration(durationString: string): number {
  if (!durationString) return 0;

  // Clean the input and handle potential space issues
  const cleanDuration = durationString.trim().toLowerCase().replace(/\s+/g, ' ');

  // Handle simple minute format like "90m"
  if (/^\d+m$/.test(cleanDuration)) {
    const minutes = parseInt(cleanDuration.replace('m', ''), 10);
    return minutes * 60 * 1000;
  }

  // Handle simple hour format like "2h"
  if (/^\d+h$/.test(cleanDuration)) {
    const hours = parseInt(cleanDuration.replace('h', ''), 10);
    return hours * 60 * 60 * 1000;
  }

  // Handle combined format like "1h 30m"
  const combinedPattern = /^(\d+)h\s*(?:(\d+)m)?$|^(?:(\d+)h\s*)?(\d+)m$/;
  const match = cleanDuration.match(combinedPattern);

  if (match) {
    const hours = parseInt(match[1] || match[3] || '0', 10);
    const minutes = parseInt(match[2] || match[4] || '0', 10);
    return (hours * 60 * 60 + minutes * 60) * 1000;
  }

  // Try to parse as just a number of minutes
  const justMinutes = parseInt(cleanDuration, 10);
  if (!isNaN(justMinutes)) {
    return justMinutes * 60 * 1000;
  }

  return 0;
}

// Export all time tracking tools
export const timeTrackingTools = [
  getTaskTimeEntriesTool,
  getMemberTimeReportTool,
  getTeamTimeReportTool,
  startTimeTrackingTool,
  stopTimeTrackingTool,
  addTimeEntryTool,
  deleteTimeEntryTool,
  getCurrentTimeEntryTool
];

// Export all time tracking handlers
export const timeTrackingHandlers = {
  get_task_time_entries: handleGetTaskTimeEntries,
  get_member_time_report: handleGetMemberTimeReport,
  get_team_time_report: handleGetTeamTimeReport,
  start_time_tracking: handleStartTimeTracking,
  stop_time_tracking: handleStopTimeTracking,
  add_time_entry: handleAddTimeEntry,
  delete_time_entry: handleDeleteTimeEntry,
  get_current_time_entry: handleGetCurrentTimeEntry
};
