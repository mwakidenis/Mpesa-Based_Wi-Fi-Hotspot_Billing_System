# Production Readiness for MikroTik Integration

## Current Status
- [ ] Implementation in progress

## Implementation Steps

### 1. Fix MAC Address Retrieval in Loan Repayment
- [ ] Update `routes/mpesaCallback.js` to retrieve MAC from 'loan_repay_initiated' activity instead of 'purchase' activity

### 2. Add Configurable WiFi Duration
- [ ] Add `LOAN_WIFI_DURATION_HOURS` environment variable (default: 1)
- [ ] Update `routes/mpesaCallback.js` to use configurable duration instead of hardcoded 1 hour

### 3. Remove Test Endpoints
- [ ] Remove bypass loan creation endpoint from `routes/loanRoutes.js`

### 4. Replace Console Logs with Logger
- [ ] Update `routes/mpesaCallback.js` to use winston logger instead of console.log
- [ ] Update `services/loanService.js` to use winston logger instead of console.log
- [ ] Update `index.js` to use winston logger instead of console.log

### 5. Enhance Input Validation
- [ ] Improve MAC address regex validation in `routes/loanRoutes.js`
- [ ] Add more robust input validation checks

## Files to be Modified
- `routes/mpesaCallback.js` - Fix MAC retrieval, configurable duration, replace logging
- `routes/loanRoutes.js` - Remove test endpoints, enhance validation
- `services/loanService.js` - Replace console.log with logger
- `index.js` - Replace console.log with logger

## Testing & Verification
- [ ] Test complete loan flow: request → repayment → WiFi access
- [ ] Verify MAC address handling consistency
- [ ] Test error scenarios and ensure proper logging
- [ ] Verify MikroTik integration works with real hardware
