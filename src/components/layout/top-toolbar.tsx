'use client';

import React from 'react';
import { Play, Save, Download, Share2, Square } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useFlowStore } from '@/store/flowStore';

export function TopToolbar() {
  const [flowName, setFlowName] = React.useState('Untitled Flow');
  const [isEditing, setIsEditing] = React.useState(false);
  const { isRunning, setIsRunning, simulateRun } = useFlowStore();

  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleInputBlur = () => {
    setIsEditing(false);
    if (flowName.trim() === '') {
      setFlowName('Untitled Flow');
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
  };

  return (
    <header className="absolute top-4 left-4 right-4 h-14 glass-panel rounded-2xl flex items-center justify-between px-6 z-40">
      <div className="flex items-center space-x-4">
        <div className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-violet-500">
          FlowCraft
        </div>
        <div className="h-4 w-[1px] bg-slate-200" />
        <input
          ref={inputRef}
          type="text"
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          className="bg-transparent border-none font-medium text-slate-700 focus:outline-none focus:ring-0 placeholder-slate-400 w-64"
        />
      </div>

      <div className="flex items-center space-x-2">
        {isRunning && (
          <Badge variant="outline" className="animate-pulse border-blue-200 bg-blue-50 text-blue-600">
            Running...
          </Badge>
        )}
      </div>

      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="sm" className="hidden md:flex">
          <Save className="w-4 h-4 mr-2" /> Save
        </Button>
        <Button size="sm" variant="outline" className="hidden border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 sm:flex">
          <Share2 className="w-4 h-4 mr-2" /> Publish API
        </Button>
        <Button
          size="sm"
          variant={isRunning ? "danger" : "primary"}
          onClick={() => isRunning ? setIsRunning(false) : simulateRun()}
          className={isRunning ? "bg-rose-500 hover:bg-rose-600 shadow-rose-200" : ""}
        >
          {isRunning ? (
            <><Square className="w-4 h-4 mr-2 fill-current" /> Stop</>
          ) : (
            <><Play className="w-4 h-4 mr-2 fill-current" /> Run Flow</>
          )}
        </Button>
      </div>
    </header>
  );
}
