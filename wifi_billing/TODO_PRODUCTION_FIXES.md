# Production Readiness Fixes for WiFi Billing System

## Pending Tasks

### 1. Fix MAC Address Retrieval in Loan Callbacks
- **File**: `routes/mpesaCallback.js`
- **Issue**: Currently using 'purchase' activity type instead of 'loan_repay_initiated'
- **Fix**: Update the query to use 'loan_repay_initiated' action

### 2. Add Configurable WiFi Duration for Loans
- **File**: `routes/mpesaCallback.js`
- **Issue**: WiFi duration for loans is hardcoded
- **Fix**: Use environment variable `LOAN_WIFI_DURATION_HOURS` with default of 1 hour

### 3. Remove Bypass Loan Creation Endpoint
- **File**: `routes/loanRoutes.js`
- **Issue**: Test/bypass endpoint needs removal for production
- **Fix**: Remove the admin bypass loan endpoint and related code

### 4. Replace console.log with Winston Logger
- **Files**: `services/loanService.js`, `index.js`
- **Issue**: console.log statements need proper logging
- **Fix**: Replace all console.log/error with winston logger calls

### 5. Enhance MAC Address Validation Regex
- **File**: `routes/loanRoutes.js`
- **Issue**: Current regex may not be robust enough
- **Fix**: Update regex to be more comprehensive for MAC address validation

### 6. Test Complete Loan Flow
- **Action**: Manual testing of loan request → repayment → WiFi access
- **Verify**: End-to-end functionality works correctly

### 7. Verify MikroTik Integration
- **Action**: Test with real MikroTik hardware
- **Verify**: Whitelist functionality works in production environment
