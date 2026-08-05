import type { CompanySettings, Contact, OutreachRule, StormEvent } from "@prisma/client";
import { renderTemplate, type TemplateContext } from "@/lib/templates";

export type ComposedEmail = {
  subject: string;
  body: string;
  writingMode: "agent" | "template";
  personalizationBrief: string;
};

type AgentContext = {
  contact: Contact;
  storm: StormEvent;
  rule: Pick<
    OutreachRule,
    "emailSubject" | "emailBody" | "fromName" | "voiceNotes" | "writingMode" | "name"
  >;
  settings: CompanySettings | null;
};

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

function stormLabel(type: string): string {
  const map: Record<string, string> = {
    thunderstorm: "severe thunderstorm",
    tornado: "tornado threat",
    hail: "hailstorm",
    hurricane: "hurricane",
    flood: "flooding event",
    winter: "winter storm",
    wind: "high-wind event",
  };
  return map[type] || "weather event";
}

function stormPrepFocus(type: string): string {
  const map: Record<string, string> = {
    thunderstorm: "water intrusion and wind damage",
    tornado: "emergency board-up and structural protection",
    hail: "roof and exterior impact damage",
    hurricane: "wind-driven rain and property securing",
    flood: "water extraction and moisture control",
    winter: "freeze-related pipe and roof issues",
    wind: "roof covering and tree-related damage",
  };
  return map[type] || "emergency restoration needs";
}

