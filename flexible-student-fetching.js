// Alternative fetchAttendedStudents function that works with existing table structure
// This goes in the faculty dashboard and tries multiple approaches to find student quiz data

const fetchAttendedStudentsFlexible = async () => {
  setStudentsLoading(true);
  try {
    const { supabase } = await import("@/lib/supabase");
    
    const facultyQuizIds = quizzes.map(q => q.id);
    const facultyQuizCodes = quizzes.map(q => q.code);
    
    if (facultyQuizIds.length === 0) {
      setAttendedStudents([]);
      setStudentsLoading(false);
      return;
    }
    
    // Strategy 1: Try to get students with quiz_history column
    let studentsData = null;
    let error = null;
    
    try {
      const result = await supabase
        .from("students")
        .select("id, name, full_name, username, email, section, department, roll_number, avg_score, accuracy_rate, quiz_history");
      
      studentsData = result.data;
      error = result.error;
    } catch (err) {
      console.log("quiz_history column might not exist, trying alternative...");
    }
    
    // Strategy 2: If quiz_history doesn't exist, try quiz_results table
    if (!studentsData || error) {
      try {
        console.log("Trying quiz_results table approach...");
        const result = await supabase
          .from("quiz_results")
          .select(`
            student_id,
            studentid,
            score,
            submitted_at,
            submittedat,
            quiz_code,
            quizcode,
            quiz_id,
            students!inner(
              id,
              name,
              full_name,
              username,
              email,
              section,
              department,
              roll_number,
              avg_score,
              accuracy_rate
            )
          `)
          .in("quiz_code", facultyQuizCodes.concat(facultyQuizIds));
        
        if (result.data && result.data.length > 0) {
          // Convert quiz_results format to students format
          const studentMap = new Map();
          const recentActivity = [];
          
          result.data.forEach((result) => {
            const student = result.students;
            const studentId = student.id;
            
            // Add to live activity
            if (recentActivity.length < 20) {
              recentActivity.push({
                studentName: student.full_name || student.name || student.username,
                quizCode: result.quiz_code || result.quizcode,
                score: result.score,
                timestamp: result.submitted_at || result.submittedat,
                department: student.department,
                section: student.section
              });
            }
            
            if (!studentMap.has(studentId)) {
              studentMap.set(studentId, {
                ...student,
                latestActivity: result.submitted_at || result.submittedat,
                totalQuizzesTaken: 1,
                totalScore: result.score || 0,
                latestScore: result.score || 0,
                avg_score: result.score || 0,
                attendedQuizzes: [result]
              });
            } else {
              const existing = studentMap.get(studentId);
              existing.totalQuizzesTaken += 1;
              existing.totalScore += result.score || 0;
              existing.avg_score = Math.round(existing.totalScore / existing.totalQuizzesTaken);
              existing.attendedQuizzes.push(result);
            }
          });
          
          recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setLiveActivity(recentActivity.slice(0, 10));
          
          const studentsArray = Array.from(studentMap.values()).sort((a, b) => 
            new Date(b.latestActivity).getTime() - new Date(a.latestActivity).getTime()
          );
          
          setAttendedStudents(studentsArray);
          setStudentsLoading(false);
          return;
        }
      } catch (quizResultsError) {
        console.log("quiz_results table approach failed:", quizResultsError);
      }
    }
    
    // Strategy 3: If we have students data with quiz_history, process it
    if (studentsData && !error) {
      const studentMap = new Map();
      const recentActivity = [];
      
      studentsData.forEach((student) => {
        const quizHistory = student.quiz_history || [];
        if (!Array.isArray(quizHistory) || quizHistory.length === 0) return;
        
        const attendedQuizzes = quizHistory.filter((quiz) => 
          facultyQuizIds.includes(quiz.quiz_id) || facultyQuizCodes.includes(quiz.quiz_code)
        );
        
        if (attendedQuizzes.length === 0) return;
        
        attendedQuizzes.forEach((quiz) => {
          if (recentActivity.length < 20) {
            recentActivity.push({
              studentName: student.full_name || student.name || student.username,
              quizCode: quiz.quiz_code,
              quizTitle: quiz.quiz_title,
              score: quiz.score,
              timestamp: quiz.submitted_at || quiz.taken_at,
              department: student.department,
              section: student.section
            });
          }
        });
        
        const totalQuizzesTaken = attendedQuizzes.length;
        const totalScore = attendedQuizzes.reduce((sum, quiz) => sum + (quiz.score || 0), 0);
        const avgScore = totalQuizzesTaken > 0 ? Math.round(totalScore / totalQuizzesTaken) : 0;
        const latestQuiz = attendedQuizzes.reduce((latest, quiz) => {
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
          attendedQuizzes
        });
      });
      
      recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLiveActivity(recentActivity.slice(0, 10));
      
      const studentsArray = Array.from(studentMap.values()).sort((a, b) => 
        new Date(b.latestActivity).getTime() - new Date(a.latestActivity).getTime()
      );
      
      setAttendedStudents(studentsArray);
    } else {
      // Strategy 4: Fallback - just show all students with a note
      console.log("No quiz data found, showing all students");
      const result = await supabase
        .from("students")
        .select("id, name, full_name, username, email, section, department, roll_number");
      
      setAttendedStudents(result.data || []);
      setLiveActivity([]);
    }
    
  } catch (error) {
    console.error("Error in fetchAttendedStudentsFlexible:", error);
    setAttendedStudents([]);
    setLiveActivity([]);
  }
  
  setStudentsLoading(false);
};
