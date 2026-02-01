import * as React from 'react';
import { cn } from '@/utils/cn';

type TransitionType = 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'scale' | 'none';

interface PageTransitionProps {
  /** Children to render */
  children: React.ReactNode;
  /** Type of transition animation */
  type?: TransitionType;
  /** Duration in milliseconds */
  duration?: number;
  /** Delay before transition starts */
  delay?: number;
  /** Additional class names */
  className?: string;
  /** Whether the component is mounted/visible */
  show?: boolean;
}

const transitionClasses: Record<TransitionType, { enter: string; base: string }> = {
  fade: {
    enter: 'animate-fade-in',
    base: 'opacity-0',
  },
  'slide-left': {
    enter: 'animate-slide-in-from-left',
    base: 'opacity-0 -translate-x-full',
  },
  'slide-right': {
    enter: 'animate-slide-in-from-right',
    base: 'opacity-0 translate-x-full',
  },
  'slide-up': {
    enter: 'animate-fade-in-up',
    base: 'opacity-0 translate-y-4',
  },
  'slide-down': {
    enter: 'animate-fade-in-down',
    base: 'opacity-0 -translate-y-4',
  },
  scale: {
    enter: 'animate-scale-in',
    base: 'opacity-0 scale-95',
  },
  none: {
    enter: '',
    base: '',
  },
};

const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  type = 'fade',
  duration = 300,
  delay = 0,
  className,
  show = true,
}) => {
  const [shouldRender, setShouldRender] = React.useState(show);
  const [isAnimating, setIsAnimating] = React.useState(false);

  React.useEffect(() => {
    if (show) {
      setShouldRender(true);
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration]);

  if (!shouldRender) {
    return null;
  }

  const transition = transitionClasses[type];

  return (
    <div
      className={cn(
        'transition-all',
        isAnimating ? transition.enter : transition.base,
        className
      )}
      style={{
        animationDuration: `${duration}ms`,
        animationDelay: `${delay}ms`,
        animationFillMode: 'forwards',
      }}
    >
      {children}
    </div>
  );
};

// Staggered animation for lists
interface StaggeredListProps {
  /** List of items to render */
  children: React.ReactNode[];
  /** Delay between each item in ms */
  staggerDelay?: number;
  /** Type of transition animation */
  type?: TransitionType;
  /** Duration of each animation */
  duration?: number;
  /** Additional class names for the container */
  className?: string;
  /** Additional class names for each item */
  itemClassName?: string;
}

const StaggeredList: React.FC<StaggeredListProps> = ({
  children,
  staggerDelay = 50,
  type = 'fade',
  duration = 300,
  className,
  itemClassName,
}) => {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <PageTransition
          type={type}
          duration={duration}
          delay={index * staggerDelay}
          className={itemClassName}
        >
          {child}
        </PageTransition>
      ))}
    </div>
  );
};

// Animate on scroll visibility
interface AnimateOnScrollProps {
  /** Children to render */
  children: React.ReactNode;
  /** Type of transition animation */
  type?: TransitionType;
  /** Duration in milliseconds */
  duration?: number;
  /** Threshold for intersection observer (0-1) */
  threshold?: number;
  /** Only animate once */
  once?: boolean;
  /** Additional class names */
  className?: string;
}

const AnimateOnScroll: React.FC<AnimateOnScrollProps> = ({
  children,
  type = 'fade',
  duration = 500,
  threshold = 0.1,
  once = true,
  className,
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [hasAnimated, setHasAnimated] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && (!once || !hasAnimated)) {
          setIsVisible(true);
          setHasAnimated(true);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold, once, hasAnimated]);

  const transition = transitionClasses[type];

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all',
        isVisible ? transition.enter : transition.base,
        className
      )}
      style={{
        animationDuration: `${duration}ms`,
        animationFillMode: 'forwards',
      }}
    >
      {children}
    </div>
  );
};

// Collapse/Expand animation
interface CollapseProps {
  /** Whether the content is expanded */
  open: boolean;
  /** Children to render */
  children: React.ReactNode;
  /** Duration in milliseconds */
  duration?: number;
  /** Additional class names */
  className?: string;
}

const Collapse: React.FC<CollapseProps> = ({
  open,
  children,
  duration = 300,
  className,
}) => {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number | 'auto'>(open ? 'auto' : 0);

  React.useEffect(() => {
    if (open) {
      const contentHeight = contentRef.current?.scrollHeight || 0;
      setHeight(contentHeight);
      // After animation, set to auto for dynamic content
      const timer = setTimeout(() => setHeight('auto'), duration);
      return () => clearTimeout(timer);
    } else {
      // Get current height first
      const contentHeight = contentRef.current?.scrollHeight || 0;
      setHeight(contentHeight);
      // Then animate to 0
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setHeight(0);
        });
      });
    }
  }, [open, duration]);

  return (
    <div
      className={cn('overflow-hidden transition-all', className)}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        transitionDuration: `${duration}ms`,
      }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
};

export {
  PageTransition,
  StaggeredList,
  AnimateOnScroll,
  Collapse,
};
export type { PageTransitionProps, TransitionType };
