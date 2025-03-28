"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarEvent } from "@/lib/types"
import { getCalendarEvents } from "@/lib/db"
import { useTeam } from "@/contexts/team-context"
import { Loader2 } from "lucide-react"

export function UpcomingEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { currentTeam, currentMember } = useTeam()

  useEffect(() => {
    const loadEvents = async () => {
      if (!currentTeam || !currentMember) {
        setIsLoading(false)
        return
      }

      try {
        const teamEvents = await getCalendarEvents(currentTeam.id)
        // Filter events to only include those where the current user is an attendee
        const userEvents = teamEvents.filter(event => 
          event.attendeeIds.includes(currentMember.id)
        )
        setEvents(userEvents)
      } catch (error) {
        console.error("Error loading upcoming events:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadEvents()
  }, [currentTeam, currentMember])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!currentTeam || !currentMember) {
    return null
  }

  // Get the next 3 upcoming events
  const upcomingEvents = events
    .filter(event => event.date >= new Date())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 3)

  if (upcomingEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No upcoming events</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Upcoming Events</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {upcomingEvents.map((event) => (
            <div key={event.id} className="flex items-start space-x-3 sm:space-x-4 rounded-lg border p-3">
              <div className="flex-shrink-0 rounded-md border p-2 text-center w-12 sm:w-14">
                <div className="text-xs sm:text-sm font-medium">
                  {event.date.toLocaleDateString("en-US", { month: "short" })}
                </div>
                <div className="text-lg sm:text-xl font-bold">{event.date.getDate()}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium text-sm sm:text-base truncate">{event.title}</h3>
                  <Badge variant="outline" className="text-xs sm:text-sm whitespace-nowrap">{event.time}</Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {event.attendees.map((attendee) => (
                    <Badge key={attendee} variant="secondary" className="text-xs">
                      {attendee}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
} 