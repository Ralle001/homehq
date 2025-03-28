"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Edit, Save, ShoppingCart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { groceryUnits } from "@/lib/constants"
import { formatQuantity, formatRelativeTime, generateId } from "@/lib/utils"
import type { GroceryList, GroceryItem } from "@/lib/types"
import { useTeam } from "@/contexts/team-context"
import { getGroceryLists, createGroceryList, updateGroceryList } from "@/lib/db"
import { toast } from "sonner"
import { DebugInfo } from "@/components/debug-info"
import { canManageContent } from "@/lib/permissions"

export default function GroceriesPage() {
  const [lists, setLists] = useState<GroceryList[]>([])
  const [activeList, setActiveList] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // New item form state
  const [newItem, setNewItem] = useState("")
  const [newItemQuantity, setNewItemQuantity] = useState("1")
  const [newItemUnit, setNewItemUnit] = useState("unit")
  const [newItemNotes, setNewItemNotes] = useState("")

  // Edit mode state
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<{
    name: string;
    quantity: string;
    unit: string;
    notes: string | undefined;
  }>({
    name: "",
    quantity: "",
    unit: "",
    notes: undefined,
  })

  const [editingListName, setEditingListName] = useState<string | null>(null)
  const [editListName, setEditListName] = useState("")

  const { currentTeam, currentMember, refreshTeams } = useTeam()

  // Load grocery lists when team changes
  useEffect(() => {
    const loadGroceryLists = async () => {
      if (!currentTeam) {
        setLists([])
        setActiveList(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const teamLists = await getGroceryLists(currentTeam.id)
        setLists(teamLists)

        if (teamLists.length > 0) {
          setActiveList(teamLists[0].id)
        } else {
          setActiveList(null)
        }
      } catch (error) {
        console.error("Error loading grocery lists:", error)
        toast.error("Failed to load grocery lists. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    loadGroceryLists()
  }, [currentTeam])

  const handleAddItem = async () => {
    console.log("handleAddItem called")
    console.log("Current values:", {
      newItem: newItem.trim(),
      currentTeam: currentTeam?.id,
      activeList,
      currentMember: currentMember?.name
    })

    if (!newItem.trim()) {
      console.log("Validation failed: Item name is empty")
      toast.error("Please enter an item name.")
      return
    }

    if (!currentTeam) {
      console.log("Validation failed: No current team")
      toast.error("Please select a team first")
      return
    }

    if (!activeList) {
      console.log("Validation failed: No active list")
      toast.error("Please select a list to add items to.")
      return
    }

    if (!currentMember) {
      console.log("Validation failed: No current member")
      // Try to refresh teams to get the latest member data
      await refreshTeams()
      
      // Check again after refresh
      if (!currentMember) {
        toast.error("You must be a member of the team to add items.")
        return
      }
    }

    const now = new Date()
    const newGroceryItem: GroceryItem = {
      id: generateId(),
      name: newItem,
      quantity: parseFloat(newItemQuantity) || 1,
      unit: newItemUnit,
      completed: false,
      notes: newItemNotes || undefined,
      addedBy: currentMember.name,
      createdAt: now,
      updatedAt: now
    }

    console.log("New item object:", newGroceryItem)

    try {
      // Get the current list's items
      const currentList = lists.find(l => l.id === activeList)
      if (!currentList) {
        console.log("Current list not found:", activeList)
        throw new Error("List not found")
      }

      console.log("Current list:", currentList)

      // Update in database first
      const updatedList = await updateGroceryList(activeList, {
        items: [...(Array.isArray(currentList.items) ? currentList.items : []), newGroceryItem],
        updatedAt: now,
        teamId: currentTeam.id,
      })

      console.log("Updated list from database:", updatedList)

      // Update local state after successful database update
      setLists(lists.map(list => 
        list.id === activeList ? updatedList : list
      ))

      // Reset form
      setNewItem("")
      setNewItemQuantity("1")
      setNewItemUnit("unit")
      setNewItemNotes("")

      toast.success("The item has been added to your list.")
    } catch (error) {
      console.error("Error adding item:", error)
      toast.error("Failed to add item. Please try again.")
    }
  }

  const handleToggleItem = async (listId: string, itemId: string) => {
    if (!currentTeam || !currentMember) {
      toast.error("You must be part of a team to update items.")
      return
    }

    // Get the current list and item
    const currentList = lists.find(l => l.id === listId)
    if (!currentList) {
      toast.error("List not found.")
      return
    }

    const itemToUpdate = currentList.items.find(item => item.id === itemId)
    if (!itemToUpdate) {
      toast.error("Item not found.")
      return
    }

    // Check if user has permission to update items
    if (!canManageContent(currentTeam, currentMember, "grocery")) {
      toast.error("You don't have permission to update this item.")
      return
    }

    const now = new Date()

    try {
      // Update the item's completed status
      const updatedItems = Array.isArray(currentList.items)
        ? currentList.items.map((item) => {
            if (item.id === itemId) {
              return { ...item, completed: !item.completed, updatedAt: now }
            }
            return item
          })
        : []

      // Update in database first
      const updatedList = await updateGroceryList(listId, {
        items: updatedItems,
        updatedAt: now,
      })

      // Update local state after successful database update
      setLists(lists.map(list => 
        list.id === listId ? updatedList : list
      ))

      toast.success("The item's status has been updated.")
    } catch (error) {
      console.error("Error updating item:", error)
      toast.error("Failed to update item. Please try again.")
    }
  }

  const handleDeleteItem = async (listId: string, itemId: string) => {
    if (!currentTeam || !currentMember) {
      toast.error("You must be part of a team to delete items.")
      return
    }

    // Get the current list and item
    const currentList = lists.find(l => l.id === listId)
    if (!currentList) {
      toast.error("List not found.")
      return
    }

    const itemToDelete = currentList.items.find(item => item.id === itemId)
    if (!itemToDelete) {
      toast.error("Item not found.")
      return
    }

    // Check if user has permission to delete items
    if (!canManageContent(currentTeam, currentMember, "grocery")) {
      toast.error("You don't have permission to delete this item.")
      return
    }

    try {
      // Update in database first
      const updatedList = await updateGroceryList(listId, {
        items: currentList.items.filter(item => item.id !== itemId),
        updatedAt: new Date(),
      })

      // Update local state after successful database update
      setLists(lists.map(list => 
        list.id === listId ? updatedList : list
      ))

      toast.success("The item has been removed from your list.")
    } catch (error) {
      console.error("Error deleting item:", error)
      toast.error("Failed to delete item. Please try again.")
    }
  }

  const startEditItem = (listId: string, itemId: string) => {
    const list = lists.find((l) => l.id === listId)
    const item = list?.items.find((i) => i.id === itemId)

    if (item) {
      setEditingItemId(itemId)
      setEditItem({
        name: item.name,
        quantity: item.quantity.toString(),
        unit: item.unit,
        notes: item.notes,
      })
    }
  }

  const saveEditItem = async (listId: string, itemId: string) => {
    if (!currentTeam || !currentMember) {
      toast.error("You must be part of a team to edit items.")
      return
    }

    // Get the current list and item
    const currentList = lists.find(l => l.id === listId)
    if (!currentList) {
      toast.error("List not found.")
      return
    }

    const itemToEdit = currentList.items.find(item => item.id === itemId)
    if (!itemToEdit) {
      toast.error("Item not found.")
      return
    }

    // Check if user has permission to edit items
    if (!canManageContent(currentTeam, currentMember, "grocery")) {
      toast.error("You don't have permission to edit this item.")
      return
    }

    try {
      // Update the item
      const updatedItems = Array.isArray(currentList.items)
        ? currentList.items.map((item) => {
            if (item.id === itemId) {
              return {
                ...item,
                name: editItem.name,
                quantity: Number.parseFloat(editItem.quantity) || 1,
                unit: editItem.unit,
                notes: editItem.notes,
                updatedAt: new Date(),
              }
            }
            return item
          })
        : []

      // Update in database first
      const updatedList = await updateGroceryList(listId, {
        items: updatedItems,
        updatedAt: new Date(),
      })

      // Update local state after successful database update
      setLists(lists.map(list => 
        list.id === listId ? updatedList : list
      ))

      setEditingItemId(null)
      toast.success("The item has been updated successfully.")
    } catch (error) {
      console.error("Error updating item:", error)
      toast.error("Failed to update item. Please try again.")
    }
  }

  const handleCreateList = async () => {
    if (!currentTeam) return

    try {
      const newList = await createGroceryList(currentTeam.id, {
        name: `New List ${lists.length + 1}`,
        items: [],
      })

      setLists([...lists, newList])
      setActiveList(newList.id)

      toast.success("New grocery list created successfully.")
    } catch (error) {
      console.error("Error creating list:", error)
      toast.error("Failed to create list. Please try again.")
    }
  }

  const startEditListName = (listId: string, currentName: string) => {
    setEditingListName(listId)
    setEditListName(currentName)
  }

  const saveListName = async (listId: string) => {
    if (!currentTeam || !currentMember) {
      toast.error("You must be part of a team to edit list names.")
      return
    }

    if (!canManageContent(currentTeam, currentMember, "grocery")) {
      toast.error("You don't have permission to edit list names.")
      return
    }

    try {
      const updatedList = await updateGroceryList(listId, {
        name: editListName || "Untitled List",
        updatedAt: new Date(),
      })

      setLists(lists.map(list => 
        list.id === listId ? updatedList : list
      ))

      setEditingListName(null)
      toast.success("The list name has been updated successfully.")
    } catch (error) {
      console.error("Error updating list name:", error)
      toast.error("Failed to update list name. Please try again.")
    }
  }

  const activeListData = lists.find((list) => list.id === activeList)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading grocery lists...</p>
        </div>
      </div>
    )
  }

  if (!currentTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">No Team Selected</h2>
          <p className="text-muted-foreground mb-4">Please select or create a team to manage grocery lists.</p>
        </div>
      </div>
    )
  }

  if (lists.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Grocery Lists</h1>
          <p className="text-muted-foreground">Manage your shopping lists and track items to buy</p>
        </div>

        <div className="flex items-center justify-center h-64">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold mb-2">No Grocery Lists</h2>
            <p className="text-muted-foreground mb-4">
              You don't have any grocery lists yet. Create your first list to get started.
            </p>
            <Button onClick={handleCreateList}>
              <Plus className="mr-2 h-4 w-4" />
              Create First List
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Grocery Lists</h1>
        <p className="text-muted-foreground">Manage your shopping lists and track items</p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Summary Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg sm:text-xl">Shopping Summary</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lists.reduce((sum, list) => 
                sum + (Array.isArray(list.items) ? list.items.filter(item => !item.completed).length : 0), 0
              )} items
            </div>
            <p className="text-xs text-muted-foreground">{lists.length} lists</p>
          </CardContent>
        </Card>

        {/* Lists Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Grocery Lists</CardTitle>
                <CardDescription>View and manage all your shopping lists</CardDescription>
              </div>
              <Button size="sm" onClick={handleCreateList}>
                <Plus className="mr-2 h-4 w-4" />
                New List
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue={activeList || undefined}
              value={activeList || undefined}
              onValueChange={setActiveList || undefined}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="w-full sm:w-auto overflow-x-auto">
                  <TabsList className="w-full sm:w-auto">
                    {lists.map((list) => (
                      <TabsTrigger key={list.id} value={list.id}>
                        {list.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </div>

              {lists.map((list) => (
                <TabsContent key={list.id} value={list.id} className="mt-4">
                  <div className="space-y-4">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Input
                          placeholder="Item name"
                          value={newItem}
                          onChange={(e) => setNewItem(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddItem()
                          }}
                        />
                        <div className="flex flex-col sm:flex-row justify-center gap-2">
                          <div className="w-full sm:w-20">
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              placeholder="Qty"
                              value={newItemQuantity}
                              onChange={(e) => setNewItemQuantity(e.target.value)}
                            />
                          </div>
                          <div className="w-full sm:w-32">
                            <Select value={newItemUnit} onValueChange={setNewItemUnit}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select unit" />
                              </SelectTrigger>
                              <SelectContent>
                                {groceryUnits.map((unit) => (
                                  <SelectItem key={unit} value={unit}>
                                    {unit}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-full sm:w-24">
                            <Button onClick={handleAddItem} className="w-full">
                              Add
                            </Button>
                          </div>
                        </div>
                      </div>
                      <Textarea
                        placeholder="Notes (optional)"
                        value={newItemNotes}
                        onChange={(e) => setNewItemNotes(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      {(Array.isArray(list.items) ? list.items : []).length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">
                          No items in this list. Add some items above.
                        </p>
                      ) : (
                        <>
                          {/* Pending items */}
                          {(Array.isArray(list.items) ? list.items : []).filter((item) => !item.completed).length > 0 && (
                            <div className="space-y-2">
                              <h3 className="font-medium">To Buy</h3>
                              <div className="rounded-md border divide-y">
                                {(Array.isArray(list.items) ? list.items : [])
                                  .filter((item) => !item.completed)
                                  .map((item) => (
                                    <div key={item.id} className="p-4">
                                      {editingItemId === item.id ? (
                                        // Edit mode
                                        <div className="space-y-2">
                                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                            <div className="col-span-1 sm:col-span-7">
                                              <Input
                                                value={editItem.name}
                                                onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                                              />
                                            </div>
                                            <div className="col-span-1 sm:col-span-2">
                                              <Input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                value={editItem.quantity}
                                                onChange={(e) => setEditItem({ ...editItem, quantity: e.target.value })}
                                              />
                                            </div>
                                            <div className="col-span-1 sm:col-span-3">
                                              <Select value={editItem.unit} onValueChange={(value) => setEditItem({ ...editItem, unit: value })}>
                                                <SelectTrigger>
                                                  <SelectValue placeholder="Select unit" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {groceryUnits.map((unit) => (
                                                    <SelectItem key={unit} value={unit}>
                                                      {unit}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>
                                          <Textarea
                                            placeholder="Notes"
                                            value={editItem.notes}
                                            onChange={(e) => setEditItem({ ...editItem, notes: e.target.value })}
                                          />
                                          <div className="flex justify-end space-x-2">
                                            <Button variant="outline" size="sm" onClick={() => setEditingItemId(null)}>
                                              Cancel
                                            </Button>
                                            <Button size="sm" onClick={() => saveEditItem(list.id, item.id)}>
                                              <Save className="h-4 w-4 mr-1" /> Save
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        // View mode
                                        <div>
                                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                            <div className="flex items-center space-x-3">
                                              <Checkbox
                                                checked={item.completed}
                                                onCheckedChange={() => handleToggleItem(list.id, item.id)}
                                              />
                                              <div>
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                                                  <span>{formatQuantity(item.quantity, item.unit)}</span>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                              <TooltipProvider>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      onClick={() => startEditItem(list.id, item.id)}
                                                    >
                                                      <Edit className="h-4 w-4" />
                                                    </Button>
                                                  </TooltipTrigger>
                                                  <TooltipContent>Edit item</TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>

                                              <TooltipProvider>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      onClick={() => handleDeleteItem(list.id, item.id)}
                                                    >
                                                      <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                  </TooltipTrigger>
                                                  <TooltipContent>Delete item</TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>
                                            </div>
                                          </div>
                                          {item.notes && (
                                            <div className="mt-2 text-sm bg-muted/50 p-2 rounded-md">{item.notes}</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Completed items */}
                          {(Array.isArray(list.items) ? list.items : []).filter((item) => item.completed).length > 0 && (
                            <div className="space-y-2">
                              <h3 className="font-medium text-muted-foreground">Purchased</h3>
                              <div className="rounded-md border divide-y bg-muted/40">
                                {(Array.isArray(list.items) ? list.items : [])
                                  .filter((item) => item.completed)
                                  .map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-4"
                                    >
                                      <div className="flex items-center space-x-3">
                                        <Checkbox
                                          checked={item.completed}
                                          onCheckedChange={() => handleToggleItem(list.id, item.id)}
                                        />
                                        <div>
                                          <div className="line-through text-muted-foreground">{item.name}</div>
                                          <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                                            <span>{formatQuantity(item.quantity, item.unit)}</span>
                                          </div>
                                        </div>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteItem(list.id, item.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 border-t pt-4">
                    <p className="text-sm text-muted-foreground">
                      Last updated: {formatRelativeTime(new Date(list.updatedAt))}
                    </p>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <DebugInfo />
    </div>
  )
}