function formatEta(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function neighborhoodCue(contact: Contact): string | null {
  if (contact.address) {
    const street = contact.address.split(",")[0]?.trim();
    if (street) return street;
  }
  if (contact.zip) return `${contact.city} ${contact.zip}`;
  return null;
}

function audienceOf(contact: Contact): "commercial" | "property_manager" | "homeowner" {
  const company = (contact.company || "").toLowerCase();
  const notes = (contact.notes || "").toLowerCase();
  if (
    company.includes("propert") ||
    company.includes("realty") ||
    company.includes("management") ||
    notes.includes("property manager")
  ) {
    return "property_manager";
  }
  if (company.trim().length > 0) return "commercial";
  return "homeowner";
}

type MemoryBundle = {
  familyCheckIn: string | null;
  personalRecall: string | null;
  lastTalkRecall: string | null;
  used: string[];
};

function buildMemoryBundle(contact: Contact, rng: () => number): MemoryBundle {
  const used: string[] = [];
  let familyCheckIn: string | null = null;
  let personalRecall: string | null = null;
  let lastTalkRecall: string | null = null;

  if (contact.spouseName || contact.familyNotes) {
    const spouse = contact.spouseName?.trim();
    const family = contact.familyNotes?.trim();
    const options: string[] = [];
    if (spouse && family) {
      options.push(
        `Hope ${spouse} and the family are doing well — I still remember you mentioning ${family}.`,
        `Thinking of you and ${spouse}. How’s everyone doing? I’ve got a note here about ${family}.`,
        `Please tell ${spouse} I said hello. Hope all is well at home (${family}).`
      );
    } else if (spouse) {
      options.push(
        `Hope you and ${spouse} are doing well.`,
        `Give ${spouse} my best — hope home has been treating you both kindly.`,
        `How are you and ${spouse} holding up these days?`
      );
    } else if (family) {
      options.push(
        `Hope the family is doing well — I’ve got a note here about ${family}.`,
        `Quick personal check-in: how’s everyone at home? I still remember you mentioning ${family}.`,
        `Hope things are good at home (${family}).`
      );
    }
    if (options.length) {
      familyCheckIn = pick(rng, options);
      used.push("family");
    }
  }

  if (contact.personalTouch?.trim()) {
    const touch = contact.personalTouch.trim();
    personalRecall = pick(rng, [
      `I’ve still got in mind that ${touch}.`,
      `Been meaning to ask how that went — ${touch}.`,
      `That detail stuck with me: ${touch}.`,
    ]);
    used.push("personalTouch");
  }

  if (contact.lastConversation?.trim()) {
    const last = contact.lastConversation.trim().replace(/\.$/, "");
    // Support both fragments ("sump pump maintenance") and verb phrases ("asked about…")
    const startsWithVerb = /^(asked|mentioned|wanted|said|told|talked|was|were|is|are)\b/i.test(
      last
    );
    lastTalkRecall = startsWithVerb
      ? pick(rng, [
          `Last time we talked, you ${last}. That stuck with me.`,
          `I’ve been thinking about our last conversation — you ${last}.`,
          `Since you ${last} last time we spoke, I wanted to check in personally before this weather hits.`,
        ])
      : pick(rng, [
          `Last time we talked, you mentioned ${last}. That stuck with me.`,
          `I’ve been thinking about our last conversation — especially when you brought up ${last}.`,
          `Since we last spoke about ${last}, I wanted to check in personally before this weather hits.`,
        ]);
    used.push("lastConversation");
  }

  return { familyCheckIn, personalRecall, lastTalkRecall, used };
}

function buildOpenings(ctx: {
  firstName: string;
  city: string;
  stormNice: string;
  eta: string;
  locality: string | null;
  audience: string;
  companyName: string;
  familyCheckIn: string | null;
}): string[] {
  const local = ctx.locality ? `near ${ctx.locality}` : `in ${ctx.city}`;

  if (ctx.familyCheckIn) {
    return [
      `Hi ${ctx.firstName} — ${ctx.familyCheckIn} I’m reaching out personally before the ${ctx.stormNice} moves through ${ctx.city}.`,
      `${ctx.firstName}, ${ctx.familyCheckIn.charAt(0).toLowerCase()}${ctx.familyCheckIn.slice(1)} Also wanted a quick one-to-one note as the ${ctx.stormNice} sets up ${local}.`,
      `Hi ${ctx.firstName}. ${ctx.familyCheckIn} With the ${ctx.stormNice} tracking toward ${ctx.city}, I didn’t want a generic blast.`,
    ];
  }

  return [
    `Hi ${ctx.firstName} — I wanted to reach you directly before the ${ctx.stormNice} moves through ${ctx.city}.`,
    `${ctx.firstName}, quick personal note from me as the ${ctx.stormNice} sets up ${local}.`,
    `Hi ${ctx.firstName}, I’m writing just to you in ${ctx.city} because this ${ctx.stormNice} is expected around ${ctx.eta}.`,
    `${ctx.firstName}, hope you’re well. With the ${ctx.stormNice} tracking toward ${ctx.city}, I didn’t want a generic blast — just a direct heads-up from ${ctx.companyName}.`,
    `Hi ${ctx.firstName}. Since you’re ${local}, I wanted you to have my direct line before conditions deteriorate.`,
  ];
}

function buildPersonalParagraphs(memories: MemoryBundle, rng: () => number): string[] {
  const lines: string[] = [];
  // family already used in opening when present; still allow a second soft line if both exist
  if (memories.personalRecall) lines.push(memories.personalRecall);
  if (memories.lastTalkRecall) lines.push(memories.lastTalkRecall);
  if (!lines.length && memories.familyCheckIn) {
    // opening already covered family; skip duplicate
    return [];
  }
  if (lines.length <= 1) return lines;
  // Keep emails tight: usually one personal recall paragraph
  return [pick(rng, lines)];
}

function buildContextLines(ctx: {
  stormName: string;
  stormNice: string;
  severity: string;
  eta: string;
  city: string;
  state: string;
  focus: string;
  audience: "commercial" | "property_manager" | "homeowner";
  contactCompany: string | null;
  description: string | null;
}): string[] {
  const severityTone =
    ctx.severity === "extreme" || ctx.severity === "warning"
      ? "This one is being treated seriously by local weather desks."
      : "It’s still developing, but the timing is close enough that preparation matters.";

  const audienceLine =
    ctx.audience === "property_manager"
      ? `If you manage multiple doors${ctx.contactCompany ? ` with ${ctx.contactCompany}` : ""}, having a restoration partner already briefed can save hours when tenants start calling.`
      : ctx.audience === "commercial"
        ? `For ${ctx.contactCompany || "your property"}, early coordination around ${ctx.focus} usually keeps business interruption shorter.`
        : `For your home in ${ctx.city}, the main risks I’m watching are ${ctx.focus}.`;

  const lines = [
    `${ctx.stormName} is currently forecast to affect ${ctx.city}, ${ctx.state}, around ${ctx.eta}. ${severityTone}`,
    `Forecast guidance has the ${ctx.stormNice} arriving near ${ctx.eta} for ${ctx.city}. ${audienceLine}`,
    `We’re watching ${ctx.stormName} into ${ctx.city} (${ctx.eta}). ${audienceLine}`,
  ];

  if (ctx.description) {
    lines.push(
      `${ctx.stormName} is described as: “${ctx.description.replace(/\s+/g, " ").trim()}” — expected near ${ctx.eta} for ${ctx.city}. ${audienceLine}`
    );
  }
  return lines;
}

function buildOfferLines(ctx: {
  companyName: string;
  focus: string;
  audience: "commercial" | "property_manager" | "homeowner";
  agentPhone: string;
}): string[] {
  const phone = ctx.agentPhone
    ? ` You can reach me directly at ${ctx.agentPhone}.`
    : " Reply to this email and I’ll pick it up personally.";

  return [
    `${ctx.companyName} already has crews positioned for ${ctx.focus}. If something happens, you won’t be starting from a cold call.${phone}`,
    `I’ve got ${ctx.companyName} staged to help with ${ctx.focus} — board-up, mitigation, and documentation support included.${phone}`,
    `If you need us, ${ctx.companyName} can move quickly on ${ctx.focus} and help you navigate insurance paperwork from the first hour.${phone}`,
    ctx.audience === "property_manager"
      ? `If a building takes damage overnight, tell me which address and I’ll prioritize dispatch for you.${phone}`
      : `Keep this note handy. If wind, water, or impact damage shows up, I’ll make sure you’re treated like a known contact — not a stranger in a queue.${phone}`,
  ];
}

function buildClosings(ctx: {
  agentName: string;
  companyName: string;
  agentPhone: string;
  agentEmail: string;
}): string[] {
  const signature = [
    ctx.agentName,
    ctx.companyName,
    ctx.agentPhone,
    ctx.agentEmail,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `Stay safe,\n${signature}`,
    `I’m here if you need anything,\n${signature}`,
    `Talk soon if the weather turns,\n${signature}`,
    `Appreciate you,\n${signature}`,
  ];
}

function buildSubjects(ctx: {
  firstName: string;
  city: string;
  stormNice: string;
  companyName: string;
  stormName: string;
  audience: string;
  spouseName: string | null;
  hasPersonalMemory: boolean;
}): string[] {
  const base = [
    `${ctx.firstName}, quick note before the ${ctx.stormNice} hits ${ctx.city}`,
    `Personal heads-up for your ${ctx.city} property — ${ctx.stormName}`,
    `${ctx.companyName} standing by for you in ${ctx.city}`,
    `${ctx.firstName} — ${ctx.stormNice} timing for ${ctx.city}`,
  ];
  if (ctx.spouseName) {
    base.unshift(`${ctx.firstName} — hoping you & ${ctx.spouseName} stay safe through this ${ctx.stormNice}`);
  }
  if (ctx.hasPersonalMemory) {
    base.unshift(`${ctx.firstName}, a personal note before the weather hits ${ctx.city}`);
  }
  return base;
}

function isMetaInstruction(text: string): boolean {
  return /^(keep|do not|don't|mention that|stress that|offer|make clear|tone|avoid|never|always|give the|ensure|emphasize|include|tell them|remind)\b/i.test(
    text.trim()
  ) || /\b(agent's|template|talking points|make clear this message)\b/i.test(text);
}

function applyGuidance(
  paragraphs: string[],
  guidance: string | null | undefined,
  rng: () => number
): string[] {
  if (!guidance?.trim()) return paragraphs;

  const cleaned = guidance.replace(/\{\{[^}]+\}\}/g, "").trim();
  const lines = cleaned
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 18 && s.length < 200 && !isMetaInstruction(s));

  if (!lines.length) return paragraphs;

  // Only weave concrete content lines, not tone instructions
  const cue = pick(rng, lines)
    .replace(/^(hi|hello|dear)\b[\s,]*/i, "")
    .replace(/\s+/g, " ");

  const insertAt = Math.min(paragraphs.length - 1, 2 + Math.floor(rng() * 2));
  const next = [...paragraphs];
  next.splice(
    insertAt,
    0,
    pick(rng, [
      `Also wanted you to know: ${cue}`,
      `Specifically for you — ${cue}`,
      cue.endsWith(".") ? cue : `${cue}.`,
    ])
  );
  return next;
}

