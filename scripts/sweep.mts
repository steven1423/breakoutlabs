/** Runs the stuck-kit sweep once. Usage: pnpm sweep (needs the Supabase URL and secret key). */
import { sweepStuckKits } from "../lib/state-machine/db.ts";

sweepStuckKits()
  .then((r) => {
    console.log(`stuck ${r.stuck}  retention ${r.retention}  tickets opened ${r.ticketsOpened}  causes set ${r.causesSet}  nudges proposed ${r.nudgesProposed}`);
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
