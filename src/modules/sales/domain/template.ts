export const defaultPipelineTemplate = {
  key: "professional-services",
  version: 1,
  name: "Ventas de servicios profesionales",
  stages: [
    {
      name: "Nuevo",
      probability: 10,
      staleAfterDays: 2,
      color: "#64748B",
      initial: true,
    },
    {
      name: "Contactado",
      probability: 20,
      staleAfterDays: 3,
      color: "#0EA5E9",
      initial: false,
    },
    {
      name: "Diagnóstico",
      probability: 40,
      staleAfterDays: 5,
      color: "#8B5CF6",
      initial: false,
    },
    {
      name: "Propuesta",
      probability: 70,
      staleAfterDays: 5,
      color: "#F59E0B",
      initial: false,
    },
    {
      name: "Negociación",
      probability: 85,
      staleAfterDays: 7,
      color: "#10B981",
      initial: false,
    },
  ],
} as const;

export const defaultLeadSources = [
  ["manual", "Manual"],
  ["whatsapp", "WhatsApp"],
  ["website_form", "Formulario web"],
  ["email", "Correo"],
  ["meta_lead_ads", "Meta Lead Ads"],
  ["messenger", "Messenger"],
  ["instagram", "Instagram"],
  ["referral", "Referido"],
  ["other", "Otro"],
] as const;

export const defaultLostReasons = [
  ["price", "Precio"],
  ["no_response", "Sin respuesta"],
  ["timing", "Momento"],
  ["competitor", "Competencia"],
  ["budget", "Presupuesto"],
  ["not_a_fit", "No es adecuado"],
  ["other", "Otro"],
] as const;
