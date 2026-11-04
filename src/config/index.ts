import { cookieStorage, createStorage } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { bsc } from "@reown/appkit/networks";
import { monadMainnet, monadTestnet } from "@/lib/monad/chains";

export const projectId =
  process.env.NEXT_PUBLIC_PROJECT_ID ||
  "b56e18d47c72ab683b10814fe9495694"; // public Reown id — localhost only

export const networks = [monadMainnet, monadTestnet, bsc] as const;

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  projectId,
  networks: [...networks],
});

export const config = wagmiAdapter.wagmiConfig;
