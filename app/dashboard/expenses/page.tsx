"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DollarSign, Plus, Loader2, Edit, Trash2, Users } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { expenseCategories } from "@/lib/constants"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { Expense, ExpenseShare } from "@/lib/types"
import { useTeam } from "@/contexts/team-context"
import { getExpenses, createExpense, updateExpense, deleteExpense, getExchangeRates } from "@/lib/db"
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
import { useAuth } from "@/contexts/auth-context"
import { canManageContent } from "@/lib/permissions"
import { Checkbox } from "@/components/ui/checkbox"
import { currencies, formatCurrencyAmount, convertCurrency } from "@/lib/currencies"

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [activeTab, setActiveTab] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingExpense, setIsAddingExpense] = useState(false)
  const [showAddExpenseDialog, setShowAddExpenseDialog] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [editExpense, setEditExpense] = useState({
    description: "",
    amount: "",
    currency: "USD",
    category: "",
    date: "",
    isShared: false,
    shares: [] as ExpenseShare[],
  })

  const [newExpense, setNewExpense] = useState<{
    description: string;
    amount: string;
    currency: string;
    category: string;
    date: string;
    isShared: boolean;
    shares: ExpenseShare[];
  }>({
    description: "",
    amount: "",
    currency: "USD",
    category: "",
    date: new Date().toISOString().split("T")[0],
    isShared: false,
    shares: [],
  })

  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({})

  const { currentTeam, currentMember } = useTeam()
  const { user } = useAuth()

  // Load expenses when team changes
  useEffect(() => {
    const loadExpenses = async () => {
      if (!currentTeam) {
        console.log("No current team, clearing expenses")
        setExpenses([])
        setIsLoading(false)
        return
      }

      console.log(`Loading expenses for team ${currentTeam.id}...`)
      setIsLoading(true)

      try {
        console.log(`Calling getExpenses for team ${currentTeam.id}`)
        const teamExpenses = await getExpenses(currentTeam.id)
        console.log(`Received ${teamExpenses.length} expenses for team ${currentTeam.id}`, teamExpenses)

        setExpenses(teamExpenses)
      } catch (error) {
        console.error(`Error loading expenses for team ${currentTeam.id}:`, error)
        toast.error("Failed to load expenses. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    loadExpenses()
  }, [currentTeam])

  // Load exchange rates when team changes
  useEffect(() => {
    const loadExchangeRates = async () => {
      if (!currentTeam?.settings.currency.primary) return
      const rates = await getExchangeRates(currentTeam.settings.currency.primary)
      if (rates) {
        setExchangeRates(rates.rates)
      }
    }
    loadExchangeRates()
  }, [currentTeam?.settings.currency.primary])

  // Update currency when currentTeam changes
  useEffect(() => {
    if (currentTeam) {
      setNewExpense(prev => ({
        ...prev,
        currency: currentTeam.settings.currency.primary
      }))
    }
  }, [currentTeam])

  // Update the handleAddExpense function in the expenses page
  const handleAddExpense = async () => {
    if (!currentTeam || !user) {
      toast.error("No team selected or user not logged in.")
      return
    }

    if (!newExpense.description || !newExpense.amount || !newExpense.category) {
      toast.error("Please fill in all required fields.")
      return
    }

    if (!currentTeam.settings.currency.supported.includes(newExpense.currency)) {
      toast.error("Selected currency is not supported by the team.")
      return
    }

    const amount = parseFloat(newExpense.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount.")
      return
    }

    if (newExpense.isShared && newExpense.shares.length === 0) {
      toast.error("Please add at least one share for shared expenses.")
      return
    }

    try {
      setIsLoading(true)

      // Convert amount to primary currency if needed
      let primaryAmount = amount
      let primaryCurrency = newExpense.currency

      if (newExpense.currency !== currentTeam.settings.currency.primary) {
        const converted = convertCurrency(
          amount,
          newExpense.currency,
          currentTeam.settings.currency.primary,
          exchangeRates
        )
        primaryAmount = converted
        primaryCurrency = currentTeam.settings.currency.primary
      }

      const expenseData = {
        description: newExpense.description,
        amount: amount,
        currency: newExpense.currency,
        primaryAmount: primaryAmount,
        primaryCurrency: primaryCurrency,
        category: newExpense.category,
        date: new Date(newExpense.date).toISOString(),
        isShared: newExpense.isShared,
        shares: newExpense.isShared ? newExpense.shares : [],
        paidBy: user.displayName || "Unknown",
        paidById: user.uid,
        teamId: currentTeam.id,
      }

      await createExpense(currentTeam.id, expenseData)
      await getExpenses(currentTeam.id).then(setExpenses)

      toast.success("Expense added successfully.")

      setNewExpense({
        description: "",
        amount: "",
        currency: currentTeam.settings.currency.primary,
        category: "",
        date: new Date().toISOString().split("T")[0],
        isShared: false,
        shares: [],
      })
      setShowAddExpenseDialog(false)
    } catch (error) {
      console.error("Error adding expense:", error)
      toast.error("Failed to add expense. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const startEditExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id)
    setEditExpense({
      description: expense.description,
      amount: expense.amount.toString(),
      currency: expense.currency,
      category: expense.category,
      date: new Date(expense.date).toISOString().split("T")[0],
      isShared: expense.isShared,
      shares: expense.shares || [],
    })
  }

  const handleEditExpense = async (expenseId: string) => {
    if (!currentTeam || !currentMember || !user) {
      toast.error("You must be part of a team to edit expenses.")
      return
    }

    // Get the expense to edit
    const expenseToEdit = expenses.find(e => e.id === expenseId)
    if (!expenseToEdit) {
      toast.error("Expense not found.")
      return
    }

    // Check if user has permission to edit expenses
    if (!canManageContent(currentTeam, currentMember, "expenses", expenseToEdit.paidById)) {
      toast.error("You don't have permission to edit this expense.")
      return
    }

    // Validate inputs
    if (!editExpense.description.trim() || !editExpense.amount.trim() || isNaN(Number.parseFloat(editExpense.amount))) {
      toast.error("Please enter a valid description and amount.")
      return
    }

    // Validate currency
    if (!currentTeam.settings.currency.supported.includes(editExpense.currency)) {
      toast.error("This currency is not supported by your team.")
      return
    }

    // Validate shares if expense is shared
    if (editExpense.isShared && editExpense.shares) {
      const totalShare = editExpense.shares.reduce((sum, share) => sum + share.share, 0)
      if (totalShare !== 100) {
        toast.error("Total shares must equal 100%.")
        return
      }
    }

    try {
      const originalAmount = Number.parseFloat(editExpense.amount)
      const primaryAmount = convertCurrency(
        originalAmount,
        editExpense.currency,
        currentTeam.settings.currency.primary,
        exchangeRates
      )

      const updatedExpense = await updateExpense(expenseId, {
        description: editExpense.description,
        amount: originalAmount,
        currency: editExpense.currency,
        date: new Date(editExpense.date).toISOString(),
        category: editExpense.category,
        isShared: editExpense.isShared,
        shares: editExpense.isShared ? editExpense.shares : [],
        primaryAmount,
        primaryCurrency: currentTeam.settings.currency.primary,
      })

      // Update local state
      setExpenses(expenses.map(expense => 
        expense.id === expenseId ? updatedExpense : expense
      ))

      setEditingExpenseId(null)
      toast.success("Your expense has been updated successfully.")
    } catch (error) {
      console.error("Error updating expense:", error)
      toast.error("Failed to update expense. Please try again.")
    }
  }

  const handleDeleteExpense = async (expenseId: string) => {
    if (!currentTeam || !currentMember || !user) {
      toast.error("You must be part of a team to delete expenses.")
      return
    }

    // Get the expense object
    const expense = expenses.find(e => e.id === expenseId)
    if (!expense) {
      toast.error("Expense not found.")
      return
    }

    // Check if user has permission to delete expenses
    if (!canManageContent(currentTeam, currentMember, "expenses", expense.paidById)) {
      toast.error("You don't have permission to delete this expense.")
      return
    }

    try {
      await deleteExpense(expenseId)

      // Update local state
      setExpenses(expenses.filter(expense => expense.id !== expenseId))

      toast.success("Your expense has been deleted successfully.")
    } catch (error) {
      console.error("Error deleting expense:", error)
      toast.error("Failed to delete expense. Please try again.")
    }

  }

  const filteredExpenses = expenses.filter((expense) => {
    if (categoryFilter !== "all" && expense.category !== categoryFilter) {
      return false
    }

    if (activeTab === user?.uid) {
      return expense.paidById === user.uid
    } else if (activeTab !== "all") {
      return expense.paidById === activeTab
    }

    return true
  })

  // Calculate total amount in primary currency
  const totalAmount = filteredExpenses.reduce((sum, expense) => {
    if (!currentTeam) return sum
    if (expense.currency === currentTeam.settings.currency.primary) {
      return sum + expense.amount
    }
    return sum + expense.primaryAmount
  }, 0)

  // Group expenses by category for the chart
  const expensesByCategory: Record<string, number> = {}
  filteredExpenses.forEach((expense) => {
    if (!expensesByCategory[expense.category]) {
      expensesByCategory[expense.category] = 0
    }
    // Use primary amount for category totals
    if (!currentTeam) return
    expensesByCategory[expense.category] += expense.currency === currentTeam.settings.currency.primary 
      ? expense.amount 
      : expense.primaryAmount
  })

  // Get unique users who have expenses
  const uniqueUsers = Array.from(new Set(expenses.map((expense) => expense.paidById))).map((id) => {
    const expense = expenses.find((e) => e.paidById === id)
    return {
      id,
      name: expense?.paidBy || "Unknown",
    }
  })

  // Calculate debts between members
  const calculateDebts = () => {
    if (!currentTeam || !expenses.length) return []

    // Calculate raw debts between members
    const debts: { from: string; to: string; amount: number }[] = []

    // Process each shared expense
    expenses.forEach(expense => {
      if (expense.isShared && expense.shares) {
        // For each share, create a debt from the share owner to the expense payer
        expense.shares.forEach(share => {
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

  // Add this function before calculateDebts
  const optimizeDebts = (debts: { from: string; to: string; amount: number }[]) => {
    // Create a map of net balances for each person
    const balances: Record<string, number> = {}
    
    // Calculate net balance for each person
    debts.forEach(debt => {
      balances[debt.from] = (balances[debt.from] || 0) - debt.amount
      balances[debt.to] = (balances[debt.to] || 0) + debt.amount
    })

    // Convert to array of {person, balance} and filter out zero balances
    const people = Object.entries(balances)
      .map(([person, balance]) => ({ person, balance }))
      .filter(p => p.balance !== 0)

    // Sort by balance (debtors first, then creditors)
    people.sort((a, b) => a.balance - b.balance)

    const optimizedTransactions: { from: string; to: string; amount: number }[] = []
    let i = 0
    let j = people.length - 1

    // Match debtors with creditors
    while (i < j) {
      const debtor = people[i]
      const creditor = people[j]
      
      if (Math.abs(debtor.balance) < Math.abs(creditor.balance)) {
        // Debtor pays their entire debt
        optimizedTransactions.push({
          from: debtor.person,
          to: creditor.person,
          amount: Math.abs(debtor.balance)
        })
        creditor.balance += debtor.balance
        debtor.balance = 0
        i++
      } else if (Math.abs(debtor.balance) > Math.abs(creditor.balance)) {
        // Creditor receives their entire credit
        optimizedTransactions.push({
          from: debtor.person,
          to: creditor.person,
          amount: Math.abs(creditor.balance)
        })
        debtor.balance += creditor.balance
        creditor.balance = 0
        j--
      } else {
        // Equal amounts
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

  const formatExpenseAmount = (expense: Expense) => {
    return formatCurrency(expense.amount, expense.currency)
  }

  const formatExpensePrimaryAmount = (expense: Expense) => {
    return formatCurrency(expense.primaryAmount, expense.primaryCurrency)
  }

  const formatExpenseShareAmount = (amount: number, currency: string) => {
    return formatCurrency(amount, currency)
  }

  const handleShareChange = (memberId: string, share: number) => {
    setNewExpense(prev => {
      const existingShare = prev.shares.find(s => s.memberId === memberId)
      if (existingShare) {
        return {
          ...prev,
          shares: prev.shares.map(s =>
            s.memberId === memberId ? { ...s, share, amount: (share / 100) * Number(prev.amount) } : s
          )
        }
      }
      const member = currentTeam?.members.find(m => m.id === memberId)
      if (!member) return prev
      return {
        ...prev,
        shares: [...prev.shares, {
          memberId,
          memberName: member.name,
          share,
          amount: (share / 100) * Number(prev.amount)
        }]
      }
    })
  }

  const handleExportData = () => {
    if (!currentTeam || !expenses.length) {
      toast.error("No Data to Export")
      return
    }

    // Prepare the data for export
    const exportData = {
      teamId: currentTeam.id,
      teamName: currentTeam.name,
      exportDate: new Date().toISOString(),
      expenses: expenses.map(expense => ({
        ...expense,
        date: new Date(expense.date).toISOString(),
        createdAt: new Date(expense.createdAt).toISOString(),
        updatedAt: new Date(expense.updatedAt).toISOString(),
      }))
    }

    // Create and download the file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `expenses-${currentTeam.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    toast.success("Your expenses data has been exported successfully.")
  }

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentTeam || !event.target.files?.length) return

    try {
      const file = event.target.files[0]
      const fileContent = await file.text()
      const importedData = JSON.parse(fileContent)

      // Validate the imported data structure
      if (!importedData.expenses || !Array.isArray(importedData.expenses)) {
        throw new Error("Invalid data format")
      }

      // Process each expense
      for (const expense of importedData.expenses) {
        // Create a new expense object with the required fields
        const expenseData = {
          description: expense.description,
          amount: expense.amount,
          currency: expense.currency,
          primaryAmount: expense.primaryAmount,
          primaryCurrency: expense.primaryCurrency,
          category: expense.category,
          date: new Date(expense.date).toISOString(),
          isShared: expense.isShared,
          shares: expense.shares || [],
          paidBy: expense.paidBy,
          paidById: expense.paidById,
          teamId: currentTeam.id,
        }

        await createExpense(currentTeam.id, expenseData)
      }

      // Refresh the expenses list
      const updatedExpenses = await getExpenses(currentTeam.id)
      setExpenses(updatedExpenses)

      toast.success(`Successfully imported ${importedData.expenses.length} expenses.`)
    } catch (error) {
      console.error("Error importing data:", error)
      toast.error("Failed to import expenses. Please check the file format.")
    }

    // Clear the input
    event.target.value = ''
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading expenses...</p>
        </div>
      </div>
    )
  }

  if (!currentTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">No Team Selected</h2>
          <p className="text-muted-foreground mb-4">Please select or create a team to manage expenses.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
        <p className="text-muted-foreground">Track and manage your team expenses</p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Debt Tracking Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Debt Tracking
            </CardTitle>
            <CardDescription>See who owes whom money</CardDescription>
          </CardHeader>
          <CardContent>
            {currentTeam && expenses.length > 0 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">Original Debts:</h3>
                  {calculateDebts().map((debt, index) => {
                    const fromMember = currentTeam.members.find(m => m.id === debt.from)
                    const toMember = currentTeam.members.find(m => m.id === debt.to)
                    
                    if (!fromMember || !toMember) return null

                    return (
                      <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{fromMember.name}</span>
                          <span className="text-muted-foreground">owes</span>
                          <span className="font-medium">{toMember.name}</span>
                        </div>
                        <span className="font-medium text-primary">
                          {formatCurrency(debt.amount, currentTeam.settings.currency.primary)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                
                <div className="pt-4 border-t">
                  <h3 className="font-medium mb-2">Optimized Settlement:</h3>
                  {optimizeDebts(calculateDebts()).map((transaction, index) => {
                    const fromMember = currentTeam.members.find(m => m.id === transaction.from)
                    const toMember = currentTeam.members.find(m => m.id === transaction.to)
                    
                    if (!fromMember || !toMember) return null

                    return (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{fromMember.name}</span>
                          <span className="text-muted-foreground">pays</span>
                          <span className="font-medium">{toMember.name}</span>
                        </div>
                        <span className="font-medium text-primary">
                          {formatCurrency(transaction.amount, currentTeam.settings.currency.primary)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                
                {calculateDebts().length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No debts to settle!</p>
                )}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">No expenses to calculate debts from.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyAmount(totalAmount, currentTeam.settings.currency.primary)}
            </div>
            <p className="text-xs text-muted-foreground">{filteredExpenses.length} expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense Summary</CardTitle>
            <CardDescription>Breakdown of expenses by category</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(expensesByCategory).length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No expenses to display.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(expensesByCategory).map(([category, amount]) => (
                  <div key={category} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full bg-primary`}></div>
                      <span>{category}</span>
                    </div>
                    <span className="font-medium">
                      {formatCurrencyAmount(amount, currentTeam.settings.currency.primary)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Expense List</CardTitle>
                <CardDescription>View and manage all your expenses</CardDescription>
              </div>
              <Dialog open={showAddExpenseDialog} onOpenChange={setShowAddExpenseDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Expense
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New Expense</DialogTitle>
                    <DialogDescription>Enter the details of your expense.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        placeholder="Grocery shopping"
                        value={newExpense.description}
                        onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={newExpense.currency}
                        onValueChange={(value) => setNewExpense({ ...newExpense, currency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {currentTeam?.settings.currency.supported.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={newExpense.category}
                        onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {expenseCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={newExpense.date}
                        onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="isShared"
                          checked={newExpense.isShared}
                          onCheckedChange={(checked) => {
                            setNewExpense({
                              ...newExpense,
                              isShared: checked as boolean,
                              shares: checked ? currentTeam.members.map(member => ({
                                memberId: member.id,
                                memberName: member.name,
                                share: 100 / currentTeam.members.length,
                                amount: (Number(newExpense.amount) * (100 / currentTeam.members.length)) / 100
                              })) : []
                            })
                          }}
                        />
                        <Label htmlFor="isShared">Split expense with others</Label>
                      </div>
                      {newExpense.isShared && (
                        <div className="space-y-2 mt-2">
                          {currentTeam.members.map((member) => (
                            <div key={member.id} className="flex items-center gap-2">
                              <Label className="w-24">{member.name}</Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                className="w-20"
                                value={newExpense.shares.find(s => s.memberId === member.id)?.share || 0}
                                onChange={(e) => {
                                  const share = Number(e.target.value)
                                  const otherShares = newExpense.shares.filter(s => s.memberId !== member.id)
                                  const totalOtherShares = otherShares.reduce((sum, s) => sum + s.share, 0)
                                  
                                  if (share + totalOtherShares <= 100) {
                                    setNewExpense({
                                      ...newExpense,
                                      shares: newExpense.shares.map(s => 
                                        s.memberId === member.id 
                                          ? { ...s, share, amount: (Number(newExpense.amount) * share) / 100 }
                                          : s
                                      )
                                    })
                                  }
                                }}
                              />
                              <span className="text-sm text-muted-foreground">%</span>
                              <span className="text-sm font-medium">
                                {formatCurrency(
                                  (Number(newExpense.amount) * (newExpense.shares.find(s => s.memberId === member.id)?.share || 0)) / 100,
                                  newExpense.currency
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddExpenseDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddExpense} disabled={isAddingExpense}>
                      {isAddingExpense ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add Expense"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <TabsList className="w-full sm:w-auto overflow-x-auto">
                  <TabsTrigger value="all">All</TabsTrigger>
                  {uniqueUsers.map((user) => (
                    <TabsTrigger key={user.id} value={user.id}>
                      {user.name.split(" ")[0]}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {expenseCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <TabsContent value={activeTab} className="mt-0">
                <div className="rounded-md border">
                  <div className="overflow-x-auto">
                    {/* Desktop Table View */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[150px]">Description</TableHead>
                            <TableHead className="min-w-[100px]">Category</TableHead>
                            <TableHead className="min-w-[100px]">Date</TableHead>
                            <TableHead className="min-w-[100px]">Paid By</TableHead>
                            <TableHead className="text-right min-w-[100px]">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredExpenses.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center h-24">
                                No expenses found
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredExpenses.map((expense) => (
                              <TableRow key={expense.id}>
                                <TableCell className="font-medium">
                                  {editingExpenseId === expense.id ? (
                                    <div className="space-y-2">
                                      <Input
                                        value={editExpense.description}
                                        onChange={(e) => setEditExpense({ ...editExpense, description: e.target.value })}
                                      />
                                      <div className="flex gap-2">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={editExpense.amount}
                                          onChange={(e) => setEditExpense({ ...editExpense, amount: e.target.value })}
                                        />
                                        <Select
                                          value={editExpense.currency}
                                          onValueChange={(value) => setEditExpense({ ...editExpense, currency: value })}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {currentTeam?.settings.currency.supported.map((currencyCode) => (
                                              <SelectItem key={currencyCode} value={currencyCode}>
                                                {currencies[currencyCode]?.name || currencyCode} ({currencies[currencyCode]?.symbol || currencyCode})
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Input
                                          type="date"
                                          value={editExpense.date}
                                          onChange={(e) => setEditExpense({ ...editExpense, date: e.target.value })}
                                        />
                                      </div>
                                      <div className="flex justify-end gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setEditingExpenseId(null)}>
                                          Cancel
                                        </Button>
                                        <Button size="sm" onClick={() => handleEditExpense(expense.id)}>
                                          Save
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <div>{expense.description}</div>
                                      {expense.isShared && expense.shares && (
                                        <div className="text-sm text-muted-foreground">
                                          Split between: {expense.shares.map(share => `${share.memberName} (${share.share}%)`).join(", ")}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>{expense.category}</TableCell>
                                <TableCell>{formatDate(expense.date)}</TableCell>
                                <TableCell>{expense.paidBy}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {formatExpenseAmount(expense)}
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => startEditExpense(expense)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteExpense(expense.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden">
                      {filteredExpenses.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No expenses found
                        </div>
                      ) : (
                        <div className="divide-y">
                          {filteredExpenses.map((expense) => (
                            <div key={expense.id} className="p-4">
                              {editingExpenseId === expense.id ? (
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Input
                                      value={editExpense.description}
                                      onChange={(e) => setEditExpense({ ...editExpense, description: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Amount</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={editExpense.amount}
                                      onChange={(e) => setEditExpense({ ...editExpense, amount: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Currency</Label>
                                    <Select
                                      value={editExpense.currency}
                                      onValueChange={(value) => setEditExpense({ ...editExpense, currency: value })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {currentTeam?.settings.currency.supported.map((currencyCode) => (
                                          <SelectItem key={currencyCode} value={currencyCode}>
                                            {currencies[currencyCode]?.name || currencyCode} ({currencies[currencyCode]?.symbol || currencyCode})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Date</Label>
                                    <Input
                                      type="date"
                                      value={editExpense.date}
                                      onChange={(e) => setEditExpense({ ...editExpense, date: e.target.value })}
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="outline" size="sm" onClick={() => setEditingExpenseId(null)}>
                                      Cancel
                                    </Button>
                                    <Button size="sm" onClick={() => handleEditExpense(expense.id)}>
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                      <p className="font-medium">{expense.description}</p>
                                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                        <span>{expense.category}</span>
                                        <span>•</span>
                                        <span>{formatDate(expense.date)}</span>
                                        <span>•</span>
                                        <span>Paid by {expense.paidBy}</span>
                                      </div>
                                      {expense.isShared && expense.shares && (
                                        <div className="text-sm text-muted-foreground mt-1">
                                          Split between: {expense.shares.map(share => `${share.memberName} (${share.share}%)`).join(", ")}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{formatExpenseAmount(expense)}</span>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => startEditExpense(expense)}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleDeleteExpense(expense.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
              <p className="text-sm text-muted-foreground">
                Showing {filteredExpenses.length} of {expenses.length} expenses
              </p>
              <div className="flex gap-2 w-full sm:w-auto">
                <Input
                  type="file"
                  accept=".json"
                  className="hidden"
                  id="import-expenses"
                  onChange={handleImportData}
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full sm:w-auto"
                  onClick={() => document.getElementById('import-expenses')?.click()}
                >
                  Import Data
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full sm:w-auto"
                  onClick={handleExportData}
                >
                  Export Data
                </Button>
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}


