import { createServiceVerification } from "@/modules/structure/service-verification";
import { applicationNamespaces, resourceReadScopes, resourceWriteScopes } from "@/utils/constant";
import { authUrl, nodeEnv } from "@/utils/environment";

export const {
  verifyServiceRequest,
  serviceAuthFailure,
  serviceResourceMetadata,
} = createServiceVerification({
  service: "resource",
  authUrl,
  nodeEnv,
  applications: applicationNamespaces,
  scopeFor: (application, access) => (access === "read" ? resourceReadScopes : resourceWriteScopes)[application],
  metadataScopes: [...new Set([...Object.values(resourceReadScopes), ...Object.values(resourceWriteScopes)])],
});
