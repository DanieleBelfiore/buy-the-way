import { prefersReducedMotionSync } from '@/composables/useReducedMotion';

type LogoMotionVariants = {
  initial: Record<string, unknown>;
  enter: Record<string, unknown>;
  visibleOnce: Record<string, unknown>;
};

export const useLogoMotion = (): LogoMotionVariants | undefined => {
  if (prefersReducedMotionSync()) return undefined;

  return {
    initial: { scale: 0.6, opacity: 0, rotate: -8, y: -12 },
    enter: {
      scale: 1,
      opacity: 1,
      rotate: 0,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 220,
        damping: 14,
        mass: 0.8,
      },
    },
    visibleOnce: {
      y: [0, -6, 0],
      rotate: [0, -2, 0, 2, 0],
      transition: {
        y: { duration: 2800, repeat: Infinity, ease: 'easeInOut', delay: 600 },
        rotate: { duration: 4200, repeat: Infinity, ease: 'easeInOut', delay: 600 },
      },
    },
  };
};