function composeWithPhraseBanks(ctx: AgentContext): ComposedEmail {
  const { contact, storm, rule, settings } = ctx;
  const seed = hashSeed(
    `${contact.email}|${storm.id}|${rule.name}|${storm.etaStart.toISOString()}`
  );
  const rng = mulberry32(seed);

  const companyName = settings?.companyName || "our restoration team";
  const agentName = rule.fromName || settings?.agentName || "your restoration partner";
  const agentPhone = settings?.agentPhone || "";
  const agentEmail = settings?.agentEmail || "";
  const audience = audienceOf(contact);
  const locality = neighborhoodCue(contact);
  const stormNice = stormLabel(storm.type);
  const focus = stormPrepFocus(storm.type);
  const eta = formatEta(new Date(storm.etaStart));
  const memories = buildMemoryBundle(contact, rng);
  const hasPersonalMemory = memories.used.length > 0;

  const opening = pick(
    rng,
    buildOpenings({
      firstName: contact.firstName,
      city: contact.city,
      stormNice,
      eta,
      locality,
      audience,
      companyName,
      familyCheckIn: memories.familyCheckIn,
    })
  );

  const context = pick(
    rng,
    buildContextLines({
      stormName: storm.name,
      stormNice,
      severity: storm.severity,
      eta,
      city: contact.city,
      state: contact.state,
      focus,
      audience,
      contactCompany: contact.company,
      description: storm.description,
    })
  );

  // Voice notes stay internal — bias closing/formality, never paste into customer copy
  const voice = (rule.voiceNotes || "").toLowerCase();
  const calm = /calm|neighbor|trusted|professional|warm/.test(voice);
  const urgent = /urgent|immediate|asap|severe/.test(voice);

  let offerPool = buildOfferLines({
    companyName,
    focus,
    audience,
    agentPhone,
  });
  if (urgent) {
    offerPool = [
      `Because timing is tight, I wanted you to have priority access with ${companyName} for ${focus}.${
        agentPhone ? ` Call/text me at ${agentPhone} and I’ll pick up.` : ""
      }`,
      ...offerPool,
    ];
  }
  const offer = pick(rng, offerPool);

  const personalDetail = locality
    ? pick(
        rng,
        calm
          ? [
              `I have you down near ${locality}, so I’m writing you personally about that property.`,
              `This note is just for you at ${locality} — not something we blasted to the whole region.`,
            ]
          : [
              `I have you listed around ${locality}, so this note is specific to that location — not a region-wide mailer.`,
              `This is going only to you for the ${locality} property, not a general list blast.`,
            ]
      )
    : pick(rng, [
        `I’m sending this only to you in ${contact.city}, not as a mass template.`,
        `You’re getting a one-to-one note because your property is in the expected path through ${contact.city}.`,
      ]);

  const memoryParagraphs = buildPersonalParagraphs(memories, rng);

  const closingPool = buildClosings({
    agentName,
    companyName,
    agentPhone,
    agentEmail,
  });
  if (contact.spouseName) {
    closingPool.unshift(
      `Stay safe — and give ${contact.spouseName} my best,\n${[
        agentName,
        companyName,
        agentPhone,
        agentEmail,
      ]
        .filter(Boolean)
        .join("\n")}`
    );
  }
  const closing = pick(rng, closingPool);

  const paragraphs = applyGuidance(
    [opening, ...memoryParagraphs, context, personalDetail, offer],
    rule.emailBody,
    rng
  );
  const body = [...paragraphs, closing].join("\n\n");

  let subject = pick(
    rng,
    buildSubjects({
      firstName: contact.firstName,
      city: contact.city,
      stormNice,
      companyName,
      stormName: storm.name,
      audience,
      spouseName: contact.spouseName,
      hasPersonalMemory,
    })
  );

  // If rule subject looks like guidance (no mustache or short), prefer agent subject;
  // if it has tokens, use as a soft preference only when rng says so.
  if (rule.emailSubject.includes("{{") && rng() > 0.55) {
    subject = renderTemplate(rule.emailSubject, {
      contact,
      storm,
      settings,
      fromName: rule.fromName,
    });
  }

  const brief = [
    `Audience: ${audience}`,
    locality ? `Local cue: ${locality}` : `City cue: ${contact.city}`,
    hasPersonalMemory
      ? `Personal memories used: ${memories.used.join(", ")}`
      : "No personal memories on file",
    contact.spouseName ? `Spouse: ${contact.spouseName}` : null,
    contact.familyNotes ? `Family: ${contact.familyNotes.slice(0, 60)}` : null,
    contact.personalTouch ? `Touch: ${contact.personalTouch.slice(0, 60)}` : null,
    contact.lastConversation
      ? `Last talk: ${contact.lastConversation.slice(0, 60)}`
      : null,
    `Storm angle: ${stormNice} / ${focus}`,
    "Writer: outreach agent (unique + personable, not a shared template)",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    subject,
    body,
    writingMode: "agent",
    personalizationBrief: brief,
  };
}

