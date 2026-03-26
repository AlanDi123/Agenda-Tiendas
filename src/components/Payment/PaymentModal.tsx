import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { SUBSCRIPTION_PLANS } from '../../types/payment';
import type { PlanType, SubscriptionPlan } from '../../types/payment';
import { redirectToCheckout } from '../../services/paymentGatewayService';
import { validateDiscountCode } from '../../services/paymentGatewayService';
import './Payment.css';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CHECKOUT_PLAN_IDS: PlanType[] = ['PREMIUM_MONTHLY', 'PREMIUM_YEARLY'];

const PAYMENT_MODAL_PLANS = SUBSCRIPTION_PLANS.filter(p => CHECKOUT_PLAN_IDS.includes(p.id));

function displayArs(plan: SubscriptionPlan): number {
  if (plan.priceArs != null) return plan.priceArs;
  if (plan.id === 'PREMIUM_MONTHLY') return 20000;
  if (plan.id === 'PREMIUM_YEARLY') return 220000;
  return 0;
}

export function PaymentModal({ isOpen, onClose, onSuccess }: PaymentModalProps) {
  const { currentUser } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(
    () => PAYMENT_MODAL_PLANS[0] ?? SUBSCRIPTION_PLANS[1]
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);

  const applyDiscount = async () => {
    if (!discountCode.trim()) return;
    setError('');
    const result = await validateDiscountCode(discountCode.trim());
    if (!result.isValid || !result.discount) {
      setDiscountAmount(0);
      setError(result.message || 'Código inválido');
      return;
    }
    const base = displayArs(selectedPlan);
    const amount = result.discount.type === 'percentage'
      ? Math.round((base * result.discount.value) / 100)
      : result.discount.value;
    setDiscountAmount(Math.min(base, Math.max(0, amount)));
  };

  const handlePayment = async () => {
    if (!currentUser) return;
    if (!CHECKOUT_PLAN_IDS.includes(selectedPlan.id)) {
      setError('Seleccioná un plan mensual o anual para pagar con Mercado Pago.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      await redirectToCheckout(selectedPlan.id, discountCode.trim() || undefined);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar pago');
    } finally {
      setIsProcessing(false);
    }
  };

  const ars = displayArs(selectedPlan);
  const total = Math.max(0, ars - discountAmount);

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
          {PAYMENT_MODAL_PLANS.map((plan: SubscriptionPlan) => (
            <button
              key={plan.id}
              className={`payment-plan-card ${selectedPlan.id === plan.id ? 'selected' : ''}`}
              onClick={() => setSelectedPlan(plan)}
              type="button"
            >
              <div className="payment-plan-header">
                <h3 className="payment-plan-name">{plan.name}</h3>
                <div className="payment-plan-price">
                  <span className="payment-plan-amount">
                    ${displayArs(plan).toLocaleString('es-AR')}
                  </span>
                  <span className="payment-plan-currency">
                    {' '}
                    ARS/
                    {plan.interval === 'yearly' ? 'año' : 'mes'}
                  </span>
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
            <span>Cupón (opcional)</span>
            <span>
              <input
                type="text"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                placeholder="Código"
                style={{ width: 120 }}
              />
              <button type="button" onClick={applyDiscount} style={{ marginLeft: 8 }}>
                Aplicar
              </button>
            </span>
          </div>
          {discountAmount > 0 && (
            <div className="payment-summary-row">
              <span>Descuento</span>
              <span>- ${discountAmount.toLocaleString('es-AR')} ARS</span>
            </div>
          )}
          <div className="payment-summary-row">
            <span>Total</span>
            <span className="payment-summary-total">
              ${total.toLocaleString('es-AR')} ARS
            </span>
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
            {isProcessing
              ? 'Procesando...'
              : `Pagar con Mercado Pago — $${total.toLocaleString('es-AR')} ARS`}
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
          <span>Pago seguro con Mercado Pago</span>
        </div>
      </div>
    </Modal>
  );
}
