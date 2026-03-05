/**
 * Currency Service
 * Handles USD to ARS conversion using exchangerate.host API
 * Uses Math.ceil for rounding up as specified
 */

// ============================================
// CONFIGURATION
// ============================================

const EXCHANGE_RATE_API_URL = 'https://api.exchangerate.host/convert';

// Cache for exchange rates (5 minutes)
let cachedRate: number | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ============================================
// TYPES
// ============================================

export interface ExchangeRateResponse {
  success: boolean;
  rate: number;
  date?: string;
}

// ============================================
// FUNCTIONS
// ============================================

/**
 * Get USD to ARS exchange rate
 * Uses caching to avoid excessive API calls
 */
export async function getUsdToArsRate(): Promise<number> {
  const now = Date.now();

  // Return cached rate if still valid
  if (cachedRate !== null && (now - cacheTimestamp) < CACHE_DURATION_MS) {
    console.log('[CurrencyService] Using cached exchange rate:', cachedRate);
    return cachedRate;
  }

  try {
    const response = await fetch(
      `${EXCHANGE_RATE_API_URL}?from=USD&to=ARS&amount=1`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Exchange rate API returned ${response.status}`);
    }

    const data = await response.json() as { success?: boolean; result?: number };

    if (!data.success && data.result === undefined) {
      throw new Error('Invalid response from exchange rate API');
    }

    // Use Math.ceil for rounding up as specified
    const rate = Math.ceil((data.result || 0) * 100) / 100;

    // Cache the rate
    cachedRate = rate;
    cacheTimestamp = now;

    console.log('[CurrencyService] Fetched new exchange rate:', rate);

    return rate;
  } catch (error) {
    console.error('[CurrencyService] Error fetching exchange rate:', error);

    // Fallback to a reasonable default rate if API fails
    const fallbackRate = 1000;
    console.log('[CurrencyService] Using fallback rate:', fallbackRate);

    return fallbackRate;
  }
}

/**
 * Convert USD amount to ARS
 * Uses Math.ceil for rounding up
 */
export async function convertUsdToArs(usdAmount: number): Promise<number> {
  const rate = await getUsdToArsRate();
  return Math.ceil(usdAmount * rate);
}

/**
 * Convert ARS amount to USD
 */
export async function convertArsToUsd(arsAmount: number): Promise<number> {
  const rate = await getUsdToArsRate();
  return Math.ceil((arsAmount / rate) * 100) / 100;
}

/**
 * Clear the cached exchange rate
 */
export function clearCache(): void {
  cachedRate = null;
  cacheTimestamp = 0;
}

export default {
  getUsdToArsRate,
  convertUsdToArs,
  convertArsToUsd,
  clearCache,
};
