import { InjectionToken } from '@angular/core';

export interface RuntimeConfig {
  apiUrl: string;
  dashboardUrl: string;
}

export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('RUNTIME_CONFIG');

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const response = await fetch('/runtime-config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load application configuration');
  const config: unknown = await response.json();
  if (!config || typeof config !== 'object' ||
      !('apiUrl' in config) || typeof config.apiUrl !== 'string' ||
      !('dashboardUrl' in config) || typeof config.dashboardUrl !== 'string') {
    throw new Error('Invalid application configuration');
  }
  for (const value of [config.apiUrl, config.dashboardUrl]) {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.origin !== value) {
      throw new Error('Invalid application URL');
    }
  }
  return { apiUrl: config.apiUrl, dashboardUrl: config.dashboardUrl };
}
