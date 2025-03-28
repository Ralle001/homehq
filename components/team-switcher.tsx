"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTeam } from "@/contexts/team-context"
import { Textarea } from "@/components/ui/textarea"
import { useEffect } from "react"
import { currencies } from "@/lib/currencies"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function TeamSwitcher() {
  const { teams, currentTeam, setCurrentTeam, createNewTeam, refreshTeams, isLoading } = useTeam()
  const [open, setOpen] = React.useState(false)
  const [showNewTeamDialog, setShowNewTeamDialog] = React.useState(false)
  const [newTeamName, setNewTeamName] = React.useState("")
  const [newTeamDescription, setNewTeamDescription] = React.useState("")
  const [newTeamCurrency, setNewTeamCurrency] = React.useState("USD")
  const [isCreating, setIsCreating] = React.useState(false)

  // Refresh teams when component mounts
  useEffect(() => {
    refreshTeams()
  }, [])

  const handleCreateTeam = async () => {
    if (newTeamName.trim()) {
      setIsCreating(true)
      try {
        const newTeam = await createNewTeam(newTeamName, newTeamDescription, newTeamCurrency)
        setNewTeamName("")
        setNewTeamDescription("")
        setNewTeamCurrency("USD")
        setShowNewTeamDialog(false)

        // Force refresh teams after creating a new one
        await refreshTeams()

        console.log("New team created and teams refreshed:", newTeam)
      } catch (error) {
        console.error("Error creating team:", error)
      } finally {
        setIsCreating(false)
      }
    }
  }

  return (
    <Dialog open={showNewTeamDialog} onOpenChange={setShowNewTeamDialog}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select a team"
            className="w-[200px] justify-between"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading teams...</span>
              </div>
            ) : currentTeam ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={`https://avatar.vercel.sh/${currentTeam.id}.png`} alt={currentTeam.name} />
                  <AvatarFallback>{currentTeam.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="truncate">{currentTeam.name}</span>
              </div>
            ) : (
              "Select team"
            )}
            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandList>
              <CommandInput placeholder="Search team..." />
              <CommandEmpty>No team found.</CommandEmpty>
              {teams.length > 0 ? (
                <CommandGroup heading="Teams">
                  {teams.map((team) => (
                    <CommandItem
                      key={team.id}
                      onSelect={() => {
                        setCurrentTeam(team)
                        setOpen(false)
                      }}
                      className="text-sm"
                    >
                      <Avatar className="mr-2 h-5 w-5">
                        <AvatarImage src={`https://avatar.vercel.sh/${team.id}.png`} alt={team.name} />
                        <AvatarFallback>{team.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span>{team.name}</span>
                      <Check
                        className={cn("ml-auto h-4 w-4", currentTeam?.id === team.id ? "opacity-100" : "opacity-0")}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                <div className="py-6 text-center text-sm">
                  <p className="text-muted-foreground">No teams found</p>
                  <p className="text-xs text-muted-foreground mt-1">Create your first team below</p>
                </div>
              )}
            </CommandList>
            <CommandSeparator />
            <CommandList>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false)
                    setShowNewTeamDialog(true)
                  }}
                >
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Create Team
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
          <DialogDescription>Add a new team to manage different households or groups.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="name">Team name</Label>
            <Input
              id="name"
              placeholder="Acme Family"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              disabled={isCreating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Our family home management"
              value={newTeamDescription}
              onChange={(e) => setNewTeamDescription(e.target.value)}
              disabled={isCreating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Primary Currency</Label>
            <Select
              value={newTeamCurrency}
              onValueChange={setNewTeamCurrency}
              disabled={isCreating}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(currencies).map(([code, currency]) => (
                  <SelectItem key={code} value={code}>
                    {currency.name} ({currency.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowNewTeamDialog(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreateTeam} disabled={isCreating || !newTeamName.trim()}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

