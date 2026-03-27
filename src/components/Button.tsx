import { forwardRef, useRef, useState, useCallback, type ButtonHTMLAttributes } from 'react';
import './Button.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /**
   * Si true, deshabilita el botón automáticamente mientras el onClick asíncrono
   * está en curso, previniendo doble-click / ghost clicks.
   */
  autoDisableWhilePending?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      autoDisableWhilePending = false,
      onClick,
      ...props
    },
    ref
  ) => {
    const [pending, setPending] = useState(false);
    const isMounted = useRef(true);

    const handleClick = useCallback(
      async (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!onClick) return;
        if (autoDisableWhilePending && pending) return;

        if (autoDisableWhilePending) {
          setPending(true);
          try {
            await (onClick as (e: React.MouseEvent<HTMLButtonElement>) => unknown)(e);
          } finally {
            if (isMounted.current) setPending(false);
          }
        } else {
          onClick(e);
        }
      },
      [onClick, autoDisableWhilePending, pending]
    );

    const isDisabled = disabled || loading || (autoDisableWhilePending && pending);
    const isLoading = loading || (autoDisableWhilePending && pending);

    const classes = [
      'btn',
      `btn-${variant}`,
      `btn-${size}`,
      fullWidth ? 'btn-full-width' : '',
      isLoading ? 'btn-loading' : '',
      className,
    ].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        className={classes}
        disabled={isDisabled}
        aria-busy={isLoading}
        role="button"
        onClick={autoDisableWhilePending ? handleClick : onClick}
        {...props}
      >
        {isLoading && (
          <span className="btn-spinner" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="32"
                strokeDashoffset="12"
              />
            </svg>
          </span>
        )}
        {leftIcon && <span className="btn-icon btn-icon-left" aria-hidden="true">{leftIcon}</span>}
        {children && <span className="btn-content">{children}</span>}
        {rightIcon && <span className="btn-icon btn-icon-right" aria-hidden="true">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
