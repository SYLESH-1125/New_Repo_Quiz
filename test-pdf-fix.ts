import { generateStudentQuizDetailedPDF } from './lib/pdf-generator';

// Test data
const testQuiz = {
  title: 'Test Quiz',
  quiz_id: 'TEST001',
  score: 80,
  total_questions: 5,
  time_spent: 300,
  submitted_at: new Date().toISOString()
};

const testQuestions = [
  {
    id: '1',
    type: 'multiple-choice',
    question: 'What is the capital of France?',
    options: ['London', 'Paris', 'Berlin', 'Madrid'],
    correctAnswer: 1,
    explanation: 'Paris is the capital and largest city of France.'
  },
  {
    id: '2',
    type: 'true-false',
    question: 'The Earth is round.',
    correctAnswer: 'true',
    explanation: 'The Earth is approximately spherical in shape.'
  }
];

const testStudentInfo = {
  id: 'student123',
  name: 'Test Student'
};

const testAnswers = {
  '1': 1, // Correct answer
  '2': 'true' // Correct answer
};

// Test the PDF generation
console.log('Testing PDF generation...');
try {
  generateStudentQuizDetailedPDF(testQuiz, testQuestions, testAnswers, testStudentInfo);
  console.log('✅ PDF generation test completed successfully!');
} catch (error) {
  console.error('❌ PDF generation test failed:', error);
} 