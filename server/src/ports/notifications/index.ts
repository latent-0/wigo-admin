import { config } from '../../config/env';
import type { NotificationsPort } from './port';
import { FakeWhatsAppAdapter } from './fake-whatsapp.adapter';
import { WhatsAppBusinessAdapter } from './whatsapp-business.adapter';

let instance: NotificationsPort | null = null;

/** Build the NotificationsPort from env. `WHATSAPP_DRIVER=live` selects the real API. */
export function getNotificationsPort(): NotificationsPort {
  if (instance) return instance;
  if (config.whatsapp.driver === 'live') {
    instance = new WhatsAppBusinessAdapter({
      phoneNumberId: config.whatsapp.phoneNumberId,
      accessToken: config.whatsapp.accessToken,
    });
  } else {
    instance = new FakeWhatsAppAdapter();
  }
  return instance;
}

/** Test-only: inject a specific port implementation. */
export function setNotificationsPort(port: NotificationsPort): void {
  instance = port;
}

export function resetNotificationsPort(): void {
  instance = null;
}

export type { NotificationsPort } from './port';
export { FakeWhatsAppAdapter } from './fake-whatsapp.adapter';
