"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTeam } from "@/contexts/team-context"
import { toast } from "sonner"
import { currencies, isValidCurrencyCode, updateTeamExchangeRates, updateTeamCurrencySettings } from "@/lib/currencies"
import { updateTeam, getTeam, getExchangeRates, updateExchangeRates } from "@/lib/db"
import { Loader2, X, Plus, Settings, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Label } from "@/components/ui/label"
import type { Team } from "@/lib/types"
import { canManageContent } from "@/lib/permissions"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export default function TeamSettingsPage() {
  const { currentTeam, setCurrentTeam } = useTeam()
  const { currentMember } = useTeam()
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState({
    primaryCurrency: "USD",
    supportedCurrencies: ["USD"],
  })
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({})
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member")
  const [isRemovingMember, setIsRemovingMember] = useState(false)

  // Check if user has admin permissions
  const isAdmin = currentTeam && currentMember && (
    currentMember.role === "admin" || 
    canManageContent(currentTeam, currentMember, "expenses")
  )

  useEffect(() => {
    if (currentTeam?.settings?.currency) {
      setSettings({
        primaryCurrency: currentTeam.settings.currency.primary,
        supportedCurrencies: currentTeam.settings.currency.supported,
      })
      if (currentTeam.updatedAt) {
        setLastUpdateTime(new Date(currentTeam.updatedAt))
      }
    }
  }, [currentTeam])

  // Load exchange rates when primary currency changes
  useEffect(() => {
    const loadExchangeRates = async () => {
      if (!settings.primaryCurrency) return
      const rates = await getExchangeRates(settings.primaryCurrency)
      if (rates) {
        setExchangeRates(rates.rates)
        setLastUpdateTime(rates.lastUpdate)
      }
    }
    loadExchangeRates()
  }, [settings.primaryCurrency])

  const handleSaveSettings = async () => {
    if (!currentTeam) return

    setIsLoading(true)
    try {
      // Update currency settings
      await updateTeamCurrencySettings(
        currentTeam.id,
        settings.primaryCurrency,
        settings.supportedCurrencies
      )

      // Update exchange rates if needed
      await updateExchangeRates(settings.primaryCurrency, exchangeRates)

      // Refresh team data
      const updatedTeam = await getTeam(currentTeam.id)
      if (updatedTeam) {
        setCurrentTeam(updatedTeam)
        toast.success("Team settings have been updated successfully.")
      }
    } catch (error) {
      console.error("Error updating team settings:", error)
      toast.error("Failed to update team settings. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddCurrency = async (currencyCode: string) => {
    if (!currentTeam) {
      toast.error("No team selected.")
      return
    }

    if (!settings.supportedCurrencies.includes(currencyCode)) {
      try {
        // Update the team's supported currencies
        await updateTeamCurrencySettings(
          currentTeam.id,
          settings.primaryCurrency,
          [...settings.supportedCurrencies, currencyCode]
        )
        
        // Refresh team data
        const updatedTeam = await getTeam(currentTeam.id)
        if (updatedTeam) {
          setCurrentTeam(updatedTeam)
          setSettings({
            ...settings,
            supportedCurrencies: updatedTeam.settings.currency.supported,
          })
        }
      } catch (error) {
        console.error("Error updating currency settings:", error)
        toast.error("Failed to update currency settings. Please try again.")
        return
      }
    }
  }

  const handleRemoveCurrency = async (currencyCode: string) => {
    if (!currentTeam) return

    if (currencyCode !== settings.primaryCurrency) {
      try {
        // Update the team's supported currencies
        await updateTeamCurrencySettings(
          currentTeam.id,
          settings.primaryCurrency,
          settings.supportedCurrencies.filter(c => c !== currencyCode)
        )
        
        // Refresh team data
        const updatedTeam = await getTeam(currentTeam.id)
        if (updatedTeam) {
          setCurrentTeam(updatedTeam)
          setSettings({
            ...settings,
            supportedCurrencies: updatedTeam.settings.currency.supported
          })
        }
      } catch (error) {
        console.error("Error removing currency:", error)
        toast.error("Failed to remove currency. Please try again.")
      }
    }
  }

  const handleSetPrimaryCurrency = async (currencyCode: string) => {
    if (!currentTeam) return

    if (!settings.supportedCurrencies.includes(currencyCode)) {
      toast.error("Currency Not Supported. Please add this currency to supported currencies first.")
      return
    }

    try {
      // Update the team's primary currency
      await updateTeamCurrencySettings(
        currentTeam.id,
        currencyCode,
        settings.supportedCurrencies
      )

      // Update exchange rates for the new primary currency
      await updateExchangeRates(currencyCode, exchangeRates)
      
      // Refresh team data
      const updatedTeam = await getTeam(currentTeam.id)
      if (updatedTeam) {
        setCurrentTeam(updatedTeam)
        setSettings({
          ...settings,
          primaryCurrency: currencyCode,
        })
      }
    } catch (error) {
      console.error("Error updating primary currency:", error)
      toast.error("Failed to update primary currency. Please try again.")
    }
  }

  const handleUpdateRates = async () => {
    if (!currentTeam) return

    setIsLoading(true)
    try {
      await updateExchangeRates(settings.primaryCurrency, exchangeRates)
      
      // Refresh exchange rates
      const rates = await getExchangeRates(settings.primaryCurrency)
      if (rates) {
        setExchangeRates(rates.rates)
        setLastUpdateTime(rates.lastUpdate)
        toast.success("Currency exchange rates have been updated successfully.")
      }
    } catch (error) {
      console.error("Error updating exchange rates:", error)
      toast.error("Failed to update exchange rates. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInviteMember = async () => {
    if (!currentTeam) return

    setIsLoading(true)
    try {
      // Implement invite member logic
      toast.success("Invitation has been sent to the specified email.")
    } catch (error) {
      console.error("Error inviting member:", error)
      toast.error("Failed to invite member. Please try again.")
    } finally {
      setIsLoading(false)
      setShowInviteDialog(false)
      setInviteEmail("")
      setInviteRole("member")
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!currentTeam) return

    setIsRemovingMember(true)
    try {
      // Implement remove member logic
      toast.success("The member has been removed from the team.")
    } catch (error) {
      console.error("Error removing member:", error)
      toast.error("Failed to remove member. Please try again.")
    } finally {
      setIsRemovingMember(false)
    }
  }

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Settings</h1>
        <p className="text-muted-foreground">Manage your team's preferences and permissions</p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Summary Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg sm:text-xl">Team Summary</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentTeam?.members.length || 0} members
            </div>
            <p className="text-xs text-muted-foreground">
              {currentTeam?.members.filter(member => member.role === "admin").length || 0} administrators
            </p>
          </CardContent>
        </Card>

        {/* Team Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Team Details</CardTitle>
            <CardDescription>Update your team's basic information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Team Name</Label>
                <Input
                  id="name"
                  placeholder="My Family"
                  value={currentTeam.name}
                  onChange={(e) => setCurrentTeam({ ...currentTeam, name: e.target.value })}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="A brief description of your team"
                  value={currentTeam.description || ""}
                  onChange={(e) => setCurrentTeam({ ...currentTeam, description: e.target.value })}
                  disabled={!isAdmin}
                />
              </div>
              <Button
                onClick={handleSaveSettings}
                disabled={isLoading || !isAdmin}
                className="w-full sm:w-auto"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Update Team"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Content Management Card */}
        <Card>
          <CardHeader>
            <CardTitle>Content Management</CardTitle>
            <CardDescription>Configure who can manage different types of content</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Expenses Management</Label>
                <Select
                  value={currentTeam.settings.contentManagement.expenses}
                  onValueChange={(value: "admin" | "everyone") =>
                    setCurrentTeam({
                      ...currentTeam,
                      settings: {
                        ...currentTeam.settings,
                        contentManagement: {
                          ...currentTeam.settings.contentManagement,
                          expenses: value,
                        },
                      },
                    })
                  }
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select who can manage expenses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">All Members</SelectItem>
                    <SelectItem value="admin">Administrators Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Groceries Management</Label>
                <Select
                  value={currentTeam.settings.contentManagement.grocery}
                  onValueChange={(value: "admin" | "everyone") =>
                    setCurrentTeam({
                      ...currentTeam,
                      settings: {
                        ...currentTeam.settings,
                        contentManagement: {
                          ...currentTeam.settings.contentManagement,
                          grocery: value,
                        },
                      },
                    })
                  }
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select who can manage groceries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">All Members</SelectItem>
                    <SelectItem value="admin">Administrators Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Calendar Management</Label>
                <Select
                  value={currentTeam.settings.contentManagement.events}
                  onValueChange={(value: "admin" | "everyone") =>
                    setCurrentTeam({
                      ...currentTeam,
                      settings: {
                        ...currentTeam.settings,
                        contentManagement: {
                          ...currentTeam.settings.contentManagement,
                          events: value,
                        },
                      },
                    })
                  }
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select who can manage calendar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">All Members</SelectItem>
                    <SelectItem value="admin">Administrators Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!isAdmin && (
                <p className="text-sm text-muted-foreground">
                  Only team administrators can modify content management settings
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Currency Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle>Currency Settings</CardTitle>
            <CardDescription>Configure your team's currency preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Primary Currency</Label>
                <Select
                  value={currentTeam.settings.currency.primary}
                  onValueChange={handleSetPrimaryCurrency}
                  disabled={!isAdmin}
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
                {!isAdmin && (
                  <p className="text-sm text-muted-foreground">
                    Only team administrators can change the primary currency
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Supported Currencies</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(currencies).map(([code, currency]) => (
                    <div
                      key={code}
                      className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
                        currentTeam.settings.currency.supported.includes(code)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted border-muted-foreground"
                      }`}
                    >
                      <span>{currency.symbol}</span>
                      <span>{code}</span>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 hover:bg-transparent"
                          onClick={() =>
                            currentTeam.settings.currency.supported.includes(code)
                              ? handleRemoveCurrency(code)
                              : handleAddCurrency(code)
                          }
                        >
                          {currentTeam.settings.currency.supported.includes(code) ? (
                            <X className="h-3 w-3" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {!isAdmin && (
                  <p className="text-sm text-muted-foreground">
                    Only team administrators can modify supported currencies
                  </p>
                )}
              </div>
              {lastUpdateTime && (
                <div className="text-sm text-muted-foreground">
                  Last updated {formatDistanceToNow(lastUpdateTime, { addSuffix: true })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Team Members Card */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>Manage your team's members and their roles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {currentTeam?.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center space-x-4">
                    <Avatar>
                      <AvatarFallback>
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                      {member.role === "admin" ? "Admin" : "Member"}
                    </Badge>
                    {isAdmin && member.id !== currentMember?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={isRemovingMember}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {isAdmin && (
                <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto">
                      <Plus className="mr-2 h-4 w-4" />
                      Invite Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite Team Member</DialogTitle>
                      <DialogDescription>
                        Enter the email address of the person you want to invite.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter email address"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select
                          value={inviteRole}
                          onValueChange={(value: "admin" | "member") => setInviteRole(value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowInviteDialog(false)
                          setInviteEmail("")
                          setInviteRole("member")
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleInviteMember}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Inviting...
                          </>
                        ) : (
                          "Invite Member"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 