import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  setDoc,
  limit as firestoreLimit,
  orderBy,
  arrayUnion,
} from "firebase/firestore"
import { db } from "./firebase"
import type { Team, TeamMember, TeamInvitation, GroceryList, GroceryItem, Expense, CalendarEvent } from "./types"

// Add this function at the beginning of the file to check if a collection exists
export async function collectionExists(collectionName: string): Promise<boolean> {
  try {
    const collectionRef = collection(db, collectionName)
    const snapshot = await getDocs(query(collectionRef, firestoreLimit(1)))
    return !snapshot.empty
  } catch (error) {
    console.error(`Error checking if collection ${collectionName} exists:`, error)
    return false
  }
}

// Helper function to convert Firestore timestamps to Date objects
const convertTimestamps = (obj: any): any => {
  if (!obj) return obj

  // If it's an array, convert each element
  if (Array.isArray(obj)) {
    return obj.map((item: any) => convertTimestamps(item))
  }

  // If it's not an object, return as is
  if (typeof obj !== 'object') {
    return obj
  }

  const result = { ...obj }
  
  // Special handling for members array to preserve member data
  if (result.members && Array.isArray(result.members)) {
    result.members = result.members.map((member: any) => ({
      ...member,
      joinedAt: member.joinedAt instanceof Timestamp ? member.joinedAt.toDate() : member.joinedAt
    }))
  }

  // Convert other timestamps
  for (const key in result) {
    if (key !== 'members' && result[key] instanceof Timestamp) {
      result[key] = result[key].toDate()
    } else if (key !== 'members' && result[key] && typeof result[key] === 'object') {
      result[key] = convertTimestamps(result[key])
    }
  }

  return result
}

// Team/Group related functions
// Update the getTeams function to ensure members is always an array
export async function getTeams() {
  try {
    const teamsSnapshot = await getDocs(collection(db, "teams"))
    const teams: Team[] = []

    teamsSnapshot.forEach((doc) => {
      const data = doc.data()
      teams.push(
        convertTimestamps({
          id: doc.id,
          ...data,
          members: Array.isArray(data.members) ? data.members : [],
        }) as Team,
      )
    })

    return teams
  } catch (error) {
    console.error("Error fetching teams:", error)
    return []
  }
}

// Update the getTeam function to ensure members is always an array
export async function getTeam(teamId: string): Promise<Team | null> {
  try {
    const teamRef = doc(db, "teams", teamId)
    const teamDoc = await getDoc(teamRef)

    if (!teamDoc.exists()) {
      return null
    }

    const data = teamDoc.data()
    return convertTimestamps({
      id: teamDoc.id,
      ...data,
    }) as Team
  } catch (error) {
    console.error(`Error fetching team ${teamId}:`, error)
    return null
  }
}

