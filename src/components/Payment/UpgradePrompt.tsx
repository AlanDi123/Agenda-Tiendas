import { Button } from '../Button';
import './Payment.css';

interface UpgradePromptProps {
  feature: string;
  onUpgrade: () => void;
  onClose: () => void;
}

export function UpgradePrompt({ feature, onUpgrade, onClose }: UpgradePromptProps) {
  return (
    <div className="upgrade-prompt">
      <div className="upgrade-prompt-icon">🔒</div>
      <h3 className="upgrade-prompt-title">Feature Premium</h3>
      <p className="upgrade-prompt-message">
        <strong>{feature}</strong> está disponible solo para usuarios Premium.
      </p>
      <ul className="upgrade-prompt-benefits">
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Eventos recurrentes
        </li>
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Alarmas y recordatorios
        </li>
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Drag & Drop para reprogramar
        </li>
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Y mucho más
        </li>
      </ul>
      <div className="upgrade-prompt-actions">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onUpgrade}
        >
          Upgrade a Premium
        </Button>
        <Button
          variant="text"
          size="md"
          fullWidth
          onClick={onClose}
        >
          Ahora no
        </Button>
      </div>
    </div>
  );
}
