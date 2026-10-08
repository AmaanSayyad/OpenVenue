import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-transparent pt-16 sm:pt-24">
      <div className="bg-white">
      <div className="mx-auto w-full max-w-[1536px] px-8 pt-8 sm:px-14 sm:pt-10">
        <p
          className="display w-full whitespace-nowrap text-center font-medium leading-none tracking-[-0.045em] text-[var(--ink)]"
          style={{
            fontSize: "clamp(2.75rem, 12vw, 10.25rem)",
            paddingBottom: "0.36em",
          }}
        >
          OpenVenue
        </p>
      </div>
      <div className="border-t border-[#dedede]">
        <div className="mx-auto flex w-full max-w-[1536px] flex-col gap-4 px-4 py-[22px] sm:flex-row sm:items-center sm:justify-between sm:px-9">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2 text-sm font-medium leading-none">
            <span className="text-black">
              OpenVenue © {new Date().getFullYear()}
            </span>
            <Link
              href="/how-it-works"
              className="text-[#626262] transition hover:text-black"
            >
              Terms of Service
            </Link>
            <Link
              href="/how-it-works"
              className="text-[#626262] transition hover:text-black"
            >
              Privacy Policy
            </Link>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X"
              className="text-[#626262] transition hover:text-black"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.227-8.26L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
              </svg>
            </a>
            <a
              href="https://github.com/AmaanSayyad/OpenVenue"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="text-[#626262] transition hover:text-black"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
      </div>
    </footer>
  );
}
