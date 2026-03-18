import { NextRequest, NextResponse } from 'next/server'
import { writeToProcess } from '@/lib/coding-agent-process'
import { requireMutationAuth } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const authError = await requireMutationAuth(req)
  if (authError) return authError

  const { nodeId, input } = await req.json() as { nodeId: string; input: string }

  if (!nodeId || typeof input !== 'string') {
    return NextResponse.json({ error: 'nodeId and input are required' }, { status: 400 })
  }

  const ok = writeToProcess(nodeId, input)
  if (!ok) {
    return NextResponse.json({ error: 'No running process for this node' }, { status: 404 })
  }

  return NextResponse.json({ sent: true })
}
