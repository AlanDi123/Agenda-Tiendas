import { useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import { Input } from '../Input';
import { Modal } from '../Modal';
import { SUBSCRIPTION_PLANS, PAYMENT_METHODS, type PlanType, type PaymentMethodType } from '../../types/payment';
import { createPaymentSession, applyDiscountCode } from '../../services/subscriptionService';
import { createGatewayPayment } from '../../services/paymentGatewayService';
import { AppLogger } from '../../services/logger';
import './Checkout.css';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultPlan?: PlanType;
}

export function CheckoutModal({ isOpen, onClose, onSuccess, defaultPlan }: CheckoutModalProps) {
  const { currentUser } = useAuth();
  
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(defaultPlan || 'PREMIUM_MONTHLY');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('mercadopago');
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState<{ valid: boolean; amount: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'plan' | 'payment' | 'processing'>('plan');

  const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan);
  const paymentMethod = PAYMENT_METHODS.find(m => m.method === selectedMethod);

  const calculateTotal = useCallback(() => {
    if (!plan) return 0;
    return plan.price - (discountApplied?.amount || 0);
  }, [plan, discountApplied]);

  const handleApplyDiscount = async () => {
    if (!discountCode || !currentUser) return;

    try {
      const result = await applyDiscountCode(
        discountCode,
        selectedPlan,
        currentUser.id,
        plan?.price || 0
      );

      if (result.valid) {
        setDiscountApplied({ valid: true, amount: result.discountAmount });
        setError('');
      } else {
        setDiscountApplied(null);
        setError(result.error || 'Código inválido');
      }
    } catch (err) {
      setError('Error al aplicar código');
    }
  };

  const handleProceedToPayment = () => {
    setStep('payment');
  };

  const handleConfirmPayment = async () => {
    if (!currentUser) return;

    setIsProcessing(true);
    setStep('processing');
    setError('');

    try {
      // Create payment session
      const session = await createPaymentSession(
        currentUser.id,
        selectedPlan,
        discountApplied?.valid ? discountCode : undefined
      );

      // Create gateway payment
      const gatewayResult = await createGatewayPayment(session, selectedMethod);

      if (!gatewayResult.success) {
        throw new Error(gatewayResult.error || 'Error al crear pago');
      }

      // Log the payment initiation
      AppLogger.logUserAction('payment_initiated', {
        sessionId: session.id,
        plan: selectedPlan,
        method: selectedMethod,
        amount: session.amount,
      });

      // Handle redirect-based payment
      if (gatewayResult.gatewayUrl) {
        // For MAJESTADALAN with 100% discount, skip redirect
        if (discountCode.toUpperCase() === 'MAJESTADALAN' && discountApplied?.amount === plan?.price) {
          // Direct success for lifetime free access
          await fetch('/api/payment/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: session.id,
              gatewayPaymentId: gatewayResult.gatewayPaymentId,
              status: 'completed',
            }),
          });
          onSuccess();
          onClose();
          return;
        }

        // Redirect to payment gateway
        window.location.href = gatewayResult.gatewayUrl;
      } else {
        // For non-redirect payments, show success
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar pago');
      setStep('payment');
      setIsProcessing(false);
    }
  };

  const handleBack = () => {
    setStep('plan');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="modal"
      showCloseButton={!isProcessing}
      title={step === 'plan' ? 'Selecciona tu Plan' : step === 'payment' ? 'Método de Pago' : 'Procesando...'}
    >
      <div className="checkout-container">
        {step === 'plan' && (
          <div className="checkout-step">
            <div className="checkout-plans">
              {SUBSCRIPTION_PLANS.filter(p => p.id !== 'FREE').map((planOption) => (
                <button
                  key={planOption.id}
                  className={`checkout-plan-card ${selectedPlan === planOption.id ? 'selected' : ''} ${planOption.popular ? 'popular' : ''}`}
                  onClick={() => setSelectedPlan(planOption.id)}
                  type="button"
                >
                  {planOption.popular && <span className="popular-badge">Más Popular</span>}
                  <h3 className="plan-name">{planOption.name}</h3>
                  <p className="plan-description">{planOption.description}</p>
                  <div className="plan-price">
                    <span className="price-amount">${planOption.price}</span>
                    <span className="price-interval">
                      {planOption.interval === 'lifetime' ? 'único' : `/${planOption.interval}`}
                    </span>
                  </div>
                  <ul className="plan-features">
                    {planOption.features.slice(0, 4).map((feature, idx) => (
                      <li key={idx} className="plan-feature">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            <div className="checkout-discount">
              <Input
                type="text"
                label="Código de descuento (opcional)"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder="Ingresa tu código"
                disabled={isProcessing}
              />
              <Button
                variant="secondary"
                onClick={handleApplyDiscount}
                disabled={!discountCode || isProcessing}
                type="button"
              >
                Aplicar
              </Button>
              {discountApplied?.valid && (
                <span className="discount-success">
                  ¡Descuento de ${discountApplied.amount.toFixed(2)} aplicado!
                </span>
              )}
            </div>

            {error && <div className="checkout-error">{error}</div>}

            <div className="checkout-summary">
              <div className="summary-row">
                <span>Plan</span>
                <span>{plan?.name}</span>
              </div>
              {discountApplied?.valid && (
                <div className="summary-row summary-discount">
                  <span>Descuento</span>
                  <span>-${discountApplied.amount.toFixed(2)}</span>
                </div>
              )}
              <div className="summary-row summary-total">
                <span>Total</span>
                <span>${calculateTotal().toFixed(2)} {plan?.currency}</span>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleProceedToPayment}
              disabled={!plan}
            >
              Continuar al Pago
            </Button>
          </div>
        )}

        {step === 'payment' && (
          <div className="checkout-step">
            <div className="checkout-methods">
              <h3 className="methods-title">Selecciona Método de Pago</h3>
              {PAYMENT_METHODS.filter(m => m.enabled).map((method) => (
                <button
                  key={method.method}
                  className={`checkout-method-card ${selectedMethod === method.method ? 'selected' : ''}`}
                  onClick={() => setSelectedMethod(method.method)}
                  type="button"
                >
                  <span className="method-name">{method.name}</span>
                </button>
              ))}
            </div>

            <div className="checkout-summary">
              <div className="summary-row">
                <span>Plan</span>
                <span>{plan?.name}</span>
              </div>
              {discountApplied?.valid && (
                <div className="summary-row summary-discount">
                  <span>Descuento</span>
                  <span>-${discountApplied.amount.toFixed(2)}</span>
                </div>
              )}
              <div className="summary-row summary-total">
                <span>Total a pagar</span>
                <span>${calculateTotal().toFixed(2)}</span>
              </div>
            </div>

            {error && <div className="checkout-error">{error}</div>}

            <div className="checkout-actions">
              <Button variant="secondary" onClick={handleBack} disabled={isProcessing}>
                ← Volver
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={handleConfirmPayment}
                loading={isProcessing}
                disabled={!paymentMethod}
              >
                Pagar ${calculateTotal().toFixed(2)}
              </Button>
            </div>

            <div className="checkout-security">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Pago seguro y encriptado</span>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="checkout-step checkout-processing">
            <div className="processing-spinner">
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
            </div>
            <h3>Procesando tu pago...</h3>
            <p>Por favor no cierres esta ventana</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
