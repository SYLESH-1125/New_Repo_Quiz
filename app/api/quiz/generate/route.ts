import { NextRequest, NextResponse } from 'next/server';

// This API route generates quiz questions using Anthropic's Claude API
// Expects: { keywords: string, numQuestions: number }
// Returns: { questions: [...] }

export async function POST(req: NextRequest) {
  const { keywords, numQuestions = 5, difficulty = "medium" } = await req.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API key not set.' }, { status: 500 });
  }

  // Define difficulty characteristics
  const difficultyLevels = {
    easy: {
      description: "Basic understanding and recall",
      characteristics: "Simple concepts, direct questions, minimal analysis required",
      complexity: "straightforward"
    },
    medium: {
      description: "Application and analysis",
      characteristics: "Requires understanding connections between concepts, some problem-solving",
      complexity: "moderate analytical thinking"
    },
    hard: {
      description: "Synthesis and evaluation",
      characteristics: "Complex scenarios, critical thinking, multiple concepts integration",
      complexity: "advanced analytical and critical thinking"
    }
  };

  const currentLevel = difficultyLevels[difficulty as keyof typeof difficultyLevels];

  // Enhanced prompt for Claude with mandatory explanations and difficulty
  const prompt = `You are an expert educational content creator. Generate exactly ${numQuestions} high-quality quiz questions based on these syllabus keywords: "${keywords}".

DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
- Description: ${currentLevel.description}
- Characteristics: ${currentLevel.characteristics}
- Complexity: Questions should require ${currentLevel.complexity}

REQUIREMENTS:
1. Each question MUST match the ${difficulty} difficulty level exactly
2. Each question MUST be one of: Multiple Choice (MCQ), True/False, or Fill in the Blanks
3. Each question MUST include a detailed educational explanation
4. For Fill in the Blanks: use ___ where the blank should appear
5. NO descriptive or open-ended questions

MANDATORY JSON FORMAT - each question must have ALL these fields:
{
  "type": "mcq" | "true-false" | "fill-in-the-blanks",
  "question": "The actual question text",
  "options": ["option1", "option2", "option3", "option4"] (for MCQ only, empty array for others),
  "correctAnswer": "answer" (string for true-false/fill-in-blanks, number index for MCQ),
  "difficulty": "${difficulty}",
  "explanation": "Detailed explanation of why this answer is correct, including relevant concepts and reasoning"
}

DIFFICULTY-SPECIFIC GUIDELINES:
${difficulty === 'easy' ? 
`- Focus on basic definitions, simple facts, and direct recall
- Use clear, straightforward language
- Test fundamental concepts without complex reasoning
- Examples: "What is photosynthesis?", "True or False: Water boils at 100°C"` :
difficulty === 'medium' ?
`- Require application of concepts to new situations
- Include some analysis and comparison
- Test understanding of relationships between concepts  
- Examples: "Which factor would MOST affect photosynthesis rate?", "Compare and contrast..."` :
`- Demand synthesis of multiple concepts
- Require critical evaluation and complex reasoning
- Include scenario-based problems
- Examples: "Given these conditions, predict and justify...", "Analyze the implications of..."`
}

EXPLANATION REQUIREMENTS:
- Must be 2-4 sentences minimum
- Should explain the concept, not just state the answer
- Must help students understand the underlying principle
- Should match the difficulty level in depth
- Include why other options are incorrect (for MCQ)

Return ONLY a valid JSON array with exactly ${numQuestions} questions. Each question MUST have all required fields including explanation and difficulty.`;

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2048, // Increased for longer explanations
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });
  } catch (err) {
    console.error('Network error calling Anthropic API:', err);
    return NextResponse.json({ error: 'Network error generating questions.' }, { status: 500 });
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Anthropic API error:', errorText);
    return NextResponse.json({ error: 'Failed to generate questions from AI service.' }, { status: 500 });
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    console.error('Failed to parse Anthropic response:', err);
    return NextResponse.json({ error: 'Invalid response from AI service.' }, { status: 500 });
  }

  // Claude returns the text in data.content[0].text
  let questions = [];
  try {
    let text = data.content[0]?.text || '';
    console.log('Raw AI response:', text); // Debug log
    
    // Clean up the text
    text = text.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (text.startsWith('```')) {
      text = text.replace(/^```/, '').replace(/```$/, '').trim();
    }
    
    // Extract JSON array
    const arrayStart = text.indexOf('[');
    const arrayEnd = text.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      const jsonArray = text.substring(arrayStart, arrayEnd + 1);
      questions = JSON.parse(jsonArray);
    } else {
      questions = JSON.parse(text);
    }
    
    // Validate each question has required fields including explanation
    questions = questions.filter((q: any) => {
      const hasRequiredFields = q.type && q.question && q.correctAnswer !== undefined;
      const hasExplanation = q.explanation && typeof q.explanation === 'string' && q.explanation.trim().length > 10;
      
      if (!hasRequiredFields) {
        console.warn('Question missing required fields:', q);
        return false;
      }
      
      if (!hasExplanation) {
        console.warn('Question missing proper explanation:', q);
        // Add a default explanation if missing
        q.explanation = `This question tests understanding of ${keywords}. Review the concept to understand why this answer is correct.`;
      }
      
      return true;
    });
    
    if (questions.length === 0) {
      throw new Error('No valid questions generated');
    }
    
    console.log(`Successfully generated ${questions.length} questions with explanations`);
    
  } catch (e) {
    console.error('Failed to parse AI response:', e);
    console.error('Raw response text:', data.content[0]?.text);
    return NextResponse.json({ 
      error: 'Failed to parse AI response. Please try again with different keywords.' 
    }, { status: 500 });
  }

  // Final validation - ensure all questions have explanations
  questions.forEach((q: any, index: number) => {
    if (!q.explanation || q.explanation.trim().length < 5) {
      q.explanation = `This question covers key concepts related to ${keywords}. Understanding the underlying principles will help you arrive at the correct answer.`;
      console.warn(`Added default explanation for question ${index + 1}`);
    }
  });

  return NextResponse.json({ questions });
}
