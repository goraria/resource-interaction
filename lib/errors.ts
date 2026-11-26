export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 502 | 503,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
