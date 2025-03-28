"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useTeam } from "@/contexts/team-context"
import { createInvitation, getUserByEmail, addTeamMember } from "@/lib/db"
import { UserPlus } from "lucide-react"

export function InviteMember() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<"owner" | "admin" | "member">("member")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { currentTeam, currentMember } = useTeam()
  const { toast } = useToast()

  const handleInvite = async () => {
    if (!currentTeam || !currentMember) return

    try {
      setIsSubmitting(true)

      // Check if user has permission to invite
      if (currentMember.role !== "owner" && currentMember.role !== "admin") {
        toast({
          title: "Permission Denied",
          description: "Only team owners and admins can invite new members.",
          variant: "destructive",
          duration: 5000,
        })
        return
      }

      // Check if user exists first
      const existingUser = await getUserByEmail(email)
      if (!existingUser) {
        toast({
          title: "User Not Found",
          description: "No user found with this email address. The user must have an account first.",
          variant: "destructive",
          duration: 5000,
        })
        return
      }

      // Check if user is already a member of the team
      const isAlreadyMember = currentTeam.members?.some(member => member.email === email)
      if (isAlreadyMember) {
        toast({
          title: "Already a Member",
          description: "This user is already a member of your team.",
          variant: "destructive",
          duration: 5000,
        })
        return
      }

      // If user exists and is not a member, add them to the team
      await addTeamMember(currentTeam.id, {
        id: existingUser.id,
        name: name || existingUser.name || "New Member",
        email: email,
        role: role,
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      toast({
        title: "Member Added",
        description: `${email} has been added to the team.`,
        duration: 5000,
      })

      setEmail("")
      setName("")
      setRole("member")
      setOpen(false)
    } catch (error) {
      console.error("Error adding member:", error)
      toast({
        title: "Error",
        description: "Failed to add member. Please try again.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Disable the invite button if:
  // 1. No current team
  // 2. No current member
  // 3. Email is empty
  // 4. Currently submitting
  const isDisabled = !currentTeam || !currentMember || !email.trim() || isSubmitting

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
          <DialogDescription>Invite a new member to join your team.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="member@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name (optional)</Label>
            <Input id="name" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as "owner" | "admin" | "member")}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Admins can manage team settings and invite members. Members can only view and edit content.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={isDisabled}>
            {isSubmitting ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

