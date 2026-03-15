'use client'
import Link from 'next/link'

export default function Home() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: '16px',
      background: '#f8fafc',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#1a1a1a' }}>
        FlowCraft
      </h1>
      <div style={{ display: 'flex', gap: '12px' }}>
        <Link href="/canvas/default-flow" style={{
          padding: '10px 24px',
          background: '#6366f1',
          color: '#fff',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: 500,
        }}>
          Canvas
        </Link>
        <Link href="/playground" style={{
          padding: '10px 24px',
          background: '#f1f5f9',
          color: '#374151',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: 500,
        }}>
          Playground
        </Link>
      </div>
    </div>
  )
}
