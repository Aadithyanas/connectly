import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { createClient } from '@/utils/supabase/server'
import { ObjectId } from 'mongodb'
// Compiler mapping for Wandbox API
const WANDBOX_COMPILER_MAP: Record<string, string> = {
  'javascript': 'nodejs-18.14.0',
  'js': 'nodejs-18.14.0',
  'python': 'cpython-3.10.1',
  'python3': 'cpython-3.10.1',
  'py': 'cpython-3.10.1',
  'typescript': 'typescript-5.0.4',
  'ts': 'typescript-5.0.4'
};

// Language mapping for Judge0 API (Common CE IDs)
const JUDGE0_LANG_MAP: Record<string, number> = {
  'javascript': 63,
  'js': 63,
  'node': 63,
  'python': 71,
  'python3': 71,
  'py': 71,
  'typescript': 74,
  'ts': 74
};

async function executeJudge0(language: string, code: string) {
  const langId = JUDGE0_LANG_MAP[language.toLowerCase()] || 63;
  const apiKey = process.env.JUDGE0_API_KEY;
  const host = process.env.JUDGE0_HOST || 'judge0-ce.p.rapidapi.com';

  const response = await fetch(`https://${host}/submissions?base64_encoded=true&wait=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-RapidAPI-Key': apiKey || '',
      'X-RapidAPI-Host': host
    },
    body: JSON.stringify({
      source_code: Buffer.from(code).toString('base64'),
      language_id: langId,
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Judge0 API Error: ${response.statusText} - ${errorBody}`);
  }

  const result = await response.json();
  
  // Judge0 returns base64 encoded strings
  const decode = (str: string | null) => str ? Buffer.from(str, 'base64').toString('utf-8') : "";
  
  return {
    stdout: decode(result.stdout),
    stderr: decode(result.stderr) || decode(result.compile_output),
    status: result.status?.description || "Unknown",
    statusId: result.status?.id
  };
}

async function executeWandbox(language: string, code: string) {
  const compiler = WANDBOX_COMPILER_MAP[language.toLowerCase()] || 'nodejs-18.14.0';
  
  const response = await fetch('https://wandbox.org/api/compile.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      compiler,
      code,
      save: false
    })
  });

  if (!response.ok) {
    throw new Error(`Wandbox API Error: ${response.statusText}`);
  }

  const result = await response.json();
  
  return {
    stdout: result.program_output || result.compiler_output || "",
    stderr: result.program_error || result.compiler_error || "",
    status: result.status,
    engine: 'Wandbox (Free)'
  };
}

async function executePaiza(language: string, code: string) {
  const paizaLang = language.toLowerCase() === 'python' || language.toLowerCase() === 'python3' ? 'python3' : 'javascript';
  
  // 1. Create runner
  const createRes = await fetch(`https://api.paiza.io/runners/create?source_code=${encodeURIComponent(code)}&language=${paizaLang}&api_key=guest`, {
    method: 'POST'
  });
  
  const createData = await createRes.json();
  const id = createData.id;

  // 2. Poll for results (max 10 seconds)
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const detailsRes = await fetch(`https://api.paiza.io/runners/get_details?id=${id}&api_key=guest`);
    const details = await detailsRes.json();
    
    if (details.status === 'completed') {
      return {
        stdout: details.stdout || "",
        stderr: details.stderr || "",
        status: details.result,
        engine: 'Paiza (Free)'
      };
    }
  }
  
  throw new Error('Paiza API Timeout');
}

// Helper to parse LeetCode-style input strings: "nums = [2,7], target = 9" -> ["[2,7]", "9"]
function parseLeetCodeInput(input: string) {
  const segments: string[] = [];
  const keyRegex = /(\w+)\s*=\s*/g;
  let match;
  let lastIndex = 0;
  let lastKey = "";

  while ((match = keyRegex.exec(input)) !== null) {
    if (lastKey) {
      // Extract the value between the previous key and this key
      let value = input.substring(lastIndex, match.index).trim();
      // Remove trailing comma if it exists
      if (value.endsWith(',')) value = value.slice(0, -1).trim();
      segments.push(value);
    }
    lastKey = match[1];
    lastIndex = match.index + match[0].length;
  }
  
  if (lastKey) {
    segments.push(input.substring(lastIndex).trim());
  }

  return segments;
}

