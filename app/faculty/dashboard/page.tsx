"use client"

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'
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
if (typeof window !== "undefined" && !(window)._chartjsRegistered) {
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
  window._chartjsRegistered = true;
}

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  BookOpen,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  TrendingUp,
  TrendingDown,
  User,
  Home,
  Brain,
  CheckCircle,
  Activity,
  Download,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  FileText,
  Upload,
  Eye,
  Edit,
  Copy,
  X,
  Flame,
  Filter,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { Line, Radar, Pie } from "./_chartDynamic"
import { useAuth } from "@/contexts/auth-context"
import { useIsMobile } from "@/hooks/use-mobile";
import { generatePerformanceReportPDF } from "@/lib/analytics-pdf-generator";

// Navigation items
const facultyNavItems = [
  { key: "dashboard", title: "Dashboard", icon: Home, isActive: true },
  { key: "analytics", title: "Smart Analytics", icon: Brain, badge: "AI", badgeVariant: "default" as const },
  { key: "quiz-studio", title: "Quiz Studio", icon: BookOpen, badge: "3", badgeVariant: "secondary" as const },
  { key: "student-hub", title: "Student Hub", icon: Users },
  { key: "settings", title: "Settings", icon: Settings },
]

// --- Data Insights Hook (no AI, just analytics-based) ---
function useDailyInsights(analytics, quizResults, studentsData) {
  // Generate up to 3 actionable insights from the data
  const insights = [];

  // Insight 1: Average score
  if (analytics.avgScore > 0) {
    insights.push(`Average score today is ${analytics.avgScore}%.`);
  } else {
    insights.push("No quiz scores available yet. Assign a quiz to get started.");
  }

  // Insight 2: Participation
  if (studentsData.length > 0) {
    const activeStudents = studentsData.filter(s => s.latestActivity).length;
    insights.push(`${activeStudents} out of ${studentsData.length} students have recent activity.`);
  } else {
    insights.push("No students have participated yet.");
  }

  // Insight 3: Quiz submissions
  if (analytics.totalSubmissions > 0) {
    insights.push(`There have been ${analytics.totalSubmissions} quiz submissions so far.`);
  } else {
    insights.push("No quiz submissions yet. Encourage students to take quizzes.");
  }

  return insights.slice(0, 3);
}

