import jsPDF from 'jspdf';

// Helper function to clean text for PDF compatibility
const cleanText = (text: string): string => {
  return text
    .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
    .replace(/[""'']/g, '"') // Replace smart quotes
    .replace(/[–—]/g, '-') // Replace em/en dashes
    .replace(/…/g, '...') // Replace ellipsis
    .trim();
};

// Interface for analytics data
interface AnalyticsData {
  totalQuizzes: number;
  totalSubmissions: number;
  avgScore: number;
  completionRate: number;
  recentActivities: any[];
  quizStats: Record<string, any>;
}

interface SectionAnalytics {
  sections: any[];
  subjectTrends: any[];
  totalSections: number;
  avgParticipation: number;
  topPerformer: any;
}

// Generate comprehensive analytics export PDF
export function generateAnalyticsExportPDF(
  analytics: AnalyticsData,
  sectionAnalytics: SectionAnalytics,
  allStudents: any[],
  quizResults: any[]
) {
  const doc = new jsPDF();
  let yPosition = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  // Helper function to add new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPosition = 20;
    }
  };

  // Helper function to add centered title
  const addTitle = (title: string, fontSize: number = 16) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'bold');
    const cleanTitle = cleanText(title);
    const titleWidth = doc.getTextWidth(cleanTitle);
    doc.text(cleanTitle, (pageWidth - titleWidth) / 2, yPosition);
    yPosition += fontSize * 0.5 + 5;
  };

  // Helper function to add section header
  const addSectionHeader = (title: string) => {
    checkPageBreak(20);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(cleanText(title), margin, yPosition);
    yPosition += 15;
    
    // Add underline
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);
    yPosition += 5;
  };

  // Helper function to add metric row
  const addMetricRow = (label: string, value: string, color: [number, number, number] = [0, 0, 0]) => {
    checkPageBreak(8);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(cleanText(label) + ':', margin, yPosition);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(cleanText(value), margin + 100, yPosition);
    yPosition += 8;
  };

  // Title and header
  addTitle('FACULTY ANALYTICS EXPORT REPORT', 18);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const dateStr = `Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`;
  const dateWidth = doc.getTextWidth(dateStr);
  doc.text(dateStr, (pageWidth - dateWidth) / 2, yPosition);
  yPosition += 20;

  // 1. OVERVIEW METRICS
  addSectionHeader('OVERVIEW METRICS');
  addMetricRow('Total Quizzes Created', analytics.totalQuizzes.toString(), [34, 197, 94]);
  addMetricRow('Total Quiz Submissions', analytics.totalSubmissions.toString(), [59, 130, 246]);
  addMetricRow('Overall Average Score', `${analytics.avgScore}%`, [168, 85, 247]);
  addMetricRow('Quiz Completion Rate', `${analytics.completionRate}%`, [249, 115, 22]);
  addMetricRow('Total Registered Students', allStudents.length.toString(), [16, 185, 129]);

  const activeStudents = new Set(quizResults.map(r => r.studentid)).size;
  addMetricRow('Active Students (Participated)', activeStudents.toString(), [34, 197, 94]);
  
  const participationRate = allStudents.length > 0 ? Math.round((activeStudents / allStudents.length) * 100) : 0;
  addMetricRow('Student Participation Rate', `${participationRate}%`, [59, 130, 246]);

  yPosition += 10;

  // 2. SECTION PERFORMANCE ANALYTICS
  addSectionHeader('SECTION PERFORMANCE ANALYTICS');
  addMetricRow('Total Sections Analyzed', sectionAnalytics.totalSections.toString(), [168, 85, 247]);
  addMetricRow('Average Section Participation', `${sectionAnalytics.avgParticipation}%`, [34, 197, 94]);

  if (sectionAnalytics.topPerformer) {
    addMetricRow('Top Performing Section', sectionAnalytics.topPerformer.section, [34, 197, 94]);
    addMetricRow('Top Section Average Score', `${sectionAnalytics.topPerformer.avgScore}%`, [34, 197, 94]);
  }

  // Section breakdown
  if (sectionAnalytics.sections.length > 0) {
    yPosition += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Section Performance Breakdown:', margin, yPosition);
    yPosition += 10;

    sectionAnalytics.sections.slice(0, 5).forEach(section => {
      const trendIcon = section.trend === 'up' ? '↑' : section.trend === 'down' ? '↓' : '→';
      const trendColor: [number, number, number] = section.trend === 'up' ? [34, 197, 94] : section.trend === 'down' ? [239, 68, 68] : [107, 114, 128];
      
      addMetricRow(
        `${section.section} (${section.students} students)`, 
        `${section.avgScore}% ${trendIcon} (${section.participation}% participation)`,
        trendColor
      );
    });
  }

  yPosition += 10;

  // 3. SUBJECT PERFORMANCE TRENDS
  if (sectionAnalytics.subjectTrends.length > 0) {
    addSectionHeader('SUBJECT PERFORMANCE TRENDS');
    
    sectionAnalytics.subjectTrends.forEach(subject => {
      const trendColor: [number, number, number] = subject.trend.startsWith('+') ? [34, 197, 94] : 
                                                  subject.trend.startsWith('-') ? [239, 68, 68] : [107, 114, 128];
      addMetricRow(subject.subject, `${subject.score}% (${subject.trend})`, trendColor);
    });
    
    yPosition += 10;
  }

  // 4. ENGAGEMENT ANALYTICS
  addSectionHeader('STUDENT ENGAGEMENT ANALYTICS');
  
  const completedQuizzes = quizResults.filter(r => r.score !== null);
  const avgSessionTime = completedQuizzes.length > 0 
    ? Math.round(completedQuizzes.reduce((sum, r) => sum + (r.time_spent || 0), 0) / completedQuizzes.length)
    : 0;

  addMetricRow('Total Quiz Attempts', quizResults.length.toString(), [59, 130, 246]);
  addMetricRow('Completed Quiz Attempts', completedQuizzes.length.toString(), [34, 197, 94]);
  addMetricRow('Average Session Time', `${Math.floor(avgSessionTime / 60)}m ${avgSessionTime % 60}s`, [168, 85, 247]);

  // Calculate peak activity
  const hourCounts: Record<number, number> = {};
  quizResults.forEach(r => {
    if (r.submittedat) {
      const hour = new Date(r.submittedat).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
  });
  
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (peakHour) {
    addMetricRow('Peak Activity Hour', `${peakHour}:00 - ${parseInt(peakHour) + 1}:00`, [249, 115, 22]);
  }

  // Day analysis
  const dayCounts: Record<string, number> = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  quizResults.forEach(r => {
    if (r.submittedat) {
      const dayName = dayNames[new Date(r.submittedat).getDay()];
      dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
    }
  });
  
  const mostActiveDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (mostActiveDay) {
    addMetricRow('Most Active Day', mostActiveDay, [34, 197, 94]);
  }

  yPosition += 10;

  // 5. PERFORMANCE DISTRIBUTION
  addSectionHeader('PERFORMANCE DISTRIBUTION');
  
  const scoreRanges = {
    'Excellent (90-100%)': 0,
    'Good (80-89%)': 0,
    'Average (70-79%)': 0,
    'Below Average (60-69%)': 0,
    'Poor (<60%)': 0
  };

  completedQuizzes.forEach(quiz => {
    const score = quiz.score || 0;
    if (score >= 90) scoreRanges['Excellent (90-100%)']++;
    else if (score >= 80) scoreRanges['Good (80-89%)']++;
    else if (score >= 70) scoreRanges['Average (70-79%)']++;
    else if (score >= 60) scoreRanges['Below Average (60-69%)']++;
    else scoreRanges['Poor (<60%)']++;
  });

  Object.entries(scoreRanges).forEach(([range, count]) => {
    const percentage = completedQuizzes.length > 0 ? Math.round((count / completedQuizzes.length) * 100) : 0;
    const color: [number, number, number] = range.includes('Excellent') ? [34, 197, 94] :
                                           range.includes('Good') ? [59, 130, 246] :
                                           range.includes('Average') ? [249, 115, 22] :
                                           range.includes('Below') ? [245, 158, 11] : [239, 68, 68];
    addMetricRow(range, `${count} students (${percentage}%)`, color);
  });

  // Footer
  checkPageBreak(20);
  yPosition = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.text('Generated by Dynamite Quiz Faculty Dashboard', margin, yPosition);
  doc.text(`Page 1 of ${doc.getNumberOfPages()}`, pageWidth - margin - 30, yPosition);

  // Save the PDF
  doc.save(`Faculty_Analytics_Export_${new Date().toISOString().split('T')[0]}.pdf`);
}

