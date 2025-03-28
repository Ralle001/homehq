import { Home } from "lucide-react"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  showIcon?: boolean
}

export function Logo({ className, showIcon = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showIcon && (
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-sm rounded-lg" />
          <div className="relative bg-gradient-to-br from-primary to-primary/80 p-1 rounded-lg">
            <Home className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
      )}
      <div className="font-outfit font-bold tracking-tight">
        <span className="text-primary">Home</span>
        <span className="text-foreground">HQ</span>
      </div>
    </div>
  )
} 