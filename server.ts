import { startServer } from "./src/server/bootstrap";

export { app } from "./src/server/app";
export { parseCampaignList } from "./src/server/deps";

// Log async rejections instead of crashing silently
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

if (!process.env.VITEST) {
  startServer();
}