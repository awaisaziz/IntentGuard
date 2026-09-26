# IntentSpec: intent-demo-galaxium
Status: **approved**

## Objective
Travelers currently cannot select cabin seats during the interstellar booking flow, resulting in customer service overhead and a 24% drop-off at checkout.

## Outcomes
- Interactive cabin seat map renders within 300ms of booking step 2
- Seat selection state is preserved and locked for 10 minutes
- Selected seat number appears on booking confirmation receipt and ticket

## Scope
**In Scope:**
- src/booking/seats/**
- src/components/CabinMap.tsx
- src/types/booking.ts

**Out of Scope:**
- src/billing/**
- src/auth/**
- src/engine/propulsion/**
- config/secrets/**

## Edge Cases
- **Two travelers select the same luxury suite simultaneously**: First hold transaction succeeds; second traveler receives real-time seat unavailable notification and map refreshes.
- **Seat hold timer expires after 10 minutes without checkout**: Seat is returned to available pool and customer is prompted to extend or re-select.
