/**
 * Shared dangerous-command detection used by both local Cowork (coworkRunner)
 * and IM channel auto-approve logic (imCoworkHandler).
 */

// Delete patterns
const DELETE_COMMAND_RE = /\b(rm|rmdir|unlink|del|erase|remove-item|trash)\b/i;
const FIND_DELETE_COMMAND_RE = /\bfind\b[\s\S]*\s-delete\b/i;
const GIT_CLEAN_COMMAND_RE = /\bgit\s+clean\b/i;

// Other destructive patterns
const GIT_PUSH_RE = /\bgit\s+push\b/i;
const GIT_RESET_HARD_RE = /\bgit\s+reset\s+--hard\b/i;
const KILL_COMMAND_RE = /\b(kill|killall|pkill)\b/i;
const CHMOD_COMMAND_RE = /\b(chmod|chown)\b/i;

/**
 * Returns true if the command is a delete operation
 * (rm, rmdir, unlink, del, erase, remove-item, find -delete, git clean).
 */
export function isDeleteCommand(command: string): boolean {
  return DELETE_COMMAND_RE.test(command)
    || FIND_DELETE_COMMAND_RE.test(command)
    || GIT_CLEAN_COMMAND_RE.test(command);
}

/**
 * Returns true if the command is considered dangerous and should require
 * explicit user confirmation before execution.
 */
export function isDangerousCommand(command: string): boolean {
  return isDeleteCommand(command)
    || GIT_PUSH_RE.test(command)
    || GIT_RESET_HARD_RE.test(command)
    || KILL_COMMAND_RE.test(command)
    || CHMOD_COMMAND_RE.test(command);
}
