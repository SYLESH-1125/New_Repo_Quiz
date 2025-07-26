-- SQL script to fix quiz_results table issues
-- Run these commands in your Supabase SQL editor

-- 1. Check if quiz_results table exists
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_name = 'quiz_results' AND table_schema = 'public';

-- 2. If table doesn't exist, create it
CREATE TABLE IF NOT EXISTS public.quiz_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id TEXT NOT NULL,
    quiz_code TEXT NOT NULL,
    quiz_title TEXT,
    subject TEXT DEFAULT 'General',
    student_id UUID NOT NULL,
    student_name TEXT,
    student_email TEXT,
    score INTEGER NOT NULL DEFAULT 0,
    total_questions INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    time_spent INTEGER DEFAULT 0,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'completed',
    answers JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Check current table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'quiz_results' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add studentid column if it doesn't exist (for backward compatibility)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'quiz_results' AND column_name = 'studentid') THEN
        ALTER TABLE quiz_results ADD COLUMN studentid UUID;
        UPDATE quiz_results SET studentid = student_id WHERE studentid IS NULL;
    END IF;

    -- Add quizcode column if it doesn't exist (for backward compatibility)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'quiz_results' AND column_name = 'quizcode') THEN
        ALTER TABLE quiz_results ADD COLUMN quizcode TEXT;
        UPDATE quiz_results SET quizcode = quiz_code WHERE quizcode IS NULL;
    END IF;

    -- Add submittedat column if it doesn't exist (for backward compatibility)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'quiz_results' AND column_name = 'submittedat') THEN
        ALTER TABLE quiz_results ADD COLUMN submittedat TIMESTAMPTZ;
        UPDATE quiz_results SET submittedat = submitted_at WHERE submittedat IS NULL;
    END IF;
END $$;

-- 5. Enable Row Level Security
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;

-- 6. Drop existing policies (if any) to avoid conflicts
DROP POLICY IF EXISTS "quiz_results_insert_policy" ON quiz_results;
DROP POLICY IF EXISTS "quiz_results_select_policy" ON quiz_results;
DROP POLICY IF EXISTS "quiz_results_update_policy" ON quiz_results;
DROP POLICY IF EXISTS "quiz_results_delete_policy" ON quiz_results;

-- 7. Create RLS policies

-- Allow authenticated users to insert their own quiz results
CREATE POLICY "quiz_results_insert_policy" 
ON quiz_results FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL AND 
    (auth.uid()::text = student_id::text OR auth.uid()::text = studentid::text)
);

-- Allow students to view their own results
CREATE POLICY "quiz_results_select_student_policy" 
ON quiz_results FOR SELECT 
USING (
    auth.uid() IS NOT NULL AND 
    (auth.uid()::text = student_id::text OR auth.uid()::text = studentid::text)
);

-- Allow faculty to view results for their quizzes
CREATE POLICY "quiz_results_select_faculty_policy" 
ON quiz_results FOR SELECT 
USING (
    auth.uid() IS NOT NULL AND
    quiz_id IN (
        SELECT id::text FROM quizzes WHERE createdby = auth.uid()::text
    )
);

