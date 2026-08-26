# Onboarding address bug regression

## Bug
New accounts could receive `Please enter a valid state and ZIP code.` while the visible onboarding step did not contain state or ZIP inputs. Because the error redirected back to the first step, the mom had no visible way to correct the address and could be blocked from completing onboarding.

## Fix
Home address is optional. The server now saves and geocodes only a complete, valid US street/city/state/ZIP combination. Invalid or partial optional address input is ignored so onboarding can always complete. Current-location search remains available later without a saved home address.

## Regression requirement
A new account must be able to complete onboarding with no home address, and malformed optional address values must never prevent onboarding completion.
