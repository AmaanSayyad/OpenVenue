"use client";

import { createAppKit } from "@reown/appkit/react";
import { bsc } from "@reown/appkit/networks";
import { projectId, wagmiAdapter } from "@/config";

const metadata = {
  name: "Venue",
  description: "Session-aware tokenized stocks on BNB Chain",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

createAppKit({
  adapters: [wagmiAdapter],
  projectId: projectId!,
  networks: [bsc],
  defaultNetwork: bsc,
  metadata,
  features: {
    analytics: true,
  },
});
