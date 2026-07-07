import { spawnSync } from "node:child_process";

const isProductionDeploy = process.env.VERCEL_ENV === "production";

run("npm", ["run", "legal:check"]);

if (isProductionDeploy) {
  run("npm", ["run", "db:migrations:check"]);
  run("npm", ["run", "db:migrate"]);
} else {
  console.log("Skipping production database migrations for non-production Vercel build.");
}

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
