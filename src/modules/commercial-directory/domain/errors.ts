export class CommercialConflictError extends Error {
  constructor(message = "El registro cambio mientras lo editabas.") {
    super(message);
    this.name = "CommercialConflictError";
  }
}

export class CommercialNotFoundError extends Error {
  constructor() {
    super("El recurso no existe.");
    this.name = "CommercialNotFoundError";
  }
}
