import { NextRequest } from 'next/server'
import { runCodeExecute, runPythonExecute } from '@/lib/tools/server-executor'

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    toolName: 'code_execute' | 'python_execute'
    input: Record<string, unknown>
  }

  try {
    let result: string

    if (body.toolName === 'code_execute') {
      result = await runCodeExecute(body.input)
    } else if (body.toolName === 'python_execute') {
      result = await runPythonExecute(body.input)
    } else {
      return Response.json({ error: `Unknown tool: ${body.toolName}` }, { status: 400 })
    }

    return Response.json({ result })
  } catch (err) {
    return Response.json({
      error: err instanceof Error ? err.message : 'unknown error',
    })
  }
}
