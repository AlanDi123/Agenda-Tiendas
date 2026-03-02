import './Avatar.css';

interface AvatarProps {
  name: string;
  initials: string;
  color: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCheck?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Avatar({
  name,
  initials,
  color,
  size = 'md',
  showCheck = false,
  isSelected = false,
  onClick,
  className = '',
}: AvatarProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      className={`avatar avatar-${size} ${onClick ? 'avatar-clickable' : ''} ${isSelected ? 'avatar-selected' : ''} ${className}`}
      style={{ backgroundColor: color }}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={name}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span className="avatar-initials">{initials}</span>
      {showCheck && isSelected && (
        <span className="avatar-check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      )}
    </div>
  );
}

interface AvatarGroupProps {
  profiles: Array<{ name: string; initials: string; color: string }>;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function AvatarGroup({ profiles, max = 3, size = 'sm' }: AvatarGroupProps) {
  const visible = profiles.slice(0, max);
  const remaining = profiles.length - max;

  return (
    <div className="avatar-group">
      {visible.map((profile, index) => (
        <Avatar
          key={index}
          name={profile.name}
          initials={profile.initials}
          color={profile.color}
          size={size}
        />
      ))}
      {remaining > 0 && (
        <div className={`avatar avatar-${size} avatar-remaining`}>
          <span>+{remaining}</span>
        </div>
      )}
    </div>
  );
}
