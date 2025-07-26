"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Users, BookOpen } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";

export default function JoinQuizPage() {
  const [quizCode, setQuizCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const { user, loading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      if (!quizCode.trim()) {
        setError("Please enter a referral code.")
        setIsLoading(false)
        return
      }
      // Check if quiz code exists in Supabase
      const { data, error: dbError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('code', quizCode.trim().toUpperCase())
        .single();
      if (dbError || !data) {
        setError("Quiz not found. Please check the code.");
        setIsLoading(false);
        return;
      }
      // Redirect to quiz taking page
      router.push(`/quiz/take/${quizCode.trim().toUpperCase()}`);
    } catch (error) {
      setError("Failed to join quiz. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) return null;
  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join Quiz</CardTitle>
          <CardDescription>Enter the referral code provided by your instructor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Enter referral code"
              value={quizCode}
              onChange={e => setQuizCode(e.target.value)}
              disabled={isLoading}
              className="text-lg"
            />
            <Button
              type="submit"
              disabled={isLoading || !quizCode.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {isLoading ? "Checking..." : "Join Quiz"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
