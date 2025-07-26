"use client"

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Activity, TrendingUp, TrendingDown } from "lucide-react";
import dynamic from "next/dynamic";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  RadialLinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
} from "chart.js";

// Register Chart.js components globally (fixes 'linear' scale error)
if (typeof window !== "undefined" && !(window as any)._chartjsRegistered) {
  ChartJS.register(
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    RadialLinearScale,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
    Title
  );
  (window as any)._chartjsRegistered = true;
}

// Dynamically import chart components for better performance
const Line = dynamic(() => import("react-chartjs-2").then(mod => mod.Line), { ssr: false });
const Radar = dynamic(() => import("react-chartjs-2").then(mod => mod.Radar), { ssr: false });
const Bar = dynamic(() => import("react-chartjs-2").then(mod => mod.Bar), { ssr: false });
const Pie = dynamic(() => import("react-chartjs-2").then(mod => mod.Pie), { ssr: false });

// Real-time activity indicator (moved from external import)
function LiveActivityIndicator({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex items-center space-x-2">
      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
      <span className="text-xs text-gray-600">
        {isActive ? 'Live Data' : 'Offline'}
      </span>
    </div>
  );
}

// Calculate streak from quiz_history
function calculateStreak(quizHistory: any[]) {
  if (!Array.isArray(quizHistory) || quizHistory.length === 0) return 0;
  // Get unique days with a quiz, sorted descending
  const days = Array.from(new Set(
    quizHistory
      .map(q => {
        const d = new Date(q.taken_at || q.submitted_at);
        if (isNaN(d)) return null;
        return d.toISOString().slice(0, 10); // YYYY-MM-DD
      })
      .filter(Boolean)
  )).sort((a, b) => b.localeCompare(a));
  if (days.length === 0) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      streak++;
    } else if (diff > 1) {
      break;
    }
  }
  return streak;
}

