import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { url } = await req.json() as { url?: string }

  if (!url || !url.startsWith('http')) {
    return Response.json({ error: 'Invalid URL' }, { status: 400 })
  }

  let response: Response
  try {
    response = await fetch(url)
  } catch {
    return Response.json(
      { error: `Network error fetching ${url}` },
      { status: 502 }
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
