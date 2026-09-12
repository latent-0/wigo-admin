import { createApp, buildContext } from './app';
import { config, assertProductionSecrets } from './config/env';
import { db } from './data/store';
import { seed } from './data/seed';

async function main(): Promise<void> {
  assertProductionSecrets();

  // Seed the deterministic demo dataset. A real deployment would run migrations and
  // skip this; here it gives the staging demo and smoke test a known starting state.
  await seed(db);

  const ctx = buildContext({ db });
  const app = createApp(ctx);

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `WIGO admin API listening on http://localhost:${config.port} ` +
        `(env=${config.env}, whatsapp=${config.whatsapp.driver}, n1co=${config.n1co.driver})`,
    );
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