export async function createTeam(team: Omit<Team, "id" | "createdAt" | "updatedAt">): Promise<Team> {
  try {
    const now = serverTimestamp()
    const teamData = {
      ...team,
      createdAt: now,
      updatedAt: now,
    }

    const teamRef = await addDoc(collection(db, "teams"), teamData)
    const newTeam = {
      id: teamRef.id,
      ...team,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    return newTeam
  } catch (error) {
    console.error("Error creating team:", error)
    throw error
  }
}

export async function updateTeam(teamId: string, updates: Partial<Team>): Promise<Team | null> {
  try {
    const teamRef = doc(db, "teams", teamId)
    const teamDoc = await getDoc(teamRef)

    if (!teamDoc.exists()) {
      return null
    }

    const updateData = {
      ...updates,
      updatedAt: serverTimestamp(),
    }

    await updateDoc(teamRef, updateData)

    const updatedTeamDoc = await getDoc(teamRef)
    return convertTimestamps({
      id: updatedTeamDoc.id,
      ...updatedTeamDoc.data(),
    }) as Team
  } catch (error) {
    console.error(`Error updating team ${teamId}:`, error)
    throw error
  }
}

export async function deleteTeam(teamId: string) {
  try {
    await deleteDoc(doc(db, "teams", teamId))
    return true
  } catch (error) {
    console.error(`Error deleting team ${teamId}:`, error)
    throw error
  }
}

// Update the getTeamsByUserId function to handle empty collections better
export async function getTeamsByUserId(userId: string) {
  try {
    console.log(`Fetching teams for user ID: ${userId}`)

    // Get all teams first (we'll filter them in JavaScript)
    const teamsSnapshot = await getDocs(collection(db, "teams"))

    // If there are no teams at all, return an empty array
    if (teamsSnapshot.empty) {
      console.log("No teams found in the database")
      return []
    }

    const teams: Team[] = []

    teamsSnapshot.forEach((doc) => {
      const data = doc.data()
      console.log(`Team ${doc.id} raw data:`, JSON.stringify(data, null, 2))

      // Ensure members is an array
      const members = Array.isArray(data.members) ? data.members : []
      console.log(`Team ${doc.id} members array:`, JSON.stringify(members, null, 2))

      // Check if this user is a member of this team
      const isMember = members.some((member: any) => {
        console.log(`Comparing member ID ${member.id} with user ID ${userId}`)
        return member.id === userId
      })

      if (isMember) {
        console.log(`User ${userId} is a member of team ${doc.id}`)
        // Convert timestamps and ensure members is an array
        const team = convertTimestamps({
          id: doc.id,
          ...data,
          members: members,
        }) as Team

        // Double-check that members is an array after conversion
        team.members = Array.isArray(team.members) ? team.members : []
        console.log(`Team ${doc.id} after conversion:`, JSON.stringify(team, null, 2))

        teams.push(team)
      } else {
        console.log(`User ${userId} is not a member of team ${doc.id}`)
        console.log(`Member IDs in team:`, members.map(m => m.id))
        console.log(`Looking for user ID:`, userId)
      }
    })

    console.log(`Found ${teams.length} teams for user ${userId}`)
    console.log(`Final teams array:`, JSON.stringify(teams, null, 2))
    return teams
  } catch (error) {
    console.error(`Error fetching teams for user ${userId}:`, error)
    return []
  }
}

// Team member functions
export async function addTeamMember(teamId: string, member: TeamMember) {
  try {
    const teamRef = doc(db, "teams", teamId)
    const teamDoc = await getDoc(teamRef)

    if (!teamDoc.exists()) {
      throw new Error(`Team ${teamId} not found`)
    }

    const teamData = teamDoc.data()
    const members = [
      ...(teamData.members || []),
      {
        ...member,
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
    ]

    await updateDoc(teamRef, { 
      members,
      updatedAt: serverTimestamp()
    })

    return getTeam(teamId)
  } catch (error) {
    console.error(`Error adding member to team ${teamId}:`, error)
    throw error
  }
}

export async function removeTeamMember(teamId: string, userId: string) {
  try {
    const teamRef = doc(db, "teams", teamId)
    const teamDoc = await getDoc(teamRef)

    if (!teamDoc.exists()) {
      throw new Error(`Team ${teamId} not found`)
    }

    const teamData = teamDoc.data()
    const members = (teamData.members || []).filter((member: TeamMember) => member.id !== userId)

    await updateDoc(teamRef, { members })

    return getTeam(teamId)
  } catch (error) {
    console.error(`Error removing member from team ${teamId}:`, error)
    throw error
  }
}

export async function updateTeamMemberRole(teamId: string, memberId: string, newRole: "owner" | "admin" | "member") {
  try {
    const teamRef = doc(db, "teams", teamId)
    const teamDoc = await getDoc(teamRef)

    if (!teamDoc.exists()) {
      throw new Error(`Team ${teamId} not found`)
    }

    const teamData = teamDoc.data()
    const members = (teamData.members || []).map((member: TeamMember) => {
      if (member.id === memberId) {
        return {
          ...member,
          role: newRole,
        }
      }
      return member
    })

    await updateDoc(teamRef, { 
      members,
      updatedAt: serverTimestamp()
    })

    return getTeam(teamId)
  } catch (error) {
    console.error(`Error updating member role in team ${teamId}:`, error)
    throw error
  }
}

// Invitation functions
// Add this interface for user data
interface UserData {
  id: string
  name: string
  email: string
  createdAt: Date
  updatedAt: Date
}

// Add this function to check if a user exists by email
export async function getUserByEmail(email: string): Promise<UserData | null> {
  try {
    const usersRef = collection(db, "users")
    const q = query(usersRef, where("email", "==", email))
    const querySnapshot = await getDocs(q)
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0]
      const data = userDoc.data()
      return {
        id: userDoc.id,
        name: data.name,
        email: data.email,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
      }
    }
    return null
  } catch (error) {
    console.error(`Error fetching user by email ${email}:`, error)
    return null
  }
}

