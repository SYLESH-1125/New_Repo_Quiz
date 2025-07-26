"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Trophy, Clock, CheckCircle, XCircle, BarChart3, Share2, Download, Home } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"

interface QuizResult {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  quizTitle: string
  quizCode: string
  score: number
  timeSpent: number
  submittedAt: string
  status: string
  answers: { [key: number]: number }
  correctAnswers: number
  totalQuestions: number
}

export default function QuizResultPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [result, setResult] = useState<QuizResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [quizData, setQuizData] = useState<any>(null) // Store full quiz data for download

  const resultId = searchParams.get("id")

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/login")
      return
    }
    if (resultId) {
      loadResult()
    }
  }, [session, status, resultId])

  // Utility to remove emojis and unsupported special characters
  function removeEmojis(str: string) {
    // Remove most emoji and symbol unicode ranges
    return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  }

  const downloadQuizPDF = async () => {
    if (!result || !quizData) return;
    try {
      const { jsPDF } = await import('jspdf');
      // Load the Noto Sans font as base64
      const fontUrl = '/NotoSans-Regular.ttf';
      const fontResp = await fetch(fontUrl);
      const fontBuffer = await fontResp.arrayBuffer();
      // Convert ArrayBuffer to base64
      function arrayBufferToBase64(buffer: ArrayBuffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
      }
      const fontBase64 = arrayBufferToBase64(fontBuffer);
      // Register the font with jsPDF
      (window as any).jsPDF = (window as any).jsPDF || {};
      (window as any).jsPDF.API = (window as any).jsPDF.API || {};
      if (!jsPDF.API.__NOTOSANS_REGISTERED) {
        jsPDF.API.addFileToVFS('NotoSans-Regular.ttf', fontBase64);
        jsPDF.API.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
        jsPDF.API.__NOTOSANS_REGISTERED = true;
      }
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      doc.setFont('NotoSans');
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 40;

      // --- Cover/Header ---
      // Colored header bar
      doc.setFillColor(54, 83, 209); // Indigo blue
      doc.rect(0, 0, pageWidth, 70, 'F');
      doc.setFontSize(28);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(removeEmojis('Quiz Report'), 40, 45);
      // Placeholder logo (if available)
      try {
        const logoImg = await fetch('/placeholder-logo.png').then(r => r.blob()).then(blob => new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        }));
        doc.addImage(logoImg, 'PNG', pageWidth - 90, 15, 50, 40);
      } catch {}
      y = 90;

      // --- Quiz & Student Info Card ---
      doc.setFillColor(240, 244, 255);
      doc.roundedRect(30, y, pageWidth - 60, 90, 10, 10, 'F');
      doc.setFontSize(18);
      doc.setTextColor(54, 83, 209);
      doc.setFont('helvetica', 'bold');
      doc.text(removeEmojis(result.quizTitle), 50, y + 30);
      doc.setFontSize(12);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      doc.text(removeEmojis(`Quiz Code: ${result.quizCode}`), 50, y + 50);
      doc.text(removeEmojis(`Student: ${result.studentName}`), 50, y + 68);
      doc.text(removeEmojis(`Date: ${new Date(result.submittedAt).toLocaleDateString()}`), 50, y + 86);
      y += 120;

      // --- Score Summary Card ---
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(30, y, pageWidth - 60, 60, 10, 10, 'F');
      doc.setFontSize(16);
      doc.setTextColor(34, 197, 94); // Green
      doc.setFont('helvetica', 'bold');
      doc.text(removeEmojis(`Score: ${result.score}%`), 50, y + 30);
      doc.setTextColor(54, 83, 209);
      doc.text(removeEmojis(`Correct: ${result.correctAnswers}/${result.totalQuestions}`), 180, y + 30);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      doc.text(removeEmojis(`Time Spent: ${Math.floor(result.timeSpent / 60)}:${(result.timeSpent % 60).toString().padStart(2, '0')}`), 350, y + 30);
      y += 80;

      // --- Performance Level ---
      const performance = result.score >= 90 ? 'Excellent' : 
        result.score >= 80 ? 'Very Good' : 
        result.score >= 70 ? 'Good' : 
        result.score >= 60 ? 'Average' : 'Needs Improvement';
      doc.setFontSize(14);
      doc.setTextColor(54, 83, 209);
      doc.setFont('helvetica', 'bold');
      doc.text(removeEmojis(`Performance Level: ${performance}`), 50, y);
      y += 30;

      // --- Section Divider ---
      doc.setDrawColor(54, 83, 209);
      doc.setLineWidth(1.5);
      doc.line(40, y, pageWidth - 40, y);
      y += 20;

      // --- Questions Table ---
      doc.setFontSize(16);
      doc.setTextColor(34, 34, 34);
      doc.setFont('helvetica', 'bold');
      doc.text(removeEmojis('Quiz Questions & Answers'), 40, y);
      y += 20;
      const questions = quizData.questions || [];
      questions.forEach((question: any, index: number) => {
        if (y > 700) { doc.addPage(); y = 60; }
        // Question box
        doc.setFillColor(240, 244, 255);
        doc.roundedRect(40, y, pageWidth - 80, 60, 8, 8, 'F');
        doc.setFontSize(13);
        doc.setTextColor(54, 83, 209);
        doc.setFont('helvetica', 'bold');
        const qText = `${index + 1}. ${removeEmojis(question.question)}`;
        const qLines = doc.splitTextToSize(qText, pageWidth - 120);
        doc.text(qLines, 55, y + 20);
        y += 30 + (qLines.length - 1) * 14;
        // Options (if MCQ)
        if (question.type === 'multiple-choice' && question.options) {
          question.options.forEach((option: string, optIndex: number) => {
            const optionPrefix = String.fromCharCode(65 + optIndex);
            const isCorrect = question.correctAnswer === optIndex;
            const isUserAnswer = result.answers[index] === optIndex;
            doc.setFont('helvetica', isCorrect ? 'bold' : 'normal');
            doc.setTextColor(isCorrect ? 34 : isUserAnswer ? 220 : 80, isCorrect ? 197 : isUserAnswer ? 38 : 80, isCorrect ? 94 : isUserAnswer ? 38 : 80);
            let optionText = `${optionPrefix}. ${removeEmojis(option)}`;
            if (isCorrect) optionText += ' ✓';
            if (isUserAnswer && !isCorrect) optionText += ' ✗';
            doc.text(removeEmojis(optionText), 70, y);
            y += 18;
          });
        } else {
          // Other types
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(34, 197, 94);
          doc.text(removeEmojis(`Correct Answer: ${question.correctAnswer}`), 70, y);
          y += 16;
          if (result.answers[index] !== undefined) {
            const isUserAnswerCorrect = result.answers[index] === question.correctAnswer;
            doc.setTextColor(isUserAnswerCorrect ? 34 : 220, isUserAnswerCorrect ? 197 : 38, isUserAnswerCorrect ? 94 : 38);
            doc.text(removeEmojis(`Your Answer: ${result.answers[index]}`), 70, y);
            y += 16;
          }
        }
        // Explanation
        if (question.explanation) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(12);
          doc.setTextColor(80, 80, 80);
          doc.text(removeEmojis('Explanation:'), 70, y);
          y += 14;
          const explLines = doc.splitTextToSize(removeEmojis(question.explanation), pageWidth - 120);
          doc.text(explLines, 85, y);
          y += explLines.length * 14;
        }
        y += 10;
      });
      // --- Study Recommendations ---
      if (result.score < 80) {
        if (y > 650) { doc.addPage(); y = 60; }
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        doc.text(removeEmojis('Study Recommendations'), 40, y);
        y += 20;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(80, 80, 80);
        const recommendations = [
          'Review the questions you answered incorrectly',
          'Focus on the explanations provided for each question',
          'Practice similar topics to improve understanding',
          'Consider discussing difficult concepts with your instructor',
          'Take practice quizzes to reinforce learning'
        ];
        recommendations.forEach((rec) => {
          doc.text(removeEmojis(`• ${rec}`), 55, y);
          y += 16;
        });
      }
      // --- Footer with page number and branding ---
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(160, 160, 160);
        doc.text(removeEmojis(`Page ${i} of ${pageCount}`), pageWidth - 80, 820);
        doc.text(removeEmojis('Generated by Chennai Boys - GoSafe'), 40, 820);
      }
      // --- Save ---
      doc.save(`${result.quizTitle}_${result.studentName}_Result.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const loadResult = async () => {
    const savedResults = localStorage.getItem("quiz_results")
    if (savedResults) {
      const results = JSON.parse(savedResults)
      const foundResult = results.find((r: QuizResult) => r.id === resultId)
      if (foundResult) {
        setResult(foundResult)
        
        // Also fetch the quiz data for PDF generation
        try {
          const { supabase } = await import("@/lib/supabase");
          const { data: quiz, error } = await supabase
            .from('quizzes')
            .select('*')
            .eq('code', foundResult.quizCode)
            .single();
            
          if (quiz && !error) {
            setQuizData(quiz);
          }
        } catch (error) {
          console.error('Error fetching quiz data:', error);
        }
      }
    }
    setIsLoading(false)
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 80) return "text-blue-600"
    if (score >= 70) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBadge = (score: number) => {
    if (score >= 90) return { variant: "default" as const, label: "Excellent" }
    if (score >= 80) return { variant: "secondary" as const, label: "Good" }
    if (score >= 70) return { variant: "outline" as const, label: "Fair" }
    return { variant: "destructive" as const, label: "Needs Improvement" }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-900">Result Not Found</CardTitle>
            <CardDescription>The quiz result you're looking for doesn't exist.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/student/dashboard")} className="w-full">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const scoreBadge = getScoreBadge(result.score)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quiz Completed!</h1>
          <p className="text-gray-600">Here are your results for {result.quizTitle}</p>
        </div>

        {/* Score Card */}
        <Card className="mb-8 border-0 shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <div className={`text-6xl font-bold ${getScoreColor(result.score)}`}>{result.score}%</div>
              <div className="text-left">
                <Badge variant={scoreBadge.variant} className="mb-2">
                  {scoreBadge.label}
                </Badge>
                <p className="text-sm text-gray-600">
                  {result.correctAnswers} out of {result.totalQuestions} correct
                </p>
              </div>
            </div>
            <Progress value={result.score} className="h-3" />
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Quiz Details */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="mr-2 h-5 w-5" />
                Quiz Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Quiz Code:</span>
                <Badge variant="outline">{result.quizCode}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Time Spent:</span>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1 text-gray-400" />
                  {formatTime(result.timeSpent)}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Submitted:</span>
                <span>{new Date(result.submittedAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <Badge variant="default">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Completed
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Performance Summary */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="mr-2 h-5 w-5" />
                Performance Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Correct Answers:</span>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                  <span className="font-semibold text-green-600">{result.correctAnswers}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Incorrect Answers:</span>
                <div className="flex items-center">
                  <XCircle className="w-4 h-4 mr-1 text-red-500" />
                  <span className="font-semibold text-red-600">{result.totalQuestions - result.correctAnswers}</span>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Accuracy Rate:</span>
                <span className={`font-bold ${getScoreColor(result.score)}`}>
                  {Math.round((result.correctAnswers / result.totalQuestions) * 100)}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => router.push("/student/dashboard")}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Home className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <Button variant="outline">
            <Share2 className="mr-2 h-4 w-4" />
            Share Result
          </Button>
          <Button variant="outline" onClick={downloadQuizPDF}>
            <Download className="mr-2 h-4 w-4" />
            Download Quiz Report
          </Button>
        </div>

        {/* Motivational Message */}
        <Card className="mt-8 border-0 shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardContent className="p-6 text-center">
            <h3 className="text-xl font-bold mb-2">
              {result.score >= 90
                ? "Outstanding Performance! 🎉"
                : result.score >= 80
                  ? "Great Job! 👏"
                  : result.score >= 70
                    ? "Good Effort! 👍"
                    : "Keep Practicing! 💪"}
            </h3>
            <p className="text-blue-100">
              {result.score >= 90
                ? "You've mastered this topic! Keep up the excellent work."
                : result.score >= 80
                  ? "You're doing well! A little more practice and you'll be perfect."
                  : result.score >= 70
                    ? "You're on the right track. Review the material and try again."
                    : "Don't give up! Every expert was once a beginner. Keep learning!"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
