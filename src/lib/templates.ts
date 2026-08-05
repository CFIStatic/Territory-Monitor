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

export const DEFAULT_EMAIL_SUBJECT =
  "{{stormName}} approaching {{city}} — {{companyName}} is standing by";

export const DEFAULT_EMAIL_BODY = `Hi {{firstName}},

Weather teams are tracking {{stormName}} headed toward {{city}}, {{state}}, with an expected arrival around {{stormEta}}.

I wanted to reach out personally from {{companyName}} so you know we're already staged and ready if you need water mitigation, board-up, or emergency restoration support.

If anything happens, reply to this email or call me directly at {{agentPhone}}. We'll move quickly and walk you through insurance documentation from the start.

Stay safe,
{{agentName}}
{{companyName}}
{{agentPhone}}
{{agentEmail}}`;