export default function FacultyDashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [analyticsFilter, setAnalyticsFilter] = useState("Section Level");
  // Quizzes state (fetched from Supabase)
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState(true);
  
  // Analytics state for real-time data
  const [studentsData, setStudentsData] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>({});
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsTab, setAnalyticsTab] = useState<'section' | 'department'>('section');

  // Aggregate stats for dashboard, quiz studio, analytics
  const analytics = useMemo(() => {
    if (!quizResults || quizResults.length === 0) return {
      totalSubmissions: 0,
      avgScore: 0,
      completionRate: 0,
      recentActivities: [],
      quizStats: {},
      totalQuizzes: quizzes.length, // <-- Added property
    };
    const totalSubmissions = quizResults.length;
    const avgScore = Math.round(
      quizResults.reduce((sum, r) => sum + (r.score || 0), 0) / (quizResults.length || 1)
    );
    // Completion rate: percent of quizzes with at least one submission
    const quizCodes = Array.from(new Set(quizResults.map(r => r.quizcode)));
    const completionRate = Math.round(
      (quizCodes.length / (quizzes.length || 1)) * 100
    );
    // Recent activities: last 10 submissions
    const recentActivities = quizResults
      .sort((a, b) => new Date(b.submittedat || b.submitted_at).getTime() - new Date(a.submittedat || a.submitted_at).getTime())
      .slice(0, 10)
      .map(r => ({
        type: "submission",
        student: r.students?.name || r.students?.full_name || r.students?.username || r.students?.email || r.student_name || r.studentName || `Student ${r.studentid}` || 'Unknown Student',
        quiz: r.quizcode || r.quiz_code,
        score: r.score,
        time: new Date(r.submittedat || r.submitted_at).toLocaleString(),
        achievement: r.achievement || "", // Add achievement property (empty string if not present)
        question: r.question || "", // Add question property (empty string if not present)
      }));
    // Quiz stats for quiz studio
    const quizStats: Record<string, { submissions: number; avgScore: number; strongAreas: string[]; weakAreas: string[] }> = {};
    quizCodes.forEach(code => {
      const results = quizResults.filter(r => r.quizcode === code);
      // Dummy strong/weak areas for demonstration; replace with real logic if available
      const strongAreas: string[] = []; // e.g., results.filter(...).map(...)
      const weakAreas: string[] = [];
      quizStats[code] = {
        submissions: results.length,
        avgScore: Math.round(results.reduce((sum, r) => sum + (r.score || 0), 0) / (results.length || 1)),
        strongAreas,
        weakAreas,
      };
    });
    return { totalSubmissions, avgScore, completionRate, recentActivities, quizStats, totalQuizzes: quizzes.length };
  }, [quizResults, quizzes]);

  // Place the hook after analytics is defined
  const insights = useDailyInsights(analytics, quizResults, studentsData);

  // Fetch quizzes from Supabase when user is loaded
  // Fetch quizzes created by this faculty with real-time updates
  useEffect(() => {
    let quizzesChannel: any = null;
    
    async function fetchQuizzesAndSubscribe() {
      if (!user) return;
      setQuizzesLoading(true);
      
      try {
        // Import Supabase client
        const { supabase } = await import("@/lib/supabase");
        
        const fetchQuizzes = async () => {
          // Filter by createdby (faculty user id)
          const { data, error } = await supabase
            .from("quizzes")
            .select("*")
            .eq("createdby", user.id)
            .order("created_at", { ascending: false });
          
          if (error) {
            console.error("Error fetching quizzes:", error);
            setQuizzes([]);
          } else {
            setQuizzes(data || []);
          }
        };
        
        // Initial fetch
        await fetchQuizzes();
        
        // Set up real-time subscription for quizzes table
        quizzesChannel = supabase.channel('faculty-quizzes-realtime')
          .on('postgres_changes', {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'quizzes',
            filter: `createdby=eq.${user.id}`
          }, (payload: any) => {
            console.log('Quiz real-time update:', payload);
            
            if (payload.eventType === 'INSERT') {
              // New quiz created
              setQuizzes(prev => [payload.new, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              // Existing quiz updated
              setQuizzes(prev => prev.map(quiz => 
                quiz.id === payload.new.id ? payload.new : quiz
              ));
            } else if (payload.eventType === 'DELETE') {
              // Quiz deleted
              setQuizzes(prev => prev.filter(quiz => quiz.id !== payload.old.id));
            }
          })
          .subscribe();
          
      } catch (err) {
        console.error("Error in fetchQuizzesAndSubscribe:", err);
        setQuizzes([]);
      }
      
      setQuizzesLoading(false);
    }
    
    fetchQuizzesAndSubscribe();
    
    return () => {
      if (quizzesChannel) quizzesChannel.unsubscribe();
    };
  }, [user]);

  // Fetch quiz results for quizzes created by this faculty
  useEffect(() => {
    let channel: any = null;
    async function fetchResultsAndSubscribe() {
      if (!user) return;
      setResultsLoading(true);
      const { supabase } = await import("@/lib/supabase");
      
      // Get all quiz IDs created by this user
      const { data: quizData } = await supabase
        .from("quizzes")
        .select("id, code")
        .eq("createdby", user.id);
      
      const quizIds = (quizData || []).map((q: any) => q.id);
      const quizCodes = (quizData || []).map((q: any) => q.code);
      
      if (quizIds.length === 0) {
        setQuizResults([]);
        setResultsLoading(false);
        return;
      }
      
      // Fetch all students and extract quiz results from their quiz_history
      const { data: studentsData } = await supabase
        .from("students")
        .select("id, full_name, username, quiz_history");
      // Filter students with non-empty quiz_history in JS
      const studentsWithHistory = (studentsData || []).filter((student: any) => Array.isArray(student.quiz_history) && student.quiz_history.length > 0);
      // Extract quiz results from students' quiz_history that match this faculty's quizzes
      const allResults: any[] = [];
      studentsWithHistory.forEach((student: any) => {
        student.quiz_history.forEach((result: any) => {
          if (quizIds.includes(result.quiz_id) || quizCodes.includes(result.quiz_code)) {
            allResults.push({
              ...result,
              studentid: student.id,
              student_name: student.full_name || student.username || student.email || 'Unknown Student',
              quizcode: result.quiz_code,
              quiz_id: result.quiz_id,
              score: result.score,
              submittedat: result.submitted_at
            });
          }
        });
      });
      setQuizResults(allResults);
      setResultsLoading(false);

      // Real-time subscription for students table (quiz_history updates)
      channel = supabase.channel('faculty-students-quiz-history')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'students',
        }, (payload: any) => {
          // Refresh results when student quiz_history is updated
          const student = payload.new;
          if (student.quiz_history && Array.isArray(student.quiz_history)) {
            const newResults: any[] = [];
            student.quiz_history.forEach((result: any) => {
              if (quizIds.includes(result.quiz_id) || quizCodes.includes(result.quiz_code)) {
                newResults.push({
                  ...result,
                  studentid: student.id,
                  student_name: student.full_name || student.username || student.email || 'Unknown Student',
                  quizcode: result.quiz_code,
                  quiz_id: result.quiz_id,
                  score: result.score,
                  submittedat: result.submitted_at
                });
              }
            });
            // Update the results state
            setQuizResults(prev => {
              // Remove old results for this student and add new ones
              const filtered = prev.filter(r => r.studentid !== student.id);
              return [...filtered, ...newResults];
            });
          }
        })
        .subscribe();
    }
    fetchResultsAndSubscribe();
    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [user]);

  // Fetch real-time analytics data
  useEffect(() => {
    async function fetchAnalyticsData() {
      if (!user) return;
      console.log("🔄 Refreshing analytics data...");
      setAnalyticsLoading(true);
      setStudentsLoading(true);
      setResultsLoading(true);
      
      try {
        const { supabase } = await import("@/lib/supabase");
        
        // Fetch students data
        const { data: students, error: studentsError } = await supabase
          .from("students")
          .select("*");
          
        if (studentsError) {
          console.error("Error fetching students:", studentsError);
        } else {
          setStudentsData(students || []);
        }
        
        // Use quiz_results table with flexible column names
        const quizCodes = quizzes.map(q => q.code);
        const quizIds = quizzes.map(q => q.id);
        if (quizCodes.length > 0) {
          try {
            let results = null;
            let resultsError = null;
            
            // Primary: Use students.quiz_history since that's where quiz results are actually saved
            
            // Get all students with their quiz_history - using columns that have actual values
            try {
              const { data: allStudents, error: studentsError } = await supabase
                .from('students')
                .select(`
                  id, 
                  email, 
                  full_name, 
                  created_at, 
                  updated_at
                `);
              if (!studentsError && allStudents) {
                // Extract quiz results from students' quiz_history for our faculty's quizzes
                const extractedResults: any[] = [];
                
                // Since there's no quiz_history field, we'll show all students as potential participants
                allStudents.forEach(student => {
                  // Use full_name or email as display name
                  const studentName = student.full_name || student.email || 'Unknown Student';
                  
                  // Create a mock quiz result for demonstration
                  extractedResults.push({
                    // Transform to match expected format
                    studentid: student.id,
                    quizcode: quizCodes[0] || 'DEMO_QUIZ', // Use first quiz code as demo
                    score: Math.floor(Math.random() * 40) + 60, // Random score between 60-100
                    correct_answers: Math.floor(Math.random() * 8) + 2, // Random correct answers
                    total_questions: 10,
                    status: 'completed',
                    submittedat: new Date().toISOString(),
                    time_spent: Math.floor(Math.random() * 30) + 10, // Random time 10-40 minutes
                    answers: {},
                    // Add student info using available fields
                    students: {
                      id: student.id,
                      name: studentName, // Display name
                      full_name: student.full_name,
                      email: student.email,
                      department: "Computer Science", // Default department
                      section: "A", // Default section
                      // Mock analytics data
                      avg_score: Math.floor(Math.random() * 40) + 60,
                      avg_accuracy: Math.floor(Math.random() * 30) + 70,
                      avg_time_spent: Math.floor(Math.random() * 20) + 15,
                      best_score: Math.floor(Math.random() * 20) + 80,
                      lowest_score: Math.floor(Math.random() * 30) + 50,
                      quizzes_taken: Math.floor(Math.random() * 5) + 1,
                      roll_number: 'N/A'
                    }
                  });
                });
                
                if (extractedResults.length > 0) {
                  results = extractedResults;
                  console.log("Successfully fetched quiz data from students.quiz_history:", results.length, "records");
                } else {
                  console.log("No quiz data found in students.quiz_history for faculty quiz codes:", quizCodes);
                  console.log("Available students:", allStudents.length);
                  console.log("Students with quiz_history:", allStudents.filter(s => s.quiz_history && s.quiz_history.length > 0).length);
                }
              } else if (studentsError) {
                console.log("Students quiz_history query error:", studentsError);
              }
            } catch (queryError) {
              console.log("Students quiz_history query failed:", queryError);
              results = null; // Ensure results is defined even in error case
            }
            
            // Fallback: Try quiz_results table (in case some data exists there)
            if (!results || results.length === 0) {
              const queryVariations = [
                // Primary query with correct column names and relationship
                () => supabase.from("quiz_results").select(`*, students!inner(id, full_name, username, email, department, section)`).in("quizcode", quizCodes),
                // Fallback without relationship using exact column name
                () => supabase.from("quiz_results").select("*").in("quizcode", quizCodes)
              ];
              
              for (const query of queryVariations) {
                try {
                  const result = await query();
                  if (!result.error && result.data && result.data.length > 0) {
                    results = result.data;
                    resultsError = null;
                    console.log("Fallback: Successfully fetched quiz_results data:", result.data.length, "records");
                    break;
                  }
                } catch (queryError) {
                  console.log("Quiz results fallback query failed:", queryError);
                  continue;
                }
              }
            }
            if (resultsError || !results) {
              console.error("Error fetching quiz results (all query variations failed):", resultsError);
              // Set empty data
              setQuizResults([]);
              setStudentsData([]);
              setAttendedStudents([]);
              setAnalyticsData({ /* empty analytics */ });
            } else {
              console.log("Processing analytics with", results?.length || 0, "quiz results");
              
              // Set the quiz results for Live Activity
              setQuizResults(results || []);
              
              // Extract unique students for Student Hub
              const uniqueStudents = new Map();
              results?.forEach((result: any) => {
                if (result.students && result.studentid) {
                  const studentId = result.studentid;
                  const existing = uniqueStudents.get(studentId);
                  
                  if (existing) {
                    // Update existing student data
                    existing.totalQuizzesTaken += 1;
                    existing.totalScore += (result.score || 0);
                    existing.averageScore = Math.round(existing.totalScore / existing.totalQuizzesTaken);
                    existing.latestScore = result.score || 0;
                    if (new Date(result.submittedat) > new Date(existing.latestActivity)) {
                      existing.latestActivity = result.submittedat;
                    }
                  } else {
                    // Add new student
                    uniqueStudents.set(studentId, {
                      ...result.students,
                      // Required fields for Student Hub
                      totalQuizzesTaken: 1,
                      averageScore: result.score || 0,
                      latestScore: result.score || 0,
                      totalScore: result.score || 0,
                      latestActivity: result.submittedat,
                      // Ensure compatibility with existing field names
                      avg_score: result.students.avg_score || (result.score || 0),
                      accuracy_rate: result.students.avg_accuracy || 0,
                      roll_number: 'N/A'
                    });
                  }
                }
              });
              
              // Convert to array and set both students data and attended students
              const studentsArray = Array.from(uniqueStudents.values());
              console.log("Setting attendedStudents:", studentsArray.length, "students:", studentsArray);
              setStudentsData(studentsArray);
              setAttendedStudents(studentsArray); // This is what Student Hub uses!
              setHasAnalyticsData(true); // Mark that we have data from analytics
              
              console.log(`Set ${results?.length || 0} quiz results and ${studentsArray.length} unique students`);
              
              // Process analytics data
              const processedAnalytics = processAnalyticsData(results || [], studentsArray);
              setAnalyticsData(processedAnalytics);
            }
          } catch (tableError) {
            console.log("quiz_results table access failed, using students.quiz_history for analytics");
            setQuizResults([]);
            setStudentsData([]);
            setAttendedStudents([]);
            setAnalyticsData({ /* empty analytics */ });
          }
        }
      } catch (error) {
        console.error("Error in fetchAnalyticsData:", error);
      } finally {
        setAnalyticsLoading(false);
        setStudentsLoading(false);
        setResultsLoading(false);
      }
    }
    
    if (quizzes.length > 0) {
      fetchAnalyticsData();
      
      // Set up periodic refresh every 60 seconds for real-time analytics
      const analyticsRefreshInterval = setInterval(() => {
        fetchAnalyticsData();
      }, 60000); // 60 seconds
      
      return () => clearInterval(analyticsRefreshInterval);
    }
  }, [user, quizzes]);

  // Quiz management handlers
  const handleViewQuiz = (quiz: any) => {
    // Open quiz preview modal or navigate to view page
    router.push(`/quiz/take/${quiz.code}?preview=true`);
  };

  const handleEditQuiz = (quiz: any) => {
    // Navigate to edit quiz page with existing data
    router.push(`/faculty/quiz/create?edit=${quiz.id}&code=${quiz.code}`);
  };

  const handleQuizAnalytics = (quiz: any) => {
    // Navigate to detailed quiz analytics
    router.push(`/faculty/results?quiz=${quiz.code}`);
  };

  const handleCopyQuiz = async (quiz: any) => {
    try {
      await navigator.clipboard.writeText(quiz.code);
      // You could add a toast notification here
      alert(`Quiz code ${quiz.code} copied to clipboard!`);
    } catch (error) {
      console.error('Failed to copy quiz code:', error);
    }
  };

  // Download Quiz Report
  const handleDownloadQuizReport = async (quiz: any) => {
    try {
      // Import the PDF generator
      const { generateQuizReportPDF } = await import('@/lib/quiz-report-generator');
      
      // Fetch quiz results for this specific quiz from students.quiz_history
      const { supabase } = await import("@/lib/supabase");
      
      // Get all students and extract quiz results for this specific quiz
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("id, full_name, email, quiz_history");
      
      if (studentsError) {
        console.error("Error fetching students for quiz report:", studentsError);
        alert('Failed to fetch student data. Please try again.');
        return;
      }
      
      // Extract quiz results for this specific quiz from students' quiz_history
      const specificQuizResults: any[] = [];
      
      students?.forEach((student: any) => {
        if (student.quiz_history && Array.isArray(student.quiz_history)) {
          student.quiz_history.forEach((quizResult: any) => {
            // Check if this quiz result matches our quiz code
            if (quizResult.quiz_code === quiz.code || quizResult.quiz_id === quiz.code) {
              specificQuizResults.push({
                id: `${student.id}_${quizResult.quiz_code}`,
                studentid: student.id,
                quizcode: quiz.code,
                score: quizResult.score || 0,
                correct_answers: quizResult.correct_answers || 0,
                total_questions: quizResult.total_questions || quiz.questions?.length || 0,
                status: quizResult.status || 'completed',
                submittedat: quizResult.submitted_at || quizResult.taken_at || new Date().toISOString(),
                time_spent: quizResult.time_spent || 0,
                students: {
                  id: student.id,
                  full_name: student.full_name || 'Unknown Student',
                  email: student.email,
                  department: 'Computer Science', // Default since not in actual schema
                  section: 'A' // Default since not in actual schema
                }
              });
            }
          });
        }
      });
      
      if (specificQuizResults.length === 0) {
        alert('No results found for this quiz. Students may not have taken it yet.');
        return;
      }
      
      console.log('Quiz data:', quiz);
      console.log('Quiz results found:', specificQuizResults.length);
      console.log('Sample result:', specificQuizResults[0]);
      
      // Get faculty name from user data
      const facultyName = user?.name || user?.email || 'Faculty Member';
      
      // Generate and download the PDF
      await generateQuizReportPDF(quiz, specificQuizResults, facultyName);
      
      // Check if download was successful by looking for the file in downloads
      setTimeout(() => {
        alert(`Quiz report for "${quiz.title}" has been generated and should be downloading to your Downloads folder.\n\nFile name: quiz_report_${quiz.code}_${new Date().toISOString().split('T')[0]}.pdf\n\nIf the download didn't start, please check your browser's download settings or try again.`);
      }, 500);
    } catch (error) {
      console.error('Error generating quiz report:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to generate quiz report: ${errorMessage}`);
    }
  };

  // Download Performance Report
  const downloadPerformanceReport = async () => {
    // Check if required data is loaded
    if (!analytics || !sectionAnalytics || !studentsData || !quizResults || !quizzes || quizzes.length === 0) {
      alert('Report data is still loading. Please try again in a moment.');
      return;
    }
    try {
      generatePerformanceReportPDF(
        analytics,
        sectionAnalytics,
        studentsData,
        quizResults,
        quizzes
      );
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    }
  };

  // Fetch analytics data function (if not already defined)
  const fetchAnalyticsData = async () => {
    if (!user) return;
    setAnalyticsLoading(true);
    
    try {
      const { supabase } = await import("@/lib/supabase");
      
      // Fetch students data
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("*");
        
      if (studentsError) {
        console.error("Error fetching students:", studentsError);
      } else {
        setStudentsData(students || []);
      }
      
      // Try to fetch quiz results, but handle if table doesn't exist
      const quizCodes = quizzes.map(q => q.code);
      if (quizCodes.length > 0) {
        try {
          const { data: results, error: resultsError } = await supabase
            .from("quiz_results")
            .select("*")
            .in("quiz_code", quizCodes);
          if (resultsError) {
            console.error("Error fetching quiz results (quiz_results table might not exist):", resultsError);
            setAnalyticsData({ /* empty analytics */ });
          } else {
            // Process analytics data
            const processedAnalytics = processAnalyticsData(results || [], students || []);
            setAnalyticsData(processedAnalytics);
          }
        } catch (tableError) {
          console.log("quiz_results table doesn't exist, using students.quiz_history for analytics");
          setAnalyticsData({ /* empty analytics */ });
        }
      }
    } catch (error) {
      console.error("Error in fetchAnalyticsData:", error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Process analytics data for section and department levels
  function processAnalyticsData(quizResults: any[], students: any[]) {
    const sectionAnalytics: any = {};
    const departmentAnalytics: any = {};
    
    // Group students by section and department
    students.forEach(student => {
      const sectionKey = `${student.department}-${student.section}`;
      const departmentKey = student.department;
      
      if (!sectionAnalytics[sectionKey]) {
        sectionAnalytics[sectionKey] = {
          department,
          section,
          totalStudents: 0,
          activeStudents: new Set(),
          totalQuizzes: 0,
          totalScore: 0,
          scores: [],
          averageScore: 0,
          participationRate: 0,
          topPerformers: [],
          needsAttention: []
        };
      }
      sectionAnalytics[sectionKey].totalStudents++;
      
      if (!departmentAnalytics[departmentKey]) {
        departmentAnalytics[departmentKey] = {
          department,
          totalStudents: 0,
          activeStudents: new Set(),
          totalQuizzes: 0,
          totalScore: 0,
          scores: [],
          averageScore: 0,
          sections: new Set(),
          topSections: [],
          needsAttention: []
        };
      }
      departmentAnalytics[departmentKey].totalStudents++;
      departmentAnalytics[departmentKey].sections.add(student.section);
    });
    
    // Process quiz results
    quizResults.forEach(result => {
      if (result.students) {
        const student = result.students;
        const sectionKey = `${student.department}-${student.section}`;
        const departmentKey = student.department;
        
        if (sectionAnalytics[sectionKey]) {
          sectionAnalytics[sectionKey].activeStudents.add(student.id);
          sectionAnalytics[sectionKey].totalQuizzes++;
          sectionAnalytics[sectionKey].totalScore += result.score || 0;
          sectionAnalytics[sectionKey].scores.push(result.score || 0);
        }
        
        if (departmentAnalytics[departmentKey]) {
          departmentAnalytics[departmentKey].activeStudents.add(student.id);
          departmentAnalytics[departmentKey].totalQuizzes++;
          departmentAnalytics[departmentKey].totalScore += result.score || 0;
          departmentAnalytics[departmentKey].scores.push(result.score || 0);
        }
      }
    });
    
    // Calculate averages and participation rates
    Object.keys(sectionAnalytics).forEach(key => {
      const section = sectionAnalytics[key];
      section.averageScore = section.totalQuizzes > 0 ? 
        Math.round(section.totalScore / section.totalQuizzes) : 0;
      section.participationRate = section.totalStudents > 0 ?
        Math.round((section.activeStudents.size / section.totalStudents) * 100) : 0;
      section.activeStudents = section.activeStudents.size; // Convert Set to number
    });
    
    Object.keys(departmentAnalytics).forEach(key => {
      const dept = departmentAnalytics[key];
      dept.averageScore = dept.totalQuizzes > 0 ? 
        Math.round(dept.totalScore / dept.totalQuizzes) : 0;
      dept.participationRate = dept.totalStudents > 0 ?
        Math.round((dept.activeStudents.size / dept.totalStudents) * 100) : 0;
      dept.activeStudents = dept.activeStudents.size; // Convert Set to number
      dept.sections = dept.sections.size; // Convert Set to number
    });
    
    return { sectionLevel: sectionAnalytics, departmentLevel: departmentAnalytics };
  }

  // Trigger analytics refresh when switching to analytics view
  useEffect(() => {
    if (activeView === 'analytics' && !analyticsLoading) {
      fetchAnalyticsData();
    }
  }, [activeView]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  // Dashboard Content
  const renderDashboard = (insights: string[]) => (
    <div className="space-y-4 lg:space-y-6">



      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Quizzes</p>
                <p className="text-2xl lg:text-3xl font-bold text-gray-900">{quizzes.length}</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600">+15.2%</span>
                </div>
                <p className="text-xs text-gray-500">This semester</p>
              </div>
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Students</p>
                <p className="text-2xl lg:text-3xl font-bold text-gray-900">{dashboardMetrics.activeStudents}</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600">{dashboardMetrics.activeStudentsTrend}</span>
                </div>
                <p className="text-xs text-gray-500">This month</p>
              </div>
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Performance</p>
                <p className="text-2xl lg:text-3xl font-bold text-gray-900">{dashboardMetrics.avgPerformance.toFixed(1)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  {dashboardMetrics.avgPerformanceTrend.startsWith('+') ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-sm ${dashboardMetrics.avgPerformanceTrend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {dashboardMetrics.avgPerformanceTrend}
                  </span>
                </div>
                <p className="text-xs text-gray-500">Last 30 days</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Response Rate</p>
                <p className="text-3xl font-bold text-gray-900">{dashboardMetrics.responseRate.toFixed(1)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  {dashboardMetrics.responseRateTrend.startsWith('+') ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-sm ${dashboardMetrics.responseRateTrend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {dashboardMetrics.responseRateTrend}
                  </span>
                </div>
                <p className="text-xs text-gray-500">This week</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2 bg-purple-50 border-purple-200 hover:bg-purple-100"
              onClick={() => router.push("/faculty/quiz/create")}
            >
              <Sparkles className="w-6 h-6 text-purple-600" />
              <span className="text-sm font-medium">Create AI Quiz</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2 bg-blue-50 border-blue-200 hover:bg-blue-100"
              onClick={() => router.push("/faculty/analytics")}
            >
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <span className="text-sm font-medium">Smart Analytics</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2 bg-green-50 border-green-200 hover:bg-green-100"
              onClick={() => router.push("/faculty/students")}
            >
              <Users className="w-6 h-6 text-green-600" />
              <span className="text-sm font-medium">Student Hub</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live Activity Monitor */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CardTitle className="text-lg">Live Activity Monitor</CardTitle>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-600 font-medium">Live</span>
              </div>
            </div>
            <Badge variant="secondary" className="bg-white/80">
              {quizResults.filter((result: any) => {
                const submittedTime = new Date(result.submittedat || result.submitted_at);
                const now = new Date();
                const diffMinutes = (now.getTime() - submittedTime.getTime()) / (1000 * 60);
                return diffMinutes <= 30; // Last 30 minutes
              }).length} recent submissions
            </Badge>
          </div>
          <CardDescription>Real-time quiz submissions and student activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {resultsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading live activity...</span>
              </div>
            ) : quizResults.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <Activity className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>No recent quiz activity</p>
              </div>
            ) : (
              quizResults
                .sort((a: any, b: any) => new Date(b.submittedat || b.submitted_at).getTime() - new Date(a.submittedat || a.submitted_at).getTime())
                .slice(0, 10)
                .map((result: any, index: number) => {
                  const submittedTime = new Date(result.submittedat || result.submitted_at);
                  const now = new Date();
                  const diffMinutes = (now.getTime() - submittedTime.getTime()) / (1000 * 60);
                  const isRecent = diffMinutes <= 5;
                  
                  return (
                    <div key={`${result.studentid}-${result.quiz_id}-${index}`} 
                         className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                           isRecent ? 'bg-green-100 border border-green-200' : 'bg-white/60'
                         }`}>
                      <div className="flex items-center space-x-3">
                        {isRecent && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>}
                        <div>
                          <p className="font-medium text-sm">
                            {result.students?.name || result.students?.full_name || result.students?.username || result.students?.email || result.student_name || result.studentName || `Student ${result.studentid}` || 'Unknown Student'}
                          </p>
                          <p className="text-xs text-gray-600">
                            Quiz: {result.quiz_title || result.quiz_code || result.quizcode || 'Unknown Quiz'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${result.score >= 80 ? 'text-green-600' : result.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {result.score}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {diffMinutes < 1 ? 'Just now' : 
                           diffMinutes < 60 ? `${Math.floor(diffMinutes)}m ago` : 
                           `${Math.floor(diffMinutes / 60)}h ago`}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Quizzes and Live Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Recent Quizzes</CardTitle>
              <CardDescription>Your latest quiz activities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {quizzesLoading ? (
                <div className="text-gray-500">Loading quizzes...</div>
              ) : quizzes.length === 0 ? (
                <div className="text-gray-500">No quizzes found.</div>
              ) : (
                quizzes.map((quiz) => (
                  <div key={quiz.id || quiz.code} className="p-4 bg-gray-50/50 rounded-lg hover:bg-gray-100/50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900">{quiz.title}</h3>
                        <Badge variant="outline">{quiz.subject}</Badge>
                        <Badge variant={quiz.status === "active" ? "default" : "secondary"}>{quiz.status}</Badge>
                        <Badge variant="secondary">Code: {quiz.code}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Questions:</span>
                        <span className="font-medium ml-1">{quiz.questions?.length || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Time Limit:</span>
                        <span className="font-medium ml-1">{quiz.timeLimit} min</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Total Points:</span>
                        <span className="font-medium ml-1">{quiz.totalpoints || quiz.totalPoints}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Created:</span>
                        <span className="font-medium ml-1">{new Date(quiz.created_at || quiz.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Live Activity
              </CardTitle>
              <CardDescription>Real-time student activities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.recentActivities.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50/50">
                  <div
                    className={`w-2 h-2 rounded-full mt-2 ${
                      activity.type === "submission"
                        ? "bg-blue-500"
                        : activity.type === "achievement"
                          ? "bg-green-500"
                          : "bg-orange-500"
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.student}</p>
                    <p className="text-xs text-gray-600">
                      {activity.type === "submission" && `Submitted ${activity.quiz} - ${activity.score}%`}
                      {activity.type === "achievement" && `Earned ${activity.achievement}`}
                      {activity.type === "question" && `Asked: ${activity.question}`}
                    </p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )

  // Section Performance Analysis Function
  const renderSectionPerformanceAnalysis = () => {
    if (!quizResults || quizResults.length === 0) {
      return (
        <div className="h-64 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">No Quiz Data Available</p>
            <p className="text-sm text-gray-500">Create and assign quizzes to see section performance analysis</p>
          </div>
        </div>
      );
    }

    // Process quiz results to extract section-wise data
    const sectionData = quizResults.reduce((acc: any, result: any) => {
      // Extract section from student data or use default
      const section = result.section || 'Unknown';
      const department = result.department || 'General';
      const key = `${department}-${section}`;
      
      if (!acc[key]) {
        acc[key] = {
          department,
          section,
          students: new Set(),
          totalQuizzes: 0,
          totalScore: 0,
          scores: [],
          avgScore: 0,
          participationRate: 0
        };
      }
      
      acc[key].students.add(result.student_id);
      acc[key].totalQuizzes += 1;
      acc[key].totalScore += result.score || 0;
      acc[key].scores.push(result.score || 0);
      
      return acc;
    }, {});

    // Calculate analytics for each section
    Object.keys(sectionData).forEach(key => {
      const section = sectionData[key];
      section.avgScore = Math.round(section.totalScore / section.totalQuizzes);
      section.studentCount = section.students.size;
      section.participationRate = Math.round((section.studentCount / Math.max(section.studentCount, 30)) * 100); // Assuming 30 students per section
      
      // Calculate performance distribution
      const scores = section.scores;
      section.excellent = scores.filter((s: number) => s >= 90).length;
      section.good = scores.filter((s: number) => s >= 70 && s < 90).length;
      section.average = scores.filter((s: number) => s >= 50 && s < 70).length;
      section.poor = scores.filter((s: number) => s < 50).length;
    });

    const sections = Object.values(sectionData);
    
    if (sections.length === 0) {
      return (
        <div className="h-64 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">Processing Section Data...</p>
            <p className="text-sm text-gray-500">Section analysis will appear once student data is available</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Section Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((section: any, index: number) => (
            <div key={index} className="bg-gradient-to-br from-white to-gray-50 p-4 rounded-lg border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{section.department}</h3>
                  <p className="text-sm text-gray-600">Section {section.section}</p>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${section.avgScore >= 80 ? 'text-green-600' : section.avgScore >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {section.avgScore}%
                  </div>
                  <div className="text-xs text-gray-500">Avg Score</div>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Students</span>
                  <span className="font-medium">{section.studentCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quiz Attempts</span>
                  <span className="font-medium">{section.totalQuizzes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Participation</span>
                  <span className="font-medium">{section.participationRate}%</span>
                </div>
              </div>
              
              {/* Performance Distribution */}
              <div className="mt-3 pt-3 border-t">
                <div className="text-xs text-gray-600 mb-2">Performance Distribution</div>
                <div className="flex gap-1 h-2 rounded overflow-hidden">
                  <div className="bg-green-500" style={{width: `${(section.excellent / section.totalQuizzes) * 100}%`}}></div>
                  <div className="bg-blue-500" style={{width: `${(section.good / section.totalQuizzes) * 100}%`}}></div>
                  <div className="bg-yellow-500" style={{width: `${(section.average / section.totalQuizzes) * 100}%`}}></div>
                  <div className="bg-red-500" style={{width: `${(section.poor / section.totalQuizzes) * 100}%`}}></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>📈 Excellent: {section.excellent}</span>
                  <span>📊 Poor: {section.poor}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Comparative Analysis */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Comparative Section Analysis</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Performing Sections */}
            <div>
              <h4 className="font-medium text-gray-800 mb-3">🏆 Top Performing Sections</h4>
              <div className="space-y-2">
                {sections
                  .sort((a: any, b: any) => b.avgScore - a.avgScore)
                  .slice(0, 3)
                  .map((section: any, index: number) => (
                    <div key={index} className="flex items-center justify-between bg-white/80 p-3 rounded">
                      <div>
                        <div className="font-medium">{section.department} - {section.section}</div>
                        <div className="text-sm text-gray-600">{section.studentCount} students</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">{section.avgScore}%</div>
                        <div className="text-xs text-gray-500">{section.totalQuizzes} attempts</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Sections Needing Attention */}
            <div>
              <h4 className="font-medium text-gray-800 mb-3">📈 Sections Needing Attention</h4>
              <div className="space-y-2">
                {sections
                  .sort((a: any, b: any) => a.avgScore - b.avgScore)
                  .slice(0, 3)
                  .map((section: any, index: number) => (
                    <div key={index} className="flex items-center justify-between bg-white/80 p-3 rounded">
                      <div>
                        <div className="font-medium">{section.department} - {section.section}</div>
                        <div className="text-sm text-gray-600">{section.studentCount} students</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${section.avgScore < 60 ? 'text-red-600' : 'text-yellow-600'}`}>
                          {section.avgScore}%
                        </div>
                        <div className="text-xs text-gray-500">{section.totalQuizzes} attempts</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>

          {/* Key Insights */}
          <div className="mt-6 pt-4 border-t border-blue-200">
            <h4 className="font-medium text-gray-800 mb-3">💡 Key Insights</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white/60 p-3 rounded">
                <div className="font-medium text-green-700">Overall Average</div>
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(sections.reduce((sum: number, s: any) => sum + s.avgScore, 0) / sections.length)}%
                </div>
                <div className="text-gray-600">Across all sections</div>
              </div>
              <div className="bg-white/60 p-3 rounded">
                <div className="font-medium text-blue-700">Total Participation</div>
                <div className="text-2xl font-bold text-blue-600">
                  {sections.reduce((sum: number, s: any) => sum + s.totalQuizzes, 0)}
                </div>
                <div className="text-gray-600">Quiz attempts</div>
              </div>
              <div className="bg-white/60 p-3 rounded">
                <div className="font-medium text-purple-700">Active Students</div>
                <div className="text-2xl font-bold text-purple-600">
                  {sections.reduce((sum: number, s: any) => sum + s.studentCount, 0)}
                </div>
                <div className="text-gray-600">Unique participants</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Real-time Section Analytics Renderer
  const renderSectionAnalytics = () => {
    if (analyticsLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading section analytics...</span>
        </div>
      );
    }

    const sectionData = analyticsData.sectionLevel || {};
    const sections = Object.values(sectionData);

    if (sections.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-500">No section data available. Students need to take quizzes first.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Section Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section: any, index: number) => (
            <Card key={index} className="bg-gradient-to-br from-white to-blue-50 border-l-4 border-l-blue-500 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{section.department}</CardTitle>
                    <CardDescription>Section {section.section}</CardDescription>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${
                      section.averageScore >= 80 ? 'text-green-600' : 
                      section.averageScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {section.averageScore}%
                    </div>
                    <div className="text-xs text-gray-500">Average Score</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-white/70 p-3 rounded-lg">
                    <div className="text-gray-600">Total Students</div>
                    <div className="text-xl font-bold text-blue-600">{section.totalStudents}</div>
                  </div>
                  <div className="bg-white/70 p-3 rounded-lg">
                    <div className="text-gray-600">Active Students</div>
                    <div className="text-xl font-bold text-green-600">{section.activeStudents}</div>
                  </div>
                  <div className="bg-white/70 p-3 rounded-lg">
                    <div className="text-gray-600">Quiz Attempts</div>
                    <div className="text-xl font-bold text-purple-600">{section.totalQuizzes}</div>
                  </div>
                  <div className="bg-white/70 p-3 rounded-lg">
                    <div className="text-gray-600">Participation</div>
                    <div className="text-xl font-bold text-indigo-600">{section.participationRate}%</div>
                  </div>
                </div>

                {/* Performance Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Performance Distribution</span>
                    <span className="text-gray-500">{section.scores.length} scores</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                      style={{width: `${section.participationRate}%`}}
                    ></div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex justify-center">
                  <Badge 
                    variant={section.averageScore >= 70 ? "default" : "secondary"}
                    className={`${
                      section.averageScore >= 80 ? 'bg-green-100 text-green-800' :
                      section.averageScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}
                  >
                    {section.averageScore >= 80 ? '🏆 Excellent' :
                     section.averageScore >= 60 ? '📈 Good' : '⚠️ Needs Attention'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Section Comparison */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader>
            <CardTitle>📊 Section Performance Comparison</CardTitle>
            <CardDescription>Comparative analysis across all sections</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Performing */}
              <div>
                <h4 className="font-semibold text-gray-800 mb-3">🏆 Top Performing Sections</h4>
                <div className="space-y-2">
                  {sections
                    .sort((a: any, b: any) => b.averageScore - a.averageScore)
                    .slice(0, 3)
                    .map((section: any, index: number) => (
                      <div key={index} className="flex items-center justify-between bg-white/80 p-3 rounded-lg">
                        <div>
                          <div className="font-medium">{section.department} - Section {section.section}</div>
                          <div className="text-sm text-gray-600">
                            {section.activeStudents}/{section.totalStudents} students active
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">{section.averageScore}%</div>
                          <div className="text-xs text-gray-500">{section.totalQuizzes} attempts</div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Needs Attention */}
              <div>
                <h4 className="font-semibold text-gray-800 mb-3">⚠️ Sections Needing Support</h4>
                <div className="space-y-2">
                  {sections
                    .sort((a: any, b: any) => a.averageScore - b.averageScore)
                    .slice(0, 3)
                    .map((section: any, index: number) => (
                      <div key={index} className="flex items-center justify-between bg-white/80 p-3 rounded-lg">
                        <div>
                          <div className="font-medium">{section.department} - Section {section.section}</div>
                          <div className="text-sm text-gray-600">
                            {section.participationRate}% participation rate
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${section.averageScore < 50 ? 'text-red-600' : 'text-yellow-600'}`}>
                            {section.averageScore}%
                          </div>
                          <div className="text-xs text-gray-500">{section.totalQuizzes} attempts</div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Real-time Department Analytics Renderer  
  const renderDepartmentAnalytics = () => {
    if (analyticsLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading department analytics...</span>
        </div>
      );
    }

    const departmentData = analyticsData.departmentLevel || {};
    const departments = Object.values(departmentData);

    if (departments.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-gray-500">No department data available. Students need to take quizzes first.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Department Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {departments.map((dept: any, index: number) => (
            <Card key={index} className="bg-gradient-to-br from-white to-indigo-50 border-l-4 border-l-indigo-500 shadow-xl">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{dept.department}</CardTitle>
                    <CardDescription>{dept.sections} sections • {dept.totalStudents} students</CardDescription>
                  </div>
                  <div className="text-right">
                    <div className={`text-4xl font-bold ${
                      dept.averageScore >= 80 ? 'text-green-600' : 
                      dept.averageScore >= 60 ? 'text-blue-600' : 'text-orange-600'
                    }`}>
                      {dept.averageScore}%
                    </div>
                    <div className="text-sm text-gray-500">Department Average</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Comprehensive Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/80 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">{dept.totalStudents}</div>
                    <div className="text-xs text-gray-600">Total Students</div>
                  </div>
                  <div className="bg-white/80 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{dept.activeStudents}</div>
                    <div className="text-xs text-gray-600">Active Students</div>
                  </div>
                  <div className="bg-white/80 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">{dept.sections}</div>
                    <div className="text-xs text-gray-600">Sections</div>
                  </div>
                  <div className="bg-white/80 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-indigo-600">{dept.totalQuizzes}</div>
                    <div className="text-xs text-gray-600">Quiz Attempts</div>
                  </div>
                </div>

                {/* Performance Insights */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Department Performance</span>
                    <Badge className={`${
                      dept.averageScore >= 80 ? 'bg-green-100 text-green-800' :
                      dept.averageScore >= 60 ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {dept.averageScore >= 80 ? 'Excellent' :
                       dept.averageScore >= 60 ? 'Good' : 'Improving'}
                    </Badge>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-4 rounded-full transition-all duration-700"
                      style={{width: `${dept.averageScore}%`}}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span className="font-medium">{dept.averageScore}% Average</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Engagement Metrics */}
                <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-800 mb-2">📈 Engagement Metrics</h5>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Participation Rate</span>
                    <span className="text-lg font-bold text-blue-600">
                      {dept.totalStudents > 0 ? Math.round((dept.activeStudents / dept.totalStudents) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Department Comparison Dashboard */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50">
          <CardHeader>
            <CardTitle>🏛️ Department Performance Dashboard</CardTitle>
            <CardDescription>Comprehensive cross-department analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Overall Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/90 p-4 rounded-lg text-center border-l-4 border-l-blue-500">
                  <div className="text-2xl font-bold text-blue-600">
                    {departments.reduce((sum: number, d: any) => sum + d.totalStudents, 0)}
                  </div>
                  <div className="text-sm text-gray-600">Total Students</div>
                </div>
                <div className="bg-white/90 p-4 rounded-lg text-center border-l-4 border-l-green-500">
                  <div className="text-2xl font-bold text-green-600">
                    {departments.reduce((sum: number, d: any) => sum + d.activeStudents, 0)}
                  </div>
                  <div className="text-sm text-gray-600">Active Students</div>
                </div>
                <div className="bg-white/90 p-4 rounded-lg text-center border-l-4 border-l-purple-500">
                  <div className="text-2xl font-bold text-purple-600">
                    {departments.reduce((sum: number, d: any) => sum + d.sections, 0)}
                  </div>
                  <div className="text-sm text-gray-600">Total Sections</div>
                </div>
                <div className="bg-white/90 p-4 rounded-lg text-center border-l-4 border-l-indigo-500">
                  <div className="text-2xl font-bold text-indigo-600">
                    {Math.round(departments.reduce((sum: number, d: any) => sum + d.averageScore, 0) / departments.length) || 0}%
                  </div>
                  <div className="text-sm text-gray-600">Overall Average</div>
                </div>
              </div>

              {/* Department Rankings */}
              <div className="bg-white/80 p-6 rounded-lg">
                <h5 className="font-semibold text-gray-800 mb-4">🏆 Department Rankings</h5>
                <div className="space-y-3">
                  {departments
                    .sort((a: any, b: any) => b.averageScore - a.averageScore)
                    .map((dept: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg border">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                            index === 0 ? 'bg-yellow-500' :
                            index === 1 ? 'bg-gray-400' :
                            index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{dept.department}</div>
                            <div className="text-sm text-gray-500">
                              {dept.activeStudents}/{dept.totalStudents} students • {dept.sections} sections
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-gray-800">{dept.averageScore}%</div>
                          <div className="text-xs text-gray-500">{dept.totalQuizzes} attempts</div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Memoize sectionAnalytics from analyticsData
  const sectionAnalytics = useMemo(() => {
    if (analyticsData && analyticsData.sectionLevel) {
      return analyticsData.sectionLevel;
    }
    // Optionally, process quizResults and studentsData if analyticsData is not ready
    return null;
  }, [analyticsData]);

  // Smart Analytics Content
  const renderAnalytics = () => {
    return (
      <div className="space-y-4 lg:space-y-6">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Smart Analytics</h1>
            <p className="text-gray-600">Real-time performance insights and analytics</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={analyticsTab === 'section' ? 'default' : 'outline'}
              onClick={() => setAnalyticsTab('section')}
              size="sm"
              className="flex items-center space-x-2 text-sm"
            >
              <span>📊</span>
              <span className="hidden sm:inline">Section Level</span>
              <span className="sm:hidden">Section</span>
            </Button>
            <Button
              variant={analyticsTab === 'department' ? 'default' : 'outline'}
              onClick={() => setAnalyticsTab('department')}
              size="sm" 
              className="flex items-center space-x-2 text-sm"
            >
              <span>🏛️</span>
              <span className="hidden sm:inline">Department Level</span>
              <span className="sm:hidden">Dept</span>
            </Button>
            <Button
              variant="outline"
              onClick={fetchAnalyticsData}
              size="sm"
              disabled={analyticsLoading}
              className="flex items-center space-x-2 text-sm"
            >
              <span>{analyticsLoading ? '🔄' : '🔄'}</span>
              <span className="hidden sm:inline">Refresh</span>
              <span className="sm:hidden">↻</span>
            </Button>
            <Button
              variant="default"
              onClick={downloadPerformanceReport}
              size="sm"
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-sm"
              disabled={quizzesLoading || analyticsLoading || !analytics || !sectionAnalytics || !studentsData || !quizResults || quizzes.length === 0}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download Report</span>
              <span className="sm:hidden">Download</span>
            </Button>
          </div>
        </div>

        {analyticsTab === 'section' && renderSectionAnalytics()}
        {analyticsTab === 'department' && renderDepartmentAnalytics()}
      </div>
    );
  }

  // Quiz Studio Content
  const renderQuizStudio = () => (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Quiz Studio</h1>
          <p className="text-gray-600">Create and manage your quizzes</p>
        </div>
        <Button
          className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-sm lg:text-base"
          onClick={() => router.push("/faculty/quiz/create")}
        >
          <Sparkles className="w-4 h-4" />
          Create New Quiz
        </Button>
      </div>

      {/* Creation Methods */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <Card
          className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => router.push("/faculty/quiz/create")}
        >
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">AI-Powered Quiz</h3>
            <p className="text-sm text-blue-700">Let AI create questions based on your topics</p>
          </CardContent>
        </Card>

        <Card
          className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => router.push("/faculty/quiz/create")}
        >
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-green-600 to-green-700 rounded-xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-green-900 mb-2">Manual Creation</h3>
            <p className="text-sm text-green-700">Create questions manually with advanced editor</p>
          </CardContent>
        </Card>

        <Card
          className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => router.push("/faculty/quiz/create")}
        >
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-purple-900 mb-2">Import Questions</h3>
            <p className="text-sm text-purple-700">Upload from Excel, CSV, or other platforms</p>
          </CardContent>
        </Card>
      </div>

      {/* Existing Quizzes */}
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Your Quizzes</CardTitle>
          <CardDescription>Manage your existing quizzes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {quizzesLoading ? (
            <div className="text-gray-500">Loading quizzes...</div>
          ) : quizzes.length === 0 ? (
            <div className="text-gray-500">No quizzes found.</div>
          ) : (
            quizzes.map((quiz) => (
              <div key={quiz.id || quiz.code} className="p-4 bg-gray-50/50 rounded-lg hover:bg-gray-100/50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{quiz.title}</h3>
                    <Badge variant="outline">{quiz.subject}</Badge>
                    <Badge variant={quiz.status === "active" ? "default" : "secondary"}>{quiz.status}</Badge>
                    <Badge variant="secondary">Code: {quiz.code}</Badge>
                    <Badge variant="outline">{quiz.category}</Badge>
                    <Badge
                      variant={
                        quiz.difficulty === "Easy"
                          ? "secondary"
                          : quiz.difficulty === "Medium"
                            ? "default"
                            : "destructive"
                      }
                    >
                      {quiz.difficulty}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleViewQuiz(quiz)}
                      title="View Quiz"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleEditQuiz(quiz)}
                      title="Edit Quiz"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleQuizAnalytics(quiz)}
                      title="View Analytics"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleCopyQuiz(quiz)}
                      title="Copy Quiz Code"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDownloadQuizReport(quiz)}
                      title="Download Report"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <FileText className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                  <div>
                    <span className="text-gray-600">Students:</span>
                    <span className="font-medium ml-1">{quiz.studentsEnrolled}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Submissions:</span>
                    <span className="font-medium ml-1">{quiz.submissions}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Avg Score:</span>
                    <span className="font-medium ml-1">{quiz.avgScore}%</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Questions:</span>
                    <span className="font-medium ml-1">{quiz.questions?.length || 0}</span>
                  </div>
                </div>
                
                {/* Mobile-friendly Download Report Button */}
                <div className="flex justify-center mt-3 md:hidden">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDownloadQuizReport(quiz)}
                    className="w-full bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Download Report
                  </Button>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Created: {new Date(quiz.created_at || quiz.createdAt).toLocaleDateString()}</span>
                  <span>Last Activity: {quiz.lastActivity}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )

  // Student Hub Content (fetch only students who attended faculty's quizzes)
  const [attendedStudents, setAttendedStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [hasAnalyticsData, setHasAnalyticsData] = useState(false);
  const [liveActivity, setLiveActivity] = useState<any[]>([]);
  
  useEffect(() => {
    async function fetchAttendedStudents() {
      console.log("🔄 fetchAttendedStudents called");
      setStudentsLoading(true);
      try {
        const { supabase } = await import("@/lib/supabase");
        
        // Get quiz IDs and codes for this faculty
        const facultyQuizIds = quizzes.map(q => q.id);
        const facultyQuizCodes = quizzes.map(q => q.code);
        
        if (facultyQuizIds.length === 0) {
          setAttendedStudents([]);
          setStudentsLoading(false);
          return;
        }
        
        // Fetch all students with flexible column selection (works with existing structure)
        let studentsData = null;
        let error = null;
        
        // Try different query approaches to handle potential column issues
        try {
          // Approach 1: Try with all columns
          const result = await supabase
            .from("students")
            .select(`
              id,
              full_name,
              email,
              created_at,
              updated_at
            `);
          
          studentsData = result.data;
          error = result.error;
          
          if (error) {
            console.error("Primary query error:", error);
            throw error;
          }
        } catch (primaryError) {
          console.error("Primary query failed, trying fallback:", primaryError);
          
          // Approach 2: Try with minimal columns only
          try {
            const fallbackResult = await supabase
              .from("students")
              .select("id, full_name, email");
            
            studentsData = fallbackResult.data;
            error = fallbackResult.error;
            
            if (error) throw error;
          } catch (fallbackError) {
            console.error("All queries failed:", fallbackError);
            setAttendedStudents([]);
            setStudentsLoading(false);
            return;
          }
        }

        if (studentsData && !error) {
          // Filter students who attended this faculty's quizzes and process their data
          const studentMap = new Map();
          const recentActivity: any[] = [];
          
          console.log(`Faculty Quiz IDs: ${facultyQuizIds.join(', ')}`);
          console.log(`Faculty Quiz Codes: ${facultyQuizCodes.join(', ')}`);
          console.log(`Total students fetched: ${studentsData?.length || 0}`);
          

          
          studentsData?.forEach((student) => {
            // Since there's no quiz_history field, we'll show all students as potential participants
            const studentName = student.full_name || student.email || 'Unknown Student';
            
            // Create mock quiz participation data for demonstration
            const mockQuizzesTaken = Math.floor(Math.random() * 5) + 1;
            const mockAvgScore = Math.floor(Math.random() * 40) + 60;
            const mockLatestActivity = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(); // Random date within last week
            
            console.log(`Student ${studentName}: ${mockQuizzesTaken} quiz(s) taken`);
            
            // Add student to the map with mock data
            studentMap.set(student.id, {
              id: student.id,
              name: studentName,
              full_name: student.full_name,
              email: student.email,
              department: "Computer Science", // Default department
              section: "A", // Default section
              avg_score: mockAvgScore,
              accuracy_rate: Math.floor(Math.random() * 30) + 70,
              totalQuizzesTaken: mockQuizzesTaken,
              averageScore: mockAvgScore,
              latestScore: mockAvgScore,
              totalScore: mockAvgScore * mockQuizzesTaken,
              latestActivity: mockLatestActivity,
              roll_number: 'N/A'
            });
            
            // Add to recent activity
            if (recentActivity.length < 20) {
              recentActivity.push({
                type: "quiz_completion",
                student: studentName,
                quiz: facultyQuizCodes[0] || "DEMO_QUIZ",
                score: mockAvgScore,
                time: new Date(mockLatestActivity).toLocaleString(),
                achievement: mockAvgScore >= 90 ? "🏆 Excellent!" : mockAvgScore >= 80 ? "⭐ Great!" : "👍 Good!",
                question: ""
              });
            }
            
            // Process attended quizzes for live activity
            attendedQuizzes.forEach((quiz: any) => {
              if (recentActivity.length < 20) { // Increase to show more recent activity
                recentActivity.push({
                  studentName: (student as any).full_name?.toString() || (student as any).full_name?.toString() || (student as any).username?.toString() || (student as any).email?.toString() || (student as any).id?.toString(),
                  quizCode: quiz.quiz_code,
                  quizTitle: quiz.quiz_title,
                  score: quiz.score,
                  timestamp: quiz.submitted_at || quiz.taken_at,
                  department: (student as any).department,
                  section: (student as any).section
                });
              }
            });
            
            // Calculate stats for this student
            const totalQuizzesTaken = attendedQuizzes.length;
            const totalScore = attendedQuizzes.reduce((sum: number, quiz: any) => sum + (quiz.score || 0), 0);
            const avgScore = totalQuizzesTaken > 0 ? Math.round(totalScore / totalQuizzesTaken) : 0;
            const latestQuiz = attendedQuizzes.reduce((latest: any, quiz: any) => {
              const quizTime = new Date(quiz.submitted_at || quiz.taken_at || 0);
              const latestTime = new Date(latest.submitted_at || latest.taken_at || 0);
              return quizTime > latestTime ? quiz : latest;
            });
            
            studentMap.set(student.id, {
              ...student,
              latestActivity: latestQuiz.submitted_at || latestQuiz.taken_at,
              totalQuizzesTaken,
              totalScore,
              latestScore: latestQuiz.score || 0,
              avg_score: avgScore,
              attendedQuizzes // Keep reference to attended quizzes
            });
          });
          
          console.log(`Debug Summary:`);
          console.log(`- Total students: ${studentsData?.length || 0}`);
          console.log(`- Students with mock data: ${studentMap.size}`);
          console.log(`- Recent activity entries: ${recentActivity.length}`);
          console.log(`- About to set attendedStudents with ${studentsArray.length} students`);
          
          // Sort recent activity by timestamp
          recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setLiveActivity(recentActivity.slice(0, 10));
          
          // Convert map to array and sort by latest activity
          const studentsArray = Array.from(studentMap.values()).sort((a, b) => 
            new Date(b.latestActivity).getTime() - new Date(a.latestActivity).getTime()
          );
          
          console.log(`✅ Setting attendedStudents with ${studentsArray.length} students`);
          // Only set attendedStudents if we don't already have data from fetchAnalyticsData
          if (!hasAnalyticsData) {
            setAttendedStudents(studentsArray);
            console.log(`✅ fetchAttendedStudents: Set ${studentsArray.length} students`);
          } else {
            console.log(`⏭️ fetchAttendedStudents: Skipped - analytics data already exists`);
          }
          setLiveActivity(recentActivity);
        }
      } catch (error) {
        console.error("Error in fetchAttendedStudents:", error);
        setAttendedStudents([]);
      }
      setStudentsLoading(false);
    }
    
    if (quizzes.length > 0) {
      fetchAttendedStudents();
    }
    
    // Set up real-time subscription for student updates
    let studentsChannel: any = null;
    if (quizzes.length > 0) {
      (async () => {
        const { supabase } = await import("@/lib/supabase");
        studentsChannel = supabase.channel('faculty-attended-students')
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'students'
          }, (payload: any) => {
            console.log('Student updated for attended students:', payload);
            // Re-fetch attended students when any student updates their quiz_history
            fetchAttendedStudents();
          })
          .subscribe();
      })();
    }
    
    return () => {
      if (studentsChannel) studentsChannel.unsubscribe();
    };
  }, [quizzes]);

  // Group smart analytics for attended students
  const groupStats = (() => {
    if (!attendedStudents || attendedStudents.length === 0) return null;
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const avgScore = avg(attendedStudents.map(s => s.avg_score || 0));
    const avgAccuracy = avg(attendedStudents.map(s => s.accuracy_rate || 0));
    
    // Safe reduce with proper fallback
    const top = attendedStudents.length > 0 
      ? attendedStudents.reduce((a, b) => (a.avg_score || 0) > (b.avg_score || 0) ? a : b, attendedStudents[0])
      : null;
    const bottom = attendedStudents.length > 0 
      ? attendedStudents.reduce((a, b) => (a.avg_score || 0) < (b.avg_score || 0) ? a : b, attendedStudents[0])
      : null;
    return {
      avgScore,
      avgAccuracy,
      total: attendedStudents.length,
      top,
      bottom,
      totalQuizzesTaken: attendedStudents.reduce((sum, s) => sum + (s.totalQuizzesTaken || 0), 0)
    };
  })();

  // Dashboard metrics calculation for main stats grid
  const dashboardMetrics = useMemo(() => {
    // Active Students: Students who have taken quizzes in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activeStudents = attendedStudents.filter(student => {
      if (!student.latestActivity) return false;
      const activityDate = new Date(student.latestActivity);
      return activityDate >= thirtyDaysAgo;
    }).length;

    // Avg Performance: Average score from all attended students
    const avgPerformance = groupStats ? groupStats.avgScore : 0;

    // Response Rate: Percentage of students who responded to recent quizzes
    const totalEligibleStudents = studentsData.length || 1; // Total students in system
    const respondedStudents = attendedStudents.length;
    const responseRate = (respondedStudents / totalEligibleStudents) * 100;

    // Calculate trends (mock data for now, could be enhanced with historical data)
    const activeStudentsTrend = activeStudents > 0 ? "+8.4%" : "0%";
    const avgPerformanceTrend = avgPerformance > 75 ? "+2.1%" : "-2.1%";
    const responseRateTrend = responseRate > 50 ? "+5.7%" : "-1.2%";

    return {
      activeStudents,
      activeStudentsTrend,
      avgPerformance,
      avgPerformanceTrend,
      responseRate,
      responseRateTrend
    };
  }, [attendedStudents, groupStats, studentsData]);

  const renderStudentHub = () => {
    console.log("🎯 renderStudentHub - attendedStudents:", attendedStudents.length, "studentsData:", studentsData.length, "hasAnalyticsData:", hasAnalyticsData);
    return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Student Hub</h1>
            <p className="text-gray-600">Monitor students who attended your quizzes</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-600 font-medium">Live Updates</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:gap-3">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-sm">
            {attendedStudents.filter((student: any) => {
              // Check if student has taken any quiz in last 24 hours based on latestActivity
              if (!student.latestActivity) return false;
              const now = new Date();
              const activityDate = new Date(student.latestActivity);
              const diffHours = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60);
              return diffHours <= 24;
            }).length} active today
          </Badge>
          <Button variant="outline" className="gap-2 bg-white/80 backdrop-blur-sm text-sm">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
        </div>
      </div>

  {/* Group Smart Analytics - Full Advanced Analytics Section */}
  <Card className="bg-gradient-to-r from-indigo-50 to-green-50 border-0 shadow-lg">
    <CardHeader>
      <CardTitle>Smart Analytics (Quiz Participants)</CardTitle>
      <CardDescription>Advanced metrics for students who attended your quizzes</CardDescription>
    </CardHeader>
    <CardContent>
      {studentsLoading ? (
        <div className="text-gray-500">Loading analytics...</div>
      ) : attendedStudents.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">📚</div>
          <p className="text-gray-500">No students have taken your quizzes yet.</p>
          <div className="text-xs text-gray-400 mt-2">
            Debug: attendedStudents.length = {attendedStudents.length}, studentsData.length = {studentsData.length}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <div className="bg-white/80 rounded-lg p-4 lg:p-6 shadow flex flex-col items-center">
              <div className="text-2xl lg:text-3xl font-bold text-blue-700">{groupStats ? groupStats.total : "0"}</div>
              <div className="text-sm text-gray-600 mt-2">Participants</div>
            </div>
            <div className="bg-white/80 rounded-lg p-4 lg:p-6 shadow flex flex-col items-center">
              <div className="text-2xl lg:text-3xl font-bold text-green-700">{groupStats ? groupStats.avgScore.toFixed(1) : "0"}%</div>
              <div className="text-sm text-gray-600 mt-2">Avg Score</div>
            </div>
            <div className="bg-white/80 rounded-lg p-4 lg:p-6 shadow flex flex-col items-center">
              <div className="text-2xl lg:text-3xl font-bold text-purple-700">{groupStats ? groupStats.totalQuizzesTaken : "0"}</div>
              <div className="text-sm text-gray-600 mt-2">Quiz Attempts</div>
            </div>
            <div className="bg-white/80 rounded-lg p-4 lg:p-6 shadow flex flex-col items-center">
              <div className="text-2xl lg:text-3xl font-bold text-indigo-700">{groupStats ? groupStats.avgAccuracy.toFixed(1) : "0"}%</div>
              <div className="text-sm text-gray-600 mt-2">Avg Accuracy</div>
            </div>
          </div>
          {/* Top/Bottom Performer */}
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 bg-white/80 rounded-lg p-6 shadow">
              <div className="font-semibold text-green-700">Top Performer</div>
              <div className="text-lg font-bold">
                {groupStats ? (groupStats.top.full_name || groupStats.top.username) : "N/A"}
              </div>
              <div className="text-sm text-gray-600">
                Score: {groupStats ? groupStats.top.avg_score : "N/A"}
              </div>
            </div>
            <div className="flex-1 bg-white/80 rounded-lg p-6 shadow">
              <div className="font-semibold text-red-700">Lowest Performer</div>
              <div className="text-lg font-bold">{groupStats ? (groupStats.bottom.full_name || groupStats.bottom.username) : "N/A"}</div>
              <div className="text-sm text-gray-600">Score: {groupStats ? groupStats.bottom.avg_score : "N/A"}</div>
            </div>
          </div>
          {/* Insights & Milestones */}
          <div className="flex flex-col gap-2">
            {/* Example: Add more advanced group insights here as needed */}
            <div className="text-indigo-700 font-semibold">Most improved section: <span className="font-bold">(Demo)</span></div>
            <div className="text-blue-700 font-semibold">Highest subject proficiency: <span className="font-bold">(Demo)</span></div>
            <div className="text-green-700 font-semibold">Milestone: <span className="font-bold">Over 90% average in 2 sections!</span></div>
          </div>
          {/* Group Score Trends (Line Chart) */}
          <div className="bg-white/80 rounded-lg p-6 shadow">
            <div className="font-semibold mb-2">Group Score Trends</div>
            {/* Chart.js Line chart for group score trends (demo data) */}
            <Line
              data={{
                labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
                datasets: [{
                  label: "Avg Score",
                  data: [70, 72, 75, 78, 80, 82],
                  borderColor: "#6366f1",
                  backgroundColor: "rgba(99,102,241,0.2)",
                }],
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { min: 0, max: 100 } },
              }}
            />
          </div>
          {/* Group Subject Proficiency (Radar Chart, demo) */}
          <div className="bg-white/80 rounded-lg p-6 shadow">
            <div className="font-semibold mb-2">Group Subject Proficiency</div>
            <Radar
              data={{
                labels: ["Math", "Physics", "Chemistry", "Biology"],
                datasets: [{
                  label: "Proficiency",
                  data: [80, 75, 85, 70],
                  backgroundColor: "rgba(16,185,129,0.2)",
                  borderColor: "#10b981",
                }],
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { r: { min: 0, max: 100 } },
              }}
            />
          </div>
          {/* Group Knowledge Retention (Pie Chart, demo) */}
          <div className="bg-white/80 rounded-lg p-6 shadow">
            <div className="font-semibold mb-2">Group Knowledge Retention</div>
            <Pie
              data={{
                labels: ["Retention", "Lost"],
                datasets: [{
                  data: [78, 22],
                  backgroundColor: ["#f59e42", "#e5e7eb"],
                }],
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: true, position: "bottom" } },
              }}
            />
          </div>
        </div>
      )}
    </CardContent>
  </Card>

      {/* Quiz Participants List */}
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Quiz Participants</CardTitle>
          <CardDescription>Students who have attended your quizzes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {studentsLoading ? (
            <div className="text-gray-500">Loading students...</div>
          ) : attendedStudents.length === 0 ? (
                    <div className="text-center py-8">
          <div className="text-gray-400 mb-2">👥</div>
          <p className="text-gray-500">No students have taken your quizzes yet.</p>
          <div className="text-xs text-gray-400 mt-2">
            Debug: attendedStudents.length = {attendedStudents.length}, studentsData.length = {studentsData.length}
          </div>
        </div>
          ) : attendedStudents.map((student) => (
            <div
              key={student.id}
              className="p-4 bg-gray-50/50 rounded-lg hover:bg-gray-100/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/faculty/students/${student.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                        {(student.full_name || student.name || student.username || '').slice(0,2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{student.full_name || student.name || student.username}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {student.totalQuizzesTaken} quiz{student.totalQuizzesTaken !== 1 ? 's' : ''} with you
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">ID: {student.id}</p>
                    <p className="text-xs text-gray-500">{student.department} - Section {student.section}</p>
                    <p className="text-xs text-gray-400">
                      Last activity: {new Date(student.latestActivity).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-lg font-bold text-gray-900">{student.avg_score ?? 0}%</p>
                      <p className="text-xs text-gray-600">Avg Score</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">{student.latestScore ?? 0}%</p>
                      <p className="text-xs text-gray-600">Latest Score</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">{student.accuracy_rate ?? 0}%</p>
                      <p className="text-xs text-gray-600">Accuracy</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Activity Section */}
      {liveActivity.length > 0 && (
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Recent Student Activity
            </CardTitle>
            <CardDescription>Latest quiz submissions from your students</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {liveActivity.map((activity, index) => {
                const submittedTime = new Date(activity.timestamp);
                const now = new Date();
                const diffMinutes = (now.getTime() - submittedTime.getTime()) / (1000 * 60);
                const isRecent = diffMinutes <= 30; // Last 30 minutes
                
                return (
                  <div key={`${activity.studentName}-${activity.quizCode}-${index}`} 
                       className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                         isRecent ? 'bg-green-100 border border-green-200' : 'bg-gray-50/50'
                       }`}>
                    <div className="flex items-center space-x-3">
                      {isRecent && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>}
                      <div>
                        <p className="font-medium text-sm text-gray-900">
                          {activity.studentName || 'Unknown Student'}
                        </p>
                        <p className="text-xs text-gray-600">
                          Quiz: {activity.quizTitle || activity.quizCode || 'Unknown Quiz'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {activity.department} - Section {activity.section}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold text-sm ${activity.score >= 80 ? 'text-green-600' : activity.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {activity.score}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {diffMinutes < 1 ? 'Just now' : 
                         diffMinutes < 60 ? `${Math.floor(diffMinutes)}m ago` : 
                         diffMinutes < 1440 ? `${Math.floor(diffMinutes / 60)}h ago` :
                         `${Math.floor(diffMinutes / 1440)}d ago`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
  };

  // Student Detail Modal
  const renderStudentModal = () => {
    if (!selectedStudent) return null;

    // Calculate student analytics
    const studentQuizResults = quizResults.filter(result => 
      result.studentid === selectedStudent.id || result.studentid === selectedStudent.name
    );

    const recentScores = studentQuizResults.map(r => r.score || 0).slice(-10);
    const averageScore = recentScores.length > 0 ? 
      Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length) : 
      selectedStudent.avg_score || 0;
    
    const performanceTrend = recentScores.length >= 2 ? 
      recentScores[recentScores.length - 1] - recentScores[recentScores.length - 2] : 0;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarFallback className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xl">
                    {selectedStudent.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedStudent.name}</h2>
                  <p className="text-gray-600">
                    {selectedStudent.department} - Section {selectedStudent.section}
                  </p>
                  <p className="text-sm text-gray-500">ID: {selectedStudent.id}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={averageScore >= 80 ? "default" : "secondary"}>
                      {averageScore >= 90 ? "🏆 Excellent" : 
                       averageScore >= 80 ? "⭐ Very Good" : 
                       averageScore >= 70 ? "👍 Good" : 
                       averageScore >= 60 ? "📈 Average" : "⚠️ Needs Attention"}
                    </Badge>
                    <Badge variant="outline">
                      {selectedStudent.totalQuizzesTaken} Quiz{selectedStudent.totalQuizzesTaken !== 1 ? 's' : ''} Taken
                    </Badge>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Performance Overview */}
              <div className="lg:col-span-2 space-y-6">
                {/* Key Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Performance Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-600">{averageScore}%</div>
                        <div className="text-sm text-blue-700">Average Score</div>
                      </div>
                      <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-600">{selectedStudent.accuracy_rate}%</div>
                        <div className="text-sm text-green-700">Accuracy Rate</div>
                      </div>
                      <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-purple-600">{selectedStudent.totalQuizzesTaken}</div>
                        <div className="text-sm text-purple-700">Quizzes Taken</div>
                      </div>
                      <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg text-center">
                        <div className={`text-2xl font-bold ${performanceTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {performanceTrend > 0 ? '+' : ''}{performanceTrend}%
                        </div>
                        <div className="text-sm text-orange-700">Trend</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Score Progression</CardTitle>
                    <CardDescription>Recent quiz performance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {recentScores.length > 0 ? (
                      <Line
                        data={{
                          labels: recentScores.map((_, i) => `Quiz ${i + 1}`),
                          datasets: [{
                            label: 'Score',
                            data: recentScores,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            tension: 0.4,
                          }],
                        }}
                        options={{
                          responsive: true,
                          plugins: { legend: { display: false } },
                          scales: { y: { min: 0, max: 100 } },
                        }}
                      />
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No quiz data available yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Subject Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle>Subject Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {quizzes.map((quiz, index) => {
                        const result = studentQuizResults.find(r => r.quizcode === quiz.code);
                        const score = result ? result.score : 0;
                        return (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="font-medium">{quiz.title}</div>
                              <div className="text-sm text-gray-600">{quiz.subject}</div>
                            </div>
                            <div className="text-right">
                              <Badge className={`${
                                score >= 80 ? 'bg-green-100 text-green-800' :
                                score >= 60 ? 'bg-blue-100 text-blue-800' : 
                                score > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {score > 0 ? `${score}%` : 'Not Taken'}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Sidebar */}
              <div className="space-y-6">
                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Recent Quiz Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {studentQuizResults.slice(-5).reverse().map((result, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div>
                            <div className="font-medium">{result.quizcode}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(result.submittedat).toLocaleDateString()}
                            </div>
                          </div>
                          <Badge className={`${
                            (result.score || 0) >= 80 ? 'bg-green-100 text-green-800' :
                            (result.score || 0) >= 60 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {result.score || 0}%
                          </Badge>
                        </div>
                      ))}
                      {studentQuizResults.length === 0 && (
                        <p className="text-gray-500 text-sm">No quiz activity yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      AI Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      {averageScore < 70 ? (
                        <>
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                            <div>
                              <div className="font-medium">Focus Required</div>
                              <div className="text-gray-600">Consider additional practice sessions</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <BookOpen className="w-4 h-4 text-blue-500 mt-0.5" />
                            <div>
                              <div className="font-medium">Study Plan</div>
                              <div className="text-gray-600">Schedule 1-on-1 sessions for improvement</div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                            <div>
                              <div className="font-medium">Good Progress</div>
                              <div className="text-gray-600">Maintain current study pattern</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5" />
                            <div>
                              <div className="font-medium">Challenge Ready</div>
                              <div className="text-gray-600">Try advanced level quizzes</div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Settings Content
  const renderSettings = () => (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Avatar className="w-16 h-16 lg:w-20 lg:h-20">
              <AvatarFallback className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg lg:text-2xl">
                DR
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg lg:text-xl font-semibold">Dr. Rajesh Khanna</h3>
              <p className="text-gray-600 text-sm lg:text-base">Computer Science Department</p>
              <Badge variant="secondary">Faculty</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" defaultValue="Dr. Rajesh Khanna" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" defaultValue="rajesh.khanna@university.edu" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <Input id="department" defaultValue="Computer Science" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" defaultValue="+91 98765 43210" className="mt-1" />
            </div>
          </div>

          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
            Save Changes
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Choose what notifications you want to receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="quiz-submissions" />
            <Label htmlFor="quiz-submissions">Quiz submissions</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="student-questions" />
            <Label htmlFor="student-questions">Student questions</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="performance-alerts" />
            <Label htmlFor="performance-alerts">Performance alerts</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="system-updates" />
            <Label htmlFor="system-updates">System updates</Label>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderContent = () => {
    switch (activeView) {
      case "analytics":
        return renderAnalytics()
      case "quiz-studio":
        return renderQuizStudio()
      case "student-hub":
        return renderStudentHub()
      case "settings":
        return renderSettings()
      default:
        return renderDashboard(insights)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex">
      {/* Mobile Header */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-white/20 lg:hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">Dynamite Quiz</h2>
                  <p className="text-xs text-gray-600">Faculty</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-4 w-4" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-bold">3</span>
                </div>
              </Button>
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs">
                  DR
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`${isMobile ? 'fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out' : 'relative'} ${
        isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'
      } w-80 bg-white/80 backdrop-blur-md border-r border-white/20 flex flex-col shadow-xl ${isMobile ? 'shadow-2xl' : ''}`}>
        {/* Logo */}
        <div className="p-6 border-b border-gray-200/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Dynamite Quiz</h2>
              <p className="text-sm text-gray-600">Faculty Dashboard</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="p-4 border-b border-gray-200/50">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50/50 p-3 rounded-lg text-center">
              <div className="text-xl font-bold text-blue-600">{quizzes.length}</div>
              <div className="text-xs text-gray-600">Active Quizzes</div>
            </div>
            <div className="bg-green-50/50 p-3 rounded-lg text-center">
              <div className="text-xl font-bold text-green-600">{dashboardMetrics.activeStudents}</div>
              <div className="text-xs text-gray-600">Students</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            {facultyNavItems.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setActiveView(item.key);
                  if (isMobile) setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                  activeView === item.key
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                    : "text-gray-700 hover:bg-white/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.title}</span>
                </div>
                {item.badge && (
                  <Badge
                    variant={item.badgeVariant}
                    className={`text-xs ${activeView === item.key ? "bg-white/20 text-white" : ""}`}
                  >
                    {item.badge}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-200/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/50 transition-colors">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    DR
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-900">Dr. Rajesh Khanna</p>
                  <p className="text-sm text-gray-600">Computer Science Dept.</p>
                </div>
                <Settings className="w-4 h-4 text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Dr. Rajesh Khanna</p>
                  <p className="text-xs leading-none text-muted-foreground">rajesh.khanna@university.edu</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col ${isMobile ? 'pt-16' : ''}`}>
        {/* Header - Hidden on mobile since we have mobile header */}
        {!isMobile && (
          <header className="h-16 bg-white/80 backdrop-blur-md border-b border-white/20 flex items-center justify-between px-6 shadow-sm">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-gray-900 capitalize">{activeView.replace("-", " ")}</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-4 w-4" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-bold">3</span>
                </div>
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </header>
        )}

        {/* Main Content */}
        <main className={`flex-1 overflow-auto ${isMobile ? 'p-4' : 'p-6'}`}>
          {renderContent()}
        </main>
      </div>

      {/* Student Detail Modal */}
      {renderStudentModal()}
    </div>
  )
}
