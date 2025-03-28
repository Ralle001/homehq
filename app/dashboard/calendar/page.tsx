"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Plus, Loader2, Pencil, Trash2, Check, ChevronsUpDown, X, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatDate, generateICSFile } from "@/lib/utils"
import type { CalendarEvent, TeamMember } from "@/lib/types"
import { useTeam } from "@/contexts/team-context"
import { getCalendarEvents, createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from "@/lib/db"
import { toast } from "sonner"
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
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { DayContentProps } from "react-day-picker"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { canManageContent } from "@/lib/permissions"

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isLoading, setIsLoading] = useState(true)
  const [showAddEventDialog, setShowAddEventDialog] = useState(false)
  const [isAddingEvent, setIsAddingEvent] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [isDeletingEvent, setIsDeletingEvent] = useState(false)
  const [isUpdatingEvent, setIsUpdatingEvent] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState<TeamMember[]>([])
  const [open, setOpen] = useState(false)

  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    time: "12:00",
    date: new Date().toISOString().split("T")[0], // Format as YYYY-MM-DD
  })

  const { currentTeam, currentMember } = useTeam()
  const { user } = useAuth()

  // Load calendar events when team changes
  useEffect(() => {
    const loadCalendarEvents = async () => {
      if (!currentTeam) {
        console.log("No current team, clearing events")
        setEvents([])
        setIsLoading(false)
        return
      }

      console.log(`Loading calendar events for team ${currentTeam.id}...`)
      setIsLoading(true)

      try {
        console.log(`Calling getCalendarEvents for team ${currentTeam.id}`)
        const teamEvents = await getCalendarEvents(currentTeam.id)
        console.log(`Received ${teamEvents.length} events for team ${currentTeam.id}`, teamEvents)

        setEvents(teamEvents)
      } catch (error) {
        console.error(`Error loading calendar events for team ${currentTeam.id}:`, error)
        toast.error("Failed to load calendar events. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    loadCalendarEvents()
  }, [currentTeam])

  // Update the handleAddEvent function
  const handleAddEvent = async () => {
    if (!currentTeam || !currentMember || !user) {
      toast.error("You must be part of a team to add events.")
      return
    }

    if (!newEvent.title.trim()) {
      toast.error("Event title is required.")
      return
    }

    // Create a new date object and set it to the selected date
    const eventDate = new Date(newEvent.date)
    // Set the time to noon to avoid timezone issues
    eventDate.setHours(12, 0, 0, 0)
    const [hours, minutes] = newEvent.time.split(":").map(Number)
    eventDate.setHours(hours, minutes)

    const eventData = {
      title: newEvent.title,
      description: newEvent.description,
      date: eventDate,
      time: newEvent.time,
      attendees: [currentMember.name, ...selectedMembers.map(m => m.name)],
      attendeeIds: [user.email || "", ...selectedMembers.map(m => m.email)],
    }

    try {
      const addedEvent = await createCalendarEvent(currentTeam.id, eventData, currentMember.id)
      setEvents((prev) => [...prev, addedEvent])
      toast.success("Event added successfully.")
      setNewEvent({
        title: "",
        description: "",
        date: new Date().toISOString().split("T")[0],
        time: "12:00",
      })
      setSelectedMembers([])
      setShowAddEventDialog(false)
    } catch (error) {
      console.error("Error adding event:", error)
      toast.error("Failed to add event. Please try again.")
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!currentTeam || !currentMember || !user) {
      toast.error("You must be part of a team to delete events.")
      return
    }

    // Get the event to delete
    const eventToDelete = events.find(e => e.id === eventId)
    if (!eventToDelete) {
      toast.error("Event not found.")
      return
    }

    // Check if user has permission to delete events
    if (!canManageContent(currentTeam, currentMember, "events", eventToDelete.addedById)) {
      toast.error("You don't have permission to delete this event.")
      return
    }

    try {
      await deleteCalendarEvent(eventId)
      setEvents((prev) => prev.filter((event) => event.id !== eventId))
      toast.success("Event deleted successfully.")
    } catch (error) {
      console.error("Error deleting event:", error)
      toast.error("Failed to delete event. Please try again.")
    }
  }

  // Update the handleUpdateEvent function
  const handleUpdateEvent = async () => {
    if (!currentTeam || !currentMember || !user) {
      toast.error("You must be part of a team to update events.")
      return
    }

    if (!editingEvent) {
      toast.error("No event selected for editing.")
      return
    }

    // Check if user has permission to update events
    if (!canManageContent(currentTeam, currentMember, "events", editingEvent.addedById)) {
      toast.error("You don't have permission to update this event.")
      return
    }

    // Create a new date object and set it to the selected date
    const eventDate = new Date(newEvent.date)
    // Set the time to noon to avoid timezone issues
    eventDate.setHours(12, 0, 0, 0)
    const [hours, minutes] = newEvent.time.split(":").map(Number)
    eventDate.setHours(hours, minutes)

    const eventData = {
      title: newEvent.title,
      description: newEvent.description,
      date: eventDate,
      time: newEvent.time,
      attendees: [currentMember.name, ...selectedMembers.map(m => m.name)],
      attendeeIds: [user.email || "", ...selectedMembers.map(m => m.email)],
    }

    try {
      await updateCalendarEvent(editingEvent.id, eventData)
      setEvents((prev) =>
        prev.map((event) => (event.id === editingEvent.id ? { ...event, ...eventData } : event))
      )
      toast.success("Event updated successfully.")
      setEditingEvent(null)
      setSelectedMembers([])
      setShowAddEventDialog(false)
    } catch (error) {
      console.error("Error updating event:", error)
      toast.error("Failed to update event. Please try again.")
    }
  }

  // Add this function to handle member selection
  const handleMemberSelect = (member: TeamMember) => {
    setSelectedMembers((prev) => {
      const isSelected = prev.some((m) => m.id === member.id)
      if (isSelected) {
        return prev.filter((m) => m.id !== member.id)
      } else {
        return [...prev, member]
      }
    })
  }

  // Get events for the selected date
  const selectedDateEvents = events.filter(
    (event) =>
      selectedDate &&
      event.date.getDate() === selectedDate.getDate() &&
      event.date.getMonth() === selectedDate.getMonth() &&
      event.date.getFullYear() === selectedDate.getFullYear(),
  )

  // Function to check if a date has events
  const hasEvents = (day: Date | undefined) => {
    if (!day) return false

    return events.some(
      (event) =>
        event.date.getDate() === day.getDate() &&
        event.date.getMonth() === day.getMonth() &&
        event.date.getFullYear() === day.getFullYear(),
    )
  }

  // Add this function before the return statement
  const handleExportCalendar = () => {
    if (!currentTeam || events.length === 0) {
      toast.error("No events to export.")
      return
    }

    // Since we've checked currentTeam is not null and Team interface requires name to be string
    const teamName = (currentTeam.name || "team") as string
    const icsContent = generateICSFile(events, teamName)
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `${teamName.toLowerCase().replace(/\s+/g, "-")}-calendar.ics`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    toast.success("Calendar exported successfully.")
  }

  // Add this function before the return statement
  const handleExportEvent = (event: CalendarEvent) => {
    if (!currentTeam) {
      toast.error("No team selected.")
      return
    }

    const teamName = (currentTeam.name || "team") as string
    const icsContent = generateICSFile(event, teamName)
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `${event.title.toLowerCase().replace(/\s+/g, "-")}-${formatDate(event.date).toLowerCase().replace(/\s+/g, "-")}.ics`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    toast.success("Event exported successfully.")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading calendar events...</p>
        </div>
      </div>
    )
  }

  if (!currentTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">No Team Selected</h2>
          <p className="text-muted-foreground mb-4">Please select or create a team to manage calendar events.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground">Schedule and manage your team events</p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Summary Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg sm:text-xl">Calendar Summary</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-muted-foreground"
            >
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {events.filter(event => event.date >= new Date()).length} upcoming events
            </div>
            <p className="text-xs text-muted-foreground">
              {events.filter(event => {
                const today = new Date()
                const thirtyDaysFromNow = new Date()
                thirtyDaysFromNow.setDate(today.getDate() + 30)
                return event.date >= today && event.date <= thirtyDaysFromNow
              }).length} events in the next 30 days
            </p>
          </CardContent>
        </Card>

        {/* Calendar Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Calendar</CardTitle>
                <CardDescription>View and manage your family events</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportCalendar}
                  disabled={events.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Calendar
                </Button>
                <Dialog open={showAddEventDialog} onOpenChange={setShowAddEventDialog}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setNewEvent({
                          title: "",
                          description: "",
                          time: "12:00",
                          date: selectedDate ? selectedDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
                        })
                        setSelectedMembers([])
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Event
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center relative calendar-wrapper">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    // Create a new date object to avoid timezone issues
                    const newDate = new Date(date)
                    newDate.setHours(12, 0, 0, 0)
                    setSelectedDate(newDate)
                  }
                }}
                className="rounded-md border shadow-sm bg-background"
                components={{
                  DayContent: ({ date }: DayContentProps) => {
                    const hasEventsOnDay = hasEvents(date)
                    return (
                      <div className="flex flex-col items-center justify-center w-full h-full">
                        <div className="text-sm">{date?.getDate()}</div>
                        {hasEventsOnDay && <div className="w-1 h-1 bg-primary rounded-full mt-1" />}
                      </div>
                    )
                  },
                }}
                classNames={{
                  day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_today: "bg-accent text-accent-foreground",
                  day_outside: "text-muted-foreground opacity-50",
                  day_disabled: "text-muted-foreground opacity-50",
                  day_hidden: "invisible",
                  months: "bg-background",
                  month: "bg-background",
                  table: "calendar-table bg-background",
                  head_row: "calendar-head-row bg-background",
                  row: "calendar-row bg-background",
                  cell: "calendar-cell bg-background",
                }}
                showOutsideDays={true}
              />
            </div>
          </CardContent>
        </Card>

        {/* Events Card */}
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>View and manage your events</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedDateEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <p className="text-muted-foreground">No events scheduled for this day</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setNewEvent({
                      title: "",
                      description: "",
                      time: "12:00",
                      date: selectedDate ? selectedDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
                    })
                    setSelectedMembers([])
                    setShowAddEventDialog(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Event
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedDateEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{event.title}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{event.time}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleExportEvent(event)}
                          title="Export event"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingEvent(event)
                            setNewEvent({
                              title: event.title,
                              description: event.description || "",
                              time: event.time,
                              date: event.date.toISOString().split("T")[0],
                            })
                            const selectedTeamMembers = currentTeam?.members.filter(member => 
                              event.attendeeIds.includes(member.email)
                            ) || []
                            setSelectedMembers(selectedTeamMembers)
                            setShowAddEventDialog(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteEvent(event.id)}
                          disabled={isDeletingEvent}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Attendees:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {event.attendeeIds.map((email, index) => {
                          const member = currentTeam?.members.find(m => m.email === email)
                          return (
                            <Badge key={email} variant="secondary" className="text-xs">
                              {member?.name} ({member?.email})
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddEventDialog} onOpenChange={setShowAddEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Edit Event" : "Add New Event"}</DialogTitle>
            <DialogDescription>
              {editingEvent ? "Update the details of your event." : "Enter the details of your event."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title</Label>
              <Input
                id="title"
                placeholder="Family Dinner"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Details about the event"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Team Members</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                  >
                    {selectedMembers.length > 0
                      ? `${selectedMembers.length} member${selectedMembers.length === 1 ? "" : "s"} selected`
                      : "Select team members..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search members..." />
                    <CommandEmpty>No members found.</CommandEmpty>
                    <CommandGroup>
                      {currentTeam?.members
                        .filter((member) => member.id !== currentMember?.id)
                        .map((member) => (
                          <CommandItem
                            key={member.id}
                            onSelect={() => handleMemberSelect(member)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedMembers.some((m) => m.id === member.id)
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {member.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedMembers.map((member) => (
                    <Badge
                      key={member.id}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {member.name}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => handleMemberSelect(member)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddEventDialog(false)
                setEditingEvent(null)
                setSelectedMembers([])
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingEvent ? handleUpdateEvent : handleAddEvent}
              disabled={isAddingEvent || isUpdatingEvent}
            >
              {isAddingEvent || isUpdatingEvent ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingEvent ? "Updating..." : "Adding..."}
                </>
              ) : (
                editingEvent ? "Update Event" : "Add Event"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