// Helper to strip comments for cleaner function name detection
function stripComments(code: string) {
  return code.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
}

// Unique marker to separate student logs from actual result
const RESULT_MARKER = "CONN_RES:";

// Helper to wrap the student's code with a runner block
function wrapCode(code: string, language: string, inputValues: string[], problemId: string) {
  const lang = language.toLowerCase();
  const cleanCode = stripComments(code);
  
  if (lang === 'javascript' || lang === 'typescript' || lang === 'js' || lang.includes('javascript')) {
    let funcName = null;
    const funcMatch = cleanCode.match(/(?:var|const|let|function)\s+([a-zA-Z0-9_]+)/);
    
    if (funcMatch) {
      funcName = funcMatch[1];
    } else {
      const fallbackMatch = cleanCode.match(/([a-zA-Z0-9_]+)\s*=/);
      if (fallbackMatch) funcName = fallbackMatch[1];
    }
    
    if (!funcName) {
      return `console.error("JUDGE_ERROR: Could not find function to execute. Problem ID: ${problemId}");\n${code}`;
    }

    return `
// --- JUDGE INITIALIZED (Prob: ${problemId}) ---
console.log("SYSTEM: Judge initializing execution...");
${code}

// Auto-generated Runner
try {
  const args = [${inputValues.join(',')}];
  console.log("SYSTEM: Injecting arguments: " + JSON.stringify(args));
  
  const target = typeof ${funcName} !== 'undefined' ? ${funcName} : (typeof Solution !== 'undefined' ? new Solution().${funcName} : null);
  
  if (typeof target === 'function') {
    console.log("SYSTEM: Starting execution of ${funcName}...");
    const result = target(...args);
    console.log("SYSTEM: Execution complete. Sending result to dashboard.");
    console.log("\\n${RESULT_MARKER}" + JSON.stringify(result));
  } else {
    console.error("JUDGE_ERROR: Found name '${funcName}' but it is not a function.");
  }
} catch (e) {
  console.error("RUNTIME_ERROR: " + e.message);
  console.error(e.stack);
}
    `;
  }

  if (lang === 'python' || lang === 'python3' || lang === 'py') {
    const funcMatch = cleanCode.match(/def\s+([a-zA-Z0-9_]+)/);
    const funcName = funcMatch ? funcMatch[1] : null;
    
    if (!funcName) {
      return `import sys; sys.stderr.write("JUDGE_ERROR: Could not find function to execute.");\n${code}`;
    }

    return `
import json, sys

print("SYSTEM: Python Judge initializing...")
${code}

# Auto-generated Runner
try:
    args = [${inputValues.join(',').replace(/true/g, 'True').replace(/false/g, 'False').replace(/null/g, 'None')}]
    print("SYSTEM: Injecting arguments: " + str(args))
    
    if 'class Solution' in \"\"\"${code}\"\"\":
        print("SYSTEM: Calling Solution().${funcName}...")
        result = Solution().${funcName}(*args)
    else:
        print("SYSTEM: Calling ${funcName}()...")
        result = ${funcName}(*args)
        
    print("SYSTEM: Execution complete.")
    print("\\n${RESULT_MARKER}" + json.dumps(result))
except Exception as e:
    sys.stderr.write("RUNTIME_ERROR: " + str(e))
    `;
  }

  return code;
}

