"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ShoppingCart, DollarSign, Calendar, Plus, Loader2, MessageSquare, Receipt } from "lucide-react"
import { formatCurrency, formatRelativeTime } from "@/lib/utils"
import { useTeam } from "@/contexts/team-context"
import { getGroceryLists, getExpenses, getCalendarEvents } from "@/lib/db"
import { toast } from "sonner"
import type { GroceryList, Expense, CalendarEvent, GroceryItem } from "@/lib/types"
import { useRouter } from "next/navigation"
import { UpcomingEvents } from "@/components/upcoming-events"
import { formatDistanceToNow } from "date-fns"

type Activity = 
  | { type: "grocery"; item: GroceryItem; list: GroceryList; date: Date }
  | { type: "expense"; expense: Expense; date: Date }
  | { type: "event"; event: CalendarEvent; date: Date }

export default function DashboardPage() {
  const [groceryLists, setGroceryLists] = useState<GroceryList[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const { currentTeam } = useTeam()
  const router = useRouter()

  useEffect(() => {
    const loadData = async () => {
      if (!currentTeam) {
        setIsLoading(false)
        return
      }

      try {
        const [lists, expenses, events] = await Promise.all([
          getGroceryLists(currentTeam.id),
          getExpenses(currentTeam.id),
          getCalendarEvents(currentTeam.id),
        ])

        setGroceryLists(lists)
        setExpenses(expenses)
        setEvents(events)
      } catch (error) {
        console.error("Error loading dashboard data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [currentTeam])

  // Calculate dashboard metrics
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const itemsToBuy = groceryLists.reduce((sum, list) => 
    sum + list.items.filter(item => !item.completed).length, 0
  )

  const totalExpensesThisMonth = expenses
    .map(expense => ({
      ...expense,
      date: new Date(expense.date)
    }))
    .filter((expense) => {
      const now = new Date()
      return expense.date.getMonth() === now.getMonth() && expense.date.getFullYear() === now.getFullYear()
    })
    .reduce((sum, expense) => sum + expense.amount, 0)

  const upcomingEvents = events
    .map(event => ({
      ...event,
      date: new Date(event.date)
    }))
    .filter((event) => event.date > new Date())
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  // Get the next event
  const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null

  // Recent activities - we'll use a mix of recent items from different sources
  const recentActivities: Activity[] = [
    ...groceryLists.flatMap((list) =>
      Array.isArray(list.items)
        ? list.items.map((item) => ({
            type: "grocery" as const,
            item,
            list,
            date: new Date(item.createdAt),
          }))
        : [],
    ),
    ...expenses.map((expense) => ({
      type: "expense" as const,
      expense,
      date: new Date(expense.createdAt),
    })),
    ...events.map((event) => ({
      type: "event" as const,
      event,
      date: new Date(event.createdAt),
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 3) // Get the 3 most recent activities

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  if (!currentTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">No Team Selected</h2>
          <p className="text-muted-foreground mb-4">Please select or create a team to get started.</p>
          <Button onClick={() => router.push("/teams")}>Manage Teams</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 h-[calc(100vh-7rem)] overflow-auto">
      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-center">Dashboard</h1>
        </div>

        {/* Overview Metrics */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Items to Buy</p>
                <p className="text-2xl font-bold">{itemsToBuy}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivities.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No recent activities to display.</div>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((activity, index) => {
                  if (activity.type === "grocery") {
                    return (
                      <div key={`grocery-${index}`} className="flex items-start gap-3">
                        <div className="rounded-full bg-primary/10 p-2">
                          <ShoppingCart className="h-4 w-4 text-primary" />
                        </div>
                        <div className="grid gap-1 flex-1">
                          <p className="text-sm font-medium break-words">
                            {activity.item.addedBy} added {activity.item.name} to {activity.list.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatRelativeTime(activity.date)}</p>
                        </div>
                      </div>
                    )
                  } else if (activity.type === "expense") {
                    return (
                      <div key={`expense-${index}`} className="flex items-start gap-3">
                        <div className="rounded-full bg-primary/10 p-2">
                          <DollarSign className="h-4 w-4 text-primary" />
                        </div>
                        <div className="grid gap-1 flex-1">
                          <p className="text-sm font-medium break-words">
                            {activity.expense.paidBy} added {activity.expense.description} expense
                          </p>
                          <p className="text-xs text-muted-foreground">{formatRelativeTime(activity.date)}</p>
                        </div>
                      </div>
                    )
                  } else if (activity.type === "event") {
                    return (
                      <div key={`event-${index}`} className="flex items-start gap-3">
                        <div className="rounded-full bg-primary/10 p-2">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div className="grid gap-1 flex-1">
                          <p className="text-sm font-medium break-words">
                            {activity.event.attendees[0]} created {activity.event.title} event
                          </p>
                          <p className="text-xs text-muted-foreground">{formatRelativeTime(activity.date)}</p>
                        </div>
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <UpcomingEvents />
      </div>
    </div>
  )
}

