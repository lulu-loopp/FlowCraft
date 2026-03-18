import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { requireMutationAuth } from '@/lib/api-auth'

interface McpServer {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  enabled: boolean
}

function getConfigPath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || ''
  return path.join(homeDir, '.claude.json')
}

async function readConfig(): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function writeConfig(config: Record<string, unknown>): Promise<void> {
  await fs.writeFile(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
}

function getMcpServers(config: Record<string, unknown>): Record<string, McpServer> {
  const mcpServers = (config.mcpServers || {}) as Record<string, McpServer>
  return mcpServers
}

export async function GET() {
  const config = await readConfig()
  const servers = getMcpServers(config)

  const list: McpServer[] = Object.entries(servers).map(([name, s]) => ({
    name,
    command: s.command || '',
    args: s.args || [],
    enabled: s.enabled !== false,
  }))

  return NextResponse.json({ servers: list })
}

export async function POST(req: NextRequest) {
  const authError = await requireMutationAuth(req)
  if (authError) return authError

  const { name, command, args, env } = await req.json() as McpServer
  if (!name || !command) {
    return NextResponse.json({ error: 'name and command are required' }, { status: 400 })
  }

  const config = await readConfig()
  const servers = getMcpServers(config)
  servers[name] = { name, command, args: args || [], env: env || {}, enabled: true }
  config.mcpServers = servers
  await writeConfig(config)

  return NextResponse.json({ added: true })
}

export async function PUT(req: NextRequest) {
  const authError = await requireMutationAuth(req)
  if (authError) return authError

  const { name, enabled, command, args } = await req.json() as {
    name: string
    enabled?: boolean
    command?: string
    args?: string[]
  }
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const config = await readConfig()
  const servers = getMcpServers(config)
  if (!servers[name]) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 })
  }

  if (typeof enabled === 'boolean') servers[name].enabled = enabled
  if (command) servers[name].command = command
  if (args) servers[name].args = args
  config.mcpServers = servers
  await writeConfig(config)

  return NextResponse.json({ updated: true })
}

export async function DELETE(req: NextRequest) {
  const authError = await requireMutationAuth(req)
  if (authError) return authError

  const name = req.nextUrl.searchParams.get('name')
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const config = await readConfig()
  const servers = getMcpServers(config)
  delete servers[name]
  config.mcpServers = servers
  await writeConfig(config)

  return NextResponse.json({ deleted: true })
}
