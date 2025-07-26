// Diagnostic script for quiz_results table access issues
// Add this to a new page: app/admin/diagnostics/page.tsx

'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DiagnosticResult {
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  data?: any;
}

export default function DiagnosticsPage() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (result: DiagnosticResult) => {
    setResults(prev => [...prev, result]);
  };

  const runDiagnostics = async () => {
    setLoading(true);
    setResults([]);

    // Test 1: Basic table existence and access
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select('count(*)')
        .limit(1);
        
      if (error) {
        addResult({
          test: 'Table Access',
          status: 'error',
          message: `Cannot access quiz_results table: ${error.message}`,
          data: error
        });
      } else {
        addResult({
          test: 'Table Access',
          status: 'success',
          message: 'quiz_results table is accessible',
          data: data
        });
      }
    } catch (err) {
      addResult({
        test: 'Table Access',
        status: 'error',
        message: `Exception accessing table: ${err}`,
        data: err
      });
    }

    // Test 2: Check table schema
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select('*')
        .limit(1);
        
      if (!error && data && data.length > 0) {
        const columns = Object.keys(data[0]);
        addResult({
          test: 'Table Schema',
          status: 'success',
          message: `Table has ${columns.length} columns`,
          data: columns
        });
      } else if (!error) {
        addResult({
          test: 'Table Schema',
          status: 'warning',
          message: 'Table exists but is empty',
          data: null
        });
      }
    } catch (err) {
      addResult({
        test: 'Table Schema',
        status: 'error',
        message: `Cannot read schema: ${err}`,
        data: err
      });
    }

    // Test 3: Insert permission test
    try {
      const testRecord = {
        quiz_id: 'diagnostic-test',
        quiz_code: 'DIAG-001',
        quiz_title: 'Diagnostic Test',
        subject: 'Test',
        student_id: 'diagnostic-user',
        student_name: 'Test User',
        student_email: 'test@example.com',
        score: 85,
        total_questions: 10,
        correct_answers: 8,
        time_spent: 300,
        submitted_at: new Date().toISOString(),
        status: 'completed'
      };

      const { data, error } = await supabase
        .from('quiz_results')
        .insert([testRecord])
        .select();

      if (error) {
        addResult({
          test: 'Insert Permission',
          status: 'error',
          message: `Cannot insert: ${error.message}`,
          data: error
        });
      } else {
        addResult({
          test: 'Insert Permission',
          status: 'success',
          message: 'Insert successful',
          data: data
        });

        // Clean up test record
        await supabase
          .from('quiz_results')
          .delete()
          .eq('quiz_id', 'diagnostic-test');
      }
    } catch (err) {
      addResult({
        test: 'Insert Permission',
        status: 'error',
        message: `Insert exception: ${err}`,
        data: err
      });
    }

    // Test 4: Check RLS policies
    try {
      const { data, error } = await supabase
        .rpc('check_table_rls', { table_name: 'quiz_results' });
        
      if (error) {
        addResult({
          test: 'RLS Check',
          status: 'warning',
          message: 'Cannot check RLS policies (function may not exist)',
          data: error
        });
      } else {
        addResult({
          test: 'RLS Check',
          status: 'success',
          message: 'RLS policies checked',
          data: data
        });
      }
    } catch (err) {
      addResult({
        test: 'RLS Check',
        status: 'warning',
        message: 'RLS check not available',
        data: null
      });
    }

    // Test 5: Compare with students.quiz_history
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, quiz_history')
        .not('quiz_history', 'is', null)
        .limit(5);

      if (!studentsError && studentsData) {
        const totalQuizHistory = studentsData.reduce((sum, student) => 
          sum + (Array.isArray(student.quiz_history) ? student.quiz_history.length : 0), 0
        );

        addResult({
          test: 'Quiz History Comparison',
          status: 'success',
          message: `Found ${totalQuizHistory} quiz history records across ${studentsData.length} students`,
          data: { studentsWithHistory: studentsData.length, totalRecords: totalQuizHistory }
        });
      } else {
        addResult({
          test: 'Quiz History Comparison',
          status: 'warning',
          message: 'Cannot access students.quiz_history',
          data: studentsError
        });
      }
    } catch (err) {
      addResult({
        test: 'Quiz History Comparison',
        status: 'error',
        message: `Quiz history check failed: ${err}`,
        data: err
      });
    }

    // Test 6: Check current user permissions
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        addResult({
          test: 'User Authentication',
          status: 'error',
          message: 'User not authenticated',
          data: userError
        });
      } else {
        addResult({
          test: 'User Authentication',
          status: 'success',
          message: `Authenticated as: ${user?.email}`,
          data: { id: user?.id, email: user?.email, role: user?.role }
        });
      }
    } catch (err) {
      addResult({
        test: 'User Authentication',
        status: 'error',
        message: `Auth check failed: ${err}`,
        data: err
      });
    }

    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return '❓';
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Quiz Results Table Diagnostics</CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runDiagnostics} 
            disabled={loading}
            className="mb-6"
          >
            {loading ? 'Running Diagnostics...' : 'Run Diagnostics'}
          </Button>

          {results.length > 0 && (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="border p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span>{getStatusIcon(result.status)}</span>
                    <h3 className="font-semibold">{result.test}</h3>
                  </div>
                  <p className={`mb-2 ${getStatusColor(result.status)}`}>
                    {result.message}
                  </p>
                  {result.data && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-gray-600">
                        View Details
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold mb-2">Summary</h3>
              <p>
                Total tests: {results.length} | 
                Passed: {results.filter(r => r.status === 'success').length} | 
                Warnings: {results.filter(r => r.status === 'warning').length} | 
                Errors: {results.filter(r => r.status === 'error').length}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
