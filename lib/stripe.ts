import Stripe from 'stripe'
import type { EmployerTier } from '@/lib/billing'

// Only the three fixed-price employer tiers ever go through Stripe --
// Enterprise (Complete Build Spec: "custom/on application") stays
// sales-led, contacted directly, never self-service checkout.
export type PayableEmployerTier = Extract<EmployerTier, 'micro' | 'growth' | 'scale'>

// Same "safe no-op until configured" pattern as RESEND_API_KEY in
// app/api/notify/route.ts -- lets this code ship and deploy before the
// real keys exist, rather than the two having to land in the same PR.
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-08-26.dahlia' })
  : null

// One Stripe Price ID per payable tier, set once in the Stripe
// Dashboard (Product catalog) and copied into these env vars -- never
// hardcoded here, since a Price ID is different between test and live
// mode and Claude Code has no Stripe dashboard access to create them.
export const STRIPE_PRICE_ID: Record<PayableEmployerTier, string | undefined> = {
  micro: process.env.STRIPE_PRICE_MICRO,
  growth: process.env.STRIPE_PRICE_GROWTH,
  scale: process.env.STRIPE_PRICE_SCALE,
}

export function isPayableTier(tier: string): tier is PayableEmployerTier {
  return tier === 'micro' || tier === 'growth' || tier === 'scale'
}
