import { createApp } from "./app.js";
import { config } from "./config.js";
import { openDb } from "./db.js";
import { seedDb } from "./seed.js";

const db = openDb(config.dbPath);
const count = (db.prepare("SELECT COUNT(*) AS n FROM reports").get() as { n: number }).n;
if (count === 0) console.log("Empty database, seeding:", seedDb(db));

createApp(db).listen(config.port, () => console.log(`StepSafe API on http://localhost:${config.port}`));
