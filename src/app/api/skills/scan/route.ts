import { NextRequest } from 'next/server'
import { scanGitHubRepo } from '@/lib/github-downloader'
import { requireMutationAuth } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const denied = await requireMutationAuth(req)
  if (denied) return denied

  const body = await req.json() as { source: string }

  try {
    const token = process.env.GITHUB_TOKEN
    const result = await scanGitHubRepo(body.source, 'skill', token)
    return Response.json(result)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
