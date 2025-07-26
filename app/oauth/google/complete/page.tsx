"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { handleGoogleCallback } from "@/lib/google-auth"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

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

        const googleUser = await handleGoogleCallback(userType)

        // Simulate login with Google user data
        const success = await login(googleUser.email, "google_oauth", userType)

        if (success) {
          setStatus("success")
          setMessage("Sign-in successful! Redirecting...")

          setTimeout(() => {
            router.push(userType === "student" ? "/student/dashboard" : "/faculty/dashboard")
          }, 1500)
        } else {
          throw new Error("Failed to complete sign-in")
        }
      } catch (error) {
        setStatus("error")
        setMessage("Sign-in failed. Redirecting to login...")

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
