// User types
export interface User {
  id: string
  name: string
  email: string
  avatar?: string
}

export interface UserProfile {
  id: string
  phoneNumber?: string
  createdAt: Date
  updatedAt: Date
}

// Team types
export interface TeamMember {
  id: string
  name: string
  email: string
  role: "owner" | "admin" | "member"
  joinedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface TeamSettings {
  currency: {
    primary: string
    supported: string[]
    lastUpdate: Date
  }
  theme: "light" | "dark" | "system"
  notifications: {
    email: boolean
    push: boolean
  }
  contentManagement: {
    expenses: "admin" | "everyone"
    grocery: "admin" | "everyone"
    events: "admin" | "everyone"
  }
}

export interface Team {
  id: string
  name: string
  description?: string
  ownerId: string
  members: TeamMember[]
  settings: TeamSettings
  createdAt: Date
  updatedAt: Date
}

export interface TeamInvitation {
  id: string
  teamId: string
  email: string
  name?: string
  role: "admin" | "member"
  createdAt: Date
  expiresAt?: Date
  accepted?: boolean
  invitedBy: string
}

// Grocery list types
export interface GroceryItem {
  id: string
  name: string
  quantity: number
  unit: string
  completed: boolean
  notes?: string
  addedBy: string
  createdAt: Date
  updatedAt: Date
}

export interface GroceryList {
  id: string
  name: string
  items: GroceryItem[]
  createdAt: Date
  updatedAt: Date
  teamId: string
}

// Expense types
export interface ExpenseShare {
  memberId: string
  memberName: string
  share: number
  amount: number
}

export interface Expense {
  id: string
  description: string
  amount: number
  currency: string
  primaryCurrency: string
  primaryAmount: number
  category: string
  date: string
  paidById: string
  paidBy: string
  isShared: boolean
  shares: ExpenseShare[]
  teamId: string
  createdAt: Date
  updatedAt: Date
}

// Calendar types
export interface CalendarEvent {
  id: string
  title: string
  description?: string
  date: Date
  time: string
  attendees: string[]
  attendeeIds: string[]
  createdAt: Date
  updatedAt: Date
  teamId: string
  addedById: string
}

export interface ChatChannel {
  id: string
  teamId: string
  name: string
  description?: string
  createdAt: Date
  createdBy: string
  isPrivate: boolean
  members: ChatMember[]
  lastMessageAt?: Date
}

export interface ChatMessage {
  id: string
  channelId: string
  content: string
  createdAt: Date
  createdBy: string
  attachments?: string[]
  mentions?: string[]
  reactions?: Record<string, string[]> // userId -> emoji
}

export interface ChatMember {
  id: string
  channelId: string
  userId: string
  role: 'admin' | 'member'
  joinedAt: Date
  lastReadAt?: Date
}

// Currency types
export interface Currency {
  code: string
  symbol: string
  name: string
  exchangeRate?: number // Exchange rate to primary currency
}

