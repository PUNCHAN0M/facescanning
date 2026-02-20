import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

interface AnimatedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function AnimatedButton({
  children,
  className,
  variant = 'primary',
  size = 'md',
  onClick,
  ...props
}: AnimatedButtonProps) {
  const [ripples, setRipples] = useState<
    Array<{ x: number; y: number; id: number }>
  >([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();

    setRipples((prev) => [...prev, { x, y, id }]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
    }, 600);

    onClick?.(e);
  };

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-[#841e27] to-[#a52a34] text-white hover:from-[#a52a34] hover:to-[#c93545] shadow-lg hover:shadow-xl',
    secondary:
      'bg-gradient-to-r from-[#fff2e9] to-[#ffe4d1] text-[#841e27] hover:from-[#ffe4d1] hover:to-[#ffd4b8] shadow-md hover:shadow-lg',
    success:
      'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl',
    danger:
      'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-lg hover:shadow-xl',
    ghost:
      'bg-transparent border-2 border-white/30 text-white hover:bg-white/10 backdrop-blur-sm',
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      className={cn(
        'relative transform overflow-hidden rounded-xl font-semibold transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className='absolute animate-ping rounded-full bg-white/30'
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 20,
            height: 20,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
      <span className='relative z-10'>{children}</span>
    </button>
  );
}
