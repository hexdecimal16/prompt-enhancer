export { BaseProvider, TokenEstimator, ProviderRegistry } from './base-provider';
export { GoogleProvider } from './google-provider';

import { ProviderInterface, ProviderConfig } from '../types';
import { ProviderFactory, ProviderRegistry } from './base-provider';
import { GoogleProvider } from './google-provider';

// Factory implementations
class GoogleProviderFactory implements ProviderFactory {
  createProvider(_name: string, config: ProviderConfig): ProviderInterface | null {
    if (!config.api_key) return null;
    return new GoogleProvider(config.api_key, config.models, config.base_url);
  }
}

// Register all providers
ProviderRegistry.register('google', new GoogleProviderFactory());

export const createProvider = (name: string, config: ProviderConfig): ProviderInterface | null => {
  return ProviderRegistry.create(name, config);
}; 