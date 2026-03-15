'use client'

import { useState } from 'react'
import type { ScanResult, ScannedItem } from '@/types/registry'

// scan 结果面板：显示可选列表
export function ScanResultPanel({
  scanResult,
  isInstalling,
  onInstall,
  onCancel,
  accentColor,
}: {
  scanResult: ScanResult
  isInstalling: boolean
  onInstall: (items: ScannedItem[]) => void
  onCancel: () => void
  accentColor: string
}) {
  const [items, setItems] = useState<ScannedItem[]>(scanResult.items)

  function toggleItem(name: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.name === name ? { ...item, selected: !item.selected } : item
      )
    )
  }

  const selectedCount = items.filter((i) => i.selected).length

  return (
    <div style={{
      background: '#141414',
      border: '1px solid #222',
      borderRadius: '8px',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px',
      }}>
        <span style={{ fontSize: '10px', color: '#555', fontFamily: 'DM Mono, monospace' }}>
          {items.length} found — select to install
        </span>
        <button
          onClick={onCancel}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#444',
            cursor: 'pointer',
            fontSize: '11px',
            fontFamily: 'DM Mono, monospace',
          }}
        >
          cancel
        </button>
      </div>

      {/* 全选/取消全选 */}
      <div
        onClick={() => setItems((prev) =>
          prev.map((i) => ({ ...i, selected: selectedCount < prev.length }))
        )}
        style={{
          fontSize: '10px',
          color: '#555',
          fontFamily: 'DM Mono, monospace',
          cursor: 'pointer',
          padding: '2px 0',
        }}
      >
        {selectedCount === items.length ? 'deselect all' : 'select all'}
        {' '}({selectedCount}/{items.length})
      </div>

      {/* 可滚动列表 */}
      <div style={{
        maxHeight: '200px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}>
        {items.map((item) => (
          <div
            key={item.name}
            onClick={() => toggleItem(item.name)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '6px 8px',
              borderRadius: '6px',
              background: item.selected ? 'rgba(200,240,96,.04)' : 'transparent',
              border: `1px solid ${item.selected ? accentColor + '33' : '#1a1a1a'}`,
              cursor: 'pointer',
              transition: 'all .1s',
            }}
          >
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: item.selected ? accentColor : '#333',
              flexShrink: 0,
              marginTop: '4px',
              transition: 'all .1s',
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '11px',
                color: item.selected ? accentColor : '#555',
                fontFamily: 'DM Mono, monospace',
              }}>
                {item.name}
              </div>
              {item.description && (
                <div style={{
                  fontSize: '10px',
                  color: '#444',
                  fontFamily: 'DM Sans, sans-serif',
                  marginTop: '1px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {item.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 安装按钮 */}
      <button
        onClick={() => onInstall(items)}
        disabled={isInstalling || selectedCount === 0}
        style={{
          background: isInstalling || selectedCount === 0 ? '#1e1e1e' : accentColor,
          color: isInstalling || selectedCount === 0 ? '#444' : '#0f0f0f',
          border: 'none',
          borderRadius: '7px',
          padding: '7px',
          fontSize: '11px',
          fontWeight: 500,
          cursor: isInstalling || selectedCount === 0 ? 'not-allowed' : 'pointer',
          fontFamily: 'DM Sans, sans-serif',
          transition: 'all .15s',
          marginTop: '2px',
        }}
      >
        {isInstalling ? 'Installing...' : `Install ${selectedCount} selected`}
      </button>
    </div>
  )
}

// 已安装条目
export function InstalledItem({
  name,
  description,
  source,
  enabled,
  accentColor,
  onToggle,
  onRemove,
}: {
  name: string
  description: string
  source: string
  enabled: boolean
  accentColor: string
  onToggle: (enabled: boolean) => void
  onRemove: () => void
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: '8px 10px',
      background: '#141414',
      border: `1px solid ${enabled ? accentColor + '66' : '#222'}`,
      borderRadius: '7px',
      gap: '8px',
      opacity: enabled ? 1 : 0.5,
      transition: 'all .15s',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        flex: 1,
        minWidth: 0,
      }}>
        <span style={{
          fontSize: '12px',
          color: enabled ? accentColor : '#555',
          fontFamily: 'DM Mono, monospace',
        }}>
          {name}
        </span>
        {description && (
          <span style={{
            fontSize: '10px',
            color: '#555',
            fontFamily: 'DM Sans, sans-serif',
            lineHeight: 1.4,
          }}>
            {description}
          </span>
        )}
        <span style={{
          fontSize: '10px',
          color: '#333',
          fontFamily: 'DM Mono, monospace',
          marginTop: '1px',
        }}>
          {source === 'manual' ? 'manual'
            : source.length > 28
            ? source.slice(0, 28) + '...'
            : source}
        </span>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        alignItems: 'flex-end',
        flexShrink: 0,
      }}>
        <div
          onClick={() => onToggle(!enabled)}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: enabled ? accentColor : '#333',
            cursor: 'pointer',
            transition: 'all .15s',
          }}
        />
        <button
          onClick={onRemove}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#333',
            cursor: 'pointer',
            fontSize: '10px',
            fontFamily: 'DM Mono, monospace',
            padding: '0',
            transition: 'color .15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ff6b6b')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#333')}
        >
          remove
        </button>
      </div>
    </div>
  )
}
