import type { Team, TeamMember } from "./types"

export type ContentType = "events" | "expenses" | "grocery"

export function canManageContent(
  team: Team,
  currentMember: TeamMember,
  contentType: ContentType,
  contentCreatorId?: string
): boolean {
  // Owner can always manage everything
  if (currentMember.role === "owner") return true

  // Members can always manage their own content
  if (contentCreatorId && contentCreatorId === currentMember.id) return true

  // Check team settings
  const setting = team.settings?.contentManagement?.[contentType]
  
  // If setting is "everyone", any member can manage
  if (setting === "everyone") return true
  
  // If setting is "admin", only admins can manage
  if (setting === "admin") return currentMember.role === "admin"

  // Default to admin-only if no setting is specified
  return currentMember.role === "admin"
} 