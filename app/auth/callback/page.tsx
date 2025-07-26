"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) throw new Error('Authentication failed');

        const userType = localStorage.getItem('userType') || 'student';
        let profile = null;
        
        if (userType === 'faculty') {
          const { data: facultyProfile } = await supabase
            .from('faculty')
            .select('*')
            .eq('email', user.email)
            .single();
          profile = facultyProfile;
        } else {
          const { data: studentProfile } = await supabase
            .from('students')
            .select('*')
            .eq('email', user.email)
            .single();
          profile = studentProfile;
        }

        if (!profile) {
          // Redirect to signup with pre-filled info
          const name = encodeURIComponent(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '');
          const email = encodeURIComponent(user.email || '');
          if (userType === 'faculty') {
            router.push(`/signup?email=${email}&name=${name}&userType=faculty`);
          } else {
            router.push(`/signup?email=${email}&name=${name}`);
          }
        } else if (
          !profile.department ||
          !profile.section ||
          !profile.username
        ) {
          // Profile exists but incomplete: redirect to profile completion
          router.push('/complete-profile');
        } else {
          // Profile complete: go to dashboard
          if (userType === 'faculty') {
            router.push('/faculty/dashboard');
          } else {
            router.push('/student/dashboard');
          }
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setError('Authentication failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    handleCallback();
  }, [router]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  return null;
} 