export default function StudentProfilePage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params?.id as string;
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdateTime, setLastUpdateTime] = useState<string>(new Date().toISOString());
  
  // Real-time quiz data for this specific student
  const [studentQuizHistory, setStudentQuizHistory] = useState<any[]>([]);
  const [realtimeConnection, setRealtimeConnection] = useState(false);
  
  // --- Section & Department Analytics ---
  const [sectionStats, setSectionStats] = useState<any>(null);
  const [deptStats, setDeptStats] = useState<any>(null);
  useEffect(() => {
    async function fetchGroupStats() {
      if (!student) return;
      try {
        const { supabase } = await import("@/lib/supabase");
        // Section stats
        const { data: sectionStudents } = await supabase
          .from("students")
          .select("id, avg_score, accuracy_rate, knowledge_retention, full_name")
          .eq("section", student.section)
          .eq("department", student.department);
        // Department stats
        const { data: deptStudents } = await supabase
          .from("students")
          .select("id, avg_score, accuracy_rate, knowledge_retention, full_name")
          .eq("department", student.department);
        // Helper for stats
        function calcStats(students: any[]) {
          if (!students || students.length === 0) return null;
          const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
          const avgScore = avg(students.map(s => s.avg_score || 0));
          const avgAccuracy = avg(students.map(s => s.accuracy_rate || 0));
          const avgRetention = avg(students.map(s => s.knowledge_retention || 0));
          const sorted = [...students].sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0));
          const rank = sorted.findIndex(s => s.id === student.id) + 1;
          return {
            avgScore,
            avgAccuracy,
            avgRetention,
            rank,
            total: students.length,
            top: sorted[0]?.full_name,
            bottom: sorted[sorted.length - 1]?.full_name
          };
        }
        setSectionStats(calcStats(sectionStudents ?? []));
        setDeptStats(calcStats(deptStudents ?? []));
      } catch {
        // fallback demo data
        setSectionStats({ avgScore: 75, avgAccuracy: 80, avgRetention: 70, rank: 3, total: 30, top: "Alice", bottom: "Bob" });
        setDeptStats({ avgScore: 72, avgAccuracy: 78, avgRetention: 68, rank: 12, total: 120, top: "Carol", bottom: "Dave" });
      }
    }
    fetchGroupStats();
  }, [student]);

  // Advanced analytics variables
  let overallPerformanceScore = null;
  let performanceConsistency = null;
  let totalAvailableQuizzes = 1;
  let quizCompletionRate = null;
  let improvementRate = null, trendDirection = null, scoreVolatility = null, scoreTrendLabels = [], scoreTrendData = [];
  let efficiencyScore = null;
  let timePerformanceCategory = "Unknown";
  let subjectLabels: string[] = [], subjectScores: number[] = [];
  let knowledgeRetentionScore = null;
  let streak = null;
  let improvementRateDirect = null;
  let peerRank = null;
  let certificationProgress = null;
  let bestPracticeAlignment = null;
  let quizHistoryLabels: string[] = [], quizHistoryScores: number[] = [];
  let difficultyLabels: string[] = [], difficultyScores: number[] = [];
  let questionTypeLabels: string[] = [], questionTypeScores: number[] = [];

  // Enhanced student data fetching with real-time updates
  useEffect(() => {
    let studentChannel: any = null;
    
    async function fetchStudentWithRealtime() {
      if (!studentId) return;
      
      setLoading(true);
      setError("");
      
      try {
        const { supabase } = await import("@/lib/supabase");
        
        const fetchStudentData = async () => {
          const { data, error } = await supabase
            .from("students")
            .select("*")
            .eq("id", studentId)
            .single();
          
          if (error) throw error;
          setStudent(data);
          setLastUpdateTime(new Date().toISOString());
          
          // Extract quiz history if it exists
          if (data.quiz_history) {
            console.log("Quiz history type:", typeof data.quiz_history);
            console.log("Quiz history is array:", Array.isArray(data.quiz_history));
            console.log("Quiz history sample:", data.quiz_history);
            
            let quizHistoryArray: any[] = [];
            
            if (Array.isArray(data.quiz_history)) {
              quizHistoryArray = data.quiz_history;
            } else if (typeof data.quiz_history === 'object' && data.quiz_history !== null) {
              // If quiz_history is an object, convert it to array of values
              console.warn("Quiz history is object, converting to array");
              quizHistoryArray = Object.values(data.quiz_history).filter(quiz => 
                quiz && typeof quiz === 'object'
              );
            }
            
            // Ensure all items are valid quiz objects
            const validQuizHistory = quizHistoryArray.filter(quiz => 
              quiz && typeof quiz === 'object' && (quiz.quiz_code || quiz.quiz_id)
            );
            
            console.log("Processed quiz history:", validQuizHistory);
            setStudentQuizHistory(validQuizHistory);
          } else {
            setStudentQuizHistory([]);
          }
        };
        
        // Initial fetch
        await fetchStudentData();
        
        // Set up real-time subscription for this specific student
        studentChannel = supabase.channel(`student-profile-${studentId}`)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'students',
            filter: `id=eq.${studentId}`
          }, (payload: any) => {
            console.log('Student profile real-time update:', payload);
            setStudent(payload.new);
            setLastUpdateTime(new Date().toISOString());
            
            // Update quiz history if it exists
            if (payload.new.quiz_history) {
              console.log("Real-time quiz history type:", typeof payload.new.quiz_history);
              
              let quizHistoryArray: any[] = [];
              
              if (Array.isArray(payload.new.quiz_history)) {
                quizHistoryArray = payload.new.quiz_history;
              } else if (typeof payload.new.quiz_history === 'object' && payload.new.quiz_history !== null) {
                console.warn("Real-time quiz history is object, converting to array");
                quizHistoryArray = Object.values(payload.new.quiz_history).filter(quiz => 
                  quiz && typeof quiz === 'object'
                );
              }
              
              // Ensure all items are valid quiz objects
              const validQuizHistory = quizHistoryArray.filter(quiz => 
                quiz && typeof quiz === 'object' && (quiz.quiz_code || quiz.quiz_id)
              );
              
              setStudentQuizHistory(validQuizHistory);
            }
            
            setRealtimeConnection(true);
          })
          .subscribe((status: string) => {
            console.log('Student profile subscription status:', status);
            setRealtimeConnection(status === 'SUBSCRIBED');
          });
          
      } catch (err: any) {
        setError(err.message || "Failed to load student data");
      }
      
      setLoading(false);
    }
    
    fetchStudentWithRealtime();
    
    return () => {
      if (studentChannel) studentChannel.unsubscribe();
    };
  }, [studentId]);

  // Set up periodic refresh for additional real-time feel
  useEffect(() => {
    if (!studentId) return;
    
    const refreshInterval = setInterval(async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase
          .from("students")
          .select("quiz_history, avg_score, accuracy_rate, best_score, lowest_score")
          .eq("id", studentId)
          .single();
        
        if (data) {
          setStudent((prev: any) => ({ ...prev, ...data }));
          if (data.quiz_history) {
            if (Array.isArray(data.quiz_history)) {
              setStudentQuizHistory(data.quiz_history);
            } else if (typeof data.quiz_history === 'object' && data.quiz_history !== null) {
              console.warn("Periodic refresh quiz history is object, converting to array");
              const quizArray = Object.values(data.quiz_history);
              setStudentQuizHistory(quizArray);
            }
          }
          setLastUpdateTime(new Date().toISOString());
        }
      } catch (error) {
        console.error('Periodic refresh failed:', error);
      }
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(refreshInterval);
  }, [studentId]);

  if (student) {
    // 1. Overall Performance Score
    overallPerformanceScore = student.avg_score && student.accuracy_rate
      ? (student.avg_score * student.accuracy_rate) / 100
      : null;

    // 2. Performance Consistency
    performanceConsistency = student.best_score && student.lowest_score && student.best_score !== 0
      ? ((student.best_score - student.lowest_score) / student.best_score) * 100
      : null;

    // 3. Quiz Completion Rate (needs total_available_quizzes, fallback to quizzes_taken for demo)
    totalAvailableQuizzes = student.quizzes_taken || 1;
    quizCompletionRate = student.quizzes_taken && totalAvailableQuizzes
      ? (student.quizzes_taken / totalAvailableQuizzes) * 100
      : null;

    // 4. Improvement Rate & Score Trends (from score_trends JSONB)
    if (student.score_trends && Array.isArray(student.score_trends)) {
      const scores = student.score_trends.map((s: any) => s.score);
      if (scores.length > 1) {
        improvementRate = ((scores[scores.length-1] - scores[0]) / (scores[0] || 1)) * 100;
        trendDirection = scores[scores.length-1] > scores[0] ? "Improving" : "Declining";
        const mean = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        scoreVolatility = Math.sqrt(scores.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / scores.length);
        scoreTrendLabels = student.score_trends.map((s: any, i: number) => s.date || `Quiz ${i+1}`);
        scoreTrendData = scores;
      }
    }
    // Fallback demo data for score trends
    if (scoreTrendData.length <= 1) {
      scoreTrendLabels = ["Quiz 1", "Quiz 2", "Quiz 3", "Quiz 4"];
      scoreTrendData = [60, 70, 80, 90];
      trendDirection = "Improving";
      scoreVolatility = 10;
    }

    // 5. Efficiency Score & Time Performance Category
    efficiencyScore = student.accuracy_rate && student.avg_time_spent
      ? (student.accuracy_rate / student.avg_time_spent) * 1000
      : null;
    if (student.avg_time_spent !== undefined) {
      if (student.avg_time_spent <= 300) timePerformanceCategory = "Fast";
      else if (student.avg_time_spent <= 600) timePerformanceCategory = "Moderate";
      else if (student.avg_time_spent <= 900) timePerformanceCategory = "Slow";
      else timePerformanceCategory = "Very Slow";
    }

    // 6. Subject Proficiency (Radar Chart)
    if (student.subject_proficiency && typeof student.subject_proficiency === 'object') {
      subjectLabels = Object.keys(student.subject_proficiency);
      subjectScores = Object.values(student.subject_proficiency).map((v: any) => v.score || v);
    }
    // Fallback demo data for subject proficiency
    if (subjectLabels.length <= 1) {
      subjectLabels = ["Math", "Physics", "Chemistry", "Biology"];
      subjectScores = [80, 65, 90, 75];
    }

    // 7. Knowledge Retention Score (Average from knowledge_retention JSONB)
    if (student.knowledge_retention && Array.isArray(student.knowledge_retention)) {
      const vals = student.knowledge_retention.map((k: any) => k.score || k);
      if (vals.length) knowledgeRetentionScore = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
    }
    // Fallback demo data for knowledge retention
    if (knowledgeRetentionScore === null) {
      knowledgeRetentionScore = 78;
    }

    // Advanced analytics
    // Use calculated streak and peer rank for display
    const streak = calculateStreak(studentQuizHistory);
    const peerRank = sectionStats?.rank ?? null;
    improvementRateDirect = student.improvement_rate ?? improvementRate;
    certificationProgress = student.certification_progress !== undefined ? student.certification_progress * 100 : null;
    bestPracticeAlignment = student.best_practice_alignment !== undefined ? student.best_practice_alignment * 100 : null;
    // Quiz history (bar chart)
    if (studentQuizHistory && Array.isArray(studentQuizHistory) && studentQuizHistory.length > 0) {
      quizHistoryLabels = studentQuizHistory.map((q: any, i: number) => q.quiz_title || q.quiz_code || `Quiz ${i+1}`);
      quizHistoryScores = studentQuizHistory.map((q: any) => q.score || 0);
    }
    if (quizHistoryLabels.length < 2) {
      quizHistoryLabels = ["Quiz 1", "Quiz 2", "Quiz 3", "Quiz 4"];
      quizHistoryScores = [60, 75, 80, 90];
    }
    // Difficulty performance (bar chart)
    if (student.difficulty_performance && typeof student.difficulty_performance === 'object') {
      difficultyLabels = Object.keys(student.difficulty_performance);
      difficultyScores = Object.values(student.difficulty_performance).map((v: any) => v.score || v);
    }
    if (difficultyLabels.length < 2) {
      difficultyLabels = ["Easy", "Medium", "Hard"];
      difficultyScores = [85, 70, 60];
    }
    // Question type analysis (bar chart)
    if (student.question_type_analysis && typeof student.question_type_analysis === 'object') {
      questionTypeLabels = Object.keys(student.question_type_analysis);
      questionTypeScores = Object.values(student.question_type_analysis).map((v: any) => v.score || v);
    }
    if (questionTypeLabels.length < 2) {
      questionTypeLabels = ["MCQ", "Short Answer", "True/False"];
      questionTypeScores = [80, 65, 90];
    }
  }

  // Calculate subject proficiency from quiz_history
  let subjectProficiencyLabels: string[] = [];
  let subjectProficiencyScores: number[] = [];
  if (Array.isArray(studentQuizHistory) && studentQuizHistory.length > 0) {
    const subjectScoresMap: Record<string, { total: number; count: number }> = {};
    studentQuizHistory.forEach((quiz: any) => {
      if (quiz.subject) {
        if (!subjectScoresMap[quiz.subject]) {
          subjectScoresMap[quiz.subject] = { total: 0, count: 0 };
        }
        subjectScoresMap[quiz.subject].total += quiz.score || 0;
        subjectScoresMap[quiz.subject].count += 1;
      }
    });
    subjectProficiencyLabels = Object.keys(subjectScoresMap);
    subjectProficiencyScores = subjectProficiencyLabels.map(
      (subject) => subjectScoresMap[subject].count > 0
        ? Math.round(subjectScoresMap[subject].total / subjectScoresMap[subject].count)
        : 0
    );
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!student) return <div className="p-8 text-center">Student not found.</div>;

  // Ensure student data is safe for rendering
  if (!student || typeof student !== 'object') {
    return (
      <div className="max-w-5xl mx-auto py-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Student data not available</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  // Additional safety check - ensure no complex objects are being rendered
  const safeStudent = student ? {
    ...student,
    // Convert any potential objects to safe strings
    full_name: String(student.full_name || ''),
    username: String(student.username || ''),
    email: String(student.email || ''),
    department: String(student.department || ''),
    section: String(student.section || ''),
    id: String(student.id || ''),
    roll_number: String(student.roll_number || ''),
    avg_score: Number(student.avg_score || 0),
    accuracy_rate: Number(student.accuracy_rate || 0),
    // Remove quiz_history from direct access to prevent accidental rendering
    quiz_history: undefined,
    // Also remove any other complex objects that might cause issues
    subject_proficiency: undefined,
    knowledge_retention: undefined,
    score_trends: undefined,
    difficulty_performance: undefined,
    question_type_analysis: undefined
  } : null;

  // Ensure safeStudent exists before rendering
  if (!safeStudent) {
    return (
      <div className="max-w-5xl mx-auto py-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Unable to process student data</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  // Ensure no complex objects can be accidentally rendered in console or debugging
  const debugSafeData = {
    id: String(student?.id || ''),
    name: String(student?.full_name || student?.username || ''),
    hasQuizHistory: !!student?.quiz_history,
    quizHistoryProcessed: Array.isArray(studentQuizHistory) ? studentQuizHistory.length : 0
  };
  
  console.log("Safe debug data:", debugSafeData);

  // Debug: Safe logging to avoid object rendering issues
  if (student) {
    console.log("Student data available, ID:", String(student?.id || ''));
    console.log("Quiz history type:", typeof student?.quiz_history);
    console.log("Quiz history is array:", Array.isArray(student?.quiz_history));
    console.log("Processed quiz count:", Array.isArray(studentQuizHistory) ? studentQuizHistory.length : 0);
  }

  // Smart Analytics variables: set safe defaults
  let recommendation: string | null = null;
  let atRiskAlert: string | null = null;
  let milestones: string[] = [];
  let quickInsights: string[] = [];

  if (student) {
    // Personalized recommendation (demo logic)
    if (subjectScores.length > 1) {
      const minScore = Math.min(...subjectScores);
      const minIdx = subjectScores.indexOf(minScore);
      recommendation = `Focus on ${String(subjectLabels[minIdx] || 'subject')}: your lowest subject.`;
    }
    // At-risk alert (demo logic)
    if (improvementRate !== null && improvementRate < -10) {
      atRiskAlert = "Alert: Declining performance trend detected.";
    } else if (knowledgeRetentionScore !== null && knowledgeRetentionScore < 60) {
      atRiskAlert = "Alert: Knowledge retention is low.";
    }
    // Milestones (demo logic)
    if (overallPerformanceScore !== null && overallPerformanceScore > 90) milestones.push("Outstanding overall performance!");
    if (streak && streak >= 7) milestones.push(`Maintaining a ${Number(streak)}-day streak!`);
    if (peerRank !== null && peerRank <= 10) milestones.push("Top 10 in your section!");
    // Quick insights (demo logic)
    if (subjectScores.length > 1) {
      const maxScore = Math.max(...subjectScores);
      const maxIdx = subjectScores.indexOf(maxScore);
      quickInsights.push(`Most improved subject: ${String(subjectLabels[maxIdx] || 'subject')}`);
    }
    if (scoreVolatility !== null && scoreVolatility < 5) quickInsights.push("Consistent performance");
    if (quizCompletionRate !== null && quizCompletionRate > 90) quickInsights.push("Excellent quiz engagement");
  }

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      {/* Header with Back Button and Real-time Indicators */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Students
        </Button>
        <div className="flex items-center gap-4">
          <LiveActivityIndicator isActive={realtimeConnection} />
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <Activity className="w-3 h-3 mr-1" />
            Real-time Profile
          </Badge>
          <span className="text-xs text-gray-500">
            Updated: {new Date(lastUpdateTime).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Student Performance Summary Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarFallback className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xl">
                  {(safeStudent?.full_name || safeStudent?.username || 'Student').slice(0,2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl font-bold">{safeStudent?.full_name || safeStudent?.username || 'Student'}</CardTitle>
                <CardDescription className="text-base">
                  {safeStudent?.department} - Section {safeStudent?.section} | Roll: {safeStudent?.roll_number || safeStudent?.id}
                </CardDescription>
                <div className="text-sm text-gray-600 mt-1">{safeStudent?.email}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{safeStudent?.avg_score || 0}%</div>
                  <div className="text-gray-600">Avg Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{Array.isArray(studentQuizHistory) ? studentQuizHistory.length : 0}</div>
                  <div className="text-gray-600">Quizzes Taken</div>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Recent Quiz Activity */}
      {Array.isArray(studentQuizHistory) && studentQuizHistory.length > 0 && (
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Recent Quiz Activity
            </CardTitle>
            <CardDescription>Latest quiz performances and trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {studentQuizHistory.slice(-5).reverse().map((quiz: any, index: number) => {
                const quizDate = new Date(quiz.submitted_at || quiz.taken_at || Date.now());
                const isRecent = (Date.now() - quizDate.getTime()) < 24 * 60 * 60 * 1000; // Last 24 hours
                
                return (
                  <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${
                    isRecent ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-3">
                      {isRecent && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>}
                      <div>
                        <p className="font-medium">{quiz.quiz_title || quiz.quiz_id || 'Quiz'}</p>
                        <p className="text-sm text-gray-600">
                          {quizDate.toLocaleDateString()} at {quizDate.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${
                        quiz.score >= 80 ? 'text-green-600' : 
                        quiz.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {quiz.score || 0}%
                      </div>
                      <p className="text-xs text-gray-500">
                        {quiz.correct_answers}/{quiz.total_questions} correct
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section & Department Analytics */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Section & Department Analytics</CardTitle>
          <CardDescription>How this student compares to their peers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 text-sm">
            {sectionStats && (
              <div>
                <span className="font-semibold">Section ({safeStudent?.section || ''}):</span> 
                Avg Score: <span className="text-blue-700 font-bold">{sectionStats.avgScore.toFixed(2)}</span>,
                Avg Accuracy: <span className="text-green-700 font-bold">{sectionStats.avgAccuracy.toFixed(2)}%</span>,
                Avg Retention: <span className="text-orange-700 font-bold">{sectionStats.avgRetention.toFixed(2)}%</span>,
                Rank: <span className="text-indigo-700 font-bold">#{sectionStats.rank} / {sectionStats.total}</span>,
                Top: <span className="text-green-700">{String(sectionStats.top || '')}</span>,
                Lowest: <span className="text-red-700">{String(sectionStats.bottom || '')}</span>
              </div>
            )}
            {deptStats && (
              <div>
                <span className="font-semibold">Department ({safeStudent?.department || ''}):</span> 
                Avg Score: <span className="text-blue-700 font-bold">{deptStats.avgScore.toFixed(2)}</span>,
                Avg Accuracy: <span className="text-green-700 font-bold">{deptStats.avgAccuracy.toFixed(2)}%</span>,
                Avg Retention: <span className="text-orange-700 font-bold">{deptStats.avgRetention.toFixed(2)}%</span>,
                Rank: <span className="text-indigo-700 font-bold">#{deptStats.rank} / {deptStats.total}</span>,
                Top: <span className="text-green-700">{String(deptStats.top || '')}</span>,
                Lowest: <span className="text-red-700">{String(deptStats.bottom || '')}</span>
              </div>
            )}
            {(!sectionStats && !deptStats) && <div className="text-gray-500">Loading group analytics...</div>}
          </div>
        </CardContent>
      </Card>
      {/* Smart Analytics Section */}
      <Card className="bg-gradient-to-r from-indigo-50 to-green-50 border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Smart Analytics</CardTitle>
          <CardDescription>Personalized insights, alerts, and milestones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {recommendation && <div className="text-blue-700 font-semibold">{recommendation}</div>}
            {atRiskAlert && <div className="text-red-600 font-semibold">{atRiskAlert}</div>}
            {milestones.length > 0 && (
              <div className="text-green-700">
                <span className="font-semibold">Milestones:</span> {milestones.join(" | ")}
              </div>
            )}
            {quickInsights.length > 0 && (
              <div className="text-indigo-700">
                <span className="font-semibold">Quick Insights:</span> {quickInsights.join(" | ")}
              </div>
            )}
            {(!recommendation && !atRiskAlert && milestones.length === 0 && quickInsights.length === 0) && (
              <div className="text-gray-500">No special analytics at this time.</div>
            )}
          </div>
        </CardContent>
      </Card>
      {/* Student Info */}
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center gap-6">
          <Avatar className="w-20 h-20">
            <AvatarFallback className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-3xl">
              {(safeStudent?.full_name || safeStudent?.username || '').slice(0,2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-2xl font-bold">{safeStudent?.full_name || safeStudent?.username || ''}</CardTitle>
            <CardDescription>ID: {safeStudent?.id || ''}</CardDescription>
            <div className="text-sm text-gray-600 mt-1">{safeStudent?.email || ''}</div>
            <div className="text-sm text-gray-600">Department: {safeStudent?.department || ''} | Section: {safeStudent?.section || ''}</div>
          </div>
        </CardHeader>
      </Card>
      {/* Metrics and charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Accuracy Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Accuracy Rate</CardTitle>
            <CardDescription>Overall accuracy in quizzes</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={safeStudent?.accuracy_rate || 0} max={100} />
            <div className="mt-2 text-lg font-bold">{(safeStudent?.accuracy_rate || 0).toFixed(2)}%</div>
          </CardContent>
        </Card>
        {/* 2. Overall Performance Score */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Performance Score</CardTitle>
            <CardDescription>Weighted by accuracy and average score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">{overallPerformanceScore?.toFixed(2) ?? 'N/A'}</div>
          </CardContent>
        </Card>
        {/* 3. Performance Consistency */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Consistency</CardTitle>
            <CardDescription>Lower is more consistent</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-700">{performanceConsistency !== null ? performanceConsistency.toFixed(2) + '%' : 'N/A'}</div>
          </CardContent>
        </Card>
        {/* 4. Score Trends (Line Chart) */}
        <Card>
          <CardHeader>
            <CardTitle>Score Trends</CardTitle>
            <CardDescription>Improvement over time</CardDescription>
          </CardHeader>
          <CardContent>
            {scoreTrendData.length > 1 ? (
              <Line
                data={{
                  labels: scoreTrendLabels,
                  datasets: [{
                    label: 'Score',
                    data: scoreTrendData,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99,102,241,0.2)',
                  }],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: { y: { min: 0, max: 100 } },
                }}
              />
            ) : <div className="text-gray-500">Not enough data</div>}
            <div className="mt-2 text-sm">{trendDirection && `Trend: ${trendDirection}`}</div>
            <div className="text-sm">{scoreVolatility !== null && `Volatility: ${scoreVolatility.toFixed(2)}`}</div>
          </CardContent>
        </Card>
        {/* 5. Efficiency Score & Time Category */}
        <Card>
          <CardHeader>
            <CardTitle>Efficiency Score</CardTitle>
            <CardDescription>Accuracy per second (scaled)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">{efficiencyScore !== null ? efficiencyScore.toFixed(2) : 'N/A'}</div>
            <div className="text-sm mt-2">Time Category: <span className="font-semibold">{timePerformanceCategory}</span></div>
          </CardContent>
        </Card>
        {/* 6. Subject Proficiency (Radar Chart) */}
        <Card>
          <CardHeader>
            <CardTitle>Subject Proficiency</CardTitle>
            <CardDescription>Average score by subject (only subjects with at least one quiz)</CardDescription>
          </CardHeader>
          <CardContent>
            {subjectProficiencyLabels.length > 1 ? (
              <Radar
                data={{
                  labels: subjectProficiencyLabels,
                  datasets: [{
                    label: 'Proficiency',
                    data: subjectProficiencyScores,
                    backgroundColor: 'rgba(16,185,129,0.2)',
                    borderColor: '#10b981',
                  }],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: { r: { min: 0, max: 100 } },
                }}
              />
            ) : <div className="text-gray-500">Not enough data (needs at least 2 subjects with quizzes)</div>}
          </CardContent>
        </Card>
        {/* 7. Knowledge Retention Score (Pie Chart) */}
        <Card>
          <CardHeader>
            <CardTitle>Knowledge Retention</CardTitle>
            <CardDescription>Average retention score</CardDescription>
          </CardHeader>
          <CardContent>
            {knowledgeRetentionScore !== null ? (
              <Pie
                data={{
                  labels: ['Retention', 'Lost'],
                  datasets: [{
                    data: [knowledgeRetentionScore, 100 - knowledgeRetentionScore],
                    backgroundColor: ['#f59e42', '#e5e7eb'],
                  }],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { display: true, position: 'bottom' } },
                }}
              />
            ) : <div className="text-gray-500">Not enough data</div>}
            <div className="mt-2 text-lg font-bold">{knowledgeRetentionScore !== null ? knowledgeRetentionScore.toFixed(2) + '%' : 'N/A'}</div>
          </CardContent>
        </Card>
        {/* 8. Streak, Peer Rank, Certification Progress, Best Practice Alignment */}
        <Card>
          <CardHeader>
            <CardTitle>Streak & Peer Rank</CardTitle>
            <CardDescription>Current streak and peer ranking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <div><span className="font-semibold">Current Streak:</span> {streak} days</div>
              <div><span className="font-semibold">Peer Rank:</span> {peerRank !== null ? `#${peerRank}` : 'N/A'}</div>
            </div>
          </CardContent>
        </Card>
        {/* 9. Improvement Rate (Direct) */}
        <Card>
          <CardHeader>
            <CardTitle>Improvement Rate</CardTitle>
            <CardDescription>Direct improvement rate from DB</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700">{improvementRateDirect !== null ? improvementRateDirect.toFixed(2) + '%' : 'N/A'}</div>
          </CardContent>
        </Card>
        {/* 10. Quiz History (Bar Chart) */}
        <Card>
          <CardHeader>
            <CardTitle>Quiz History</CardTitle>
            <CardDescription>Scores in recent quizzes</CardDescription>
          </CardHeader>
          <CardContent>
            <Bar
              data={{
                labels: quizHistoryLabels,
                datasets: [{
                  label: 'Score',
                  data: quizHistoryScores,
                  backgroundColor: '#6366f1',
                }],
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { min: 0, max: 100 } },
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
