import { NextRequest } from 'next/server'
import { requireMutationAuth } from '@/lib/api-auth'
import { safeFetch } from '@/lib/safe-fetch'

export async function POST(req: NextRequest) {
  const denied = await requireMutationAuth(req)
  if (denied) return denied

  const { url } = await req.json() as { url?: string }

  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'Invalid URL' }, { status: 400 })
  }

  let response: Response
  try {
    response = await safeFetch(url)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : `Network error fetching ${url}` },
      { status: 400 }
    )
  }

  if (!response.ok) {
    return Response.json(
      { error: `Failed to fetch from ${url} (${response.status})` },
      { status: response.status }
    )
  }

  const content = await response.text()
  return Response.json({ content })
}
