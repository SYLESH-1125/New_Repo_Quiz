"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function FacultyStudentsList() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function fetchStudents() {
      setLoading(true);
      setError("");
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data, error } = await supabase
          .from("students")
          .select("id, full_name, username, email, department, section");
        if (error) throw error;
        setStudents(data || []);
      } catch (err: any) {
        setError(err.message || "Failed to load students");
      }
      setLoading(false);
    }
    fetchStudents();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle>All Registered Students</CardTitle>
          <CardDescription>Click a student to view their analytics profile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {students.length === 0 && <div className="text-gray-500">No students found.</div>}
          {students.map(student => (
            <div
              key={student.id}
              className="flex items-center gap-4 p-4 bg-gray-50/50 rounded-lg hover:bg-gray-100/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/faculty/students/${student.id}`)}
            >
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  {(student.full_name || student.username || "").slice(0,2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold text-gray-900">{student.full_name || student.username}</div>
                <div className="text-xs text-gray-600">{student.email}</div>
                <div className="text-xs text-gray-600">Dept: {student.department} | Section: {student.section}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
