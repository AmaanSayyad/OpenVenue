/** Production site (Vercel / custom domain after deploy). */
export const SITE_URL = "https://openvenue.xyz";

/** Public GitHub source. */
export const REPO_URL = "https://github.com/AmaanSayyad/OpenVenue";

/** Blitz team. */
export const TEAM = ["Amaan Sayyad", "Shivam Sharma"] as const;

/** Pitch deck (Chronicle). */
export const PITCH_DECK_URL =
  "https://app.chroniclehq.com/amaan-s-workspace/openvenue-monad";

/** Demo video / assets (Google Drive). */
export const DEMO_VIDEO_URL =
  "https://drive.google.com/drive/folders/1TuNcIJzfz2zBeFZEqPaOEqWkbUR-vCXw?usp=sharing";

/** Launch tweet. */
export const TWEET_URL =
  "https://x.com/amaanbiz/status/2117954547817828767";

/** Runtime app origin - env in prod, localhost when developing. */
export function appOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL || SITE_URL;
}
