"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  BookOpen,
  Users,
  TrendingUp,
  Download,
  Filter,
  Search,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase";

interface QuizResult {
  id: string
  studentName: string
  studentEmail: string
  studentId: string
  quizTitle: string
  quizCode: string
  score: number
  timeSpent: number
  submittedAt: string
  status: "completed" | "in-progress" | "not-started"
}

export default function FacultyResults() {
  const router = useRouter();
  const [results, setResults] = useState<QuizResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<QuizResult[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    setIsLoading(true);
    // Fetch quiz results from Supabase
    const { data, error } = await supabase
      .from("quiz_results")
      .select("id, quiz_id, quiz_code, quiz_title, subject, student_id, student_name, student_email, score, total_questions, correct_answers, time_spent, submitted_at, status");
    if (!error && data) {
      setResults(data);
      setFilteredResults(data);
    }
    setIsLoading(false);
  };

  const handleQuizFilter = (quizCode: string) => {
    setSelectedQuiz(quizCode);
    if (quizCode === "all") {
      setFilteredResults(results);
    } else {
      setFilteredResults(results.filter((result) => result.quizCode === quizCode));
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 80) return "text-blue-600"
    if (score >= 70) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 90) return "default"
    if (score >= 70) return "secondary"
    return "destructive"
  }

  const calculateStats = () => {
    if (filteredResults.length === 0) {
      return {
        totalSubmissions: 0,
        averageScore: 0,
        completionRate: 0,
        topScore: 0,
      }
    }

    const completedResults = filteredResults.filter((r) => r.status === "completed")
    const totalSubmissions = completedResults.length
    const averageScore = Math.round(
      completedResults.reduce((sum, result) => sum + result.score, 0) / totalSubmissions || 0,
    )
    const completionRate = Math.round((totalSubmissions / filteredResults.length) * 100)
    const topScore = Math.max(...completedResults.map((r) => r.score), 0)

    return {
      totalSubmissions,
      averageScore,
      completionRate,
      topScore,
    }
  }

  const stats = calculateStats()
  const uniqueQuizzes = Array.from(new Set(results.map((r) => r.quizCode)))

  if (isLoading || status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    )
  }

  // Removed session check as it is not defined or needed here.
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button variant="ghost" onClick={() => router.push("/faculty/dashboard")}>
                ← Back to Dashboard
              </Button>
              <div className="ml-4">
                <h1 className="text-xl font-bold text-gray-900">Quiz Results</h1>
                <p className="text-sm text-gray-600">View and analyze student performance</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Submissions</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalSubmissions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Average Score</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.averageScore}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.completionRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Top Score</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.topScore}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="mr-2 h-5 w-5" />
              Filter Results
            </CardTitle>
            <CardDescription>Filter results by quiz or student criteria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <Select value={selectedQuiz} onValueChange={handleQuizFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a quiz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Quizzes</SelectItem>
                    {uniqueQuizzes.map((quizCode) => (
                      <SelectItem key={quizCode} value={quizCode}>
                        {quizCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline">
                <Search className="h-4 w-4 mr-2" />
                Search Students
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="mr-2 h-5 w-5" />
              Quiz Results
              {selectedQuiz !== "all" && (
                <Badge variant="secondary" className="ml-2">
                  {selectedQuiz}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Showing {filteredResults.length} result{filteredResults.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredResults.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-600">No quiz results match your current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Quiz</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Time Spent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src="/placeholder.png" alt={result.studentName} />
                              <AvatarFallback>
                                {(result.studentName || 'Student')
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-gray-900">{result.studentName}</p>
                              <p className="text-sm text-gray-600">{result.studentEmail}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">{result.quizTitle}</p>
                            <p className="text-sm text-gray-600">{result.quizCode}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getScoreBadgeVariant(result.score)}>{result.score}%</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 text-gray-400 mr-1" />
                            {Math.floor(result.timeSpent / 60)}m {result.timeSpent % 60}s
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              result.status === "completed"
                                ? "default"
                                : result.status === "in-progress"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {result.status === "completed"
                              ? "Completed"
                              : result.status === "in-progress"
                                ? "In Progress"
                                : "Not Started"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-gray-900">{new Date(result.submittedAt).toLocaleDateString()}</p>
                          <p className="text-xs text-gray-600">{new Date(result.submittedAt).toLocaleTimeString()}</p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