export async function POST(req: Request) {
  try {
    const { challengeId, code, language } = await req.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB || 'connectly')
    
    let query = {}
    try {
      query = { _id: new ObjectId(challengeId) }
    } catch (e) {
      query = { id: challengeId } 
    }

    const challenge = await db.collection('challenges').findOne(query)

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    // 1. Resolve Test Cases (Prefer structured, fallback to parsing examples)
    let testCases = challenge.test_cases || []
    
    if (testCases.length === 0 && challenge.examples) {
      challenge.examples.forEach((ex: any) => {
        const text = ex.example_text || ""
        const inputMatch = text.match(/Input:\s*(.*)/i)
        const outputMatch = text.match(/Output:\s*(.*)/i)
        if (inputMatch && outputMatch) {
          testCases.push({
            input: inputMatch[1].split('\n')[0].trim(),
            output: outputMatch[1].split('\n')[0].trim()
          })
        }
      })
    }

    // 2. Execute each test case
    let allPassed = true
    const results = []

    if (testCases.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: "No test cases found for this problem. Solution accepted by sight.",
        results: []
      })
    }

    for (const testCase of testCases) {
      // SMART WRAP: Pre-parse inputs and wrap the code
      const inputParams = parseLeetCodeInput(testCase.input);
      const wrappedCode = wrapCode(code, language, inputParams, challenge.id || challenge._id.toString());

      let stdout = "";
      let stderr = "";
      let usedEngine = "None";
      
      try {
        // --- MULTI-ENGINE FALLBACK STRATEGY ---
        
        // 1. Try Judge0 (Primary if Key Provided)
        if (process.env.JUDGE0_API_KEY) {
          try {
            const res = await executeJudge0(language, wrappedCode);
            stdout = res.stdout;
            stderr = res.stderr;
            usedEngine = "Judge0 (Premium)";
          } catch (e) {
            console.warn("Judge0 failed, falling back to Wandbox...");
          }
        }
        
        // 2. Try Wandbox (First Free Fallback)
        if (!stdout && !stderr) {
          try {
            const res = await executeWandbox(language, wrappedCode);
            stdout = res.stdout;
            stderr = res.stderr;
            usedEngine = "Wandbox (Free)";
          } catch (e) {
            console.warn("Wandbox failed, falling back to Paiza...");
          }
        }
        
        // 3. Try Paiza (Final Free Fallback)
        if (!stdout && !stderr) {
          const res = await executePaiza(language, wrappedCode);
          stdout = res.stdout;
          stderr = res.stderr;
          usedEngine = "Paiza (Free)";
        }
        
      } catch (err: any) {
        throw new Error(`All execution engines failed: ${err.message}`);
      }

      // Split stdout into logs and result using the marker
      const parts = stdout.split(RESULT_MARKER);
      const logs = parts[0]?.trim() || "";
      const resultValue = (parts[1] || "").trim();
      
      // Smart comparison: strip quotes and brackets for loose matching
      const cleanStdout = resultValue.replace(/[\s"\[\],]+/g, '');
      const cleanExpected = testCase.output.replace(/[\s"\[\],]+/g, '');
      const passed = cleanStdout === cleanExpected || resultValue === testCase.output;

      results.push({
        input: testCase.input,
        expected: testCase.output,
        actual: resultValue || (stderr ? `Error: ${stderr}` : ""),
        logs: logs,
        passed,
        error: stderr
      })

      if (!passed) {
        allPassed = false
        break 
      }
    }

    if (allPassed) {
      // Normalize challenge_id to prevent duplicates between sources
      let finalChallengeId = challenge.id || challenge._id.toString();
      
      try {
        // Try to find a canonical Supabase ID by title matching
        const { data: canonical } = await supabase
          .from('challenges')
          .select('id')
          .ilike('title', `%${challenge.title}%`)
          .limit(1)
          .single();
        
        if (canonical) finalChallengeId = canonical.id;
      } catch (e) {
        // Fallback to original ID if lookup fails
      }

      await supabase
        .from('challenge_solutions')
        .upsert({ 
          challenge_id: finalChallengeId, 
          user_id: user.id 
        })
    }

    return NextResponse.json({ 
      success: allPassed,
      results,
      points: allPassed ? challenge.points : 0
    })

  } catch (error: any) {
    console.error('Execution Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