-- Allow service role to access everything (for analytics)
CREATE POLICY "quiz_results_service_policy" 
ON quiz_results FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quiz_results_student_id ON quiz_results(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_studentid ON quiz_results(studentid);
CREATE INDEX IF NOT EXISTS idx_quiz_results_quiz_id ON quiz_results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_quiz_code ON quiz_results(quiz_code);
CREATE INDEX IF NOT EXISTS idx_quiz_results_quizcode ON quiz_results(quizcode);
CREATE INDEX IF NOT EXISTS idx_quiz_results_submitted_at ON quiz_results(submitted_at);
CREATE INDEX IF NOT EXISTS idx_quiz_results_submittedat ON quiz_results(submittedat);

-- 9. Create a function to sync quiz_history to quiz_results
CREATE OR REPLACE FUNCTION sync_quiz_history_to_results()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert records from students.quiz_history that don't exist in quiz_results
    INSERT INTO quiz_results (
        quiz_id,
        quiz_code,
        quiz_title,
        student_id,
        student_name,
        score,
        total_questions,
        correct_answers,
        time_spent,
        submitted_at,
        status,
        answers,
        studentid,
        quizcode,
        submittedat
    )
    SELECT DISTINCT
        (quiz_item->>'quiz_id')::text,
        (quiz_item->>'quiz_code')::text,
        COALESCE((quiz_item->>'quiz_title')::text, (quiz_item->>'title')::text),
        s.id,
        COALESCE(s.full_name, s.username, s.email),
        COALESCE((quiz_item->>'score')::integer, 0),
        COALESCE((quiz_item->>'total_questions')::integer, 0),
        COALESCE((quiz_item->>'correct_answers')::integer, 0),
        COALESCE((quiz_item->>'time_spent')::integer, 0),
        COALESCE(
            (quiz_item->>'submitted_at')::timestamptz,
            (quiz_item->>'taken_at')::timestamptz,
            NOW()
        ),
        COALESCE((quiz_item->>'status')::text, 'completed'),
        (quiz_item->'answers'),
        s.id, -- studentid for backward compatibility
        (quiz_item->>'quiz_code')::text, -- quizcode for backward compatibility
        COALESCE(
            (quiz_item->>'submitted_at')::timestamptz,
            (quiz_item->>'taken_at')::timestamptz,
            NOW()
        ) -- submittedat for backward compatibility
    FROM 
        students s,
        jsonb_array_elements(s.quiz_history) AS quiz_item
    WHERE 
        s.quiz_history IS NOT NULL 
        AND jsonb_array_length(s.quiz_history) > 0
        AND (quiz_item->>'quiz_id') IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM quiz_results qr 
            WHERE qr.quiz_id = (quiz_item->>'quiz_id')::text 
            AND qr.student_id = s.id
        );
        
    RAISE NOTICE 'Quiz history sync completed';
END;
$$;

-- 10. Run the sync function
SELECT sync_quiz_history_to_results();

-- 11. Verify the setup
SELECT 
    'quiz_results' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT student_id) as unique_students,
    COUNT(DISTINCT quiz_id) as unique_quizzes,
    MIN(submitted_at) as earliest_submission,
    MAX(submitted_at) as latest_submission
FROM quiz_results;

-- 12. Check for data consistency
WITH quiz_history_count AS (
    SELECT 
        s.id as student_id,
        jsonb_array_length(s.quiz_history) as history_count
    FROM students s 
    WHERE s.quiz_history IS NOT NULL 
    AND jsonb_array_length(s.quiz_history) > 0
),
quiz_results_count AS (
    SELECT 
        student_id,
        COUNT(*) as results_count
    FROM quiz_results 
    GROUP BY student_id
)
SELECT 
    COALESCE(qhc.student_id, qrc.student_id) as student_id,
    COALESCE(qhc.history_count, 0) as quiz_history_count,
    COALESCE(qrc.results_count, 0) as quiz_results_count,
    CASE 
        WHEN COALESCE(qhc.history_count, 0) = COALESCE(qrc.results_count, 0) THEN 'MATCH'
        ELSE 'MISMATCH'
    END as status
FROM quiz_history_count qhc
FULL OUTER JOIN quiz_results_count qrc ON qhc.student_id = qrc.student_id
ORDER BY status DESC, student_id;

-- 13. Grant necessary permissions
GRANT ALL ON quiz_results TO authenticated;
GRANT ALL ON quiz_results TO service_role;

-- 14. Test basic operations
INSERT INTO quiz_results (
    quiz_id,
    quiz_code, 
    quiz_title,
    student_id,
    student_name,
    score,
    total_questions,
    correct_answers
) VALUES (
    'test-quiz-001',
    'TEST-001',
    'Test Quiz',
    auth.uid(),
    'Test User',
    85,
    10,
    8
) ON CONFLICT DO NOTHING;

-- Clean up test record
DELETE FROM quiz_results WHERE quiz_id = 'test-quiz-001' AND quiz_code = 'TEST-001';
