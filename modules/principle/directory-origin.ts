export function parseDirectoryOrigin(
  value: string,
  options: {
    isLoopback: (url: URL) => boolean;
    allowLoopback: boolean;
    requireLoopback?: boolean;
  },
) {
  const url = new URL(value);
  const local = options.isLoopback(url);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (local && !options.allowLoopback) ||
    (!local && options.requireLoopback) ||
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    (!local && /^(?:\d+\.\d+\.\d+\.\d+|\[)/.test(url.hostname))
  )
    throw new Error("invalid_directory_origin");
  return url.origin;
}
