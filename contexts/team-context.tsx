"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import type { Team, TeamMember } from "@/lib/types"
import { createTeam, getTeamsByUserId, updateTeam } from "@/lib/db"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { fetchLatestExchangeRates } from "@/lib/currencies"
import { currencies } from "@/lib/currencies"

interface TeamContextType {
  teams: Team[]
  currentTeam: Team | null
  setCurrentTeam: (team: Team) => void
  isLoading: boolean
  createNewTeam: (name: string, description: string, primaryCurrency: string) => Promise<Team | null>
  refreshTeams: () => Promise<void>
  currentMember: TeamMember | null
}

const TeamContext = createContext<TeamContextType | undefined>(undefined)

export function TeamProvider({
  children,
  userId,
}: {
  children: React.ReactNode | ((data: TeamContextType) => React.ReactNode)
  userId: string
}) {
  const [teams, setTeams] = useState<Team[]>([])
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentMember, setCurrentMember] = useState<TeamMember | null>(null)
  const { toast } = useToast()
  const { user } = useAuth()

  const refreshTeams = async () => {
    try {
      setIsLoading(true)

      // Get teams where the user is a member directly from Firestore
      const userTeams = await getTeamsByUserId(userId)
      console.log("User teams fetched:", JSON.stringify(userTeams, null, 2))
      console.log("Current userId:", userId)
      console.log("Current user:", user)

      // Ensure each team has a members array and convert timestamps
      const teamsWithMembers = userTeams.map((team) => {
        const teamWithMembers = {
          ...team,
          members: Array.isArray(team.members) ? team.members : [],
        }
        console.log(`Team ${team.id} with members:`, JSON.stringify(teamWithMembers, null, 2))
        return teamWithMembers
      })

      console.log("Teams with members:", JSON.stringify(teamsWithMembers, null, 2))
      setTeams(teamsWithMembers)

      // If no current team is set but we have teams, set the first one
      if (!currentTeam && teamsWithMembers.length > 0) {
        const firstTeam = teamsWithMembers[0]
        console.log("First team members:", JSON.stringify(firstTeam.members, null, 2))
        console.log("Looking for member with userId:", userId)
        console.log("Member IDs in team:", firstTeam.members.map(m => m.id))
        setCurrentTeam(firstTeam)

        // Find the current user in the members array
        const member = firstTeam.members.find((m) => m.id === userId) || null
        console.log("Found member:", JSON.stringify(member, null, 2))
        setCurrentMember(member)
      } else if (currentTeam) {
        // Update current team with fresh data
        const updatedCurrentTeam = teamsWithMembers.find((t) => t.id === currentTeam.id)
        if (updatedCurrentTeam) {
          console.log("Updated current team members:", JSON.stringify(updatedCurrentTeam.members, null, 2))
          console.log("Looking for member with userId:", userId)
          console.log("Member IDs in team:", updatedCurrentTeam.members.map(m => m.id))
          setCurrentTeam(updatedCurrentTeam)

          // Find the current user in the members array
          const member = updatedCurrentTeam.members.find((m) => m.id === userId) || null
          console.log("Found member:", JSON.stringify(member, null, 2))
          setCurrentMember(member)
        } else if (teamsWithMembers.length > 0) {
          // If current team no longer exists, set to first available team
          const firstTeam = teamsWithMembers[0]
          console.log("First team members:", JSON.stringify(firstTeam.members, null, 2))
          console.log("Looking for member with userId:", userId)
          console.log("Member IDs in team:", firstTeam.members.map(m => m.id))
          setCurrentTeam(firstTeam)
          const member = firstTeam.members.find((m) => m.id === userId) || null
          console.log("Found member:", JSON.stringify(member, null, 2))
          setCurrentMember(member)
        } else {
          setCurrentTeam(null)
          setCurrentMember(null)
        }
      }
    } catch (error) {
      console.error("Error refreshing teams:", error)
      toast({
        title: "Error",
        description: "Failed to load your teams. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (userId) {
      refreshTeams()
    }
  }, [userId])

  const createNewTeam = async (name: string, description: string, primaryCurrency: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a team.",
        variant: "destructive",
      })
      return null
    }

    try {
      setIsLoading(true)

      // Get all supported currencies from the currencies object
      const supportedCurrencies = Object.keys(currencies)

      // Create the new team
      const newTeam = await createTeam({
        name,
        description,
        ownerId: user.uid,
        members: [
          {
            id: user.uid,
            name: user.displayName || "Owner",
            email: user.email || "",
            role: "owner",
            joinedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        settings: {
          contentManagement: {
            events: "admin",
            expenses: "admin",
            grocery: "admin"
          },
          currency: {
            primary: primaryCurrency,
            supported: supportedCurrencies,
            lastUpdate: new Date()
          },
          theme: "system",
          notifications: {
            email: true,
            push: true
          }
        }
      })

      // Fetch initial exchange rates for the primary currency
      const rates = await fetchLatestExchangeRates(primaryCurrency)
      console.log("Fetched initial exchange rates:", rates)

      // Update the team with the last update time
      const updatedTeam = await updateTeam(newTeam.id, {
        settings: {
          ...newTeam.settings,
          currency: {
            ...newTeam.settings.currency,
            lastUpdate: new Date()
          }
        }
      })

      // Add the new team to the teams array
      if (updatedTeam) {
        setTeams((prevTeams) => [...prevTeams, updatedTeam])
        setCurrentTeam(updatedTeam)
      }

      toast({
        title: "Team Created",
        description: "Your new team has been created successfully.",
      })

      return updatedTeam
    } catch (error) {
      console.error("Error creating team:", error)
      toast({
        title: "Error",
        description: "Failed to create team. Please try again.",
        variant: "destructive",
      })
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetCurrentTeam = (team: Team) => {
    console.log("Setting current team:", team)
    console.log("Current userId:", userId)
    
    // Ensure the team has a members array
    const teamWithMembers = {
      ...team,
      members: Array.isArray(team.members) ? team.members : [],
    }

    console.log("Team with members:", teamWithMembers)
    console.log("Team members:", teamWithMembers.members)
    setCurrentTeam(teamWithMembers)

    // Find the current user in the members array
    const member = teamWithMembers.members.find((m) => m.id === userId) || null
    console.log("Looking for member with userId:", userId)
    console.log("Found member:", member)
    setCurrentMember(member)
  }

  const contextValue: TeamContextType = {
    teams,
    currentTeam,
    setCurrentTeam: handleSetCurrentTeam,
    isLoading,
    createNewTeam,
    refreshTeams,
    currentMember,
  }

  return (
    <TeamContext.Provider value={contextValue}>
      {typeof children === "function" ? children(contextValue) : children}
    </TeamContext.Provider>
  )
}

export function useTeam() {
  const context = useContext(TeamContext)
  if (context === undefined) {
    throw new Error("useTeam must be used within a TeamProvider")
  }
  return context
}

