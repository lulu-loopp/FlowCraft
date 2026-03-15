import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary:   'bg-teal-600 text-white hover:bg-teal-700 shadow-sm',
      secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
      ghost:     'bg-transparent text-slate-600 hover:bg-slate-100',
      outline:   'border border-slate-200 bg-transparent hover:bg-slate-50 text-slate-700',
      danger:    'bg-rose-500 text-white hover:bg-rose-600 shadow-sm',
    };

    const sizes = {
      sm:   'h-8 px-3 text-xs',
      md:   'h-10 px-4 py-2 text-sm',
      lg:   'h-11 px-8 text-base',
      icon: 'h-10 w-10 flex items-center justify-center',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
          'active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
