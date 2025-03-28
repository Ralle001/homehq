"use client"

import type React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar, Home, LogOut, Menu, ShoppingCart, User, DollarSign, X, Settings, MessageSquare, Sun, LayoutDashboard, Receipt } from "lucide-react"
import { useState, useEffect } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"
import { TeamProvider, useTeam } from "@/contexts/team-context"
import { TeamSwitcher } from "@/components/team-switcher"
import { TeamMembers } from "@/components/team-members"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/auth-context"
import { DebugInfo } from "@/components/debug-info"
import { useTheme } from "next-themes"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/logo"

// Navigation component that uses the team context
function DashboardNav() {
  const pathname = usePathname()
  const { currentMember } = useTeam()

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Grocery Lists", href: "/dashboard/groceries", icon: ShoppingCart },
    { name: "Expenses", href: "/dashboard/expenses", icon: Receipt },
    { name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
    { name: "Team Settings", href: "/dashboard/team-settings", icon: Settings },
  ]

  return (
    <div className="px-3 py-2">
      <div className="space-y-1">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
              pathname === item.href ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            <item.icon className="mr-3 h-5 w-5" />
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  )
}

// Mobile navigation component
function MobileNav({ onClose }: { onClose: () => void }) {
  const pathname = usePathname()
  const { currentMember } = useTeam()

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Grocery Lists", href: "/dashboard/groceries", icon: ShoppingCart },
    { name: "Expenses", href: "/dashboard/expenses", icon: Receipt },
    { name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
    { name: "Team Settings", href: "/dashboard/team-settings", icon: Settings },
  ]

  return (
    <div className="px-3 py-2">
      <div className="space-y-1">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
              pathname === item.href ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { user, loading, logout } = useAuth()
  const { setTheme } = useTheme()
  const router = useRouter()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render the dashboard if not authenticated
  if (!user) {
    return null
  }

  // Get user initials for avatar fallback
  const getInitials = (name: string) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
  }

  const userInitials = getInitials(user.displayName || "")

  const handleLogout = async () => {
    try {
      await logout()
      router.push("/")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  return (
    <TeamProvider userId={user.uid}>
      <div className="flex min-h-screen flex-col">
        {/* Mobile menu */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetContent side="left" className="w-64 p-0 [&>button]:hidden">
            <div className="flex h-full flex-col">
              <div className="border-b px-6 py-4">
                <div className="flex items-center justify-between">
                  <Link href="/dashboard" className="flex items-center">
                    <Logo />
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <TeamSwitcher />
              </div>
              <nav className="flex-1 overflow-auto py-4">
                <MobileNav onClose={() => setIsMobileMenuOpen(false)} />
              </nav>
              <div className="border-t p-4">
                <TeamMembers />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Desktop sidebar */}
        <div className="flex flex-1">
          <div className="hidden border-r md:block md:w-64">
            <div className="flex h-full flex-col">
              <div className="border-b px-6 py-4">
                <Link href="/dashboard" className="flex items-center">
                  <Logo />
                </Link>
              </div>
              <div className="p-4">
                <TeamSwitcher />
              </div>
              <Separator className="mb-4" />
              <nav className="flex-1 overflow-auto py-4">
                <DashboardNav />
              </nav>
              <div className="border-t p-4">
                <TeamMembers />
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col">
            <div className="flex h-16 items-center gap-4 px-4 border-b border-border md:px-6">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileMenuOpen(true)}>
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>

              <div className="ml-auto flex items-center gap-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 rounded-full px-2">
                      <Avatar className="mr-2 h-8 w-8">
                        <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User"} />
                        <AvatarFallback>{userInitials}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{user.displayName || "User"}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.displayName || "User"}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/profile">
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Sun className="mr-2 h-4 w-4" />
                        <span>Theme</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
          </div>
        </div>
      </div>
      <DebugInfo />
    </TeamProvider>
  )
}

