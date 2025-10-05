export interface StorePrice {
  initialCents: number;
  finalCents: number;
  discountPercent: number;
  currency: string;
}

export interface ValidatedPrice {
  isAvailable: boolean;
  unavailableReason?: string;
  basePrice?: number;
  finalPrice?: number;
  discountPercent?: number;
}

export function validateStorePrice(storePrice: StorePrice, store: string, country: string): ValidatedPrice {
  // Basic validation of price data
  if (storePrice.initialCents === undefined || storePrice.finalCents === undefined) {
    return {
      isAvailable: false,
      unavailableReason: 'Missing price data'
    };
  }

  if (storePrice.initialCents <= 0 || storePrice.finalCents < 0) {
    return {
      isAvailable: false,
      unavailableReason: 'Invalid price values'
    };
  }

  // Check if discount percentage is consistent with price values
  let calculatedDiscount = 0;
  if (storePrice.initialCents > 0) {
    calculatedDiscount = Math.round(((storePrice.initialCents - storePrice.finalCents) / storePrice.initialCents) * 100);
  }

  // Validate discount percentage is within reasonable range
  if (storePrice.discountPercent !== calculatedDiscount && 
      Math.abs(storePrice.discountPercent - calculatedDiscount) > 5) { // Allow 5% tolerance
    console.warn(`Discount percentage mismatch: ${storePrice.discountPercent}% vs calculated ${calculatedDiscount}%`);
  }

  return {
    isAvailable: true,
    basePrice: storePrice.initialCents / 100,
    finalPrice: storePrice.finalCents / 100,
    discountPercent: storePrice.discountPercent
  };
}

export function qualityCheckPrice(validatedPrice: ValidatedPrice): boolean {
  if (!validatedPrice.isAvailable || 
      validatedPrice.basePrice === undefined || 
      validatedPrice.finalPrice === undefined) {
    return false;
  }

  // Basic quality checks
  if (validatedPrice.basePrice <= 0 || validatedPrice.finalPrice < 0) {
    return false;
  }

  // Check if final price is higher than base price (shouldn't happen)
  if (validatedPrice.finalPrice > validatedPrice.basePrice) {
    return false;
  }

  // Check for unusually high discount (90% or more might indicate bad data)
  if (validatedPrice.discountPercent && validatedPrice.discountPercent > 90) {
    console.warn(`Unusually high discount detected: ${validatedPrice.discountPercent}%`);
    return false;
  }

  return true;
}