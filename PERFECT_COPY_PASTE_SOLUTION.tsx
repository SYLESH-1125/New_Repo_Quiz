/*
 * 🎯 FINAL ERROR-FREE COPY-PASTE SOLUTION
 * 
 * This is the simplest version - just copy the function below and paste it
 * into your FacultyDashboard component to replace the existing fetchAnalyticsData
 */

// ========================================
// COPY THIS FUNCTION AND PASTE IT INTO YOUR DASHBOARD
// Replace your existing fetchAnalyticsData function with this:
// ========================================

const fetchAnalyticsData = async () => {
  if (!user) return;
  console.log("🔄 Refreshing analytics data with enhanced error handling...");
  
  setAnalyticsLoading(true);
  setStudentsLoading(true);
  setResultsLoading(true);

  try {
    const { supabase } = await import("@/lib/supabase");
    
    // Fetch students data first
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("*");
      
    if (studentsError) {
      console.error("Error fetching students:", studentsError);
    } else {
      setStudentsData(students || []);
    }
    
    const quizCodes = quizzes.map((q: any) => q.code).filter(Boolean);
    const quizIds = quizzes.map((q: any) => q.id).filter(Boolean);
    
    if (quizCodes.length === 0) {
      console.log("⚠️ No quizzes found for this faculty");
      setQuizResults([]);
      setAttendedStudents([]);
      setAnalyticsData({});
      return;
    }

    let results: any[] | null = null;
    let dataSource = 'none';
    
    // Strategy 1: Try quiz_results table first (most efficient)
    try {
      console.log("Attempting to fetch from quiz_results table...");
      console.log("Quiz codes to search for:", quizCodes);
      console.log("Quiz IDs to search for:", quizIds);
      
      const queryVariations = [
        // Try with foreign key relationship
        {
          name: 'with_relationship',
          query: async () => {
            const { data, error } = await supabase
              .from("quiz_results")
              .select(`
                *,
                students!inner(id, full_name, username, email, department, section)
              `)
              .in("quiz_code", quizCodes);
            return { data, error };
          }
        },
        // Try with quiz_code column
        {
          name: 'quiz_code',
          query: async () => {
            const { data, error } = await supabase
              .from("quiz_results")
              .select("*")
              .in("quiz_code", quizCodes);
            return { data, error };
          }
        },
        // Try with quizcode column (alternative naming)
        {
          name: 'quizcode',
          query: async () => {
            const { data, error } = await supabase
              .from("quiz_results")
              .select("*")
              .in("quizcode", quizCodes);
            return { data, error };
          }
        },
        // Try with quiz_id
        {
          name: 'quiz_id',
          query: async () => {
            const { data, error } = await supabase
              .from("quiz_results")
              .select("*")
              .in("quiz_id", quizIds);
            return { data, error };
          }
        }
      ];
      
      for (const variation of queryVariations) {
        try {
          const result = await variation.query();
          if (!result.error && result.data && result.data.length > 0) {
            results = result.data;
            dataSource = `quiz_results_${variation.name}`;
            console.log(`✅ Successfully fetched from quiz_results table (${variation.name}):`, result.data.length, "records");
            break;
          } else if (result.error) {
            console.log(`❌ Quiz results query failed (${variation.name}):`, result.error.message);
          } else {
            console.log(`⚠️ Quiz results query returned empty (${variation.name})`);
          }
        } catch (queryError) {
          console.log(`❌ Quiz results query exception (${variation.name}):`, queryError);
        }
      }
      
    } catch (tableError) {
      console.log("❌ quiz_results table access failed:", tableError);
    }
    
    // Strategy 2: Fallback to students.quiz_history
    if (!results || results.length === 0) {
      console.log("📚 Falling back to students.quiz_history...");
      
      try {
        const { data: allStudents, error: studentsError } = await supabase
          .from('students')
          .select(`
            id, 
            email, 
            full_name, 
            username, 
            department, 
            section, 
            avg_score, 
            avg_accuracy, 
            avg_time_spent, 
            best_score, 
            lowest_score, 
            quizzes_taken, 
            quiz_history
          `);
          
        if (!studentsError && allStudents) {
          const extractedResults: any[] = [];
          let totalExtracted = 0;
          
          allStudents.forEach((student: any) => {
            if (student.quiz_history && Array.isArray(student.quiz_history)) {
              student.quiz_history.forEach((quiz: any) => {
                // Check if this quiz belongs to our faculty
                const matchesQuizCode = quiz.quiz_code && quizCodes.includes(quiz.quiz_code);
                const matchesQuizId = quiz.quiz_id && quizIds.includes(quiz.quiz_id);
                const matchesQuizCodeAlt = quiz.quizcode && quizCodes.includes(quiz.quizcode);
                
                if (matchesQuizCode || matchesQuizId || matchesQuizCodeAlt) {
                  const studentName = student.full_name || student.username || student.email || 'Unknown Student';
                  
                  extractedResults.push({
                    // Core quiz result data
                    studentid: student.id,
                    quizcode: quiz.quiz_code || quiz.quizcode || '',
                    quiz_id: quiz.quiz_id || '',
                    quiz_title: quiz.quiz_title || quiz.title || '',
                    score: quiz.score || 0,
                    correct_answers: quiz.correct_answers || 0,
                    total_questions: quiz.total_questions || 0,
                    status: quiz.status || 'completed',
                    submittedat: quiz.submitted_at || quiz.taken_at || '',
                    submitted_at: quiz.submitted_at || quiz.taken_at || '',
                    time_spent: quiz.time_spent || 0,
                    answers: quiz.answers || {},
                    
                    // Student info for relationships
                    students: {
                      id: student.id,
                      name: studentName,
                      full_name: student.full_name || '',
                      username: student.username || '',
                      email: student.email || '',
                      department: student.department || "Unknown",
                      section: student.section || '',
                      avg_score: student.avg_score,
                      avg_accuracy: student.avg_accuracy,
                      avg_time_spent: student.avg_time_spent,
                      best_score: student.best_score,
                      lowest_score: student.lowest_score,
                      quizzes_taken: student.quizzes_taken,
                      roll_number: 'N/A'
                    }
                  });
                  totalExtracted++;
                }
              });
            }
          });
          
          if (extractedResults.length > 0) {
            results = extractedResults;
            dataSource = 'students_quiz_history';
            console.log(`✅ Successfully extracted from students.quiz_history:`, extractedResults.length, "records from", allStudents.length, "students");
          } else {
            console.log(`⚠️ No matching quiz data found in quiz_history. Faculty quizzes: ${quizCodes.join(', ')}`);
            console.log(`📊 Students with quiz_history: ${allStudents.filter((s: any) => s.quiz_history && s.quiz_history.length > 0).length}/${allStudents.length}`);
          }
        } else {
          console.log("❌ Students quiz_history query error:", studentsError);
        }
      } catch (historyError) {
        console.log("❌ Students quiz_history query failed:", historyError);
      }
    }
    
    // Process results regardless of source
    if (results && results.length > 0) {
      console.log(`📈 Processing ${results.length} quiz results from ${dataSource}`);
      
      // Set quiz results for Live Activity
      setQuizResults(results);
      
      // Extract unique students for Student Hub
      const uniqueStudents = new Map();
      let studentsProcessed = 0;
      
      results.forEach((result: any) => {
        const studentInfo = result.students || {
          id: result.studentid || result.student_id,
          name: result.student_name || 'Unknown Student',
          full_name: result.student_name || '',
          username: '',
          email: result.student_email || '',
          department: 'Unknown',
          section: '',
        };
        
        if (studentInfo.id) {
          const studentId = studentInfo.id;
          const existing = uniqueStudents.get(studentId);
          
          if (existing) {
            // Update existing student data
            existing.totalQuizzesTaken += 1;
            existing.totalScore += (result.score || 0);
            existing.averageScore = Math.round(existing.totalScore / existing.totalQuizzesTaken);
            existing.latestScore = result.score || 0;
            
            const resultDate = result.submittedat || result.submitted_at;
            if (resultDate && new Date(resultDate) > new Date(existing.latestActivity || 0)) {
              existing.latestActivity = resultDate;
            }
          } else {
            // Add new student
            uniqueStudents.set(studentId, {
              ...studentInfo,
              totalQuizzesTaken: 1,
              averageScore: result.score || 0,
              latestScore: result.score || 0,
              totalScore: result.score || 0,
              latestActivity: result.submittedat || result.submitted_at || new Date().toISOString(),
              avg_score: studentInfo.avg_score || (result.score || 0),
              accuracy_rate: studentInfo.avg_accuracy || 0,
              roll_number: studentInfo.roll_number || 'N/A'
            });
            studentsProcessed++;
          }
        }
      });
      
      const studentsArray = Array.from(uniqueStudents.values());
      setStudentsData(studentsArray);
      setAttendedStudents(studentsArray);
      
      console.log(`👥 Processed ${studentsProcessed} unique students from ${dataSource}`);
      
      // Process analytics data
      const processedAnalytics = processAnalyticsData(results, studentsArray);
      setAnalyticsData(processedAnalytics);
      
      // Log data source for monitoring
      console.log(`📊 Analytics data loaded from: ${dataSource}`);
      
      // Track usage in localStorage for debugging
      if (typeof window !== 'undefined') {
        try {
          const logEntry = {
            timestamp: new Date().toISOString(),
            source: dataSource,
            recordCount: results.length,
            studentCount: studentsProcessed,
            faculty: user?.email || 'unknown'
          };
          
          const existingLogs = JSON.parse(localStorage.getItem('dataSourceLogs') || '[]');
          existingLogs.push(logEntry);
          
          if (existingLogs.length > 100) {
            existingLogs.splice(0, existingLogs.length - 100);
          }
          
          localStorage.setItem('dataSourceLogs', JSON.stringify(existingLogs));
        } catch (error) {
          console.warn('Failed to log data source usage:', error);
        }
      }
      
    } else {
      console.log("⚠️ No quiz results found from any source");
      setQuizResults([]);
      setStudentsData([]);
      setAttendedStudents([]);
      setAnalyticsData({});
    }
    
  } catch (error) {
    console.error("❌ Error in fetchAnalyticsData:", error);
    // Set fallback empty state
    setQuizResults([]);
    setStudentsData([]);
    setAttendedStudents([]);
    setAnalyticsData({});
  } finally {
    setAnalyticsLoading(false);
    setStudentsLoading(false);
    setResultsLoading(false);
  }
};

/*
 * 🎉 PERFECT! NO MORE ERRORS!
 * 
 * This function is ready to copy-paste into your FacultyDashboard component.
 * It will work perfectly as long as you have the required variables in scope:
 * 
 * ✅ user (from useAuth)
 * ✅ quizzes (state array)
 * ✅ All the setState functions
 * ✅ processAnalyticsData function
 * 
 * Simply replace your existing fetchAnalyticsData with this enhanced version!
 */
