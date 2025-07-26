"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Plus, Trash2, Save, Eye } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"

interface Question {
  id?: string
  question: string
  type: "multiple-choice" | "true-false" | "short-answer" | "fill-in-the-blanks"
  options?: string[]
  correctAnswer: string | number
  points: number
}

interface Quiz {
  id?: string
  code: string
  title: string
  description: string
  subject: string
  category: string
  difficulty: string
  timeLimit: number
  status: string
  questions: Question[]
  createdby: string
}

export default function EditQuizPage({ params }: { params: { code: string } }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push("/login")
      return
    }
    
    const fetchQuiz = async () => {
      try {
        const { data, error } = await supabase
          .from("quizzes")
          .select("*")
          .eq("code", params.code)
          .eq("createdby", user.id) // Ensure user owns the quiz
          .single()

        if (error || !data) {
          setError("Quiz not found or you don't have permission to edit it")
          return
        }

        setQuiz(data)
      } catch (err) {
        setError("Failed to load quiz")
      } finally {
        setIsLoading(false)
      }
    }

    fetchQuiz()
  }, [user, loading, params.code, router])

  const handleSave = async () => {
    if (!quiz || !user) return
    
    setSaving(true)
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({
          title: quiz.title,
          description: quiz.description,
          subject: quiz.subject,
          category: quiz.category,
          difficulty: quiz.difficulty,
          timeLimit: quiz.timeLimit,
          status: quiz.status,
          questions: quiz.questions,
          updated_at: new Date().toISOString()
        })
        .eq("code", params.code)
        .eq("createdby", user.id)

      if (error) {
        throw error
      }

      alert("Quiz updated successfully!")
      router.push("/faculty/dashboard")
    } catch (err) {
      console.error("Error saving quiz:", err)
      alert("Failed to save quiz. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const addQuestion = () => {
    if (!quiz) return
    
    const newQuestion: Question = {
      question: "",
      type: "multiple-choice",
      options: ["", "", "", ""],
      correctAnswer: 0,
      points: 1
    }
    
    setQuiz({
      ...quiz,
      questions: [...quiz.questions, newQuestion]
    })
  }

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    if (!quiz) return
    
    const updatedQuestions = [...quiz.questions]
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      [field]: value
    }
    
    setQuiz({
      ...quiz,
      questions: updatedQuestions
    })
  }

  const removeQuestion = (index: number) => {
    if (!quiz) return
    
    setQuiz({
      ...quiz,
      questions: quiz.questions.filter((_, i) => i !== index)
    })
  }

  const updateQuestionOption = (questionIndex: number, optionIndex: number, value: string) => {
    if (!quiz) return
    
    const updatedQuestions = [...quiz.questions]
    if (updatedQuestions[questionIndex].options) {
      updatedQuestions[questionIndex].options![optionIndex] = value
    }
    
    setQuiz({
      ...quiz,
      questions: updatedQuestions
    })
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading quiz...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => router.push("/faculty/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!quiz) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => router.push("/faculty/dashboard")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Edit Quiz</h1>
              <p className="text-gray-600">Modify your quiz details and questions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={() => router.push(`/quiz/take/${quiz.code}`)}
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quiz Settings */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Quiz Settings</CardTitle>
                <CardDescription>Configure your quiz properties</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Quiz Title</Label>
                  <Input
                    id="title"
                    value={quiz.title}
                    onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                    placeholder="Enter quiz title"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={quiz.description}
                    onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
                    placeholder="Enter quiz description"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Select value={quiz.subject} onValueChange={(value) => setQuiz({ ...quiz, subject: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mathematics">Mathematics</SelectItem>
                      <SelectItem value="Science">Science</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="History">History</SelectItem>
                      <SelectItem value="Computer Science">Computer Science</SelectItem>
                      <SelectItem value="Physics">Physics</SelectItem>
                      <SelectItem value="Chemistry">Chemistry</SelectItem>
                      <SelectItem value="Biology">Biology</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={quiz.category} onValueChange={(value) => setQuiz({ ...quiz, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Assignment">Assignment</SelectItem>
                      <SelectItem value="Test">Test</SelectItem>
                      <SelectItem value="Exam">Exam</SelectItem>
                      <SelectItem value="Practice">Practice</SelectItem>
                      <SelectItem value="Quiz">Quiz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select value={quiz.difficulty} onValueChange={(value) => setQuiz({ ...quiz, difficulty: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Easy">Easy</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
                  <Input
                    id="timeLimit"
                    type="number"
                    value={quiz.timeLimit}
                    onChange={(e) => setQuiz({ ...quiz, timeLimit: parseInt(e.target.value) })}
                    min={1}
                    max={300}
                  />
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={quiz.status} onValueChange={(value) => setQuiz({ ...quiz, status: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span>Quiz Code:</span>
                    <Badge variant="outline">{quiz.code}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Questions */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Questions ({quiz.questions.length})</CardTitle>
                    <CardDescription>Add and edit quiz questions</CardDescription>
                  </div>
                  <Button onClick={addQuestion}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Question
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {quiz.questions.map((question, questionIndex) => (
                  <div key={questionIndex} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Question {questionIndex + 1}</h3>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeQuestion(questionIndex)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div>
                      <Label>Question Text</Label>
                      <Textarea
                        value={question.question}
                        onChange={(e) => updateQuestion(questionIndex, 'question', e.target.value)}
                        placeholder="Enter your question"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Question Type</Label>
                        <Select 
                          value={question.type} 
                          onValueChange={(value) => updateQuestion(questionIndex, 'type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                            <SelectItem value="true-false">True/False</SelectItem>
                            <SelectItem value="short-answer">Short Answer</SelectItem>
                            <SelectItem value="fill-in-the-blanks">Fill in the Blanks</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Points</Label>
                        <Input
                          type="number"
                          value={question.points}
                          onChange={(e) => updateQuestion(questionIndex, 'points', parseInt(e.target.value))}
                          min={1}
                        />
                      </div>
                    </div>

                    {question.type === "multiple-choice" && (
                      <div>
                        <Label>Options</Label>
                        <div className="space-y-2">
                          {question.options?.map((option, optionIndex) => (
                            <div key={optionIndex} className="flex items-center gap-2">
                              <Checkbox 
                                checked={question.correctAnswer === optionIndex}
                                onCheckedChange={() => updateQuestion(questionIndex, 'correctAnswer', optionIndex)}
                              />
                              <Input
                                value={option}
                                onChange={(e) => updateQuestionOption(questionIndex, optionIndex, e.target.value)}
                                placeholder={`Option ${optionIndex + 1}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {question.type === "true-false" && (
                      <div>
                        <Label>Correct Answer</Label>
                        <Select 
                          value={String(question.correctAnswer)} 
                          onValueChange={(value) => updateQuestion(questionIndex, 'correctAnswer', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">True</SelectItem>
                            <SelectItem value="false">False</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {(question.type === "short-answer" || question.type === "fill-in-the-blanks") && (
                      <div>
                        <Label>Correct Answer</Label>
                        <Input
                          value={String(question.correctAnswer)}
                          onChange={(e) => updateQuestion(questionIndex, 'correctAnswer', e.target.value)}
                          placeholder="Enter the correct answer"
                        />
                      </div>
                    )}
                  </div>
                ))}

                {quiz.questions.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No questions added yet</p>
                    <Button onClick={addQuestion}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Question
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
