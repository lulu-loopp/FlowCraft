import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { requireMutationAuth } from '@/lib/api-auth'

function memoryPath(flowId: string, nodeId: string): string {
  return path.join(process.cwd(), 'workspace', flowId, 'memory', `${nodeId}.md`)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ flowId: string; nodeId: string }> }
) {
  const { flowId, nodeId } = await params
  const filePath = memoryPath(flowId, nodeId)
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return NextResponse.json({ content })
  } catch {
    return NextResponse.json({ content: '' })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ flowId: string; nodeId: string }> }
) {
  const authError = await requireMutationAuth(req)
  if (authError) return authError

  const { flowId, nodeId } = await params
  const { content } = await req.json()
  const filePath = memoryPath(flowId, nodeId)
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, 'utf-8')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Write failed' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ flowId: string; nodeId: string }> }
) {
  const authError = await requireMutationAuth(req)
  if (authError) return authError

  const { flowId, nodeId } = await params
  const { entry } = await req.json() as { entry: string }
  const filePath = memoryPath(flowId, nodeId)
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.appendFile(filePath, entry, 'utf-8')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Append failed' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ flowId: string; nodeId: string }> }
) {
  const authError = await requireMutationAuth(req)
  if (authError) return authError

  const { flowId, nodeId } = await params
  const filePath = memoryPath(flowId, nodeId)
  try {
    await fs.unlink(filePath)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