async function composeWithOpenAI(ctx: AgentContext): Promise<ComposedEmail | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const companyName = ctx.settings?.companyName || "our restoration team";
  const agentName = ctx.rule.fromName || ctx.settings?.agentName || "your restoration partner";
  const prompt = {
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.9,
    messages: [
      {
        role: "system",
        content:
          "You write short, professional, one-to-one restoration sales outreach emails. Never sound like a mass template. Always weave in personal memories the sales agent recorded (spouse/family, personal touches, last conversation) in a natural, personable way — like a human who actually remembers them. No emojis. No hype. Warm, competent, specific. Return JSON with keys subject, body, personalizationBrief.",
      },
      {
        role: "user",
        content: JSON.stringify({
          contact: {
            firstName: ctx.contact.firstName,
            lastName: ctx.contact.lastName,
            city: ctx.contact.city,
            state: ctx.contact.state,
            zip: ctx.contact.zip,
            address: ctx.contact.address,
            company: ctx.contact.company,
            spouseName: ctx.contact.spouseName,
            familyNotes: ctx.contact.familyNotes,
            personalTouch: ctx.contact.personalTouch,
            lastConversation: ctx.contact.lastConversation,
            notes: ctx.contact.notes,
          },
          storm: {
            name: ctx.storm.name,
            type: ctx.storm.type,
            severity: ctx.storm.severity,
            description: ctx.storm.description,
            etaStart: ctx.storm.etaStart,
          },
          sender: {
            companyName,
            agentName,
            agentPhone: ctx.settings?.agentPhone,
            agentEmail: ctx.settings?.agentEmail,
          },
          guidance: ctx.rule.emailBody,
          voiceNotes: ctx.rule.voiceNotes,
          subjectHint: ctx.rule.emailSubject,
        }),
      },
    ],
    response_format: { type: "json_object" },
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(prompt),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as {
      subject?: string;
      body?: string;
      personalizationBrief?: string;
    };
    if (!parsed.subject || !parsed.body) return null;
    return {
      subject: parsed.subject.trim(),
      body: parsed.body.trim(),
      writingMode: "agent",
      personalizationBrief:
        parsed.personalizationBrief?.trim() ||
        "Written by outreach agent via OpenAI for this contact only",
    };
  } catch {
    return null;
  }
}

export async function composeOutreachEmail(ctx: AgentContext): Promise<ComposedEmail> {
  const mode = (ctx.rule.writingMode || "agent").toLowerCase();

  if (mode === "template") {
    const templateCtx: TemplateContext = {
      contact: ctx.contact,
      storm: ctx.storm,
      settings: ctx.settings,
      fromName: ctx.rule.fromName,
    };
    return {
      subject: renderTemplate(ctx.rule.emailSubject, templateCtx),
      body: renderTemplate(ctx.rule.emailBody, templateCtx),
      writingMode: "template",
      personalizationBrief: "Literal template merge (writingMode=template)",
    };
  }

  const llm = await composeWithOpenAI(ctx);
  if (llm) return llm;
  return composeWithPhraseBanks(ctx);
}

export async function composeOutreachBatch(
  contacts: Contact[],
  storm: StormEvent,
  rule: AgentContext["rule"],
  settings: CompanySettings | null
): Promise<Map<string, ComposedEmail>> {
  const map = new Map<string, ComposedEmail>();
  for (const contact of contacts) {
    const composed = await composeOutreachEmail({ contact, storm, rule, settings });
    map.set(contact.id, composed);
  }
  return map;
}
