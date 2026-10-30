import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "games-night-v2";
export default defineRailway(() => {
  const gamesNightV2 = service("games-night-v2", {
    source: github("Tosinfamzy/games-night-v2", { branch: "main", checkSuites: false }),
    build: { builder: "dockerfile", dockerfilePath: "Dockerfile" },
    start: "node dist/src/main",
    healthcheck: "/v1/health",
    healthcheckTimeout: 120,
    replicas: { "europe-west4-drams3a": 1 },
    domains: ["api.thegamesnight.com"],
  });

  return project("games-night-api", {
    variables: { managed: false },
    resources: [gamesNightV2],
  });
});
