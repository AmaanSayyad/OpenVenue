"use client";

import { createAppKit } from "@reown/appkit/react";
import { bsc } from "@reown/appkit/networks";
import { projectId, wagmiAdapter } from "@/config";
import { monadMainnet, monadTestnet } from "@/lib/monad/chains";
import { SITE_URL, appOrigin } from "@/lib/site";

const appUrl = appOrigin();
const monadIcon = `${appUrl}/brand/logos/monad.png`;
const openVenueIcon = `${SITE_URL}/favicon.svg`;

const metadata = {
  name: "OpenVenue",
  description:
    "Flight-style aggregator for tokenized stocks - compare Anchored, xStocks, Ondo, bStocks. Buy where they live; platform fees settle on Monad.",
  url: appUrl.includes("localhost") ? SITE_URL : appUrl,
  icons: [openVenueIcon],
};

createAppKit({
  adapters: [wagmiAdapter],
  projectId: projectId!,
  networks: [monadMainnet, monadTestnet, bsc],
  defaultNetwork: monadMainnet,
  metadata,
  chainImages: {
    143: monadIcon,
    10143: monadIcon,
  },
  features: {
    analytics: true,
  },
});
