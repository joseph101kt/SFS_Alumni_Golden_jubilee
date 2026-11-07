// lib/registration/currency.ts
// Approximate currency conversion for display only. Rates come from Frankfurter, which
// publishes European Central Bank reference rates on working days. They are not live
// trading rates, so every converted figure in the UI is labelled as approximate.

import { useEffect, useState } from 'react';

/** Currencies Frankfurter publishes rates for (AED and SAR are not in its set). */
export const DISPLAY_CURRENCIES = [
    'INR',
    'USD',
    'EUR',
    'GBP',
    'AUD',
    'CAD',
    'SGD',
    'NZD',
    'JPY',
    'CHF',
    'MYR',
    'ZAR',
] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

const FRANKFURTER_LATEST_URL = 'https://api.frankfurter.dev/v1/latest';

interface FrankfurterLatestResponse {
    base: string;
    date: string;
    rates: Record<string, number>;
}

export type ExchangeRateState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; currency: DisplayCurrency; rate: number; date: string }
    | { status: 'error' };

function isFrankfurterLatestResponse(value: unknown): value is FrankfurterLatestResponse {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Partial<FrankfurterLatestResponse>;
    return typeof candidate.date === 'string' && typeof candidate.rates === 'object' && candidate.rates !== null;
}

/**
 * Fetches the INR → currency reference rate whenever the chosen currency changes.
 * INR needs no conversion, so the state stays idle.
 */
export function useInrExchangeRate(currency: DisplayCurrency): ExchangeRateState {
    const [state, setState] = useState<ExchangeRateState>({ status: 'idle' });

    useEffect(() => {
        if (currency === 'INR') {
            setState({ status: 'idle' });
            return;
        }

        let active = true;
        setState({ status: 'loading' });

        fetch(`${FRANKFURTER_LATEST_URL}?base=INR&symbols=${currency}`)
            .then(async (res): Promise<unknown> => {
                if (!res.ok) throw new Error('Rate request failed');
                return res.json();
            })
            .then((data) => {
                if (!isFrankfurterLatestResponse(data)) throw new Error('Unexpected rate response');
                const rate = data.rates[currency];
                if (typeof rate !== 'number') throw new Error('Rate missing for currency');
                if (active) setState({ status: 'ready', currency, rate, date: data.date });
            })
            .catch(() => {
                if (active) setState({ status: 'error' });
            });

        return () => {
            active = false;
        };
    }, [currency]);

    return state;
}

/**
 * Approximate amount in the chosen currency for an INR amount given in paise.
 * Returns null when no usable rate is loaded for that currency.
 */
export function approximateInCurrency(
    paise: number,
    currency: DisplayCurrency,
    state: ExchangeRateState
): string | null {
    if (currency === 'INR' || state.status !== 'ready' || state.currency !== currency) return null;
    const converted = (paise / 100) * state.rate;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
    }).format(converted);
}