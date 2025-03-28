import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Expense, ExpenseShare, CalendarEvent } from "@/lib/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format date to a readable string
export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

// Format time to a readable string
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(date)
}

// Format date to relative time (e.g., "2 days ago")
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return "just now"
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`
  }

  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths > 1 ? "s" : ""} ago`
  }

  const diffInYears = Math.floor(diffInMonths / 12)
  return `${diffInYears} year${diffInYears > 1 ? "s" : ""} ago`
}

// Format currency
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount)
}

// Format quantity and unit
export function formatQuantity(quantity: number, unit: string): string {
  if (unit === "unit") {
    return quantity === 1 ? `${quantity} unit` : `${quantity} units`
  }
  return `${quantity} ${unit}`
}

// Generate a unique ID
export function generateId(prefix: string = ""): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export interface Debt {
  from: string
  to: string
  amount: number
}

export function calculateDebts(expenses: Expense[], currentTeam: any): Debt[] {
  if (!currentTeam || !expenses.length) return []

  const debts: Debt[] = []

  expenses.forEach(expense => {
    if (expense.isShared && expense.shares) {
      expense.shares.forEach((share: ExpenseShare) => {
        if (share.memberId !== expense.paidById && share.amount > 0) {
          debts.push({
            from: share.memberId,
            to: expense.paidById,
            amount: share.amount
          })
        }
      })
    }
  })

  return debts
}

export function optimizeDebts(debts: Debt[]): Debt[] {
  const balances: Record<string, number> = {}
  
  debts.forEach(debt => {
    balances[debt.from] = (balances[debt.from] || 0) - debt.amount
    balances[debt.to] = (balances[debt.to] || 0) + debt.amount
  })

  const people = Object.entries(balances)
    .map(([person, balance]) => ({ person, balance }))
    .filter(p => p.balance !== 0)
    .sort((a, b) => a.balance - b.balance)

  const optimizedTransactions: Debt[] = []
  let i = 0
  let j = people.length - 1

  while (i < j) {
    const debtor = people[i]
    const creditor = people[j]
    
    if (Math.abs(debtor.balance) < Math.abs(creditor.balance)) {
      optimizedTransactions.push({
        from: debtor.person,
        to: creditor.person,
        amount: Math.abs(debtor.balance)
      })
      creditor.balance += debtor.balance
      debtor.balance = 0
      i++
    } else if (Math.abs(debtor.balance) > Math.abs(creditor.balance)) {
      optimizedTransactions.push({
        from: debtor.person,
        to: creditor.person,
        amount: Math.abs(creditor.balance)
      })
      debtor.balance += creditor.balance
      creditor.balance = 0
      j--
    } else {
      optimizedTransactions.push({
        from: debtor.person,
        to: creditor.person,
        amount: Math.abs(debtor.balance)
      })
      debtor.balance = 0
      creditor.balance = 0
      i++
      j--
    }
  }

  return optimizedTransactions
}

export function filterExpenses(expenses: Expense[], categoryFilter: string, activeTab: string, userId: string) {
  return expenses.filter((expense) => {
    if (categoryFilter !== "all" && expense.category !== categoryFilter) {
      return false
    }

    if (activeTab === userId) {
      return expense.paidById === userId
    } else if (activeTab !== "all") {
      return expense.paidById === activeTab
    }

    return true
  })
}

export function calculateExpensesByCategory(expenses: Expense[], currentTeam: any): Record<string, number> {
  const expensesByCategory: Record<string, number> = {}
  
  expenses.forEach((expense) => {
    if (!expensesByCategory[expense.category]) {
      expensesByCategory[expense.category] = 0
    }
    if (!currentTeam) return
    expensesByCategory[expense.category] += expense.currency === currentTeam.settings.currency.primary 
      ? expense.amount 
      : expense.primaryAmount
  })

  return expensesByCategory
}

/**
 * Generates an ICS file content from calendar events
 * @param events Single event or array of calendar events
 * @param teamName Name of the team for the calendar
 * @returns ICS file content as a string
 */
export function generateICSFile(events: CalendarEvent | CalendarEvent[], teamName: string): string {
  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    
    return `${year}${month}${day}T${hours}${minutes}${seconds}`
  }

  const generateEventContent = (event: CalendarEvent) => {
    // Create a new date object for the event's start time
    const startDate = new Date(event.date)
    const [hours, minutes] = event.time.split(":").map(Number)
    startDate.setHours(hours, minutes, 0, 0)

    // Create an end date 1 hour after the start time
    const endDate = new Date(startDate)
    endDate.setHours(endDate.getHours() + 1)

    return [
      "BEGIN:VEVENT",
      `UID:${event.id}@${teamName.toLowerCase().replace(/\s+/g, "-")}`,
      `SUMMARY:${event.title}`,
      event.description ? `DESCRIPTION:${event.description}` : "",
      `DTSTART;TZID=America/Los_Angeles:${formatDate(startDate)}`,
      `DTEND;TZID=America/Los_Angeles:${formatDate(endDate)}`,
      ...event.attendeeIds.map(id => `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION:mailto:${id}`),
      "END:VEVENT"
    ].filter(Boolean).join("\n")
  }

  const eventsArray = Array.isArray(events) ? events : [events]
  const icsEvents = eventsArray.map(generateEventContent).join("\n")

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${teamName}//Calendar//EN`,
    "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE",
    "TZID:America/Los_Angeles",
    "BEGIN:STANDARD",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "TZOFFSETFROM:-0700",
    "TZOFFSETTO:-0800",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "TZOFFSETFROM:-0800",
    "TZOFFSETTO:-0700",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    icsEvents,
    "END:VCALENDAR"
  ].join("\n")
}

