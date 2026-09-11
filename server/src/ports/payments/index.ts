import { config } from '../../config/env';
import type { PaymentsPort } from './port';
import { FakeN1coAdapter } from './fake-n1co.adapter';
import { N1coAdapter } from './n1co.adapter';

let instance: PaymentsPort | null = null;

/** Build the PaymentsPort from env. `N1CO_DRIVER=live` selects the real API. */
export function getPaymentsPort(): PaymentsPort {
  if (instance) return instance;
  if (config.n1co.driver === 'live') {
    instance = new N1coAdapter({ baseUrl: config.n1co.baseUrl, apiKey: config.n1co.apiKey });
  } else {
    instance = new FakeN1coAdapter();
  }
  return instance;
}

export function setPaymentsPort(port: PaymentsPort): void {
  instance = port;
}

export function resetPaymentsPort(): void {
  instance = null;
}

export type { PaymentsPort } from './port';
export { FakeN1coAdapter } from './fake-n1co.adapter';
