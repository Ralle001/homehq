"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useTeam } from "@/contexts/team-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Users, Loader2 } from "lucide-react"
import { InviteMember } from "./invite-member"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
import { removeTeamMember, updateTeamMemberRole } from "@/lib/db"
import { useToast } from "@/hooks/use-toast"
import type { TeamMember } from "@/lib/types"

export function TeamMembers() {
  const [open, setOpen] = useState(false)
  const { currentTeam, currentMember, refreshTeams, isLoading } = useTeam()
  const { toast } = useToast()

  const handleRemoveMember = async (memberId: string) => {
    if (!currentTeam || !currentMember) return

    // Check if user has permission
    if (currentMember.role !== "owner" && currentMember.role !== "admin") {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to remove members.",
        variant: "destructive",
      })
      return
    }

    // Ensure members is an array
    const members = Array.isArray(currentTeam.members) ? currentTeam.members : []

    // Prevent removing the owner
    const memberToRemove = members.find((m) => m.id === memberId)
    if (memberToRemove?.role === "owner") {
      toast({
        title: "Cannot Remove Owner",
        description: "The team owner cannot be removed.",
        variant: "destructive",
      })
      return
    }

    try {
      await removeTeamMember(currentTeam.id, memberId)
      await refreshTeams()

      toast({
        title: "Member Removed",
        description: "The team member has been removed successfully.",
      })
    } catch (error) {
      console.error("Error removing member:", error)
      toast({
        title: "Error",
        description: "Failed to remove team member. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: "owner" | "admin" | "member") => {
    if (!currentTeam || !currentMember) return

    // Check if user has permission (only owner can change roles)
    if (currentMember.role !== "owner") {
      toast({
        title: "Permission Denied",
        description: "Only the team owner can change member roles.",
        variant: "destructive",
      })
      return
    }

    // Prevent changing owner's role
    const memberToUpdate = currentTeam.members.find((m) => m.id === memberId)
    if (memberToUpdate?.role === "owner") {
      toast({
        title: "Cannot Change Owner Role",
        description: "The team owner's role cannot be changed.",
        variant: "destructive",
      })
      return
    }

    try {
      await updateTeamMemberRole(currentTeam.id, memberId, newRole)
      await refreshTeams()

      toast({
        title: "Role Updated",
        description: `Member role has been updated to ${newRole}.`,
      })
    } catch (error) {
      console.error("Error updating member role:", error)
      toast({
        title: "Error",
        description: "Failed to update member role. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default"
      case "admin":
        return "outline"
      default:
        return "secondary"
    }
  }

  // Ensure members is an array
  const members = currentTeam && Array.isArray(currentTeam.members) ? currentTeam.members : []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Users className="mr-2 h-4 w-4" />
              Members ({members ? members.length : 0})
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Team Members</DialogTitle>
          <DialogDescription>
            {members ? members.length : 0} {members && members.length === 1 ? "member" : "members"} in{" "}
            {currentTeam?.name || "team"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Members</h3>
            <InviteMember />
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={`https://avatar.vercel.sh/${member.id}.png`} alt={member.name} />
                    <AvatarFallback>{member.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {member.name}
                      {member.id === currentMember?.id && <span className="text-xs text-muted-foreground">(You)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{member.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getRoleBadgeVariant(member.role)} className="capitalize">
                    {member.role}
                  </Badge>

                  {/* Only show dropdown for non-owners if current user is owner/admin */}
                  {(currentMember?.role === "owner" || currentMember?.role === "admin") &&
                    member.role !== "owner" &&
                    member.id !== currentMember?.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* Only show role management for owner */}
                          {currentMember?.role === "owner" && (member.role as string) !== "owner" && (
                            <>
                              <DropdownMenuItem onClick={() => handleUpdateRole(member.id, member.role === "admin" ? "member" : "admin")}>
                                {member.role === "admin" ? "Demote to Member" : "Promote to Admin"}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleRemoveMember(member.id)}>
                                Remove member
                              </DropdownMenuItem>
                            </>
                          )}
                          {/* Show only remove option for admins */}
                          {currentMember?.role === "admin" && (member.role as string) !== "owner" && (
                            <DropdownMenuItem className="text-destructive" onClick={() => handleRemoveMember(member.id)}>
                              Remove member
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                </div>
              </div>
            ))}

            {members.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">No members found in this team.</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

