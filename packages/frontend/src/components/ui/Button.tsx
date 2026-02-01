import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

const buttonVariants = cva(
  'relative inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 overflow-hidden transform active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-lg hover:shadow-primary-500/25 active:bg-primary-800',
        secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 hover:shadow-md active:bg-gray-400',
        outline: 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50 hover:border-primary-700 active:bg-primary-100',
        ghost: 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200',
        destructive: 'bg-error-500 text-white hover:bg-error-600 hover:shadow-lg hover:shadow-error-500/25 active:bg-error-700',
        link: 'text-primary-600 underline-offset-4 hover:underline',
        success: 'bg-success-500 text-white hover:bg-success-600 hover:shadow-lg hover:shadow-success-500/25 active:bg-success-700',
        glow: 'bg-primary-600 text-white hover:bg-primary-700 animate-glow',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  /** Enable ripple effect on click */
  ripple?: boolean;
}

interface RippleStyle {
  top: number;
  left: number;
  width: number;
  height: number;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, fullWidth = false, ripple = true, disabled, children, onClick, ...props }, ref) => {
    const [rippleStyle, setRippleStyle] = React.useState<RippleStyle | null>(null);
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (ripple && !disabled && !loading) {
        const button = buttonRef.current;
        if (button) {
          const rect = button.getBoundingClientRect();
          const size = Math.max(rect.width, rect.height);
          const x = event.clientX - rect.left - size / 2;
          const y = event.clientY - rect.top - size / 2;
          
          setRippleStyle({ top: y, left: x, width: size, height: size });
          
          // Remove ripple after animation
          setTimeout(() => setRippleStyle(null), 600);
        }
      }
      
      onClick?.(event);
    };

    const setRefs = (element: HTMLButtonElement | null) => {
      buttonRef.current = element;
      if (typeof ref === 'function') {
        ref(element);
      } else if (ref) {
        ref.current = element;
      }
    };

    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size }), fullWidth && 'w-full', className)}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }
    
    return (
      <button
        className={cn(buttonVariants({ variant, size }), fullWidth && 'w-full', className)}
        ref={setRefs}
        disabled={disabled || loading}
        aria-disabled={disabled || loading}
        onClick={handleClick}
        {...props}
      >
        {loading && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {children}
        {loading && <span className="sr-only">Loading</span>}
        
        {/* Ripple effect */}
        {rippleStyle && (
          <span
            className="absolute rounded-full bg-white/30 animate-ripple pointer-events-none"
            style={{
              top: rippleStyle.top,
              left: rippleStyle.left,
              width: rippleStyle.width,
              height: rippleStyle.height,
            }}
          />
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
