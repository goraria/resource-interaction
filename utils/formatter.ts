/** Select only profile fields. No grant/session credential or authorization token. */
export function formatServiceProfile(
  profile: import("@/modules/structure/user-profile").SsoProfile,
) {
  const username = profile.preferred_username?.trim().toLowerCase();
  return {
    externalUserId: profile.sub,
    email: profile.email,
    name: profile.name?.trim() ?? "",
    username: username && /^[a-z0-9._]{5,32}$/.test(username) ? username : null,
    image: profile.picture ?? null,

    lastSeenAt: new Date(),
  };
}
