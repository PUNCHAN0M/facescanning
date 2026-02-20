import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'dark' | 'strong';
  hover?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export function GlassCard({
  children,
  className,
  variant = 'default',
  hover = false,
  onClick,
  style,
}: GlassCardProps) {
  const variantClasses = {
    default: 'glass',
    dark: 'glass-dark',
    strong: 'glass-strong',
  };

  return (
    <div
      className={cn(
        'rounded-2xl p-6 shadow-xl transition-all duration-300',
        variantClasses[variant],
        hover && 'hover:scale-105 hover:shadow-2xl',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}
