"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Clock, CheckCircle, AlertCircle, BookOpen } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { updateStudentQuizHistory, updateStudentQuizStats } from '@/lib/user-management';

interface Question {
  id: string;
  type: "multiple-choice" | "true-false" | "short-answer" | "fill-in-the-blanks";
  question: string;
  options?: string[];
  correctAnswer: string | number;
  points: number;
}

interface Quiz {
  code: string
  title: string
  description: string
  timeLimit: number
  questions: Question[]
}

// Helper to shuffle an array
function shuffleArray(array: any[]) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function TakeQuizPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [quiz, setQuiz] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string | number }>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState<any>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  const quizCode = params.code as string;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    const fetchQuiz = async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .eq("code", quizCode)
        .single();
      if (data) {
        setTimeLeft(data.timeLimit || 1800);
        // Shuffle questions per user/attempt
        const localStorageKey = `quiz_shuffled_${quizCode}_${user.id}`;
        let shuffledQuestions = null;
        let stored = localStorage.getItem(localStorageKey);
        if (stored) {
          shuffledQuestions = JSON.parse(stored);
        } else {
          shuffledQuestions = shuffleArray(data.questions);
          localStorage.setItem(localStorageKey, JSON.stringify(shuffledQuestions));
        }
        setQuiz({ ...data, questions: shuffledQuestions });
        // Persist startTime in localStorage per quiz attempt
        const startTimeKey = `quiz_startTime_${quizCode}_${user.id}`;
        let storedStartTime = localStorage.getItem(startTimeKey);
        let startTimeValue = Date.now();
        if (storedStartTime) {
          startTimeValue = parseInt(storedStartTime, 10);
        } else {
          localStorage.setItem(startTimeKey, String(startTimeValue));
        }
        setStartTime(startTimeValue);
      } else {
        setError("Quiz not found");
      }
    };
    if (quizCode) fetchQuiz();
    // Cleanup startTime from localStorage on unmount or quiz submit
    return () => {
      if (user && quizCode) {
        const startTimeKey = `quiz_startTime_${quizCode}_${user.id}`;
        localStorage.removeItem(startTimeKey);
        // Do NOT remove shuffledKey here; only remove after submit
      }
    };
  }, [user, loading, quizCode, router]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && quiz) {
      handleSubmit();
    }
  }, [timeLeft]);

  const handleAnswerChange = (questionId: string, answer: string | number) => {
    setAnswers({
      ...answers,
      [questionId]: answer,
    });
  };

  const handleNext = () => {
    if (currentQuestion < (quiz?.questions.length || 0) - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  const handleSubmit = async () => {
    if (!quiz || !user) return;
    setIsSubmitting(true);
    try {
      let correctAnswers = 0;
      let totalPoints = 0;
      let earnedPoints = 0;
      quiz.questions.forEach((question: any) => {
        totalPoints += question.points;
        const userAnswer = answers[question.id];
        let isCorrect = false;
        
        console.log(`Question ${question.id} - User Answer:`, userAnswer, `Correct Answer:`, question.correctAnswer);
        
        if (question.type === "multiple-choice") {
          // Handle both index-based and text-based answers
          if (typeof userAnswer === 'number') {
            // User answer is an index
            isCorrect = userAnswer === question.correctAnswer;
          } else if (typeof userAnswer === 'string') {
            // User answer is option text - find matching option
            const userAnswerIndex = question.options.findIndex((opt: string) => 
              String(opt).trim().toLowerCase() === String(userAnswer).trim().toLowerCase()
            );
            isCorrect = userAnswerIndex === question.correctAnswer;
          }
        } else if (question.type === "true-false") {
          isCorrect = String(userAnswer).toLowerCase() === String(question.correctAnswer).toLowerCase();
        } else if (question.type === "short-answer" || question.type === "fill-in-the-blanks") {
          isCorrect = String(userAnswer).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase();
        }
        
        console.log(`Question ${question.id} - Is Correct:`, isCorrect);
        if (isCorrect) {
          correctAnswers++;
          earnedPoints += question.points;
        }
      });
      // Calculate score as percent
      const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      // Calculate time spent as positive seconds
      let timeSpent = 0;
      const localStorageKey = `quiz_startTime_${quizCode}_${user.id}`;
      let storedStartTime = localStorage.getItem(localStorageKey);
      let startTimeValue = startTime;
      if (storedStartTime) {
        startTimeValue = parseInt(storedStartTime, 10);
      }
      if (startTimeValue) {
        timeSpent = Math.max(0, Math.floor((Date.now() - startTimeValue) / 1000));
      } else {
        timeSpent = quiz.timeLimit ? quiz.timeLimit - timeLeft : 0;
        if (timeSpent < 0) timeSpent = 0;
      }
      // Save result to students table quiz_history column
      // Prepare correct answers in the expected format for PDF
      const correctAnswersMap: Record<string, any> = {};
      (quiz.questions as any[]).forEach((question: any) => {
        correctAnswersMap[question.id] = question.correctAnswer;
      });

      // Convert answers to the format expected by PDF generator
      const processedAnswers: Record<string, any> = {};
      (quiz.questions as any[]).forEach((question: any) => {
        const userAnswer = answers[question.id];
        if (question.type === "multiple-choice" && typeof userAnswer === 'string') {
          // Convert text answer to index for PDF generator
          const answerIndex = (question.options as any[]).findIndex((opt: any) => 
            String(opt).trim().toLowerCase() === String(userAnswer).trim().toLowerCase()
          );
          processedAnswers[question.id] = answerIndex >= 0 ? answerIndex : userAnswer;
        } else {
          processedAnswers[question.id] = userAnswer;
        }
      });

      // Create a clean, serializable version of quiz result
      const quizResult = {
        quiz_id: String(quiz.id || ''),
        quiz_code: String(quiz.code || ''),
        quiz_title: String(quiz.title || 'Untitled Quiz'),
        subject: String(quiz.subject || 'General'),
        score: Number(scorePercent) || 0,
        total_questions: Number(quiz.questions.length) || 0,
        correct_answers: Number(correctAnswers) || 0, // Store the COUNT, not the mappings
        time_spent: Number(timeSpent) || 0,
        answers: processedAnswers || {}, // Use processed answers
        correct_answer_mappings: correctAnswersMap || {}, // Store correct answer mappings separately
        questions: quiz.questions.map((q: any) => {
          // Create a clean question object without potential circular references
          return {
            id: String(q.id || ''),
            type: String(q.type || 'multiple-choice'),
            question: String(q.question || '').substring(0, 1000), // Limit question length
            options: Array.isArray(q.options) ? q.options.map(opt => String(opt).substring(0, 200)) : [],
            correctAnswer: q.correctAnswer,
            explanation: String(q.explanation || '').substring(0, 2000), // Limit explanation length
            points: Number(q.points) || 1
          };
        }),
        submitted_at: new Date().toISOString(),
        taken_at: new Date().toISOString(), // Add for backwards compatibility
        status: "completed"
      };

      // Validate the JSON structure before storing
      try {
        const jsonString = JSON.stringify(quizResult);
        const jsonSize = new Blob([jsonString]).size;
        console.log(`Quiz result JSON size: ${jsonSize} bytes`);
        
        if (jsonSize > 1000000) { // 1MB limit
          throw new Error(`Quiz data too large (${jsonSize} bytes). Reducing data size...`);
        }
        
        // Test JSON parse
        JSON.parse(jsonString);
        console.log("Quiz result JSON validation passed");
      } catch (jsonError) {
        console.error("JSON validation failed:", jsonError);
        
        // Create minimal fallback version
        const minimalResult = {
          quiz_id: String(quiz.id || ''),
          quiz_code: String(quiz.code || ''),
          quiz_title: String(quiz.title || 'Quiz'),
          score: Number(scorePercent) || 0,
          total_questions: Number(quiz.questions.length) || 0,
          correct_answers: Number(correctAnswers) || 0,
          submitted_at: new Date().toISOString(),
          taken_at: new Date().toISOString(),
          status: "completed"
        };
        
        console.log("Using minimal quiz result due to JSON error");
        Object.assign(quizResult, minimalResult);
      }

      // Get current student data
      const { data: studentData, error: fetchError } = await supabase
        .from("students")
        .select("quiz_history")
        .eq("id", user.id)
        .single();

      if (fetchError) {
        console.error("Fetch student data error:", fetchError);
        setError("Failed to fetch student data: " + fetchError.message + " (Code: " + fetchError.code + ")");
        setIsSubmitting(false);
        return;
      }

      // Add validation and debug logging
      console.log("Current student data:", studentData);
      console.log("Quiz result to be stored:", quizResult);

      // Add new result to quiz_history array with safety checks
      const currentHistory = Array.isArray(studentData?.quiz_history) ? studentData.quiz_history : [];
      
      // Limit history size to prevent database issues
      const maxHistoryItems = 100;
      const trimmedHistory = currentHistory.length >= maxHistoryItems ? 
        currentHistory.slice(-maxHistoryItems + 1) : currentHistory;
      
      const updatedHistory = [...trimmedHistory, quizResult];

      console.log("Updated quiz history length:", updatedHistory.length);
      console.log("Sample quiz result keys:", Object.keys(quizResult));

      // Update student record with new quiz_history
      const { data: updateData, error: updateError } = await supabase
        .from("students")
        .update({ quiz_history: updatedHistory })
        .eq("id", user.id)
        .select(); // Add select to get response data

      console.log("Database update response:", updateData);

      // Insert quiz result into quiz_results table for analytics
      const quizResultsInsert = {
        quiz_id: quiz.id,
        quiz_code: quiz.code,
        quiz_title: quiz.title,
        subject: quiz.subject || 'General',
        student_id: user.id,
        student_name: (user as any).full_name || (user as any).username || user.email || '',
        student_email: user.email || '',
        score: scorePercent,
        total_questions: quiz.questions.length,
        correct_answers: correctAnswers,
        time_spent: timeSpent,
        submitted_at: new Date().toISOString(),
        status: "completed"
      };
      await supabase.from("quiz_results").insert([quizResultsInsert]);

      if (updateError) {
        console.error("Update student data error:", updateError);
        console.error("Error details:", {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        });
        
        // Try an even simpler fallback approach
        console.log("Trying ultra-simple fallback storage method...");
        const ultraSimpleResult = {
          quiz_code: String(quiz.code || 'unknown'),
          quiz_id: String(quiz.id || ''),
          quiz_title: String(quiz.title || 'Quiz'),
          score: Number(scorePercent) || 0,
          total_questions: Number(quiz.questions.length) || 0,
          correct_answers: Number(correctAnswers) || 0,
          taken_at: new Date().toISOString(),
          status: "completed"
        };
        
        const { error: fallbackError } = await supabase
          .from("students")
          .update({ 
            quiz_history: [ultraSimpleResult] // Just store this one result
          })
          .eq("id", user.id);
          
        if (fallbackError) {
          console.error("Ultra-simple fallback also failed:", fallbackError);
          setError(`Database error: ${updateError.message || 'Unknown error'}. Please check browser console for details.`);
          setIsSubmitting(false);
          return;
        } else {
          console.log("Ultra-simple fallback storage successful");
        }
      } else {
        // After successful update, update quiz history and stats
        await updateStudentQuizHistory(user.id);
        await updateStudentQuizStats(user.id);
        console.log("Quiz submission successful!");
      }
      setResultData({ correctAnswers, totalQuestions: quiz.questions.length, score: scorePercent });
      setShowResult(true);
      // Cleanup startTime and shuffled questions from localStorage after submit
      const startTimeKey = `quiz_startTime_${quizCode}_${user.id}`;
      const shuffledKey = `quiz_shuffled_${quizCode}_${user.id}`;
      localStorage.removeItem(startTimeKey);
      localStorage.removeItem(shuffledKey);
    } catch (e) {
      setError("Failed to submit quiz. Please try again.");
      setIsSubmitting(false);
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  const getTimeColor = () => {
    if (timeLeft > 300) return "text-green-600" // > 5 minutes
    if (timeLeft > 60) return "text-yellow-600" // > 1 minute
    return "text-red-600" // < 1 minute
  }

  if (!user) {
    return null
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-900">Quiz Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/quiz/join")} className="w-full">
              Try Another Code
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    )
  }

  const currentQ = quiz.questions[currentQuestion]
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100

  if (showResult && resultData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-green-900">Quiz Completed!</CardTitle>
            <CardDescription>
              You answered <span className="font-bold">{resultData.correctAnswers}</span> out of <span className="font-bold">{resultData.totalQuestions}</span> questions correctly.<br />
              Your Score: <span className="font-bold">{resultData.score}%</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/student/dashboard")} className="w-full bg-purple-600 hover:bg-purple-700">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <BookOpen className="h-6 w-6 text-blue-600 mr-2" />
              <div>
                <h1 className="font-bold text-gray-900">{quiz.title}</h1>
                <p className="text-sm text-gray-600">{quiz.code}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className={`flex items-center ${getTimeColor()}`}>
                <Clock className="h-4 w-4 mr-1" />
                <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
              </div>
              <Badge variant="outline">
                Question {currentQuestion + 1} of {quiz.questions.length}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Question Card */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Question {currentQuestion + 1}</CardTitle>
              <Badge variant="default">{currentQ.type.replace(/-/g, " ")}</Badge>
            </div>
            <CardDescription className="text-base text-gray-900 mt-4">{currentQ.question}</CardDescription>
          </CardHeader>
          <CardContent>
            {currentQ.type === "multiple-choice" && currentQ.options && (
              <RadioGroup
                value={answers[currentQ.id]?.toString()}
                onValueChange={(value) => handleAnswerChange(currentQ.id, value)}
              >
                {currentQ.options.map((option: string, index: number) => (
                  <div key={index} className="flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-50">
                    <RadioGroupItem value={option} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
            {currentQ.type === "true-false" && (
              <RadioGroup
                value={answers[currentQ.id]?.toString()}
                onValueChange={(value) => handleAnswerChange(currentQ.id, value)}
              >
                <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="true" id={`tf-true`} />
                  <Label htmlFor={`tf-true`} className="flex-1 cursor-pointer">True</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="false" id={`tf-false`} />
                  <Label htmlFor={`tf-false`} className="flex-1 cursor-pointer">False</Label>
                </div>
              </RadioGroup>
            )}
            {currentQ.type === "short-answer" && (
              <Input
                placeholder="Type your answer"
                value={answers[currentQ.id] || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAnswerChange(currentQ.id, e.target.value)}
                className="mt-2"
              />
            )}
            {currentQ.type === "fill-in-the-blanks" && (
              <div className="mt-2">
                {/* Render question with blank replaced by input */}
                {(() => {
                  // Replace ___ or {blank} in question text with input
                  const BLANK_REGEX = /(___|\{blank\})/;
                  const parts = currentQ.question.split(BLANK_REGEX);
                  return parts.map((part: string, idx: number) =>
                    BLANK_REGEX.test(part) ? (
                      <Input
                        key={"blank-" + idx}
                        value={answers[currentQ.id] || ""}
                        onChange={e => handleAnswerChange(currentQ.id, e.target.value)}
                        className="inline-block w-32 mx-2"
                        placeholder="Your answer"
                      />
                    ) : (
                      <span key={"text-" + idx}>{part}</span>
                    )
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={handlePrevious} disabled={currentQuestion === 0}>
            Previous
          </Button>

          <div className="flex space-x-2">
            {quiz.questions.map((_: any, index: number) => (
              <button
                key={index}
                onClick={() => setCurrentQuestion(index)}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                  index === currentQuestion
                    ? "bg-blue-600 text-white"
                    : answers[quiz.questions[index].id as string] !== undefined
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          {currentQuestion === quiz.questions.length - 1 ? (
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Submit Quiz
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext}>Next</Button>
          )}
        </div>

        {/* Warning for unanswered questions */}
        {currentQuestion === quiz.questions.length - 1 && (
          <Alert className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have answered {
                quiz.questions.filter((q: Question) => answers[q.id] !== undefined && answers[q.id] !== "").length
              } out of {quiz.questions.length} questions. Make sure to
              review your answers before submitting.
            </AlertDescription>
          </Alert>
        )}
      </main>
    </div>
  )
}
