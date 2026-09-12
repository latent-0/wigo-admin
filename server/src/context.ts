import type { Database } from './data/store';
import type { NotificationsPort } from './ports/notifications';
import type { PaymentsPort } from './ports/payments';
import type { AuthService } from './services/auth.service';

/** Everything the route handlers depend on, injected so tests can supply fakes. */
export interface AppContext {
  db: Database;
  notifications: NotificationsPort;
  payments: PaymentsPort;
  auth: AuthService;
}
