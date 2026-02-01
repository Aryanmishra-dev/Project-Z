import * as React from 'react';
import { cn } from '@/utils/cn';

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  size: number;
  duration: number;
}

interface ConfettiProps {
  /** Whether to show the confetti animation */
  active: boolean;
  /** Number of confetti pieces */
  count?: number;
  /** Duration in milliseconds before confetti disappears */
  duration?: number;
  /** Custom colors for confetti */
  colors?: string[];
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Additional class names */
  className?: string;
}

const DEFAULT_COLORS = [
  '#f44336', // red
  '#e91e63', // pink
  '#9c27b0', // purple
  '#673ab7', // deep purple
  '#3f51b5', // indigo
  '#2196f3', // blue
  '#03a9f4', // light blue
  '#00bcd4', // cyan
  '#009688', // teal
  '#4caf50', // green
  '#8bc34a', // light green
  '#cddc39', // lime
  '#ffeb3b', // yellow
  '#ffc107', // amber
  '#ff9800', // orange
  '#ff5722', // deep orange
];

const Confetti: React.FC<ConfettiProps> = ({
  active,
  count = 50,
  duration = 3000,
  colors = DEFAULT_COLORS,
  onComplete,
  className,
}) => {
  const [pieces, setPieces] = React.useState<ConfettiPiece[]>([]);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (active) {
      // Generate confetti pieces
      const newPieces: ConfettiPiece[] = Array.from({ length: count }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)] ?? '#ff0',
        delay: Math.random() * 0.5,
        size: Math.random() * 8 + 4,
        duration: Math.random() * 1 + 2,
      }));
      setPieces(newPieces);
      setVisible(true);

      // Clean up after duration
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      setPieces([]);
    }
  }, [active, count, duration, colors, onComplete]);

  if (!visible || pieces.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed inset-0 pointer-events-none overflow-hidden z-50',
        className
      )}
      aria-hidden="true"
    >
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${piece.x}%`,
            top: '-10px',
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </div>
  );
};

// Alternate confetti styles
interface StreamerPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  width: number;
  height: number;
}

const ConfettiStreamers: React.FC<Omit<ConfettiProps, 'count'> & { count?: number }> = ({
  active,
  count = 30,
  duration = 4000,
  colors = DEFAULT_COLORS,
  onComplete,
  className,
}) => {
  const [streamers, setStreamers] = React.useState<StreamerPiece[]>([]);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (active) {
      const newStreamers: StreamerPiece[] = Array.from({ length: count }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)] ?? '#ff0',
        delay: Math.random() * 0.8,
        width: Math.random() * 6 + 2,
        height: Math.random() * 20 + 15,
      }));
      setStreamers(newStreamers);
      setVisible(true);

      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      setStreamers([]);
    }
  }, [active, count, duration, colors, onComplete]);

  if (!visible || streamers.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed inset-0 pointer-events-none overflow-hidden z-50',
        className
      )}
      aria-hidden="true"
    >
      {streamers.map((streamer) => (
        <div
          key={streamer.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${streamer.x}%`,
            top: '-30px',
            width: `${streamer.width}px`,
            height: `${streamer.height}px`,
            backgroundColor: streamer.color,
            animationDelay: `${streamer.delay}s`,
            animationDuration: '3s',
            borderRadius: `${streamer.width / 2}px`,
          }}
        />
      ))}
    </div>
  );
};

// Firework burst effect
interface FireworkBurst {
  id: number;
  x: number;
  y: number;
  particles: { angle: number; distance: number; color: string }[];
}

const ConfettiFireworks: React.FC<
  Omit<ConfettiProps, 'count'> & { bursts?: number }
> = ({
  active,
  bursts = 5,
  duration = 2000,
  colors = DEFAULT_COLORS,
  onComplete,
  className,
}) => {
  const [fireworks, setFireworks] = React.useState<FireworkBurst[]>([]);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (active) {
      const newFireworks: FireworkBurst[] = Array.from({ length: bursts }).map((_, i) => ({
        id: i,
        x: 20 + Math.random() * 60,
        y: 20 + Math.random() * 40,
        particles: Array.from({ length: 12 }).map((_, j) => ({
          angle: (j * 30 * Math.PI) / 180,
          distance: 30 + Math.random() * 40,
          color: colors[Math.floor(Math.random() * colors.length)] ?? '#ff0',
        })),
      }));
      setFireworks(newFireworks);
      setVisible(true);

      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      setFireworks([]);
    }
  }, [active, bursts, duration, colors, onComplete]);

  if (!visible || fireworks.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed inset-0 pointer-events-none overflow-hidden z-50',
        className
      )}
      aria-hidden="true"
    >
      {fireworks.map((firework, fIndex) => (
        <div
          key={firework.id}
          className="absolute"
          style={{
            left: `${firework.x}%`,
            top: `${firework.y}%`,
            animationDelay: `${fIndex * 0.3}s`,
          }}
        >
          {firework.particles.map((particle, pIndex) => (
            <div
              key={pIndex}
              className="absolute w-2 h-2 rounded-full animate-scale-in"
              style={{
                backgroundColor: particle.color,
                transform: `translate(${Math.cos(particle.angle) * particle.distance}px, ${Math.sin(particle.angle) * particle.distance}px)`,
                animationDelay: `${fIndex * 0.3}s`,
                animationDuration: '0.5s',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export { Confetti, ConfettiStreamers, ConfettiFireworks };
export type { ConfettiProps };
