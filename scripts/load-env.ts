import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", {
  info: () => {},
  error: (message) => console.error(message),
});
