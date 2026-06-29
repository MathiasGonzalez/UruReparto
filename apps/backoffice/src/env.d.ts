/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

interface Env {
  API_URL: string;
}

declare namespace App {
  interface Locals extends Runtime {}
}
