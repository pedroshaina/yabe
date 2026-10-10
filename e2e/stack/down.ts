import { rmSync } from "node:fs";
import { compose } from "./compose.ts";
import { SEED_FILE } from "./urls.ts";

// --rmi local: also remove the images this project built (Compose names them per project).
compose("down", "-v", "--remove-orphans", "--rmi", "local");
rmSync(SEED_FILE, { force: true });
