import { supabase } from './supabase';

export interface User {
  id: string
  name: string
  email: string
  userType: "student" | "faculty"
  picture?: string
  createdAt: Date
  lastLogin: Date
  department?: string
  section?: string
  username?: string
  profileComplete?: boolean
}

// Add function to check if profile is complete
export function isProfileComplete(user: User): boolean {
  return !!(user.department && user.section && user.username)
}

class UserManager {
  private users: Map<string, User> = new Map()
  private emailIndex: Map<string, string> = new Map()

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    if (typeof window === "undefined") return

    try {
      const stored = localStorage.getItem("quiz_app_users")
      if (stored) {
        const data = JSON.parse(stored)
        this.users = new Map(data.users || [])
        this.emailIndex = new Map(data.emailIndex || [])
      }
    } catch (error) {
      console.error("Error loading users from storage:", error)
    }
  }

  private saveToStorage() {
    if (typeof window === "undefined") return

    try {
      const data = {
        users: Array.from(this.users.entries()),
        emailIndex: Array.from(this.emailIndex.entries()),
      }
      localStorage.setItem("quiz_app_users", JSON.stringify(data))
    } catch (error) {
      console.error("Error saving users to storage:", error)
    }
  }

  createUser(id: string, name: string, email: string, userType: "student" | "faculty"): User {
    const user: User = {
      id,
      name,
      email,
      userType,
      createdAt: new Date(),
      lastLogin: new Date(),
    }

    this.users.set(id, user)
    this.emailIndex.set(email.toLowerCase(), id)
    this.saveToStorage()

    return user
  }

  getUserById(id: string): User | undefined {
    return this.users.get(id)
  }

  getUserByEmail(email: string): User | undefined {
    const userId = this.emailIndex.get(email.toLowerCase())
    return userId ? this.users.get(userId) : undefined
  }

  updateUser(id: string, updates: Partial<User>): User | undefined {
    const user = this.users.get(id)
    if (!user) return undefined

    const updatedUser = { ...user, ...updates }
    this.users.set(id, updatedUser)

    // Update email index if email changed
    if (updates.email && updates.email !== user.email) {
      this.emailIndex.delete(user.email.toLowerCase())
      this.emailIndex.set(updates.email.toLowerCase(), id)
    }

    this.saveToStorage()
    return updatedUser
  }

  deleteUser(id: string): boolean {
    const user = this.users.get(id)
    if (!user) return false

    this.users.delete(id)
    this.emailIndex.delete(user.email.toLowerCase())
    this.saveToStorage()
    return true
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values())
  }

  getUsersByType(userType: "student" | "faculty"): User[] {
    return this.getAllUsers().filter((user) => user.userType === userType)
  }

  updateLastLogin(id: string): void {
    const user = this.users.get(id)
    if (user) {
      user.lastLogin = new Date()
      this.users.set(id, user)
      this.saveToStorage()
    }
  }
}

// Create singleton instance
const userManager = new UserManager()

// Export convenience functions
export const createUser = (id: string, name: string, email: string, userType: "student" | "faculty") =>
  userManager.createUser(id, name, email, userType)

export const getUserById = (id: string) => userManager.getUserById(id)

export const getUserByEmail = (email: string) => userManager.getUserByEmail(email)

export const updateUser = (id: string, updates: Partial<User>) => userManager.updateUser(id, updates)

export const deleteUser = (id: string) => userManager.deleteUser(id)

export const getAllUsers = () => userManager.getAllUsers()

export const getUsersByType = (userType: "student" | "faculty") => userManager.getUsersByType(userType)

export const updateLastLogin = (id: string) => userManager.updateLastLogin(id)

export const saveUser = (user: User) => {
  userManager.updateUser(user.id, user)
}

export default userManager

export async function updateStudentQuizHistory(studentId: string) {
  // Fetch all quiz results for the student
  const { data: results, error: resultsError } = await supabase
    .from('quiz_results')
    .select('quiz_id, score, correct_answers, total_questions, time_spent, taken_at, answers')
    .eq('student_id', studentId)
    .order('taken_at', { ascending: false });
  if (resultsError) {
    console.error('Error fetching quiz results:', resultsError);
    return;
  }
  // Fetch all quiz titles for the quiz_ids
  const quizIds = [...new Set(results.map((r: any) => r.quiz_id))];
  const { data: quizzes, error: quizzesError } = await supabase
    .from('quizzes')
    .select('id, title')
    .in('id', quizIds);
  if (quizzesError) {
    console.error('Error fetching quizzes:', quizzesError);
    return;
  }
  // Map quiz_id to title
  const quizIdToTitle: Record<string, string> = {};
  quizzes.forEach((q: any) => {
    quizIdToTitle[q.id] = q.title;
  });
  // Build quiz_history array with titles
  const quizHistory = results.map((r: any) => ({
    quiz_id: r.quiz_id,
    title: quizIdToTitle[r.quiz_id] || r.quiz_id,
    score: r.score,
    correct_answers: r.correct_answers,
    total_questions: r.total_questions,
    time_spent: r.time_spent,
    taken_at: r.taken_at,
    answers: r.answers, // include answers for PDF and evaluation
  }));
  // Update the student's quiz_history field
  const { error: updateError } = await supabase
    .from('students')
    .update({ quiz_history: quizHistory })
    .eq('id', studentId);
  if (updateError) {
    console.error('Error updating student quiz_history:', updateError);
  }
}

export async function updateStudentQuizStats(studentId: string) {
  // Fetch the student's quiz_history
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('quiz_history')
    .eq('id', studentId)
    .single();
  if (studentError) {
    console.error('Error fetching student quiz_history:', studentError);
    return;
  }
  const quizHistory = Array.isArray(student?.quiz_history) ? student.quiz_history : [];
  const quizzesTaken = quizHistory.length;
  
  let avgScore = 0;
  let bestScore = 0;
  let lowestScore = 0;
  
  if (quizzesTaken > 0) {
    // Calculate average score
    const totalScore = quizHistory.reduce((sum: number, q: any) => sum + (q.score || 0), 0);
    avgScore = Math.round(totalScore / quizzesTaken);
    
    // Calculate best and lowest scores
    const scores = quizHistory.map((q: any) => q.score || 0).filter(score => score > 0);
    if (scores.length > 0) {
      bestScore = Math.max(...scores);
      lowestScore = Math.min(...scores);
    }
  }
  
  // Update the student's stats
  const { error: updateError } = await supabase
    .from('students')
    .update({ 
      avg_score: avgScore, 
      quizzes_taken: quizzesTaken,
      best_score: bestScore,
      lowest_score: lowestScore
    })
    .eq('id', studentId);
  if (updateError) {
    console.error('Error updating student stats:', updateError);
  }
}

export async function updateAllStudentsQuizStats() {
  try {
    // Fetch all students with quiz_history
    const { data: students, error: fetchError } = await supabase
      .from('students')
      .select('id, quiz_history')
      .not('quiz_history', 'is', null);
    
    if (fetchError) {
      console.error('Error fetching students:', fetchError);
      return;
    }
    
    console.log(`Updating quiz stats for ${students?.length || 0} students`);
    
    // Update each student's stats
    for (const student of students || []) {
      await updateStudentQuizStats(student.id);
    }
    
    console.log('Successfully updated all students quiz stats');
  } catch (error) {
    console.error('Error updating all students quiz stats:', error);
  }
}
