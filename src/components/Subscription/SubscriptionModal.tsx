import { useState } from 'react';
import { Button } from '../Button';
import { Modal } from '../Modal';
import {
  redirectToCheckout,
  validateDiscountCode,
} from '../../services/paymentGatewayService';
import './SubscriptionModal.css';

interface PlanOption {
  id: string;
  name: string;
  priceUsd: number;
  priceArs: number;
  interval: 'monthly' | 'yearly' | 'lifetime';
  description: string;
  features: string[];
  popular?: boolean;
}

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PLANS: PlanOption[] = [
  {
    id: 'PREMIUM_MONTHLY',
    name: 'Mensual',
    priceUsd: 0,
    priceArs: 20000,
    interval: 'monthly',
    description: 'Ideal para empezar',
    features: [
      'Perfiles ilimitados',
      'Eventos ilimitados',
      'Eventos recurrentes',
      'Alarmas personalizadas',
      'Soporte por email',
    ],
  },
  {
    id: 'PREMIUM_YEARLY',
    name: 'Anual',
    priceUsd: 0,
    priceArs: 220000,
    interval: 'yearly',
    description: '1 mes gratis',
    features: [
      'Todo lo del plan mensual',
      'Equivale a $18.333/mes',
      '1 mes gratis incluido',
      'Soporte prioritario',
      'Actualizaciones anticipadas',
    ],
    popular: true,
  },
];

export function SubscriptionModal({ isOpen, onClose, onSuccess }: SubscriptionModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>('PREMIUM_YEARLY');
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<string | null>(null);
  const [appliedDiscountAmount, setAppliedDiscountAmount] = useState(0);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    
    setDiscountError(null);
    setIsProcessing(true);
    
    try {
      const result = await validateDiscountCode(discountCode.trim());

      if (result.isValid) {
        setAppliedDiscount(discountCode.trim().toUpperCase());
        setDiscountError(null);
        if (selectedPlanData && result.discount) {
          const amount = result.discount.type === 'percentage'
            ? Math.round((selectedPlanData.priceArs * result.discount.value) / 100)
            : result.discount.value;
          setDiscountError(null);
          setAppliedDiscountAmount(Math.min(selectedPlanData.priceArs, Math.max(0, amount)));
        } else {
          setAppliedDiscountAmount(0);
        }
      } else {
        setAppliedDiscount(null);
        setDiscountError(result.message || 'Código inválido');
        setAppliedDiscountAmount(0);
      }
    } catch {
      setDiscountError('Error al validar código');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubscribe = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const plan = PLANS.find(p => p.id === selectedPlan);
      if (!plan) {
        throw new Error('Plan no válido');
      }
      
      await redirectToCheckout(selectedPlan, appliedDiscount || undefined);
      
      // Success - user will be redirected to Mercado Pago
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar pago');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedPlanData = PLANS.find(p => p.id === selectedPlan);
  const discountValue = appliedDiscount && selectedPlanData
    ? (appliedDiscount === 'MAJESTADALAN' ? selectedPlanData.priceArs : appliedDiscountAmount)
    : 0;
  const finalTotal = Math.max(0, (selectedPlanData?.priceArs || 0) - discountValue);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="modal"
      showCloseButton={!isProcessing}
      title="🚀 Upgrade a Premium"
    >
      <div className="subscription-modal">
        {/* Plan Selection */}
        <div className="subscription-plans">
          {PLANS.map(plan => (
            <button
              key={plan.id}
              className={`subscription-plan-card ${selectedPlan === plan.id ? 'selected' : ''} ${plan.popular ? 'popular' : ''}`}
              onClick={() => setSelectedPlan(plan.id)}
              type="button"
              disabled={isProcessing}
            >
              {plan.popular && <span className="popular-badge">Más popular</span>}
              
              <div className="plan-header">
                <h3 className="plan-name">{plan.name}</h3>
                <div className="plan-price">
                  <span className="plan-amount">
                    ${plan.priceArs.toLocaleString('es-AR')}
                  </span>
                  <span className="plan-currency">
                    {' '}ARS{plan.interval === 'yearly' ? '/año' : '/mes'}
                  </span>
                </div>
                {plan.interval === 'yearly' && (
                  <p className="plan-price-ars" style={{ color: 'var(--color-success, #43a047)', fontWeight: 500 }}>
                    Equivale a $28.000/mes
                  </p>
                )}
              </div>
              
              <p className="plan-description">{plan.description}</p>
              
              <ul className="plan-features">
                {plan.features.map((feature, index) => (
                  <li key={index} className="plan-feature">
                    <svg className="feature-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {/* Discount Code */}
        <div className="discount-section">
          <label className="discount-label">¿Tienes un código de descuento?</label>
          <div className="discount-input-group">
            <input
              type="text"
              className="discount-input"
              placeholder="Ingresa tu código"
              value={discountCode}
              onChange={e => setDiscountCode(e.target.value.toUpperCase())}
              disabled={isProcessing || !!appliedDiscount}
            />
            {appliedDiscount ? (
              <span className="discount-applied">✓ Aplicado</span>
            ) : (
              <Button
                variant="secondary"
                onClick={handleApplyDiscount}
                disabled={!discountCode.trim() || isProcessing}
                type="button"
              >
                Aplicar
              </Button>
            )}
          </div>
          {discountError && <p className="discount-error">{discountError}</p>}
          {appliedDiscount && appliedDiscount === 'MAJESTADALAN' && (
            <p className="majestadalan-note">🎉 ¡Código VIP aplicado! Acceso lifetime gratuito.</p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="subscription-error">
            <span className="subscription-error-icon">⚠️</span>
            {error}
          </div>
        )}

        {/* Summary */}
        <div className="subscription-summary">
          <div className="summary-row">
            <span>Plan seleccionado:</span>
            <span>{selectedPlanData?.name}</span>
          </div>
          {appliedDiscount && (
            <div className="summary-row discount">
              <span>Descuento ({appliedDiscount}):</span>
                  <span>-{appliedDiscount === 'MAJESTADALAN' ? '100%' : 'Aplicado en checkout'}</span>
            </div>
          )}
          <div className="summary-row total">
            <span>Total:</span>
            <span className="total-amount">
              {finalTotal === 0
                ? 'GRATIS'
                : `$${finalTotal.toLocaleString('es-AR')} ARS`}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="subscription-actions">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSubscribe}
            loading={isProcessing}
            disabled={!selectedPlan}
          >
            {isProcessing ? 'Procesando...' : finalTotal === 0 ? 'Activar Premium' : `Pagar $${finalTotal.toLocaleString('es-AR')} ARS`}
          </Button>
          
          {!isProcessing && (
            <Button
              variant="text"
              size="md"
              fullWidth
              onClick={onClose}
            >
              Cancelar
            </Button>
          )}
        </div>

        {/* Security Note */}
        <div className="subscription-security">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Pago seguro procesado por Mercado Pago</span>
        </div>
      </div>
    </Modal>
  );
}
