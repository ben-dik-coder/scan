/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Unngå at gammel HTML i cache peker på utgåtte CSS-filer etter deploy
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
