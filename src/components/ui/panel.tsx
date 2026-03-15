import React from 'react';
import { cn } from './button';

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('bg-white/70 backdrop-blur-md border border-white/50 shadow-lg rounded-xl', className)}
        {...props}
      />
    );
  }
);
Panel.displayName = 'Panel';
