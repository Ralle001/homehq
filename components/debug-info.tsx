"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import { useTeam } from "@/contexts/team-context"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase" // Fixed import path
import { useToast } from "@/components/ui/use-toast"

export function DebugInfo() {
  const [showDebug, setShowDebug] = useState(false)
  const { user } = useAuth()
  const { teams, currentTeam, refreshTeams } = useTeam()
  const { toast } = useToast()

  const checkDatabaseCollections = async () => {
    try {
      console.log("Checking database collections...")

      // Check teams collection
      const teamsSnapshot = await getDocs(collection(db, "teams"))
      console.log(`Teams collection has ${teamsSnapshot.size} documents`)

      // Check groceryLists collection
      const groceryListsSnapshot = await getDocs(collection(db, "groceryLists"))
      console.log(`GroceryLists collection has ${groceryListsSnapshot.size} documents`)

      // Check expenses collection
      const expensesSnapshot = await getDocs(collection(db, "expenses"))
      console.log(`Expenses collection has ${expensesSnapshot.size} documents`)

      // Check events collection
      const eventsSnapshot = await getDocs(collection(db, "events"))
      console.log(`Events collection has ${eventsSnapshot.size} documents`)

      // Check users collection
      const usersSnapshot = await getDocs(collection(db, "users"))
      console.log(`Users collection has ${usersSnapshot.size} documents`)

      // If current team is selected, check documents for that team
      if (currentTeam) {
        console.log(`Checking documents for team ${currentTeam.id}...`)

        // Check grocery lists for current team
        const teamGroceryListsQuery = query(collection(db, "groceryLists"), where("teamId", "==", currentTeam.id))
        const teamGroceryListsSnapshot = await getDocs(teamGroceryListsQuery)
        console.log(`Team ${currentTeam.id} has ${teamGroceryListsSnapshot.size} grocery lists`)

        // Check expenses for current team
        const teamExpensesQuery = query(collection(db, "expenses"), where("teamId", "==", currentTeam.id))
        const teamExpensesSnapshot = await getDocs(teamExpensesQuery)
        console.log(`Team ${currentTeam.id} has ${teamExpensesSnapshot.size} expenses`)

        // Check events for current team
        const teamEventsQuery = query(collection(db, "events"), where("teamId", "==", currentTeam.id))
        const teamEventsSnapshot = await getDocs(teamEventsQuery)
        console.log(`Team ${currentTeam.id} has ${teamEventsSnapshot.size} events`)
      }

      toast({
        title: "Database Check Complete",
        description: "Check the console for details.",
      })
    } catch (error) {
      console.error("Error checking database collections:", error)
      toast({
        title: "Error",
        description: "Failed to check database collections.",
        variant: "destructive",
      })
    }
  }

  if (!showDebug) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 opacity-50 hover:opacity-100"
        onClick={() => setShowDebug(true)}
      >
        Show Debug
      </Button>
    )
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-[80vh] overflow-auto shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Debug Information</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setShowDebug(false)}>
          Hide
        </Button>
      </CardHeader>
      <CardContent className="text-xs">
        <div className="space-y-4">
          <div>
            <h3 className="font-bold mb-1">User:</h3>
            <pre className="bg-muted p-2 rounded overflow-auto">
              {JSON.stringify(
                {
                  uid: user?.uid,
                  email: user?.email,
                  displayName: user?.displayName,
                  photoURL: user?.photoURL,
                },
                null,
                2,
              )}
            </pre>
          </div>

          <div>
            <h3 className="font-bold mb-1">Teams ({teams.length}):</h3>
            <pre className="bg-muted p-2 rounded overflow-auto">
              {JSON.stringify(
                teams.map((t) => ({
                  id: t.id,
                  name: t.name,
                  ownerId: t.ownerId,
                  memberCount: t.members?.length || 0,
                  members: t.members?.map((m) => ({
                    id: m.id,
                    name: m.name,
                    role: m.role,
                  })),
                })),
                null,
                2,
              )}
            </pre>
          </div>

          <div>
            <h3 className="font-bold mb-1">Current Team:</h3>
            <pre className="bg-muted p-2 rounded overflow-auto">
              {JSON.stringify(
                currentTeam
                  ? {
                      id: currentTeam.id,
                      name: currentTeam.name,
                      ownerId: currentTeam.ownerId,
                      memberCount: currentTeam.members?.length || 0,
                    }
                  : null,
                null,
                2,
              )}
            </pre>
          </div>

          <Button size="sm" variant="outline" onClick={() => refreshTeams()} className="w-full">
            Refresh Teams
          </Button>
          <Button size="sm" variant="outline" onClick={checkDatabaseCollections} className="w-full">
            Check Database Collections
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

