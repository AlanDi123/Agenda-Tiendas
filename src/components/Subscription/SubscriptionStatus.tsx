import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { getUserSubscription, cancelSubscription } from '../../services/subscriptionService';
import type { Subscription } from '../../types/payment';
import { SUBSCRIPTION_PLANS } from '../../types/payment';
import './Subscription.css';

interface SubscriptionStatusProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

export function SubscriptionStatus({ isOpen, onClose, onUpgrade }: SubscriptionStatusProps) {
  const { currentUser } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSubscription = useCallback(async () => {
    if (!currentUser) return;

    try {
      const sub = await getUserSubscription(currentUser.id);
      setSubscription(sub);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (isOpen && currentUser) {
      void loadSubscription();
    }
  }, [isOpen, currentUser, loadSubscription]);

  const handleCancel = async () => {
    if (!subscription || !confirm('¿Estás seguro de cancelar tu suscripción?')) return;

    try {
      await cancelSubscription(subscription.id);
      setSubscription(prev => prev ? { ...prev, cancelAtPeriodEnd: true, canceledAt: new Date() } : null);
    } catch (error) {
      console.error('Error canceling subscription:', error);
    }
  };

  const plan = subscription ? SUBSCRIPTION_PLANS.find(p => p.id === subscription.planType) : null;

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="modal"
      title="Mi Suscripción"
    >
      <div className="subscription-status">
        {isLoading ? (
          <div className="subscription-loading">
            <div className="loading-spinner" />
            <p>Cargando información...</p>
          </div>
        ) : subscription && subscription.status === 'active' ? (
          <div className="subscription-active">
            <div className="subscription-header">
              <span className="status-badge status-active">Activo</span>
              <h3 className="plan-name">{plan?.name}</h3>
            </div>

            <div className="subscription-details">
              <div className="detail-row">
                <span className="detail-label">Plan actual</span>
                <span className="detail-value">{plan?.name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Precio</span>
                <span className="detail-value">${plan?.price} {plan?.interval === 'lifetime' ? '(pago único)' : `/${plan?.interval}`}</span>
              </div>
              {subscription.planType !== 'PREMIUM_LIFETIME' && (
                <>
                  <div className="detail-row">
                    <span className="detail-label">Renovación</span>
                    <span className="detail-value">{formatDate(subscription.currentPeriodEnd)}</span>
                  </div>
                  {subscription.cancelAtPeriodEnd && (
                    <div className="detail-row detail-warning">
                      <span className="detail-label">Estado</span>
                      <span className="detail-value cancel-pending">
                        Cancelada - Acceso hasta {formatDate(subscription.currentPeriodEnd)}
                      </span>
                    </div>
                  )}
                </>
              )}
              {subscription.planType === 'PREMIUM_LIFETIME' && (
                <div className="detail-row detail-lifetime">
                  <span className="detail-label">Acceso</span>
                  <span className="detail-value lifetime-badge">♾️ Vitalicio</span>
                </div>
              )}
            </div>

            <div className="subscription-features">
              <h4>Funcionalidades incluidas:</h4>
              <ul className="features-list">
                {plan?.features.map((feature, idx) => (
                  <li key={idx} className="feature-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {!subscription.cancelAtPeriodEnd && subscription.planType !== 'PREMIUM_LIFETIME' && (
              <div className="subscription-actions">
                <Button
                  variant="secondary"
                  onClick={handleCancel}
                  fullWidth
                >
                  Cancelar suscripción
                </Button>
              </div>
            )}

            {subscription.cancelAtPeriodEnd && (
              <div className="subscription-reactivate">
                <p className="reactivate-message">
                  Tu suscripción se cancelará al final del período. Puedes reactivarla en cualquier momento.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="subscription-free">
            <div className="subscription-header">
              <span className="status-badge status-free">Gratis</span>
              <h3>Plan Actual</h3>
            </div>

            <p className="free-description">
              Estás usando el plan gratuito. Actualiza a Premium para acceder a todas las funcionalidades.
            </p>

            <div className="subscription-features">
              <h4>Funcionalidades del plan gratuito:</h4>
              <ul className="features-list">
                <li className="feature-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Hasta 50 eventos
                </li>
                <li className="feature-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Vista de calendario
                </li>
                <li className="feature-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Eventos básicos
                </li>
              </ul>
            </div>

            <div className="subscription-actions">
              <Button
                variant="primary"
                size="lg"
                onClick={onUpgrade}
                fullWidth
              >
                Actualizar a Premium
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