// Generate detailed performance report PDF
export function generatePerformanceReportPDF(
  analytics: AnalyticsData,
  sectionAnalytics: SectionAnalytics,
  allStudents: any[],
  quizResults: any[],
  quizzes: any[]
) {
  const doc = new jsPDF();
  let yPosition = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  // Helper functions (same as above)
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPosition = 20;
    }
  };

  const addTitle = (title: string, fontSize: number = 16) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'bold');
    const cleanTitle = cleanText(title);
    const titleWidth = doc.getTextWidth(cleanTitle);
    doc.text(cleanTitle, (pageWidth - titleWidth) / 2, yPosition);
    yPosition += fontSize * 0.5 + 5;
  };

  const addSectionHeader = (title: string) => {
    checkPageBreak(20);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(cleanText(title), margin, yPosition);
    yPosition += 15;
    
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);
    yPosition += 5;
  };

  const addMetricRow = (label: string, value: string, color: [number, number, number] = [0, 0, 0]) => {
    checkPageBreak(8);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(cleanText(label) + ':', margin, yPosition);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(cleanText(value), margin + 120, yPosition);
    yPosition += 8;
  };

  // Title
  addTitle('COMPREHENSIVE PERFORMANCE REPORT', 18);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const dateStr = `Report Period: Last 30 Days | Generated: ${new Date().toLocaleDateString()}`;
  const dateWidth = doc.getTextWidth(dateStr);
  doc.text(dateStr, (pageWidth - dateWidth) / 2, yPosition);
  yPosition += 25;

  // EXECUTIVE SUMMARY
  addSectionHeader('EXECUTIVE SUMMARY');
  
  const totalActiveStudents = new Set(quizResults.map(r => r.studentid)).size;
  const avgQuizScore = analytics.avgScore;
  const trendDirection = avgQuizScore >= 75 ? 'Strong' : avgQuizScore >= 65 ? 'Moderate' : 'Needs Improvement';
  const trendColor: [number, number, number] = avgQuizScore >= 75 ? [34, 197, 94] : avgQuizScore >= 65 ? [249, 115, 22] : [239, 68, 68];

  addMetricRow('Overall Performance Status', trendDirection, trendColor);
  addMetricRow('Faculty Quiz Portfolio', `${analytics.totalQuizzes} Active Quizzes`, [59, 130, 246]);
  addMetricRow('Student Engagement Level', `${totalActiveStudents}/${allStudents.length} Students Active`, [168, 85, 247]);
  addMetricRow('Assessment Completion Rate', `${analytics.completionRate}%`, [34, 197, 94]);

  yPosition += 10;

  // DETAILED ANALYTICS
    // DETAILED PERFORMANCE ANALYTICS
  addSectionHeader('DETAILED PERFORMANCE ANALYTICS');

  // Calculate additional metrics
  const completedQuizzes = quizResults.filter(r => r.score !== null);
  const recentQuizzes = quizResults
    .filter(r => new Date(r.submittedat) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .length;

  addMetricRow('Total Assessment Submissions', analytics.totalSubmissions.toString(), [59, 130, 246]);
  addMetricRow('Successfully Completed Assessments', completedQuizzes.length.toString(), [34, 197, 94]);
  addMetricRow('Recent Activity (Last 7 Days)', `${recentQuizzes} submissions`, [168, 85, 247]);

  // Score distribution
  const highScorers = completedQuizzes.filter(q => (q.score || 0) >= 80).length;
  const mediumScorers = completedQuizzes.filter(q => (q.score || 0) >= 60 && (q.score || 0) < 80).length;
  const lowScorers = completedQuizzes.filter(q => (q.score || 0) < 60).length;

  addMetricRow('High Performers (80%+)', `${highScorers} students`, [34, 197, 94]);
  addMetricRow('Medium Performers (60-79%)', `${mediumScorers} students`, [249, 115, 22]);
  addMetricRow('Students Needing Support (<60%)', `${lowScorers} students`, [239, 68, 68]);

  yPosition += 10;

  // SECTION-WISE DETAILED ANALYSIS
  addSectionHeader('SECTION-WISE DETAILED ANALYSIS');

  if (sectionAnalytics.sections.length > 0) {
    addMetricRow('Total Sections Under Review', sectionAnalytics.totalSections.toString(), [59, 130, 246]);
    
    // Best performing sections
    const topSections = sectionAnalytics.sections
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3);

    addMetricRow('Top Performing Sections', '', [0, 0, 0]);
    yPosition -= 8;
    
    topSections.forEach((section, index) => {
      addMetricRow(`  ${index + 1}. ${section.section}`, `${section.avgScore}% (${section.students} students)`, [34, 197, 94]);
    });

    // Sections needing attention
    const needsAttention = sectionAnalytics.sections.filter(s => s.avgScore < 70 || s.participation < 60);
    if (needsAttention.length > 0) {
      yPosition += 5;
      addMetricRow('Sections Requiring Attention', `${needsAttention.length} sections`, [239, 68, 68]);
      
      needsAttention.slice(0, 3).forEach(section => {
        const issue = section.avgScore < 70 ? `Low scores (${section.avgScore}%)` : `Low participation (${section.participation}%)`;
        addMetricRow(`  • ${section.section}`, issue, [239, 68, 68]);
      });
    }
  }

  yPosition += 10;

  // QUIZ-SPECIFIC PERFORMANCE
  // QUIZ-SPECIFIC PERFORMANCE METRICS
  addSectionHeader('QUIZ-SPECIFIC PERFORMANCE METRICS');

  // Calculate quiz-specific metrics
  const quizPerformance = Object.entries(analytics.quizStats).map(([code, stats]) => ({
    code,
    ...stats,
    quiz: quizzes.find(q => q.code === code)
  })).sort((a, b) => b.avgScore - a.avgScore);

  if (quizPerformance.length > 0) {
    addMetricRow('Most Successful Quiz', `${quizPerformance[0].code} (${quizPerformance[0].avgScore}%)`, [34, 197, 94]);
    
    if (quizPerformance.length > 1) {
      const leastSuccessful = quizPerformance[quizPerformance.length - 1];
      addMetricRow('Quiz Needing Review', `${leastSuccessful.code} (${leastSuccessful.avgScore}%)`, [239, 68, 68]);
    }

    // Average metrics across all quizzes
    const totalSubmissionsPerQuiz = quizPerformance.reduce((sum, q) => sum + q.submissions, 0) / quizPerformance.length;
    addMetricRow('Average Submissions per Quiz', Math.round(totalSubmissionsPerQuiz).toString(), [168, 85, 247]);
  }

  yPosition += 10;

  // TIME-BASED ANALYTICS
  addSectionHeader('⏰ TIME-BASED PERFORMANCE ANALYTICS');

  const completedWithTime = completedQuizzes.filter(q => q.time_spent);
  if (completedWithTime.length > 0) {
    const avgTime = Math.round(
      completedWithTime.reduce((sum, q) => sum + (q.time_spent || 0), 0) / completedWithTime.length
    );
    const fastCompletions = completedWithTime.filter(q => (q.time_spent || 0) < avgTime * 0.7).length;
    const slowCompletions = completedWithTime.filter(q => (q.time_spent || 0) > avgTime * 1.3).length;

    addMetricRow('Average Quiz Completion Time', `${Math.floor(avgTime / 60)}m ${avgTime % 60}s`, [59, 130, 246]);
    addMetricRow('Fast Completions (<70% avg time)', `${fastCompletions} submissions`, [34, 197, 94]);
    addMetricRow('Thorough Attempts (>130% avg time)', `${slowCompletions} submissions`, [168, 85, 247]);
  }

  // Peak performance times
  const hourlyPerformance: Record<number, number[]> = {};
  completedQuizzes.forEach(quiz => {
    if (quiz.submittedat && quiz.score !== null) {
      const hour = new Date(quiz.submittedat).getHours();
      if (!hourlyPerformance[hour]) hourlyPerformance[hour] = [];
      hourlyPerformance[hour].push(quiz.score);
    }
  });

  const bestPerformanceHour = Object.entries(hourlyPerformance)
    .map(([hour, scores]) => ({
      hour: parseInt(hour),
      avgScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      count: scores.length
    }))
    .filter(h => h.count >= 3) // Only consider hours with at least 3 submissions
    .sort((a, b) => b.avgScore - a.avgScore)[0];

  if (bestPerformanceHour) {
    addMetricRow('Peak Performance Time', `${bestPerformanceHour.hour}:00-${bestPerformanceHour.hour + 1}:00 (${Math.round(bestPerformanceHour.avgScore)}% avg)`, [34, 197, 94]);
  }

  yPosition += 15;

  // RECOMMENDATIONS
  addSectionHeader('RECOMMENDATIONS & ACTION ITEMS');

  const recommendations = [];
  
  if (analytics.avgScore < 70) {
    recommendations.push('• Consider reviewing question difficulty levels and providing additional study materials');
  }
  if (analytics.completionRate < 80) {
    recommendations.push('• Increase student engagement through reminders and incentives');
  }
  if (sectionAnalytics.avgParticipation < 70) {
    recommendations.push('• Implement section-specific engagement strategies for low-participation areas');
  }
  if (totalActiveStudents / allStudents.length < 0.7) {
    recommendations.push('• Focus on activating dormant students through targeted outreach');
  }
  if (recommendations.length === 0) {
    recommendations.push('• Continue current successful teaching strategies and maintain performance levels');
    recommendations.push('• Consider expanding quiz variety to challenge high-performing students');
  }

  recommendations.forEach(rec => {
    checkPageBreak(8);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(rec, margin, yPosition);
    yPosition += 8;
  });

  // QUIZ & STUDENT DETAILS SECTION
  addSectionHeader('QUIZ & STUDENT DETAILS');
  // Group quizResults by quiz_code
  const quizzesByCode: Record<string, any[]> = {};
  quizResults.forEach(r => {
    if (!quizzesByCode[r.quiz_code]) quizzesByCode[r.quiz_code] = [];
    quizzesByCode[r.quiz_code].push(r);
  });
  Object.entries(quizzesByCode).forEach(([quizCode, results]) => {
    const quiz = quizzes.find((q: any) => q.code === quizCode);
    checkPageBreak(20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Quiz: ${quiz?.title || quizCode} (${quizCode})`, margin, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Subject: ${quiz?.subject || results[0]?.subject || 'N/A'}`, margin, yPosition);
    yPosition += 8;
    // Table header
    checkPageBreak(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Student Name', margin, yPosition);
    doc.text('Email', margin + 50, yPosition);
    doc.text('Score', margin + 110, yPosition);
    doc.text('Time', margin + 130, yPosition);
    doc.text('Date', margin + 150, yPosition);
    yPosition += 7;
    doc.setFont('helvetica', 'normal');
    results.forEach((r: any) => {
      checkPageBreak(7);
      doc.text(cleanText(r.student_name || ''), margin, yPosition);
      doc.text(cleanText(r.student_email || ''), margin + 50, yPosition);
      doc.text((r.score != null ? r.score + '%' : 'N/A'), margin + 110, yPosition);
      const mins = Math.floor((r.time_spent || 0) / 60);
      const secs = (r.time_spent || 0) % 60;
      doc.text(`${mins}m ${secs}s`, margin + 130, yPosition);
      doc.text(r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '', margin + 150, yPosition);
      yPosition += 7;
    });
    yPosition += 5;
  });

  // Footer
  yPosition = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.text('Comprehensive Performance Report - Dynamite Quiz Faculty Dashboard', margin, yPosition);
  doc.text(`Page 1 of ${doc.getNumberOfPages()}`, pageWidth - margin - 40, yPosition);

  // Save the PDF
  doc.save(`Performance_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}
