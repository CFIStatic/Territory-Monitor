import type { CompanySettings, Contact, StormEvent } from "@prisma/client";

export type TemplateContext = {
  contact: Contact;
  storm: StormEvent;
  settings: CompanySettings | null;
  fromName?: string | null;
};

export function renderTemplate(template: string, ctx: TemplateContext): string {
  const fullName = `${ctx.contact.firstName} ${ctx.contact.lastName}`.trim();
  const companyName = ctx.settings?.companyName ?? "our team";
  const agentName = ctx.fromName || ctx.settings?.agentName || "your restoration partner";
  const agentPhone = ctx.settings?.agentPhone ?? "";
  const agentEmail = ctx.settings?.agentEmail ?? "";
  const website = ctx.settings?.website ?? "";

  const replacements: Record<string, string> = {
    firstName: ctx.contact.firstName,
    lastName: ctx.contact.lastName,
    fullName,
    email: ctx.contact.email,
    city: ctx.contact.city,
    state: ctx.contact.state,
    zip: ctx.contact.zip ?? "",
    address: ctx.contact.address ?? "",
    contactCompany: ctx.contact.company ?? "",
    stormName: ctx.storm.name,
    stormType: ctx.storm.type,
    stormSeverity: ctx.storm.severity,
    stormEta: new Date(ctx.storm.etaStart).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    companyName,
    agentName,
    agentPhone,
    agentEmail,
    website,
  };

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    return replacements[key] ?? "";
  });
}

/** Soft subject hint for the outreach agent (not a mass template). */
export const DEFAULT_EMAIL_SUBJECT =
  "Personal note before the storm — keep it local and one-to-one";

/**
 * Talking points / guidance for the outreach agent.
 * In agent mode these are cues, not the literal email every contact receives.
 */
export const DEFAULT_EMAIL_BODY = `Mention that we are already staged locally and can help with mitigation, board-up, and insurance documentation.
Keep the tone warm, professional, and specific to their city.
Offer the agent's direct phone line.
Do not sound like a mass marketing blast.`;

export const DEFAULT_VOICE_NOTES =
  "Professional, calm, neighborly — like a trusted local contractor texting a known customer";
