"use client"

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import {
  BookOpen,
  BarChart3,
  Users,
  Trophy,
  Settings,
  Home,
  CheckCircle,
  Clock,
  Eye,
  Star,
  TrendingUp,
  TrendingDown,
  LogOut,
} from "lucide-react"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js"
import { Line } from "react-chartjs-2"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase";
import { generateStudentQuizDetailedPDF } from "@/lib/pdf-generator";
import { updateStudentQuizStats } from "@/lib/user-management";
import { useIsMobile } from "@/hooks/use-mobile";
import jsPDF from 'jspdf';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

interface QuizData {
  id: number
  title: string
  subject: string
  duration: string
  date: string
  score: number | null
  status: "completed" | "available" | "upcoming"
  difficulty: "Easy" | "Medium" | "Hard"
  attempts: number
}

interface StudentData {
  name: string
  section: string
  score: number
  rank: number
  online: boolean
  isCurrentUser?: boolean
}

// Helper functions for safe name handling
const getDisplayName = (user: { name?: string; email?: string }) =>
  user.name && user.name.trim().length > 0 ? user.name : (user.email?.split("@")[0] ?? "User")

const getFirstName = (displayName: string) => displayName.split(" ")[0]

const getInitials = (displayName: string) =>
  displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

function useStudentProfile(userId: any) {
  const [student, setStudent] = useState<any>(null);

  useEffect(() => {
    if (!userId) return;
    const fetchStudent = async () => {
      const { data, error } = await supabase
        .from('students')
        .select('avg_score, avg_accuracy, avg_time_spent, best_score, lowest_score, quizzes_taken, quiz_history')
        .eq('id', userId)
        .single();
      setStudent(data);
    };
    fetchStudent();
  }, [userId]);

  return student;
}

// Hook for real-time available quizzes
function useAvailableQuizzes() {
  const [availableQuizzes, setAvailableQuizzes] = useState<any[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);

  useEffect(() => {
    let quizzesChannel: any = null;
    
    const fetchAndSubscribeQuizzes = async () => {
      setQuizzesLoading(true);
      
      try {
        // Fetch currently available quizzes
        const { data, error } = await supabase
          .from('quizzes')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        
        if (!error && data) {
          setAvailableQuizzes(data);
        }
        
        // Set up real-time subscription for quiz availability changes
        quizzesChannel = supabase.channel('student-available-quizzes')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'quizzes'
          }, (payload: any) => {
            console.log('Quiz availability update:', payload);
            
            if (payload.eventType === 'INSERT' && payload.new.status === 'active') {
              // New active quiz added
              setAvailableQuizzes(prev => [payload.new, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              if (payload.new.status === 'active') {
                // Quiz became active or was updated while active
                setAvailableQuizzes(prev => {
                  const existingIndex = prev.findIndex(q => q.id === payload.new.id);
                  if (existingIndex >= 0) {
                    // Update existing quiz
                    return prev.map(quiz => 
                      quiz.id === payload.new.id ? payload.new : quiz
                    );
                  } else {
                    // Add newly active quiz
                    return [payload.new, ...prev];
                  }
                });
              } else {
                // Quiz became inactive
                setAvailableQuizzes(prev => prev.filter(quiz => quiz.id !== payload.new.id));
              }
            } else if (payload.eventType === 'DELETE') {
              // Quiz deleted
              setAvailableQuizzes(prev => prev.filter(quiz => quiz.id !== payload.old.id));
            }
          })
          .subscribe();
          
      } catch (error) {
        console.error('Error fetching quizzes:', error);
      }
      
      setQuizzesLoading(false);
    };
    
    fetchAndSubscribeQuizzes();
    
    return () => {
      if (quizzesChannel) quizzesChannel.unsubscribe();
    };
  }, []);

  return { availableQuizzes, quizzesLoading };
}

// Live Activity Indicator Component
function LiveActivityIndicator({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex items-center space-x-2">
      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
      <span className="text-xs text-gray-600">
        {isActive ? 'Live' : 'Offline'}
      </span>
    </div>
  );
}

// Last updated timestamp component
function LastUpdated({ timestamp }: { timestamp?: string }) {
  const [timeAgo, setTimeAgo] = useState('');
  
  useEffect(() => {
    if (!timestamp) return;
    
    const updateTimeAgo = () => {
      const now = new Date();
      const updated = new Date(timestamp);
      const diffMs = now.getTime() - updated.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      
      if (diffMinutes < 1) {
        setTimeAgo('Just updated');
      } else if (diffMinutes < 60) {
        setTimeAgo(`Updated ${diffMinutes}m ago`);
      } else {
        const diffHours = Math.floor(diffMinutes / 60);
        setTimeAgo(`Updated ${diffHours}h ago`);
      }
    };
    
    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [timestamp]);
  
  return timestamp ? (
    <span className="text-xs text-gray-500">{timeAgo}</span>
  ) : null;
}

// Add a helper function for formatting time
function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds) || seconds < 0) seconds = 0;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// Calculate streak (consecutive days with at least one quiz taken)
function calculateStreak(quizHistory: any[]) {
  if (!quizHistory || quizHistory.length === 0) return 0;
  // Sort by date descending
  const sorted = [...quizHistory].sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime());
  let streak = 1;
  let prevDate = new Date(sorted[0].taken_at);
  for (let i = 1; i < sorted.length; i++) {
    const currDate = new Date(sorted[i].taken_at);
    // Check if previous date is exactly 1 day after current
    const diff = (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diff >= 1 && diff < 2) {
      streak++;
      prevDate = currDate;
    } else if (diff < 1) {
      // Same day, skip
      continue;
    } else {
      break;
    }
  }
  return streak;
}

