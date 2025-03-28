"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useTeam } from "@/contexts/team-context"
import { toast } from "sonner"
import { updateTeam, removeTeamMember, deleteTeam, getExpenses, updateExpense, getExchangeRates, updateTeamMemberRole } from "@/lib/db"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Loader2, Trash2, UserX, AlertTriangle, Settings, Users, Shield } from "lucide-react"
import { InviteMember } from "@/components/invite-member"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { currencies, updateTeamCurrencySettings, convertCurrency, fetchLatestExchangeRates } from "@/lib/currencies"
import { canManageContent } from "@/lib/permissions"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"

export default function TeamSettingsPage() {
  const { currentTeam, currentMember, refreshTeams } = useTeam()
  const router = useRouter()

  const [teamDetails, setTeamDetails] = useState({
    name: currentTeam?.name || "",
    description: currentTeam?.description || "",
  })

  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState("general")

  // Check if user has admin permissions or is the team owner
  const isAdmin = currentTeam && currentMember && (
    currentMember.role === "owner" || 
    canManageContent(currentTeam, currentMember, "expenses", currentTeam.ownerId)
  )

  // Load team details when the current team changes
  useEffect(() => {
    if (currentTeam) {
      setTeamDetails({
        name: currentTeam.name,
        description: currentTeam.description || "",
      })
    }
  }, [currentTeam])

  // If not the owner or admin, redirect to dashboard
  useEffect(() => {
    if (currentMember && !isAdmin) {
      toast.error("Permission Denied", {
        description: "Only team owners and admins can access team settings."
      })
      router.push("/dashboard")
    }
  }, [currentMember, isAdmin, router, toast])

  // If no team is selected, show a message
  if (!currentTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">No Team Selected</h2>
          <p className="text-muted-foreground mb-4">Please select or create a team to manage settings.</p>
        </div>
      </div>
    )
  }

  // If not the owner or admin, don't render the page
  if (!isAdmin) {
    return null
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setTeamDetails((prev) => ({ ...prev, [name]: value }))
  }

  const handleUpdateTeam = async () => {
    if (!currentTeam) return

    // Validate inputs
    if (!teamDetails.name.trim()) {
      toast.error("Invalid Input", {
        description: "Team name cannot be empty."
      })
      return
    }

    setIsUpdating(true)

    try {
      await updateTeam(currentTeam.id, {
        name: teamDetails.name,
        description: teamDetails.description,
      })

      await refreshTeams()

      toast("Team Updated", {
        description: "Team details have been updated successfully."
      })
    } catch (error) {
      console.error("Error updating team:", error)
      toast.error("Error", {
        description: "Failed to update team details. Please try again."
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!currentTeam) return

    try {
      await removeTeamMember(currentTeam.id, memberId)
      await refreshTeams()

      toast("Member Removed", {
        description: "The team member has been removed successfully."
      })
    } catch (error) {
      console.error("Error removing member:", error)
      toast.error("Error", {
        description: "Failed to remove team member. Please try again."
      })
    }
  }

  const handleDeleteTeam = async () => {
    if (!currentTeam) return

    setIsDeleting(true)

    try {
      await deleteTeam(currentTeam.id)
      await refreshTeams()

      toast("Team Deleted", {
        description: "The team has been deleted successfully."
      })

      router.push("/dashboard")
    } catch (error) {
      console.error("Error deleting team:", error)
      toast.error("Error", {
        description: "Failed to delete team. Please try again."
      })
      setIsDeleting(false)
    }
  }

  const handleSetPrimaryCurrency = async (currencyCode: string) => {
    if (!currentTeam) return

    try {
      // First get the latest exchange rates from the API
      const rates = await fetchLatestExchangeRates(currencyCode)

      // Update the team's primary currency with the latest exchange rates
      await updateTeamCurrencySettings(
        currentTeam.id,
        currencyCode,
        currentTeam.settings.currency.supported
      )

      // Get all expenses for the team
      const expenses = await getExpenses(currentTeam.id)

      // Update each expense with new primary currency amounts
      const updatePromises = expenses.map(async (expense) => {
        // Skip if the expense is already in the new primary currency
        if (expense.currency === currencyCode) {
          return updateExpense(expense.id, {
            primaryAmount: expense.amount,
            primaryCurrency: currencyCode,
          })
        }

        // Convert the amount to the new primary currency using the latest rates
        const primaryAmount = convertCurrency(
          expense.amount,
          expense.currency,
          currencyCode,
          rates
        )

        return updateExpense(expense.id, {
          primaryAmount,
          primaryCurrency: currencyCode,
        })
      })

      // Wait for all expense updates to complete
      await Promise.all(updatePromises)

      // Refresh the team data
      await refreshTeams()

      toast("Currency Updated", {
        description: "Primary currency and all expenses have been updated successfully."
      })
    } catch (error) {
      console.error("Error updating currency:", error)
      toast.error("Error", {
        description: "Failed to update primary currency. Please try again."
      })
    }
  }

  const handleUpdateContentManagement = async (key: string, value: "admin" | "everyone") => {
    if (!currentTeam) return

    try {
      await updateTeam(currentTeam.id, {
        settings: {
          ...currentTeam.settings,
          contentManagement: {
            ...currentTeam.settings.contentManagement,
            [key]: value,
          },
        },
      })
      await refreshTeams()
      toast("Settings Updated", {
        description: "Content management settings have been updated successfully."
      })
    } catch (error) {
      console.error("Error updating content management:", error)
      toast.error("Error", {
        description: "Failed to update content management settings. Please try again."
      })
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: "admin" | "member") => {
    if (!currentTeam) return

    try {
      await updateTeamMemberRole(currentTeam.id, memberId, newRole)
      await refreshTeams()
      toast("Role Updated", {
        description: `Member role has been updated to ${newRole}.`
      })
    } catch (error) {
      console.error("Error updating member role:", error)
      toast.error("Error", {
        description: "Failed to update member role. Please try again."
      })
    }
  }

  // Ensure members is an array
  const members = Array.isArray(currentTeam.members) ? currentTeam.members : []

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Team Settings</h1>
        <p className="text-muted-foreground">Manage your team preferences and members</p>
      </div>

      <div className="space-y-6 max-w-4xl mx-auto">
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <CardTitle>Settings</CardTitle>
                <TabsList>
                  <TabsTrigger value="general" className="py-2">
                    <Settings className="h-4 w-4 mr-2" />
                    General
                  </TabsTrigger>
                  <TabsTrigger value="members" className="py-2">
                    <Users className="h-4 w-4 mr-2" />
                    Members
                  </TabsTrigger>
                  <TabsTrigger value="danger" className="py-2">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Danger
                  </TabsTrigger>
                </TabsList>
              </div>
            </CardHeader>
          </Card>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Team Details</CardTitle>
                <CardDescription>Update your team's name and description</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Team Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={teamDetails.name}
                      onChange={handleInputChange}
                      disabled={isUpdating}
                      className="max-w-md"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={teamDetails.description}
                      onChange={handleInputChange}
                      disabled={isUpdating}
                      rows={3}
                      className="max-w-md"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleUpdateTeam} disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  <div>
                    <CardTitle>Content Management</CardTitle>
                    <CardDescription>Configure who can manage different types of content</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {Object.entries(currentTeam.settings.contentManagement).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <Label className="capitalize">{key}</Label>
                      <Select
                        value={value}
                        onValueChange={(newValue) => handleUpdateContentManagement(key, newValue as "admin" | "everyone")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin Only</SelectItem>
                          <SelectItem value="everyone">Everyone</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Currency Settings</CardTitle>
                <CardDescription>Manage your team's primary currency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-md space-y-2">
                  <Label>Primary Currency</Label>
                  <Select
                    value={currentTeam.settings.currency.primary}
                    onValueChange={handleSetPrimaryCurrency}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select primary currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentTeam.settings.currency.supported.map((currencyCode) => (
                        <SelectItem key={currencyCode} value={currencyCode}>
                          {currencies[currencyCode]?.name || currencyCode} ({currencies[currencyCode]?.symbol || currencyCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>Manage the members of your team</CardDescription>
                  </div>
                  <InviteMember />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border gap-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={`https://avatar.vercel.sh/${member.id}.png`} alt={member.name} />
                          <AvatarFallback>{member.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-sm text-muted-foreground">{member.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-14 sm:ml-0">
                        {member.role === "owner" ? (
                          <Badge variant="default" className="capitalize">
                            {member.role}
                          </Badge>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 flex items-center gap-1">
                                <Badge
                                  variant={member.role === "admin" ? "default" : "outline"}
                                  className="capitalize cursor-pointer"
                                >
                                  {member.role}
                                </Badge>
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleUpdateRole(member.id, member.role === "admin" ? "member" : "admin")}
                                disabled={!isAdmin}
                              >
                                {member.role === "admin" ? "Demote to Member" : "Promote to Admin"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}

                        {member.role !== "owner" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <UserX className="h-4 w-4" />
                                <span className="sr-only">Remove member</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove {member.name} from the team? This action cannot be
                                  undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))}

                  {members.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No members found in this team.</p>
                      <p className="text-sm">Start by inviting team members using the button above.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="danger" className="space-y-4">
            <Card className="border-destructive">
              <CardHeader>
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <div>
                    <CardTitle>Danger Zone</CardTitle>
                    <CardDescription>Destructive actions that cannot be undone</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h3 className="font-medium">Delete Team</h3>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete this team and all associated data. This action cannot be undone.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isDeleting}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Team
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Team</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete the team "{currentTeam.name}"? This will permanently remove all
                        team data, including grocery lists, expenses, and calendar events. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteTeam}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          "Delete Team"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

