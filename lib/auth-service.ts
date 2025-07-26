import { supabase } from './supabase';

// Check if user exists using Supabase users table
export async function checkUserExists(email: string): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('email')
    .eq('email', email.toLowerCase())
    .single();
  return !!data;
}

// Sign up with email using Supabase auth
export async function signUpWithEmail(userData: {
  email: string;
  password: string;
  userType: 'student' | 'faculty';
  department: string;
  section: string;
  username: string;
  name: string;
}): Promise<any> {
  const { data, error } = await supabase.auth.signUp({
    email: userData.email,
    password: userData.password,
    options: {
      data: {
        full_name: userData.name,
        user_type: userData.userType,
        department: userData.department,
        section: userData.section,
        username: userData.username,
      },
    },
  });
  if (error) throw error;
  return data;
}

// Complete user profile using Supabase auth updateUser
export async function completeUserProfile(profileData: {
  department: string;
  section: string;
  username: string;
  userType: 'student' | 'faculty';
}): Promise<any> {
  const { data, error } = await supabase.auth.updateUser({
    data: {
      ...profileData,
      user_type: profileData.userType,
    },
  });
  if (error) throw error;
  return data;
}

// Check username uniqueness
export async function validateUsername(username: string, excludeUserId?: string): Promise<boolean> {
  let query = supabase
    .from('users')
    .select('username')
    .eq('username', username);
  if (excludeUserId) {
    query = query.neq('id', excludeUserId);
  }
  const { data } = await query.single();
  return !data; // Username is available if no data returned
}

// Sign in with email using Supabase auth
export async function signInWithEmail(email: string, password: string): Promise<any> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

// Add function to call the updated student profile RPC
export async function createStudentProfile({ email, department, section, username }: { email: string, department: string, section: string, username: string }) {
  const { data, error } = await supabase.rpc('create_student_profile', {
    user_email: email,
    department,
    section,
    username
  });
  if (error) throw error;
  return data;
}

// Add function to call the updated faculty profile RPC
export async function createFacultyProfile({ email, department, section, username }: { email: string, department: string, section: string, username: string }) {
  const { data, error } = await supabase.rpc('create_faculty_profile', {
    user_email: email,
    department,
    section,
    username
  });
  if (error) throw error;
  return data;
} 