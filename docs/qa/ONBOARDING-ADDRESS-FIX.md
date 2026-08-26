# Onboarding address fix

Home address is optional during onboarding. Invalid or partial optional address data is ignored rather than blocking account activation. A complete valid state/ZIP is saved and geocoded. This prevents a new account from being trapped on the first onboarding step by an address validation error.