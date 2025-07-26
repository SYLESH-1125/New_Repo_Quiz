"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { handleGoogleCallback } from "@/lib/google-auth"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { supabase } from "@/lib/supabase";

export default function GoogleOAuthComplete() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("Completing sign-in...")
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()

  useEffect(() => {
    const completeOAuth = async () => {
      try {
        const userType = searchParams.get("userType") as "student" | "faculty"

        if (!userType) {
          throw new Error("Invalid user type")
        }

        // Get the current session from Supabase Auth
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          throw new Error("Session error: " + sessionError.message)
        }

        if (!session?.user) {
          throw new Error("No user session found")
        }

        const user = session.user
        console.log("Google OAuth user:", user)

        // Check if user exists in the appropriate table
        if (userType === "student") {
          const { data: existingStudent, error: studentError } = await supabase
            .from("students")
            .select("*")
            .eq("email", user.email)
            .single();

          if (studentError && studentError.code !== "PGRST116") {
            // Not a "no rows" error
            throw new Error("Database error: " + studentError.message)
          }

          if (!existingStudent) {
            // Create new student record
            const { error: insertError } = await supabase.from("students").insert({
              id: user.id, // Use the Supabase Auth user ID
              email: user.email,
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Unknown',
              created_at: user.created_at,
              updated_at: new Date().toISOString()
            });
            
            if (insertError) {
              console.error("Insert error:", insertError)
              throw new Error("Failed to create student record: " + insertError.message)
            }
            console.log("Created new student record for:", user.email)
          } else {
            console.log("Student already exists:", user.email)
          }
        } else if (userType === "faculty") {
          const { data: existingFaculty, error: facultyError } = await supabase
            .from("faculty")
            .select("*")
            .eq("email", user.email)
            .single();

          if (facultyError && facultyError.code !== "PGRST116") {
            throw new Error("Database error: " + facultyError.message)
          }

          if (!existingFaculty) {
            // Create new faculty record
            const { error: insertError } = await supabase.from("faculty").insert({
              id: user.id, // Use the Supabase Auth user ID
              email: user.email,
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Unknown',
              created_at: user.created_at,
              updated_at: new Date().toISOString()
            });
            
            if (insertError) {
              console.error("Insert error:", insertError)
              throw new Error("Failed to create faculty record: " + insertError.message)
            }
            console.log("Created new faculty record for:", user.email)
          } else {
            console.log("Faculty already exists:", user.email)
          }
        }

        // Set user type and redirect
        const success = await login(user.email || '', "google_oauth", userType)
        if (success) {
          setStatus("success")
          setMessage("Sign-in successful! Redirecting...")
          setTimeout(() => {
            router.push(userType === "student" ? "/student/dashboard" : "/faculty/dashboard")
          }, 1500)
        } else {
          throw new Error("Failed to complete sign-in")
        }
      } catch (error: any) {
        console.error("OAuth completion error:", error)
        setStatus("error")
        setMessage("Sign-in failed: " + (error?.message || "Unknown error") + ". Redirecting to login...")
        setTimeout(() => {
          router.push("/login")
        }, 2000)
      }
    }
    completeOAuth()
  }, [searchParams, login, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Completing Sign-in</h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-8 w-8 text-green-600 mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Success!</h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-8 w-8 text-red-600 mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Error</h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