// Update the createInvitation function to handle existing users
export async function createInvitation(invitation: Omit<TeamInvitation, "id" | "createdAt">) {
  try {
    // Check if user already exists
    const existingUser = await getUserByEmail(invitation.email)
    
    if (existingUser) {
      // If user exists, add them directly to the team
      await addTeamMember(invitation.teamId, {
        id: existingUser.id,
        name: invitation.name || existingUser.name || "New Member",
        email: invitation.email,
        role: invitation.role,
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      // Return a special response indicating direct addition
      return {
        id: "direct-add",
        createdAt: new Date(),
        ...invitation,
        accepted: true,
        directAdd: true,
      }
    }

    // If user doesn't exist, create invitation as before
    const newInvitationRef = await addDoc(collection(db, "invitations"), {
      ...invitation,
      accepted: false,
      createdAt: serverTimestamp(),
    })

    const newInvitation = {
      id: newInvitationRef.id,
      createdAt: new Date(),
      ...invitation,
      accepted: false,
    }

    return newInvitation
  } catch (error) {
    console.error("Error creating invitation:", error)
    throw error
  }
}

export async function getInvitationsByEmail(email: string) {
  try {
    const q = query(collection(db, "invitations"), where("email", "==", email), where("accepted", "==", false))

    const invitationsSnapshot = await getDocs(q)
    const invitations: TeamInvitation[] = []

    invitationsSnapshot.forEach((doc) => {
      invitations.push(
        convertTimestamps({
          id: doc.id,
          ...doc.data(),
        }) as TeamInvitation,
      )
    })

    return invitations
  } catch (error) {
    console.error(`Error fetching invitations for ${email}:`, error)
    return []
  }
}

export async function acceptInvitation(invitationId: string, userId: string) {
  try {
    const invitationRef = doc(db, "invitations", invitationId)
    const invitationDoc = await getDoc(invitationRef)

    if (!invitationDoc.exists()) {
      throw new Error(`Invitation ${invitationId} not found`)
    }

    const invitation = invitationDoc.data() as TeamInvitation

    // Update invitation to accepted
    await updateDoc(invitationRef, { accepted: true })

    // Add user to team
    await addTeamMember(invitation.teamId, {
      id: userId,
      name: invitation.name || "New Member",
      email: invitation.email,
      role: "member",
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    })

    return true
  } catch (error) {
    console.error(`Error accepting invitation ${invitationId}:`, error)
    throw error
  }
}

// Grocery list functions
// Update the getGroceryLists function to ensure items is always an array
export async function getGroceryLists(teamId: string) {
  try {
    // Check if the collection exists first
    const exists = await collectionExists("groceryLists")
    if (!exists) {
      console.log("groceryLists collection doesn't exist yet")
      return []
    }

    const q = query(collection(db, "groceryLists"), where("teamId", "==", teamId))

    const listsSnapshot = await getDocs(q)
    const lists: GroceryList[] = []

    listsSnapshot.forEach((doc) => {
      const data = doc.data()
      lists.push(
        convertTimestamps({
          id: doc.id,
          ...data,
          items: Array.isArray(data.items) ? data.items : [],
        }) as GroceryList,
      )
    })

    return lists
  } catch (error) {
    console.error(`Error fetching grocery lists for team ${teamId}:`, error)
    return []
  }
}

// Update the createGroceryList function to ensure items is always an array
export async function createGroceryList(
  teamId: string,
  list: Omit<GroceryList, "id" | "createdAt" | "updatedAt" | "teamId">,
) {
  try {
    const now = serverTimestamp()

    // Ensure items is an array
    const items = Array.isArray(list.items) ? list.items : []

    const newListRef = await addDoc(collection(db, "groceryLists"), {
      ...list,
      items: items,
      teamId,
      createdAt: now,
      updatedAt: now,
    })

    const newList = {
      id: newListRef.id,
      ...list,
      items: items,
      teamId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    return newList
  } catch (error) {
    console.error(`Error creating grocery list for team ${teamId}:`, error)
    throw error
  }
}

// Update the updateGroceryList function to ensure items is always an array
export async function updateGroceryList(listId: string, updates: Partial<GroceryList>) {
  try {
    const listRef = doc(db, "groceryLists", listId)

    // If updates contains items, ensure it's an array
    const updatesWithArrayItems = { ...updates }
    if ("items" in updatesWithArrayItems) {
      updatesWithArrayItems.items = Array.isArray(updatesWithArrayItems.items) ? updatesWithArrayItems.items : []
    }

    await updateDoc(listRef, {
      ...updatesWithArrayItems,
      updatedAt: serverTimestamp(),
    })

    const updatedListDoc = await getDoc(listRef)
    const data = updatedListDoc.data()

    return convertTimestamps({
      id: updatedListDoc.id,
      ...data,
      items: Array.isArray(data?.items) ? data.items : [],
    }) as GroceryList
  } catch (error) {
    console.error(`Error updating grocery list ${listId}:`, error)
    throw error
  }
}

export async function addGroceryItem(listId: string, item: Omit<GroceryItem, "id" | "createdAt" | "updatedAt">) {
  try {
    const listRef = doc(db, "groceryLists", listId)
    const listDoc = await getDoc(listRef)

    if (!listDoc.exists()) {
      throw new Error(`Grocery list ${listId} not found`)
    }

    const listData = listDoc.data() as GroceryList
    const now = new Date()

    const newItem: GroceryItem = {
      id: `item-${Date.now()}`,
      ...item,
      createdAt: now,
      updatedAt: now,
    }

    const items = [...(listData.items || []), newItem]

    await updateDoc(listRef, {
      items,
      updatedAt: serverTimestamp(),
    })

    return newItem
  } catch (error) {
    console.error(`Error adding item to grocery list ${listId}:`, error)
    throw error
  }
}

// Expense functions
// Update the getExpenses function similarly
export async function getExpenses(teamId: string) {
  try {
    console.log(`Fetching expenses for team ${teamId}...`)

    // Check if the collection exists first
    const exists = await collectionExists("expenses")
    if (!exists) {
      console.log("expenses collection doesn't exist yet")
      return []
    }

    // Create the query
    const q = query(collection(db, "expenses"), where("teamId", "==", teamId))
    console.log(`Created query for expenses with teamId: ${teamId}`)

    // Execute the query
    const expensesSnapshot = await getDocs(q)

    // Log the results
    console.log(`Query returned ${expensesSnapshot.size} expenses`)

    // If there are no expenses for this team, return an empty array
    if (expensesSnapshot.empty) {
      console.log(`No expenses found for team ${teamId}`)
      return []
    }

    const expenses: Expense[] = []

    // Process each document
    expensesSnapshot.forEach((doc) => {
      const data = doc.data()
      console.log(`Processing expense document: ${doc.id}`, data)

      // Convert timestamps and add to the array
      const expense = convertTimestamps({
        id: doc.id,
        ...data,
      }) as Expense

      expenses.push(expense)
    })

    console.log(`Returning ${expenses.length} expenses for team ${teamId}`)
    return expenses
  } catch (error) {
    console.error(`Error fetching expenses for team ${teamId}:`, error)
    return []
  }
}

// Update the createExpense function to ensure teamId is correctly set
export async function createExpense(
  teamId: string,
  expense: Omit<Expense, "id" | "createdAt" | "updatedAt" | "teamId">,
) {
  try {
    console.log(`Creating expense for team ${teamId}...`, expense)

    // Ensure the expenses collection exists
    const expensesCollection = collection(db, "expenses")

    const now = serverTimestamp()

    // Prepare the expense data with explicit teamId
    const { shares, ...expenseWithoutShares } = expense
    const expenseData = {
      ...expenseWithoutShares,
      teamId: teamId, // Explicitly set the teamId
      createdAt: now,
      updatedAt: now,
      // Only include shares if the expense is shared
      ...(expense.isShared ? { shares } : {}),
      // Always include currency fields
      currency: expense.currency,
      primaryAmount: expense.primaryAmount,
      primaryCurrency: expense.primaryCurrency,
    }

    console.log("Expense data to be added:", expenseData)

    // Add the expense to Firestore
    const newExpenseRef = await addDoc(expensesCollection, expenseData)
    const newExpenseId = newExpenseRef.id

    console.log(`Created expense with ID: ${newExpenseId} for team ${teamId}`)

    // Return the created expense with a proper Date object
    const newExpense = {
      id: newExpenseId,
      ...expenseWithoutShares,
      teamId: teamId,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Only include shares if the expense is shared
      ...(expense.isShared ? { shares } : {}),
      // Always include currency fields
      currency: expense.currency,
      primaryAmount: expense.primaryAmount,
      primaryCurrency: expense.primaryCurrency,
    }

    return newExpense
  } catch (error) {
    console.error(`Error creating expense for team ${teamId}:`, error)
    throw error
  }
}

// Update expense function
export async function updateExpense(expenseId: string, updates: Partial<Expense>) {
  try {
    console.log(`Updating expense ${expenseId}...`, updates)

    const expenseRef = doc(db, "expenses", expenseId)
    const expenseDoc = await getDoc(expenseRef)

    if (!expenseDoc.exists()) {
      throw new Error(`Expense ${expenseId} not found`)
    }

    // Prepare the update data
    const { shares, ...updatesWithoutShares } = updates
    const updateData = {
      ...updatesWithoutShares,
      updatedAt: serverTimestamp(),
      // Only include shares if the expense is shared
      ...(updates.isShared ? { shares } : {}),
      // Include primaryAmount and primaryCurrency if they are provided
      ...(updates.primaryAmount !== undefined ? { primaryAmount: updates.primaryAmount } : {}),
      ...(updates.primaryCurrency !== undefined ? { primaryCurrency: updates.primaryCurrency } : {}),
    }

    console.log("Update data:", updateData)

    // Update the expense in Firestore
    await updateDoc(expenseRef, updateData)

    // Get the updated expense
    const updatedExpenseDoc = await getDoc(expenseRef)
    const updatedExpense = convertTimestamps({
      id: updatedExpenseDoc.id,
      ...updatedExpenseDoc.data(),
    }) as Expense

    return updatedExpense
  } catch (error) {
    console.error(`Error updating expense ${expenseId}:`, error)
    throw error
  }
}

// Delete expense function
export async function deleteExpense(expenseId: string) {
  try {
    console.log(`Deleting expense ${expenseId}...`)

    const expenseRef = doc(db, "expenses", expenseId)
    const expenseDoc = await getDoc(expenseRef)

    if (!expenseDoc.exists()) {
      throw new Error(`Expense ${expenseId} not found`)
    }

    await deleteDoc(expenseRef)
    return true
  } catch (error) {
    console.error(`Error deleting expense ${expenseId}:`, error)
    throw error
  }
}

// Calendar events functions
// Update the getCalendarEvents function similarly
// Update the getCalendarEvents function with more detailed logging
export async function getCalendarEvents(teamId: string) {
  try {
    console.log(`Fetching calendar events for team ${teamId}...`)

    // Check if the collection exists first
    const exists = await collectionExists("events")
    if (!exists) {
      console.log("events collection doesn't exist yet")
      return []
    }

    // Create the query
    const q = query(collection(db, "events"), where("teamId", "==", teamId))
    console.log(`Created query for events with teamId: ${teamId}`)

    // Execute the query
    const eventsSnapshot = await getDocs(q)

    // Log the results
    console.log(`Query returned ${eventsSnapshot.size} events`)

    // If there are no events for this team, return an empty array
    if (eventsSnapshot.empty) {
      console.log(`No events found for team ${teamId}`)
      return []
    }

    const events: CalendarEvent[] = []

    // Process each document
    eventsSnapshot.forEach((doc) => {
      const data = doc.data()
      console.log(`Processing event document: ${doc.id}`, data)

      // Convert timestamps and add to the array
      const event = convertTimestamps({
        id: doc.id,
        ...data,
      }) as CalendarEvent

      events.push(event)
    })

    console.log(`Returning ${events.length} events for team ${teamId}`)
    return events
  } catch (error) {
    console.error(`Error fetching calendar events for team ${teamId}:`, error)
    return []
  }
}

// Update the createCalendarEvent function to ensure teamId is correctly set
export async function createCalendarEvent(
  teamId: string,
  event: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt" | "teamId" | "addedById">,
  addedById: string
) {
  try {
    console.log(`Creating calendar event for team ${teamId}...`, event)

    // Ensure the events collection exists
    const eventsCollection = collection(db, "events")

    const now = serverTimestamp()

    // Prepare the event data with explicit teamId
    const eventData = {
      ...event,
      teamId: teamId, // Explicitly set the teamId
      addedById: addedById, // Set the addedById field
      createdAt: now,
      updatedAt: now,
    }

    console.log("Event data to be added:", eventData)

    // Add the event to Firestore
    const newEventRef = await addDoc(eventsCollection, eventData)
    const newEventId = newEventRef.id

    console.log(`Created event with ID: ${newEventId} for team ${teamId}`)

    // Return the created event with a proper Date object
    const newEvent = {
      id: newEventId,
      ...event,
      teamId: teamId,
      addedById: addedById,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    return newEvent
  } catch (error) {
    console.error(`Error creating calendar event for team ${teamId}:`, error)
    throw error
  }
}

export async function deleteCalendarEvent(eventId: string) {
  try {
    console.log(`Deleting calendar event ${eventId}...`)
    await deleteDoc(doc(db, "events", eventId))
    console.log(`Successfully deleted event ${eventId}`)
  } catch (error) {
    console.error(`Error deleting calendar event ${eventId}:`, error)
    throw error
  }
}

export async function updateCalendarEvent(eventId: string, data: Partial<CalendarEvent>) {
  try {
    console.log(`Updating calendar event ${eventId}...`, data)
    const eventRef = doc(db, "events", eventId)
    
    await updateDoc(eventRef, {
      ...data,
      updatedAt: serverTimestamp(),
    })

    console.log(`Successfully updated event ${eventId}`)
  } catch (error) {
    console.error(`Error updating calendar event ${eventId}:`, error)
    throw error
  }
}

// User profile functions
export async function getUserProfile(userId: string) {
  try {
    const userDoc = await getDoc(doc(db, "users", userId))

    if (!userDoc.exists()) {
      return null
    }

    return {
      id: userDoc.id,
      ...userDoc.data(),
    }
  } catch (error) {
    console.error(`Error fetching user profile for ${userId}:`, error)
    return null
  }
}

export async function createUserProfile(userId: string, data: { name: string; email: string }) {
  try {
    console.log("Creating user profile for:", userId, "with data:", data)
    
    const userRef = doc(db, "users", userId)
    const userData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    
    console.log("Setting user data:", userData)
    await setDoc(userRef, userData)
    
    console.log("Successfully created user profile")
    return {
      id: userId,
      ...data,
    }
  } catch (error) {
    console.error(`Error creating user profile for ${userId}:`, error)
    throw error
  }
}

export async function updateUserProfile(userId: string, data: any) {
  try {
    const userRef = doc(db, "users", userId)

    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp(),
    })

    return {
      id: userId,
      ...data,
    }
  } catch (error) {
    console.error(`Error updating user profile for ${userId}:`, error)
    throw error
  }
}

// Helper function to generate unique IDs
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Exchange rates functions
export async function getExchangeRates(primaryCurrency: string) {
  try {
    const ratesRef = doc(db, "exchangeRates", primaryCurrency)
    const ratesDoc = await getDoc(ratesRef)

    if (!ratesDoc.exists()) {
      return null
    }

    const data = ratesDoc.data()
    return {
      rates: data.rates,
      lastUpdate: data.lastUpdate instanceof Timestamp ? data.lastUpdate.toDate() : new Date(data.lastUpdate)
    }
  } catch (error) {
    console.error(`Error fetching exchange rates for ${primaryCurrency}:`, error)
    return null
  }
}

export async function updateExchangeRates(primaryCurrency: string, rates: Record<string, number>) {
  try {
    const ratesRef = doc(db, "exchangeRates", primaryCurrency)
    await setDoc(ratesRef, {
      rates,
      lastUpdate: serverTimestamp(),
      primaryCurrency
    })
    return true
  } catch (error) {
    console.error(`Error updating exchange rates for ${primaryCurrency}:`, error)
    throw error
  }
}

