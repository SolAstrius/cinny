import React from 'react';
import { useBrand } from '../../hooks/useClientConfig';
import { PixelWordmark } from './PixelWordmark';

/** brand.wordmark (an image URL) when set, otherwise brand.name in the pixel font. */
export function BrandWordmark({ className }: { className?: string }) {
  const brand = useBrand();
  if (brand.wordmark) return <img className={className} src={brand.wordmark} alt={brand.name} />;
  return <PixelWordmark className={className} text={brand.name} />;
}
