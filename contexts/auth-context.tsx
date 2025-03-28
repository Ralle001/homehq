"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import {
  type User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  signInWithPopup,
} from "firebase/auth"
import { auth, googleProvider, appleProvider } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { createUserProfile } from "@/lib/db"

interface AuthContextType {
  user: User | null
  loading: boolean
  signUp: (email: string, password: string, name: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithApple: () => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signUp = async (email: string, password: string, name: string) => {
    try {
      console.log("Starting sign up process for:", email)
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      console.log("Firebase Auth user created:", userCredential.user.uid)
      
      await updateProfile(userCredential.user, { displayName: name })
      console.log("Firebase Auth profile updated with name:", name)
      
      // Create user profile in Firestore
      console.log("Creating Firestore user profile...")
      await createUserProfile(userCredential.user.uid, {
        name,
        email,
      })
      console.log("Firestore user profile created successfully")

      toast({
        title: "Account created",
        description: "Your account has been created successfully.",
      })
    } catch (error: any) {
      console.error("Error during sign up:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create account",
        variant: "destructive",
      })
      throw error
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      toast({
        title: "Welcome back",
        description: "You have been signed in successfully.",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in",
        variant: "destructive",
      })
      throw error
    }
  }

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      
      // Create or update user profile in Firestore
      await createUserProfile(result.user.uid, {
        name: result.user.displayName || "User",
        email: result.user.email || "",
      })

      toast({
        title: "Welcome",
        description: "You have been signed in with Google successfully.",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      })
      throw error
    }
  }

  const signInWithApple = async () => {
    try {
      const result = await signInWithPopup(auth, appleProvider)
      
      // Create or update user profile in Firestore
      await createUserProfile(result.user.uid, {
        name: result.user.displayName || "User",
        email: result.user.email || "",
      })

      toast({
        title: "Welcome",
        description: "You have been signed in with Apple successfully.",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in with Apple",
        variant: "destructive",
      })
      throw error
    }
  }

  const logout = async () => {
    try {
      await signOut(auth)
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign out",
        variant: "destructive",
      })
      throw error
    }
  }

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email)
      toast({
        title: "Password reset email sent",
        description: "Check your email for a link to reset your password.",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send password reset email",
        variant: "destructive",
      })
      throw error
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signInWithGoogle, signInWithApple, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

