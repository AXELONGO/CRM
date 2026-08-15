import type {
  AuthEmailKind,
  EmailMessage,
} from "@/modules/identity/application/ports/email-sender";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

function subjectFor(kind: AuthEmailKind): string {
  if (kind === "verification") return "Verifica tu correo de CRM";
  if (kind === "password-reset") return "Restablece tu contrasena de CRM";
  if (kind === "quote-otp") return "Codigo de verificacion de tu cotizacion CRM";
  if (kind === "agreement-otp") return "Codigo de verificacion de tu acuerdo CRM";
  return "Invitacion para unirte a CRM";
}

function actionFor(kind: AuthEmailKind): string {
  if (kind === "verification") return "Verificar correo";
  if (kind === "password-reset") return "Restablecer contrasena";
  if (kind === "quote-otp") return "Ver codigo de cotizacion";
  if (kind === "agreement-otp") return "Ver codigo de tu acuerdo";
  return "Aceptar invitacion";
}

function hasOtp(kind: AuthEmailKind): boolean {
  return kind === "quote-otp" || kind === "agreement-otp";
}

export function buildAuthEmail(message: EmailMessage) {
  const recipientName = escapeHtml(message.recipientName || "usuario");
  const safeUrl = escapeHtml(message.url);
  const action = actionFor(message.kind);
  const otp = hasOtp(message.kind) ? ` Codigo: ${message.code ?? ""}.` : "";

  return {
    subject: subjectFor(message.kind),
    text: `Hola ${message.recipientName || "usuario"}. ${action}: ${message.url}${otp}`,
    html: `<main><h1>CRM</h1><p>Hola ${recipientName}.</p><p><a href="${safeUrl}">${action}</a></p>${hasOtp(message.kind) ? `<p>Codigo: <strong>${escapeHtml(message.code ?? "")}</strong></p>` : ""}<p>Si no solicitaste este correo, puedes ignorarlo.</p></main>`,
  };
}
