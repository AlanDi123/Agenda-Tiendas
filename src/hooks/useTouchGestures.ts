import { useState, useCallback, useEffect, useRef } from 'react';

interface TouchGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  onLongPress?: () => void;
  threshold?: number;
  longPressDelay?: number;
}

export function useTouchGestures({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onTap,
  onLongPress,
  threshold = 50,
  longPressDelay = 500,
}: TouchGestureOptions = {}) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const isLongPress = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.targetTouches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
    isLongPress.current = false;
    
    // Iniciar timer para long press
    if (onLongPress) {
      longPressTimer.current = window.setTimeout(() => {
        isLongPress.current = true;
        onLongPress();
      }, longPressDelay);
    }
  }, [onLongPress, longPressDelay]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.targetTouches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
    
    // Cancelar long press si se mueve el dedo
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    // Cancelar long press timer
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
    }
    
    // Si fue long press, no procesar swipe/tap
    if (isLongPress.current) {
      return;
    }

    if (!touchStart || !touchEnd) {
      // Fue un tap
      if (onTap) {
        onTap();
      }
      return;
    }

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isHorizontal = Math.abs(distanceX) > Math.abs(distanceY);

    // Detectar dirección del swipe
    if (isHorizontal) {
      if (Math.abs(distanceX) > threshold) {
        if (distanceX > 0 && onSwipeLeft) {
          onSwipeLeft();
        } else if (distanceX < 0 && onSwipeRight) {
          onSwipeRight();
        }
      }
    } else {
      if (Math.abs(distanceY) > threshold) {
        if (distanceY > 0 && onSwipeUp) {
          onSwipeUp();
        } else if (distanceY < 0 && onSwipeDown) {
          onSwipeDown();
        }
      }
    }

    // Si no fue swipe, fue tap
    if (Math.abs(distanceX) < threshold && Math.abs(distanceY) < threshold) {
      if (onTap) {
        onTap();
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}

// Hook para pull-to-refresh
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef<number | null>(null);
  const pullThreshold = 100;
  const maxPull = 200;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.targetTouches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current !== null && window.scrollY === 0) {
      const currentY = e.targetTouches[0].clientY;
      const distance = Math.max(0, currentY - startY.current);
      if (distance > 0 && distance < maxPull) {
        setPullDistance(distance);
      }
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > pullThreshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
    startY.current = null;
  }, [pullDistance, pullThreshold, isRefreshing, onRefresh]);

  return {
    isRefreshing,
    pullDistance,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}

// Hook para optimizar interacciones móviles
export function useMobileOptimization() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return { isMobile, isTouch };
}
