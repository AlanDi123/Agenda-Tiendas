import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { SUBSCRIPTION_PLANS } from '../../types/payment';
import type { SubscriptionPlan } from '../../types/payment';
import './Payment.css';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({ isOpen, onClose, onSuccess }: PaymentModalProps) {
  const { currentUser, upgradeToPremium } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(SUBSCRIPTION_PLANS[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handlePayment = async () => {
    if (!currentUser) return;

    setIsProcessing(true);
    setError('');

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Upgrade to premium
      await upgradeToPremium();
      
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar pago');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="modal"
      showCloseButton
      title="Upgrade a Premium"
    >
      <div className="payment-container">
        <div className="payment-header">
          <p className="payment-description">
            Desbloquea todas las features avanzadas de Dommuss Agenda
          </p>
        </div>

        <div className="payment-plans">
          {SUBSCRIPTION_PLANS.filter(p => p.id !== 'FREE').map((plan: SubscriptionPlan) => (
            <button
              key={plan.id}
              className={`payment-plan-card ${selectedPlan.id === plan.id ? 'selected' : ''}`}
              onClick={() => setSelectedPlan(plan)}
              type="button"
            >
              <div className="payment-plan-header">
                <h3 className="payment-plan-name">{plan.name}</h3>
                <div className="payment-plan-price">
                  <span className="payment-plan-amount">${plan.price}</span>
                  <span className="payment-plan-currency">/{plan.interval === 'lifetime' ? 'único' : plan.interval === 'yearly' ? 'año' : 'mes'}</span>
                </div>
              </div>
              <ul className="payment-plan-features">
                {plan.features.slice(0, 3).map((feature: string, index: number) => (
                  <li key={index} className="payment-plan-feature">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {feature}
                  </li>
                ))}
                {plan.features.length > 3 && (
                  <li className="payment-plan-feature-more">
                    +{plan.features.length - 3} features más
                  </li>
                )}
              </ul>
            </button>
          ))}
        </div>

        <div className="payment-summary">
          <div className="payment-summary-row">
            <span>Plan</span>
            <span>{selectedPlan.name}</span>
          </div>
          <div className="payment-summary-row">
            <span>Total</span>
            <span className="payment-summary-total">${selectedPlan.price} {selectedPlan.currency}</span>
          </div>
        </div>

        {error && <div className="payment-error">{error}</div>}

        <div className="payment-actions">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handlePayment}
            loading={isProcessing}
          >
            {isProcessing ? 'Procesando...' : `Pagar $${selectedPlan.price}`}
          </Button>
          <Button
            variant="text"
            size="md"
            fullWidth
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancelar
          </Button>
        </div>

        <div className="payment-security">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Pago seguro y encriptado</span>
        </div>
      </div>
    </Modal>
  );
}