export default function StudentDashboard() {
  console.log("StudentDashboard rendered");
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sortLevel, setSortLevel] = useState("College Level");
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [classmates, setClassmates] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState({ averageScore: 0, totalQuizzes: 0, completed: 0 });
  // Leaderboard state and fetch
  const [activeLeaderboard, setActiveLeaderboard] = useState("College Level");
  const [collegeStudents, setCollegeStudents] = useState<any[]>([]);
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [sectionStudents, setSectionStudents] = useState<any[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  // Add leaderboard scope state
  const [leaderboardScope, setLeaderboardScope] = useState("College");
  const leaderboardScopes = [
    { label: "College", value: "College" },
    { label: "Department", value: "Department" },
    { label: "Section", value: "Section" },
  ];

  // Use the new real-time available quizzes hook
  const { availableQuizzes, quizzesLoading } = useAvailableQuizzes();
  
  // Track last update time for real-time indicators
  const [lastUpdateTime, setLastUpdateTime] = useState<string>(new Date().toISOString());

  // Define fetchLeaderboards at the top level
  const fetchLeaderboards = async () => {
    // Debug log for studentProfile
    console.log('studentProfile:', studentProfile);
    // Fetch all students for debugging
    const { data: all, error } = await supabase
      .from('students')
      .select('id, full_name, department, section, avg_score, quizzes_taken');
    console.log('All students:', all);
    setAllStudents(all || []);
    
    // Debug: Check all unique sections in the database
    const uniqueSections = [...new Set(all?.map(s => s.section) || [])];
    console.log('All unique sections in database:', uniqueSections);
    
    // College Level: all students, sorted by avg_score
    const { data: college, error: collegeError } = await supabase
      .from('students')
      .select('id, full_name, department, section, avg_score, quizzes_taken')
      .order('avg_score', { ascending: false });
    console.log('College fetch:', college, 'Error:', collegeError);
    setCollegeStudents(college || []);
    
    // Department Level: students in same department, sorted by avg_score
    if (studentProfile && studentProfile.department) {
      const { data: dept, error: deptError } = await supabase
        .from('students')
        .select('id, full_name, department, section, avg_score, quizzes_taken')
        .eq('department', studentProfile.department)
        .order('avg_score', { ascending: false });
      console.log('Department fetch:', dept, 'Error:', deptError, 'Filter:', studentProfile.department);
      setClassStudents(dept || []);
      
      // Section Level: students in same department and section, sorted by avg_score
      if (studentProfile.section) {
        console.log('Current user section:', studentProfile.section);
        console.log('Current user department:', studentProfile.department);
        
        // Try exact match first
        let { data: sect, error: sectError } = await supabase
          .from('students')
          .select('id, full_name, department, section, avg_score, quizzes_taken')
          .eq('department', studentProfile.department)
          .eq('section', studentProfile.section)
          .order('avg_score', { ascending: false });
        
        // If no results, try case-insensitive match
        if (!sect || sect.length === 0) {
          console.log('No exact match found, trying case-insensitive search...');
          const { data: sectCaseInsensitive, error: sectCaseError } = await supabase
            .from('students')
            .select('id, full_name, department, section, avg_score, quizzes_taken')
            .eq('department', studentProfile.department)
            .ilike('section', studentProfile.section)
            .order('avg_score', { ascending: false });
          
          sect = sectCaseInsensitive;
          sectError = sectCaseError;
          console.log('Case-insensitive section fetch:', sect, 'Error:', sectError);
        }
        
        console.log('Final section fetch:', sect, 'Error:', sectError, 'Filter:', studentProfile.department, studentProfile.section);
        setSectionStudents(sect || []);
      }
    }
    
    // Update last update timestamp
    setLastUpdateTime(new Date().toISOString());
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Fetch student analytics fields from students table
  useEffect(() => {
    const fetchStudentAnalytics = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('students')
        .select('avg_score, avg_accuracy, avg_time_spent, best_score, lowest_score, quizzes_taken')
        .eq('id', user.id)
        .single();
      if (data) setStudentProfile((prev: any) => ({ ...prev, ...data }));
    };
    if (user) fetchStudentAnalytics();
  }, [user]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', user.id)
        .single();
      setStudentProfile(data);
    };
    if (user) fetchProfile();
  }, [user]);


  useEffect(() => {
    const fetchQuizResults = async () => {
      setLoadingData(true);
      if (!user) return;
      
      // Get student's quiz_history from students table
      const { data: studentData, error } = await supabase
        .from('students')
        .select('quiz_history')
        .eq('id', user.id)
        .single();
      
      if (error || !studentData?.quiz_history) {
        setQuizResults([]);
        setLoadingData(false);
        return;
      }
      
      // Convert quiz_history to the expected format
      const results = studentData.quiz_history.map((result: any) => ({
        ...result,
        id: result.quiz_id,
        student_id: user.id,
        taken_at: result.submitted_at,
        quizzes: {
          id: result.quiz_id,
          code: result.quiz_code,
          title: result.quiz_title,
          subject: result.subject
        }
      }));
      
      setQuizResults(results || []);
      setLoadingData(false);
    };
    if (user) fetchQuizResults();

    // Real-time subscription for quiz_results
    let subscription: any = null;
    // Helper functions to refetch all student views
    const refetchAllStudentViews = async () => {
      await fetchQuizResults();
      // Refetch analytics from student's quiz_history
      if (user) {
        const { data: studentData } = await supabase
          .from('students')
          .select('quiz_history')
          .eq('id', user.id)
          .single();
          
        if (studentData?.quiz_history) {
          const quizHistory = studentData.quiz_history;
          const completed = quizHistory.filter((q: any) => q.status === 'completed').length;
          const averageScore = quizHistory.length > 0
            ? Math.round(quizHistory.filter((q: any) => q.score !== null).reduce((sum: number, q: any) => sum + (q.score || 0), 0) / quizHistory.filter((q: any) => q.score !== null).length)
            : 0;
          setAnalytics({ averageScore, totalQuizzes: quizHistory.length, completed });
        }
      }
      // Refetch classmates and leaderboard
      if (studentProfile) {
        const { data: classmatesData } = await supabase
          .from('students')
          .select('*')
          .eq('department', studentProfile.department)
          .eq('section', studentProfile.section);
        setClassmates(classmatesData || []);
        // fetchLeaderboards(); // This is now handled by the top-level fetchLeaderboards
      }
    };

    if (user) {
      subscription = supabase
        .channel('student-quiz-history')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'students',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            // Refetch all student views when student's quiz_history is updated
            refetchAllStudentViews();
          }
        )
        .subscribe();
    }
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [user, studentProfile]);

  useEffect(() => {
    const fetchClassmatesAndLeaderboard = async () => {
      if (!studentProfile) return;
      // Fetch classmates (same department and section)
      const { data: classmatesData } = await supabase
        .from('students')
        .select('*')
        .eq('department', studentProfile.department)
        .eq('section', studentProfile.section);
      console.log('Fetched classmates:', classmatesData, 'For department:', studentProfile.department, 'section:', studentProfile.section);
      setClassmates(classmatesData || []);
      // fetchLeaderboards(); // This is now handled by the top-level fetchLeaderboards
    };
    if (studentProfile) fetchClassmatesAndLeaderboard();
  }, [studentProfile]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user) return;
      
      try {
        // Use quiz_results table with exact column name from database structure
        let data = null;
        let error = null;
        
        // Use the correct column name 'studentid' based on actual table structure
        try {
          const result = await supabase.from('quiz_results').select('*').eq('studentid', user.id);
          if (!result.error && result.data) {
            data = result.data;
            error = null;
            console.log("Successfully fetched quiz_results analytics:", data.length, "records");
          } else if (result.error) {
            console.log("Quiz results query error:", result.error);
          }
        } catch (queryError) {
          console.log("Quiz results query failed:", queryError);
        }
          
        if (!data || (data && data.length === 0)) {
          console.log("No quiz data found in quiz_results table, using quiz_history from students table");
          
          // Fallback: get analytics from students.quiz_history
          const { data: studentData } = await supabase
            .from('students')
            .select('quiz_history')
            .eq('id', user.id)
            .single();
            
          if (studentData && studentData.quiz_history && studentData.quiz_history.length > 0) {
            const quizHistory = studentData.quiz_history;
            const completed = quizHistory.filter((q: any) => q.status === 'completed').length;
            const averageScore = quizHistory.length > 0
              ? Math.round(quizHistory.reduce((sum: number, q: any) => sum + (q.score || 0), 0) / quizHistory.length)
              : 0;
            console.log("Using quiz_history analytics:", { totalQuizzes: quizHistory.length, averageScore, completed });
            setAnalytics({ averageScore, totalQuizzes: quizHistory.length, completed });
          } else {
            console.log("No quiz data found anywhere, setting default analytics");
            setAnalytics({ averageScore: 0, totalQuizzes: 0, completed: 0 });
          }
        } else if (data) {
          const completed = data.filter(q => q.status === 'completed').length;
          const averageScore = data.length > 0
            ? Math.round(data.filter(q => q.score !== null).reduce((sum, q) => sum + (q.score || 0), 0) / data.filter(q => q.score !== null).length)
            : 0;
          console.log("Using quiz_results analytics:", { totalQuizzes: data.length, averageScore, completed });
          setAnalytics({ averageScore, totalQuizzes: data.length, completed });
        }
      } catch (error) {
        console.error("Error fetching analytics:", error);
        // Set default analytics
        setAnalytics({ averageScore: 0, totalQuizzes: 0, completed: 0 });
      }
    };
    if (user) fetchAnalytics();
  }, [user]);

  useEffect(() => {
    console.log('useEffect studentProfile:', studentProfile);
    if (studentProfile) {
      fetchLeaderboards();
      
      // Set up periodic refresh every 30 seconds for real-time updates
      const refreshInterval = setInterval(() => {
        fetchLeaderboards();
      }, 30000); // 30 seconds
      
      return () => clearInterval(refreshInterval);
    }
  }, [studentProfile]);

  useEffect(() => {
    if (!studentProfile) return;
    // Subscribe to all changes in the students table
    const studentsChannel = supabase
      .channel('students-leaderboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'students',
        },
        (payload) => {
          // Refetch all leaderboard levels on any change
          // fetchLeaderboards is defined in the same scope
          fetchLeaderboards();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(studentsChannel);
    };
  }, [studentProfile]);

  const student = useStudentProfile(user?.id);
  const quizHistory = student?.quiz_history || [];
  const streak = calculateStreak(quizHistory);

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Calculate stats from quizResults
  // Find user's rank in section leaderboard
  const sectionRank = sectionStudents.findIndex(s => s.id === user.id) + 1;
  const stats = {
    totalQuizzes: analytics.totalQuizzes,
    completed: analytics.completed,
    averageScore: analytics.averageScore,
    classRank: sectionRank > 0 ? sectionRank : '-'
  };

  // Use quizResults for recent quizzes
  const recentQuizzes = quizResults.slice(0, 3);

  // Enhanced analytics from quiz_results for the current student
  const completedQuizzes = quizResults.filter(q => q.status === 'completed');
  const avgCorrectAnswers = completedQuizzes.length
    ? Math.round(completedQuizzes.reduce((sum, q) => sum + (q.correct_answers || 0), 0) / completedQuizzes.length)
    : 0;
  // Calculate average percent score for completed quizzes
  const avgPercentScore = completedQuizzes.length
    ? Math.round(completedQuizzes.reduce((sum, q) => sum + (q.score || 0), 0) / completedQuizzes.length)
    : 0;
  const avgAccuracy = completedQuizzes.length
    ? Math.round(
        completedQuizzes.reduce((sum, q) => sum + ((q.correct_answers || 0) / (q.total_questions || 1)), 0) / completedQuizzes.length * 100
      )
    : 0;
  const avgTimeSpent = completedQuizzes.length
    ? Math.round(completedQuizzes.reduce((sum, q) => sum + (q.time_spent || 0), 0) / completedQuizzes.length)
    : 0;
  const bestScore = completedQuizzes.length
    ? Math.max(...completedQuizzes.map(q => q.score || 0))
    : 0;
  const worstScore = completedQuizzes.length
    ? Math.min(...completedQuizzes.map(q => q.score || 0))
    : 0;
  const recentQuizzesHistory = completedQuizzes.slice(0, 5);

  // Find most commonly missed question (by question id)
  const missedCounts: Record<string, number> = {};
  completedQuizzes.forEach(q => {
    if (q.answers && typeof q.answers === 'object') {
      Object.entries(q.answers).forEach(([qid, answer]) => {
        // If answer is wrong, increment missed count
        // (Assume you have access to quiz.questions to check correct answer, or store correct/incorrect in answers)
        // For now, just count all answers (customize as needed)
        // missedCounts[qid] = (missedCounts[qid] || 0) + 1;
      });
    }
  });
  // For demo, leave mostMissedQuestion blank (requires more data structure)
  const mostMissedQuestion = Object.entries(missedCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  // Chart data: Use real quiz results for performance trend
  const performanceTrend = quizResults
    .filter(q => q.score !== null && q.taken_at)
    .sort((a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime());
  const chartData = {
    labels: performanceTrend.map(q => {
      const d = new Date(q.taken_at);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    }),
    datasets: [
      {
        label: "Performance Trend",
        data: performanceTrend.map(q => q.score),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        tension: 0.4,
      },
    ],
  };

  // Fix chart options legend position type
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Performance Over Time',
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        min: 10,
        max: 100,
        ticks: { stepSize: 10 },
      },
    },
  };

  // Subject performance: Calculate average score per subject
  const subjectScores: Record<string, { total: number; count: number }> = {};
  quizResults.forEach(q => {
    const subject = q.quizzes?.subject || "Unknown";
    if (!subjectScores[subject]) subjectScores[subject] = { total: 0, count: 0 };
    if (q.score !== null) {
      subjectScores[subject].total += q.score;
      subjectScores[subject].count += 1;
    }
  });
  const subjectPerformance = Object.entries(subjectScores).map(([subject, { total, count }]) => ({
    subject,
    avg: count > 0 ? Math.round(total / count) : 0,
  }));

  const displayName = getDisplayName({ name: user.user_metadata?.full_name || user.user_metadata?.name, email: user.email })
  const firstName = getFirstName(displayName)
  const initials = getInitials(displayName)

  const sidebarItems = [
    { key: "dashboard", label: "Dashboard", icon: Home },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "quizzes", label: "Quizzes", icon: BookOpen },
    { key: "classmates", label: "Download", icon: Users },
    { key: "leaderboard", label: "Leaderboard", icon: Trophy },
    { key: "settings", label: "Settings", icon: Settings },
  ]

  const renderDashboard = () => (
    <div className="space-y-3 lg:space-y-6">
      <div>
        <h1 className="text-lg lg:text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-xs lg:text-sm text-gray-600">Welcome back to your learning hub</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-6">
        <Card>
          <CardContent className="p-2 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Total Quizzes</p>
                <p className="text-lg lg:text-2xl font-bold truncate">{stats.totalQuizzes}</p>
                <div className="flex items-center text-xs lg:text-sm text-green-600">
                  <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4 mr-1 flex-shrink-0" />
                  <span className="truncate">+5.4%</span>
                </div>
              </div>
              <div className="w-8 h-8 lg:w-12 lg:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-4 h-4 lg:w-6 lg:h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Completed</p>
                <p className="text-lg lg:text-2xl font-bold truncate">{stats.completed}</p>
                <div className="flex items-center text-xs lg:text-sm text-green-600">
                  <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4 mr-1 flex-shrink-0" />
                  <span className="truncate">+8.0%</span>
                </div>
              </div>
              <div className="w-8 h-8 lg:w-12 lg:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 lg:w-6 lg:h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Avg Score</p>
                <p className="text-lg lg:text-2xl font-bold truncate">{stats.averageScore}%</p>
                <div className="flex items-center text-xs lg:text-sm text-red-600">
                  <TrendingDown className="w-3 h-3 lg:w-4 lg:h-4 mr-1 flex-shrink-0" />
                  <span className="truncate">-4.5%</span>
                </div>
              </div>
              <div className="w-8 h-8 lg:w-12 lg:h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-4 h-4 lg:w-6 lg:h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Class Rank</p>
                <p className="text-lg lg:text-2xl font-bold truncate">#{stats.classRank}</p>
                <div className="flex items-center text-xs lg:text-sm text-red-600">
                  <TrendingDown className="w-3 h-3 lg:w-4 lg:h-4 mr-1 flex-shrink-0" />
                  <span className="truncate">-6.5%</span>
                </div>
              </div>
              <div className="w-8 h-8 lg:w-12 lg:h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Trophy className="w-4 h-4 lg:w-6 lg:h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Quizzes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Removed: <h2 className="text-xl font-semibold text-gray-900">Available Quizzes</h2> */}
            {/* Removed: <LiveActivityIndicator isActive={!quizzesLoading} /> */}
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push('/quiz/join')}
            className="flex items-center space-x-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>Join Quiz</span>
          </Button>
        </div>
        {/* Removed: Available Quizzes grid and all related logic */}
      </div>

      {/* About and Tips Section */}
      <div className="mt-4 lg:mt-10 max-w-4xl mx-auto w-full">
        <Card className="bg-gradient-to-br from-white to-blue-50 shadow-lg border border-blue-100">
          <CardContent className="p-4 lg:p-10 flex flex-col lg:flex-row items-center gap-4 lg:gap-8">
            <div className="flex-1">
              <h2 className="text-lg lg:text-2xl font-bold mb-2 lg:mb-3">About the Dynamite Quiz</h2>
              <p className="text-gray-700 mb-3 lg:mb-5 text-xs lg:text-base">
                Welcome to the Dynamite Quiz! Here you can join quizzes, track your progress, and compete with classmates. Your dashboard gives you a real-time overview of your quiz activity and performance.
              </p>
              <h3 className="text-sm lg:text-lg font-semibold mb-1 lg:mb-2">Tips for Success:</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-0.5 lg:space-y-1 text-xs lg:text-base">
                <li>Attend quizzes regularly to improve your rank.</li>
                <li>Review your quiz history and analytics to identify areas for improvement.</li>
                <li>Check the leaderboard to see how you compare with your peers.</li>
                <li>Download your quiz results with AI explanations for revision.</li>
              </ul>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <span className="text-3xl lg:text-7xl mb-2 lg:mb-4">📚</span>
              <blockquote className="italic text-blue-700 text-center text-xs lg:text-base">
                "Success is the sum of small efforts, repeated day in and day out."
              </blockquote>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderAnalytics = () => {
    // Prepare data for performance trend graph
    const quizHistorySorted = [...quizHistory].sort((a, b) => {
      const dateA = a.submitted_at || a.taken_at || new Date(0);
      const dateB = b.submitted_at || b.taken_at || new Date(0);
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    const chartData = {
      labels: quizHistorySorted.map(q => q.taken_at ? new Date(q.taken_at).toLocaleDateString() : ""),
      datasets: [
        {
          label: "Score",
          data: quizHistorySorted.map(q => q.score),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.4,
        },
      ],
    };
    const chartOptions = {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: "Performance Over Time" },
      },
      scales: { y: { beginAtZero: true, max: 100 } },
    };
    return (
    <div className="space-y-3 lg:space-y-6">
      <div>
        <h1 className="text-lg lg:text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-xs lg:text-sm text-gray-600">Detailed performance insights</p>
      </div>
        {/* Analytics from students table */}
        <div className="grid grid-cols-3 gap-2 lg:gap-6">
          <Card className="min-w-0 flex-1">
            <CardContent className="p-2 lg:p-6">
              <div className="text-xs lg:text-sm text-gray-600 mb-1 truncate">Avg Score</div>
              <div className="text-lg lg:text-3xl font-bold truncate">{student?.avg_score ?? 0}%</div>
            </CardContent>
          </Card>
          <Card className="min-w-0 flex-1">
            <CardContent className="p-2 lg:p-6">
              <div className="text-xs lg:text-sm text-gray-600 mb-1 truncate">Best Score</div>
              <div className="text-lg lg:text-3xl font-bold truncate">{student?.best_score ?? 0}%</div>
            </CardContent>
          </Card>
          <Card className="min-w-0 flex-1">
            <CardContent className="p-2 lg:p-6">
              <div className="text-xs lg:text-sm text-gray-600 mb-1 truncate">Lowest</div>
              <div className="text-lg lg:text-3xl font-bold truncate">{student?.lowest_score ?? 0}%</div>
            </CardContent>
          </Card>
      </div>
        <div className="mt-3 lg:mt-4 text-sm lg:text-lg font-medium">Quizzes Taken: {student?.quizzes_taken ?? 0}</div>
        {/* Performance Trend Graph */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trend</CardTitle>
          <CardDescription>Your quiz performance over time</CardDescription>
        </CardHeader>
        <CardContent>
            {quizHistory.length === 0 ? (
              <div className="text-gray-500 text-sm">No quiz data available.</div>
            ) : (
              <div className="h-48 lg:h-96 min-h-[200px] lg:min-h-[350px] w-full flex items-center justify-center bg-white rounded-lg border p-2 lg:p-4">
                <Line
                  data={chartData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      legend: {
                        ...chartOptions.plugins.legend,
                        position: "top" as const,
                      },
                    },
                    maintainAspectRatio: false,
                  }}
                  style={{ width: '100%', height: '100%' }}
                />
          </div>
            )}
        </CardContent>
      </Card>
              </div>
    );
  }

  // Real-time quizzes attended by the user (most recent first)
  const attendedQuizzes = quizResults
    .sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime());

  const renderQuizzes = () => (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Quizzes</h1>
        <p className="text-gray-600">All your quiz activities (real-time)</p>
        <Button
          variant="default"
          size="lg"
          className="mt-6 mb-6 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg rounded-lg flex items-center gap-2 animate-pulse"
          onClick={() => router.push('/quiz/join')}
        >
          <BookOpen className="w-5 h-5 mr-2" />
          Attend Quiz
        </Button>
      </div>

      {/* Table of All Attended Quizzes (Full History) */}
      <Card>
        <CardHeader>
          <CardTitle>Quiz History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Quiz</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Score</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Accuracy</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Time Spent</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {quizHistory.length > 0 ? (
                  [...quizHistory].sort((a, b) => {
                    const dateA = a.submitted_at || a.taken_at || new Date(0);
                    const dateB = b.submitted_at || b.taken_at || new Date(0);
                    return new Date(dateB).getTime() - new Date(dateA).getTime();
                  }).map((quiz: any, idx: number) => {
                    // Handle different formats of correct_answers for backwards compatibility
                    let correctAnswersCount;
                    if (typeof quiz.correct_answers === 'number') {
                      correctAnswersCount = quiz.correct_answers;
                    } else if (typeof quiz.correct_answers === 'object' && quiz.correct_answers !== null) {
                      // Legacy format: correct_answers was an object mapping question IDs to correct answers
                      // For display purposes, we can't show this directly - calculate from score instead
                      correctAnswersCount = quiz.score && quiz.total_questions 
                        ? Math.round((quiz.score / 100) * quiz.total_questions)
                        : Object.keys(quiz.correct_answers).length; // Fallback to object size
                    } else {
                      // Fallback: calculate from score and total questions
                      correctAnswersCount = quiz.score && quiz.total_questions 
                        ? Math.round((quiz.score / 100) * quiz.total_questions)
                        : 0;
                    }

                    return (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{quiz.quiz_title || quiz.title || quiz.quiz_id}</td>
                        <td className="py-3 px-4">{correctAnswersCount}</td>
                        <td className="py-3 px-4">{quiz.score || Math.round(((correctAnswersCount / (quiz.total_questions || 1)) * 100))}%</td>
                        <td className="py-3 px-4">{formatTime(quiz.time_spent)}</td>
                        <td className="py-3 px-4">{quiz.taken_at ? new Date(quiz.taken_at).toLocaleString() : quiz.submitted_at ? new Date(quiz.submitted_at).toLocaleString() : ''}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-gray-400">No quizzes taken yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
              </div>
            </CardContent>
          </Card>
    </div>
  )

  // Replace renderClassmates with renderDownloadQuestions
  const renderDownloadQuestions = (downloading: string | null, setDownloading: (id: string | null) => void) => {
    console.log('Full quizHistory:', quizHistory);
    
    // Sort quiz history by date (newest first)
    const sortedQuizHistory = [...quizHistory].sort((a, b) => {
      const dateA = a.submitted_at || a.taken_at || new Date(0);
      const dateB = b.submitted_at || b.taken_at || new Date(0);
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    
    const handleDownload = async (quiz: any) => {
      // Handle different field names - old data might use 'quizcode', new data uses 'quiz_id'
      const quizId = quiz.quiz_id || quiz.id;
      const quizCode = quiz.quiz_code || quiz.quizcode;
      const identifier = quizId || quizCode;
      
      console.log('Attempting to fetch quiz with identifier:', identifier, 'from quiz object:', quiz);
      if (!identifier) {
        alert('Quiz ID/Code is missing for this quiz history entry. Quiz object: ' + JSON.stringify(quiz));
        return;
      }
      
      setDownloading(identifier);
      try {
        // Since we now store quiz results in students.quiz_history, we need to check if the quiz data has questions
        let quizQuestions = null;
        let quizTitle = quiz.quiz_title || quiz.title || 'Quiz';
        
        // Check if quiz history already has the questions stored
        if (quiz.questions && Array.isArray(quiz.questions)) {
          quizQuestions = quiz.questions;
          console.log('Using questions from quiz history:', quizQuestions);
          // Debug: check if explanations exist in stored questions
          console.log('Question explanations check:', quizQuestions.map(q => ({ 
            id: q.id, 
            hasExplanation: !!q.explanation, 
            explanation: q.explanation?.substring(0, 100) + '...' 
          })));
        } else {
          // Fallback: try to fetch questions from quizzes table
          // First try by ID, then by code
          let quizData = null;
          let error = null;
          
          if (quizId) {
            console.log('Fetching questions from quizzes table by ID:', quizId);
            const result = await supabase
              .from('quizzes')
              .select('questions, title, id')
              .eq('id', quizId)
              .single();
            quizData = result.data;
            error = result.error;
          }
          
          // If ID lookup failed and we have a quiz code, try by code
          if (!quizData && quizCode) {
            console.log('Fetching questions from quizzes table by code:', quizCode);
            const result = await supabase
              .from('quizzes')
              .select('questions, title, id')
              .eq('code', quizCode)
              .single();
            quizData = result.data;
            error = result.error;
          }
          
          console.log('Fetched quizData:', quizData, 'Error:', error);
          if (error || !quizData || !quizData.questions) {
            // If we can't fetch from quizzes table, create a basic structure from what we have
            console.log('Could not fetch from quizzes table, creating basic structure from quiz history');
            quizQuestions = [{
              id: 1,
              question: "Quiz data not available - this is a summary based on your results",
              type: "summary",
              options: [],
              correct_answer: "",
              explanation: `You scored ${quiz.score || 0}% on this quiz with ${quiz.total_questions || 0} questions. Time spent: ${Math.floor((quiz.time_spent || 0) / 60)}m ${(quiz.time_spent || 0) % 60}s`
            }];
          } else {
            quizQuestions = quizData.questions;
            quizTitle = quizData.title || quizTitle;
            // Debug: check if explanations exist in fetched questions
            console.log('Fetched question explanations check:', quizQuestions.map(q => ({ 
              id: q.id, 
              hasExplanation: !!q.explanation, 
              explanationPreview: q.explanation ? q.explanation.substring(0, 100) + '...' : 'No explanation'
            })));
          }
        }

        if (!quizQuestions || quizQuestions.length === 0) {
          alert('No questions available for this quiz.');
          setDownloading(null);
          return;
        }

        // Final debug check before PDF generation
        console.log('=== QUIZ EXPLANATION DEBUG ===');
        console.log('Quiz result data:', quiz);
        console.log('Questions to be used in PDF:');
        quizQuestions.forEach((q: any, idx: number) => {
          console.log(`Question ${idx + 1}:`, {
            id: q.id,
            type: q.type,
            question: q.question?.substring(0, 50) + '...',
            hasExplanation: !!q.explanation,
            explanationExists: !!q.explanation && q.explanation.trim().length > 0,
            explanationLength: q.explanation ? q.explanation.length : 0,
            explanationPreview: q.explanation ? q.explanation.substring(0, 100) + '...' : 'NO EXPLANATION',
            allFields: Object.keys(q)
          });
        });
        console.log('=== END DEBUG ===');

        // Use the enhanced PDF generator with AI explanations
        generateStudentQuizDetailedPDF(
          {
            title: quizTitle,
            quiz_id: identifier, // Use the identifier we found
            score: quiz.score || 0,
            total_questions: quiz.total_questions || quizQuestions.length,
            time_spent: quiz.time_spent || 0,
            submitted_at: quiz.submitted_at || quiz.taken_at || new Date().toISOString()
          },
          quizQuestions,
          quiz.answers || {},
          {
            id: user?.id || 'student',
            name: user?.user_metadata?.full_name || user?.email || 'Student'
          }
        );
      } catch (e) {
        console.error('Error generating PDF:', e);
        alert('An error occurred while generating the PDF: ' + (e as Error).message);
      }
      setDownloading(null);
    };

    return (
    <div className="space-y-3 lg:space-y-6">
      <div>
          <h1 className="text-lg lg:text-2xl font-bold text-gray-900">📥 Download Quiz Analysis</h1>
          <p className="text-xs lg:text-sm text-gray-600">Download comprehensive quiz reports with AI-generated explanations, performance insights, and detailed answers</p>
      </div>
        <div className="space-y-3 lg:space-y-4">
          {sortedQuizHistory.length === 0 ? (
            <div className="text-gray-500 p-4 lg:p-8 text-center">
              <div className="text-2xl lg:text-4xl mb-3 lg:mb-4">📝</div>
              <div className="text-sm lg:text-lg font-medium">No quiz history available</div>
              <div className="text-xs lg:text-sm">Take some quizzes to see your results here</div>
            </div>
          ) : (
            sortedQuizHistory.map((quiz: any, idx: number) => {
              const quizIdentifier = quiz.quiz_id || quiz.id || quiz.quiz_code || quiz.quizcode || idx;
              return (
              <div key={idx} className="flex flex-col lg:flex-row lg:items-center justify-between p-3 lg:p-4 bg-white rounded-lg shadow-sm border gap-2 lg:gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm lg:text-lg truncate">{quiz.quiz_title || quiz.title || `Quiz ${idx + 1}`}</div>
                  <div className="text-xs lg:text-sm text-gray-600 mt-1 space-y-1 lg:space-y-0 lg:space-x-4">
                    <span className="block lg:inline">📊 <span className="font-semibold text-blue-600">{quiz.score || 0}%</span></span>
                    <span className="block lg:inline">📝 {quiz.total_questions || 'N/A'}</span>
                    <span className="block lg:inline">📅 {quiz.submitted_at ? new Date(quiz.submitted_at).toLocaleDateString() : quiz.taken_at ? new Date(quiz.taken_at).toLocaleDateString() : 'Unknown'}</span>
                  </div>
                  {quiz.subject && (
                    <div className="text-xs text-gray-500 mt-1 truncate">Subject: {quiz.subject}</div>
                  )}
                </div>
                <button
                  className="px-3 lg:px-6 py-2 lg:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 font-semibold shadow-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed text-xs lg:text-base flex-shrink-0"
                  onClick={() => handleDownload(quiz)}
                  disabled={downloading === quizIdentifier}
                >
                  {downloading === quizIdentifier ? (
                    <span className="flex items-center gap-1 lg:gap-2">
                      <svg className="animate-spin h-3 w-3 lg:h-4 lg:w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="hidden sm:inline">Generating...</span>
                      <span className="sm:hidden">...</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 lg:gap-2">
                      📊 <span className="hidden sm:inline">Download</span>
                    </span>
                  )}
                </button>
              </div>
              );
            })
          )}
        </div>
    </div>
    );
  };

  const renderLeaderboard = () => {
    console.log("renderLeaderboard called");
    let leaderboardData = [];
    if (leaderboardScope === "College") leaderboardData = collegeStudents;
    else if (leaderboardScope === "Department") leaderboardData = classStudents;
    else leaderboardData = sectionStudents;
    return (
  <div className="space-y-3 lg:space-y-6">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">
      <div>
        <h1 className="text-lg lg:text-2xl font-bold text-gray-900">Leaderboard</h1>
        <p className="text-xs lg:text-sm text-gray-600">See how you rank against peers</p>
      </div>
      <div className="flex items-center gap-2 lg:gap-4 text-xs lg:text-sm text-gray-600">
        <LiveActivityIndicator isActive={true} />
        <span className="hidden sm:inline">Updates in real-time</span>
        <LastUpdated timestamp={lastUpdateTime} />
      </div>
    </div>
    {/* Leaderboard Scope Selector */}
    <div className="flex flex-wrap gap-1 lg:gap-2 mb-3 lg:mb-4">
      {leaderboardScopes.map((scope) => (
        <button
          key={scope.value}
          className={`px-2 lg:px-4 py-1 lg:py-2 rounded text-xs lg:text-base ${
            leaderboardScope === scope.value ? "bg-blue-500 text-white" : "bg-gray-200"
          }`}
          onClick={() => setLeaderboardScope(scope.value)}
        >
          {scope.label}
        </button>
      ))}
    </div>
    <Card>
      <CardHeader>
        <CardTitle className="text-base lg:text-lg">Rankings</CardTitle>
        <CardDescription className="text-xs lg:text-sm">Current standings based on quiz performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 lg:space-y-3">
          {leaderboardData.length === 0 ? (
            <div className="text-center text-gray-400 py-4 lg:py-8 text-sm">No students found for this leaderboard.</div>
          ) : (
            leaderboardData.map((studentRow, index) => (
              <div
                key={studentRow.id}
                className={`flex items-center justify-between p-3 lg:p-4 rounded-lg ${
                  studentRow.id === user.id ? "bg-blue-50 border-l-4 border-blue-500" : "bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2 lg:gap-4 min-w-0 flex-1">
                  <div
                    className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center font-bold text-xs lg:text-sm flex-shrink-0 ${
                      index < 3 ? "bg-yellow-500 text-white" : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {index < 3 ? <Trophy className="w-3 h-3 lg:w-4 lg:h-4" /> : index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 lg:gap-2">
                      <span className="font-medium text-sm lg:text-base truncate">{studentRow.full_name}</span>
                      {index < 3 && <Star className="w-3 h-3 lg:w-4 lg:h-4 text-yellow-500 flex-shrink-0" />}
                    </div>
                    <div className="text-xs lg:text-sm text-gray-600 truncate">
                      {studentRow.department} • {studentRow.section}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-sm lg:text-lg">{studentRow.avg_score ?? 0}%</div>
                  <div className="text-xs lg:text-sm text-gray-600">
                    {studentRow.quizzes_taken} quizzes
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  </div>
);
  };

  const renderSettings = () => (
    <div className="space-y-3 lg:space-y-6">
      <div>
        <h1 className="text-lg lg:text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-xs lg:text-sm text-gray-600">Manage your account preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base lg:text-lg">Profile Settings</CardTitle>
          <CardDescription className="text-xs lg:text-sm">Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 lg:space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:gap-4">
            <Avatar className="w-12 h-12 lg:w-16 lg:h-16">
              <AvatarFallback className="bg-blue-100 text-blue-600 text-sm lg:text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm lg:text-base truncate">{displayName}</h3>
              <p className="text-gray-600 text-xs lg:text-sm truncate">{user.email}</p>
              <Badge variant="secondary" className="text-xs">Student</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
            <div>
              <label className="text-xs lg:text-sm font-medium">Name</label>
              <Input value={displayName} className="mt-1 text-xs lg:text-sm" />
            </div>
            <div>
              <label className="text-xs lg:text-sm font-medium">Email</label>
              <Input value={user.email} className="mt-1 text-xs lg:text-sm" />
            </div>
          </div>

          <Button className="text-xs lg:text-sm">Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base lg:text-lg">Quiz Statistics</CardTitle>
          <CardDescription className="text-xs lg:text-sm">Refresh your quiz performance statistics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 lg:space-y-4">
          <p className="text-xs lg:text-sm text-gray-600">
            If your best score, lowest score, or average score seem incorrect, click the button below to recalculate your statistics.
          </p>
          <Button 
            onClick={async () => {
              try {
                await updateStudentQuizStats(user.id);
                // Refresh the page to show updated stats
                window.location.reload();
              } catch (error) {
                console.error('Error updating stats:', error);
                alert('Failed to update statistics. Please try again.');
              }
            }}
            variant="outline"
            className="text-xs lg:text-sm"
          >
            Refresh Statistics
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base lg:text-lg">Notifications</CardTitle>
          <CardDescription className="text-xs lg:text-sm">Choose what notifications you want to receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 lg:space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="quiz-reminders" />
            <label htmlFor="quiz-reminders" className="text-xs lg:text-sm font-medium">
              Quiz reminders
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="score-updates" />
            <label htmlFor="score-updates" className="text-xs lg:text-sm font-medium">
              Score updates
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="leaderboard-changes" />
            <label htmlFor="leaderboard-changes" className="text-xs lg:text-sm font-medium">
              Leaderboard changes
            </label>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderContent = () => {
    switch (activeView) {
      case "analytics":
        return renderAnalytics()
      case "quizzes":
        return renderQuizzes()
      case "classmates":
        return renderDownloadQuestions(downloading, setDownloading);
      case "leaderboard":
        return renderLeaderboard()
      case "settings":
        return renderSettings()
      default:
        return renderDashboard()
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile Header */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 lg:hidden">
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
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">Dynamite Quiz</h2>
                  <p className="text-xs text-gray-600">Student</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">{initials}</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`${isMobile ? 'fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out' : 'relative'} ${
        isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'
      } w-64 bg-white border-r border-gray-200 flex flex-col ${isMobile ? 'shadow-xl' : ''}`}>
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Dynamite Quiz</h2>
              <p className="text-sm text-gray-600">Student Panel</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setActiveView(item.key);
                  if (isMobile) setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeView === item.key ? "bg-gray-100 text-blue-600" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-blue-100 text-blue-600">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{displayName}</p>
              <p className="text-sm text-gray-600">student</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={async () => { await signOut(); router.push("/login"); }} className="w-full justify-start bg-transparent">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
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
      <div className={`flex-1 overflow-auto ${isMobile ? 'pt-16' : ''}`}>
        <div className={`${isMobile ? 'p-4' : 'p-8'}`}>{renderContent()}</div>
      </div>
    </div>
  )
}
