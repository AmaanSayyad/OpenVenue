/** Production site (Vercel / custom domain after deploy). */
export const SITE_URL = "https://openvenue.xyz";

/** Public GitHub source. */
export const REPO_URL = "https://github.com/AmaanSayyad/OpenVenue";

/** Pitch deck (Chronicle). */
export const PITCH_DECK_URL =
  "https://app.chroniclehq.com/amaan-s-workspace/openvenue-monad";

/** Demo video / assets (Google Drive). */
export const DEMO_VIDEO_URL =
  "https://drive.google.com/drive/folders/1TuNcIJzfz2zBeFZEqPaOEqWkbUR-vCXw?usp=sharing";

/** Runtime app origin - env in prod, localhost when developing. */
export function appOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL || SITE_URL;
}
