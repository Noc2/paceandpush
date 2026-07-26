import { spawnSync } from "node:child_process";

run("npm", ["run", "legal:check"]);
run("npm", ["run", "db:migrations:check"]);
run("npm", ["run", "build:web"]);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
