/**
 * WhatsApp message templates. On the Business API, templates must be pre-approved by
 * Meta; here we mirror the approved set and render params locally so the code path is
 * identical whether the fake or live adapter is used.
 */
export interface TemplateDef {
  name: string;
  /** Ordered placeholder names, rendered into the body as {{1}}, {{2}}, ... */
  params: string[];
  body: string; // uses {{paramName}} placeholders for readability
}

export const TEMPLATES: Record<string, TemplateDef> = {
  otp_login: {
    name: 'otp_login',
    params: ['code'],
    body: 'Your WIGO verification code is {{code}}. It expires in 5 minutes. Do not share it.',
  },
  application_approved: {
    name: 'application_approved',
    params: ['name', 'city'],
    body: 'Hi {{name}}, your WIGO application in {{city}} is approved. Welcome aboard!',
  },
  application_rejected: {
    name: 'application_rejected',
    params: ['name', 'reason'],
    body: 'Hi {{name}}, we could not approve your WIGO application. Reason: {{reason}}.',
  },
  deposit_received: {
    name: 'deposit_received',
    params: ['name', 'amount'],
    body: 'Hi {{name}}, we received your deposit of {{amount}}. Your wallet is updated.',
  },
};

export class TemplateError extends Error {}

/** Render a template body, enforcing that every required param is present. */
export function renderTemplate(name: string, params: Record<string, string>): string {
  const def = TEMPLATES[name];
  if (!def) throw new TemplateError(`Unknown template: ${name}`);
  const missing = def.params.filter((p) => params[p] === undefined || params[p] === '');
  if (missing.length > 0) {
    throw new TemplateError(`Template ${name} missing params: ${missing.join(', ')}`);
  }
  return def.body.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => params[key] ?? '');
}
