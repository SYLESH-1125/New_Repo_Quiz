import jsPDF from 'jspdf';

interface QuizResult {
  id: string;
  studentid: string;
  quizcode: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  status: string;
  submittedat: string;
  time_spent: number;
  students: {
    id: string;
    full_name: string;
    email: string;
    department?: string;
    section?: string;
  };
}

interface Quiz {
  id: string;
  code: string;
  title: string;
  subject: string;
  category: string;
  difficulty: string;
  questions: any[];
  created_at: string;
}

export async function generateQuizReportPDF(
  quiz: Quiz,
  results: QuizResult[],
  facultyName: string
) {
  try {
    console.log('Starting PDF generation for quiz:', quiz.title);
    console.log('Results count:', results.length);
    
    // Validate and sanitize input data
    if (!quiz || !quiz.title) {
      throw new Error('Invalid quiz data provided');
    }
    
    if (!Array.isArray(results)) {
      throw new Error('Invalid results data provided');
    }
    
    // Sanitize quiz data
    const sanitizedQuiz = {
      id: quiz.id || 'unknown',
      code: quiz.code || 'unknown',
      title: quiz.title || 'Untitled Quiz',
      subject: quiz.subject || 'General',
      category: quiz.category || 'General',
      difficulty: quiz.difficulty || 'Medium',
      questions: Array.isArray(quiz.questions) ? quiz.questions : [],
      created_at: quiz.created_at || new Date().toISOString()
    };
    
    // Sanitize faculty name
    const sanitizedFacultyName = facultyName || 'Faculty Member';
    
    // Sanitize results data
    const sanitizedResults = results.map((result, index) => ({
      id: result.id || `result_${index}`,
      studentid: result.studentid || 'unknown',
      quizcode: result.quizcode || sanitizedQuiz.code,
      score: typeof result.score === 'number' ? result.score : 0,
      correct_answers: typeof result.correct_answers === 'number' ? result.correct_answers : 0,
      total_questions: typeof result.total_questions === 'number' ? result.total_questions : 0,
      status: result.status || 'completed',
      submittedat: result.submittedat || new Date().toISOString(),
      time_spent: typeof result.time_spent === 'number' ? result.time_spent : 0,
      students: {
        id: result.students?.id || 'unknown',
        full_name: result.students?.full_name || 'Unknown Student',
        email: result.students?.email || 'unknown@email.com',
        department: result.students?.department || 'Computer Science',
        section: result.students?.section || 'A'
      }
    }));
    
    const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  // Helper function to add text with word wrapping
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 12) => {
    // Sanitize text input
    const sanitizedText = text || '';
    if (typeof sanitizedText !== 'string') {
      console.warn('Invalid text provided to addWrappedText:', text);
      return 0;
    }
    
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(sanitizedText, maxWidth);
    doc.text(lines, x, y);
    return lines.length * (fontSize * 0.4); // Return height used
  };

  // Helper function to check if we need a new page
  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Header
  doc.setFillColor(59, 130, 246); // Blue
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Dynamite Quiz', pageWidth / 2, 25, { align: 'center' });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  yPosition = 50;

  // Quiz Title and Details
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  const titleHeight = addWrappedText(sanitizedQuiz.title, margin, yPosition, contentWidth, 20);
  yPosition += titleHeight + 10;

  // Quiz Details Table
  const details = [
    ['Subject:', sanitizedQuiz.subject],
    ['Category:', sanitizedQuiz.category],
    ['Difficulty:', sanitizedQuiz.difficulty],
    ['Quiz Code:', sanitizedQuiz.code],
    ['Total Questions:', sanitizedQuiz.questions.length.toString()],
    ['Created:', new Date(sanitizedQuiz.created_at).toLocaleDateString()],
    ['Report Generated:', new Date().toLocaleDateString()],
    ['Faculty:', sanitizedFacultyName]
  ];

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  details.forEach(([label, value]) => {
    if (checkPageBreak(15)) return;
    
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 50, yPosition);
    yPosition += 8;
  });

  yPosition += 15;

  // Summary Statistics
  if (checkPageBreak(60)) return;
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary Statistics', margin, yPosition);
  yPosition += 15;

  const totalParticipants = sanitizedResults.length;
  const avgScore = totalParticipants > 0 ? sanitizedResults.reduce((sum, r) => sum + r.score, 0) / totalParticipants : 0;
  const highestScore = totalParticipants > 0 ? Math.max(...sanitizedResults.map(r => r.score)) : 0;
  const lowestScore = totalParticipants > 0 ? Math.min(...sanitizedResults.map(r => r.score)) : 0;
  const completionRate = totalParticipants > 0 ? (sanitizedResults.filter(r => r.status === 'completed').length / totalParticipants) * 100 : 0;

  const summaryStats = [
    ['Total Participants:', totalParticipants.toString()],
    ['Average Score:', `${avgScore.toFixed(1)}%`],
    ['Highest Score:', `${highestScore}%`],
    ['Lowest Score:', `${lowestScore}%`],
    ['Completion Rate:', `${completionRate.toFixed(1)}%`]
  ];

  doc.setFontSize(10);
  summaryStats.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 80, yPosition);
    yPosition += 8;
  });

  yPosition += 15;

  // Top 5 Performers
  if (checkPageBreak(80)) return;
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Top 5 Performers', margin, yPosition);
  yPosition += 15;

  const topPerformers = sanitizedResults
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Rank', margin, yPosition);
  doc.text('Student Name', margin + 20, yPosition);
  doc.text('Score', margin + 100, yPosition);
  doc.text('Time (min)', margin + 140, yPosition);
  yPosition += 8;

  doc.setFont('helvetica', 'normal');
  topPerformers.forEach((result, index) => {
    if (checkPageBreak(20)) return;
    
    const studentName = result.students?.full_name || result.students?.email || 'Unknown';
    const timeSpent = Math.round(result.time_spent / 60);
    
    doc.text(`${index + 1}`, margin, yPosition);
    doc.text(studentName.substring(0, 25), margin + 20, yPosition);
    doc.text(`${result.score}%`, margin + 100, yPosition);
    doc.text(timeSpent.toString(), margin + 140, yPosition);
    yPosition += 8;
  });

  yPosition += 15;

  // Bottom 5 Performers
  if (checkPageBreak(80)) return;
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Bottom 5 Performers', margin, yPosition);
  yPosition += 15;

  const bottomPerformers = sanitizedResults
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Rank', margin, yPosition);
  doc.text('Student Name', margin + 20, yPosition);
  doc.text('Score', margin + 100, yPosition);
  doc.text('Time (min)', margin + 140, yPosition);
  yPosition += 8;

  doc.setFont('helvetica', 'normal');
  bottomPerformers.forEach((result, index) => {
    if (checkPageBreak(20)) return;
    
    const studentName = result.students?.full_name || result.students?.email || 'Unknown';
    const timeSpent = Math.round(result.time_spent / 60);
    
    doc.text(`${index + 1}`, margin, yPosition);
    doc.text(studentName.substring(0, 25), margin + 20, yPosition);
    doc.text(`${result.score}%`, margin + 100, yPosition);
    doc.text(timeSpent.toString(), margin + 140, yPosition);
    yPosition += 8;
  });

  yPosition += 15;

  // Score Distribution
  if (checkPageBreak(60)) return;
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Score Distribution', margin, yPosition);
  yPosition += 15;

  const scoreRanges = [
    { range: '90-100%', count: sanitizedResults.filter(r => r.score >= 90).length },
    { range: '80-89%', count: sanitizedResults.filter(r => r.score >= 80 && r.score < 90).length },
    { range: '70-79%', count: sanitizedResults.filter(r => r.score >= 70 && r.score < 80).length },
    { range: '60-69%', count: sanitizedResults.filter(r => r.score >= 60 && r.score < 70).length },
    { range: '50-59%', count: sanitizedResults.filter(r => r.score >= 50 && r.score < 60).length },
    { range: 'Below 50%', count: sanitizedResults.filter(r => r.score < 50).length }
  ];

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Score Range', margin, yPosition);
  doc.text('Count', margin + 80, yPosition);
  doc.text('Percentage', margin + 120, yPosition);
  yPosition += 8;

  doc.setFont('helvetica', 'normal');
  scoreRanges.forEach(range => {
    if (checkPageBreak(15)) return;
    
    const percentage = totalParticipants > 0 ? ((range.count / totalParticipants) * 100).toFixed(1) : '0.0';
    
    doc.text(range.range, margin, yPosition);
    doc.text(range.count.toString(), margin + 80, yPosition);
    doc.text(`${percentage}%`, margin + 120, yPosition);
    yPosition += 8;
  });

  yPosition += 15;

  // Complete Participant List
  if (checkPageBreak(60)) return;
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Complete Participant List', margin, yPosition);
  yPosition += 15;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Name', margin, yPosition);
  doc.text('Score', margin + 60, yPosition);
  doc.text('Time', margin + 80, yPosition);
  doc.text('Status', margin + 100, yPosition);
  doc.text('Submitted', margin + 130, yPosition);
  yPosition += 6;

  doc.setFont('helvetica', 'normal');
  sanitizedResults.forEach(result => {
    if (checkPageBreak(15)) return;
    
    const studentName = result.students?.full_name || result.students?.email || 'Unknown';
    const timeSpent = Math.round(result.time_spent / 60);
    const submittedDate = new Date(result.submittedat).toLocaleDateString();
    
    doc.text(studentName.substring(0, 20), margin, yPosition);
    doc.text(`${result.score}%`, margin + 60, yPosition);
    doc.text(`${timeSpent}m`, margin + 80, yPosition);
    doc.text(result.status, margin + 100, yPosition);
    doc.text(submittedDate, margin + 130, yPosition);
    yPosition += 6;
  });

  // Footer
  const footerY = pageHeight - 20;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, footerY, { align: 'center' });

  // Save the PDF with better download handling
  const fileName = `quiz_report_${sanitizedQuiz.code}_${new Date().toISOString().split('T')[0]}.pdf`;
  
  try {
    // Method 1: Try direct save (works in most browsers)
    doc.save(fileName);
    console.log('PDF generated successfully via direct save:', fileName);
  } catch (saveError) {
    console.warn('Direct save failed, trying blob method:', saveError);
    
    try {
      // Method 2: Use blob for better browser compatibility
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      
      // Add to DOM, click, and cleanup
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      console.log('PDF downloaded via blob method:', fileName);
    } catch (blobError) {
      console.error('Blob method also failed:', blobError);
      
      // Method 3: Try data URL method
      try {
        const dataUrl = doc.output('dataurlstring');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('PDF downloaded via data URL method:', fileName);
      } catch (dataUrlError) {
        console.error('All download methods failed:', dataUrlError);
        throw new Error('Failed to download PDF. Please check your browser settings and try again.');
      }
    }
  }
  } catch (error) {
    console.error('Error in generateQuizReportPDF:', error);
    throw error;
  }
} 