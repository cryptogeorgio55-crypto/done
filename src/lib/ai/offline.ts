import type { BusinessContext } from "./context";
import type {
  CampaignOutput,
  ContentOutput,
  ReplyOutput,
  FollowUpOutput,
  WeekPlanOutput,
  LazyPlan,
} from "./schemas";

// Deterministic, context-aware generators used when no LLM provider is
// configured. They read the Business Brain and produce genuinely tailored
// output — not lorem ipsum — so a zero-budget user still gets a working
// product. The UI labels this as "offline mode" so it's never mistaken for
// live AI generation.

function firstProduct(ctx: BusinessContext): string {
  return ctx.products[0]?.name || "your service";
}

function audienceLine(ctx: BusinessContext): string {
  return ctx.personas[0]?.label || "your ideal local customers";
}

function place(ctx: BusinessContext): string {
  return ctx.location || "your area";
}

export function offlineCampaign(ctx: BusinessContext, objective?: string): CampaignOutput {
  const product = firstProduct(ctx);
  const aud = audienceLine(ctx);
  const obj = objective || `Get more customers for ${ctx.businessName}`;
  const offer = `Book this week and get a special welcome offer on ${product}.`;
  return {
    title: `${ctx.businessName}: ${product} promotion`,
    objective: obj,
    audience: aud,
    offer,
    hook: `Looking for ${product} in ${place(ctx)}? We've got you.`,
    assets: [
      {
        kind: "instagram_post",
        title: "Feed post",
        body: `✨ ${ctx.businessName} is here for you.\n\nWe're making it easy to get ${product} this week. ${offer}\n\n📍 ${place(ctx)}\nTap the link or send us a message to book. Spots are limited!`,
      },
      {
        kind: "caption",
        title: "Caption",
        body: `Your ${product}, sorted. Book with ${ctx.businessName} this week and enjoy our welcome offer. Drop us a message to grab your spot. 💙`,
      },
      {
        kind: "story",
        title: "Story",
        body: `Swipe up / DM us "BOOK" to claim this week's ${product} offer at ${ctx.businessName}. Limited spots!`,
      },
      {
        kind: "reel",
        title: "Reel idea",
        body: `15s Reel: Quick before → after of ${product}. Text overlay: "This week only". End card: "Message us to book". Upbeat trending audio.`,
      },
      {
        kind: "whatsapp",
        title: "WhatsApp / DM message",
        body: `Hi! 👋 Thanks for your interest in ${ctx.businessName}. We have a welcome offer on ${product} this week. Would you like me to book you in? We have a few slots left.`,
      },
      {
        kind: "followup",
        title: "Follow-up (48h later)",
        body: `Hi again! Just checking in — the ${product} offer is still open for a couple more days. Want me to hold a slot for you?`,
      },
      {
        kind: "cta",
        title: "Call to action",
        body: `Message "${product.toUpperCase()}" to book your spot this week.`,
      },
      {
        kind: "checklist",
        title: "Execution checklist",
        body: `1. Post the feed image + caption.\n2. Add the Story with a DM sticker.\n3. Reply to every DM within an hour.\n4. Send the WhatsApp message to warm leads.\n5. Send the 48h follow-up to anyone who didn't reply.`,
      },
    ],
  };
}

const CONTENT_TEMPLATES: Record<string, (ctx: BusinessContext) => { title: string; body: string; hashtags: string[] }> = {
  instagram_post: (ctx) => ({
    title: `${firstProduct(ctx)} spotlight`,
    body: `✨ Meet your new favourite: ${firstProduct(ctx)} at ${ctx.businessName}.\n\n${ctx.description || "We put care into every detail."}\n\n📍 ${place(ctx)} — message us to book.`,
    hashtags: ["#local", "#smallbusiness", "#booknow"],
  }),
  promotional_post: (ctx) => ({
    title: "This week's offer",
    body: `🔥 This week only at ${ctx.businessName}: a special deal on ${firstProduct(ctx)}. Perfect for ${audienceLine(ctx)}. Limited spots — DM us to grab yours!`,
    hashtags: ["#offer", "#thisweek", "#local"],
  }),
  educational: (ctx) => ({
    title: `3 things about ${firstProduct(ctx)}`,
    body: `Did you know? Here are 3 quick tips about ${firstProduct(ctx)} from the team at ${ctx.businessName}:\n\n1. Preparation matters more than you think.\n2. Consistency beats intensity.\n3. Ask us anything — we're happy to help.\n\nSave this for later 💙`,
    hashtags: ["#tips", "#howto"],
  }),
  testimonial: (ctx) => ({
    title: "Client love",
    body: `"Honestly the best experience — ${ctx.businessName} made it so easy." ⭐️⭐️⭐️⭐️⭐️\n\nWe love hearing this. Want to be next? Message us to book ${firstProduct(ctx)}.`,
    hashtags: ["#reviews", "#happyclients"],
  }),
  reel_idea: (ctx) => ({
    title: "Reel idea",
    body: `15–20s Reel for ${ctx.businessName}:\nHook (0-2s): "Watch this ${firstProduct(ctx)} transformation"\nMiddle: quick process clips\nEnd: "Message us to book". Use a trending upbeat sound.`,
    hashtags: ["#reels", "#transformation"],
  }),
};

export function offlineContent(ctx: BusinessContext, type: string): ContentOutput {
  const factory = CONTENT_TEMPLATES[type] || CONTENT_TEMPLATES.instagram_post;
  const t = factory(ctx);
  return { type, title: t.title, body: t.body, hashtags: t.hashtags };
}

export function offlineReply(
  ctx: BusinessContext,
  customerMessage: string,
  mode: string
): ReplyOutput {
  const product = firstProduct(ctx);
  const msg = customerMessage.toLowerCase();
  let reply: string;
  if (mode === "price" || msg.includes("price") || msg.includes("cost") || msg.includes("how much")) {
    const priced = ctx.products.find((p) => p.price);
    reply = `Hi, thanks for reaching out to ${ctx.businessName}! ${
      priced ? `Our ${priced.name} is ${priced.price}.` : `Happy to share pricing for ${product}.`
    } Would you like me to book you in or answer anything else?`;
  } else if (mode === "availability" || msg.includes("available") || msg.includes("book") || msg.includes("appointment")) {
    reply = `Hi! Thanks for messaging ${ctx.businessName} 😊 Yes, we have availability this week for ${product}. What day works best for you and I'll get you booked in?`;
  } else if (mode === "complaint") {
    reply = `Hi, thank you for letting us know, and I'm really sorry to hear about this. That's not the experience we want you to have at ${ctx.businessName}. I'd love to make it right — could you share a few details so I can sort this for you personally?`;
  } else {
    reply = `Hi, thanks so much for getting in touch with ${ctx.businessName}! 😊 I'd be happy to help with that. ${
      mode === "sales" ? `Our ${product} is really popular right now — would you like me to book you in?` : "Let me know a little more and I'll take care of it for you."
    }`;
  }
  return { reply, tone: mode, notes: "Offline draft — review before sending." };
}

export function offlineFollowUp(
  ctx: BusinessContext,
  lead: { name?: string | null; stage?: string | null },
  mode?: string
): FollowUpOutput {
  const name = lead.name?.split(" ")[0] || "there";
  const product = firstProduct(ctx);
  const stage = mode || lead.stage || "followup";
  let message: string;
  if (stage === "new" || stage === "contacted") {
    message = `Hi ${name}! 👋 This is ${ctx.businessName}. Just following up on your interest in ${product}. Would you like me to book you a slot this week?`;
  } else if (stage === "interested") {
    message = `Hi ${name}, great chatting earlier! Whenever you're ready to go ahead with ${product}, I can hold a spot for you. Want me to pencil something in?`;
  } else {
    message = `Hi ${name}, hope you're well! Just checking in from ${ctx.businessName} — the offer on ${product} is still available if the timing's better now. Happy to book you in. 💙`;
  }
  return { message, channel: "whatsapp", reasoning: "Offline follow-up based on lead stage." };
}

export function offlineWeekPlan(ctx: BusinessContext): WeekPlanOutput {
  const product = firstProduct(ctx);
  return {
    summary: `A simple, doable week for ${ctx.businessName} focused on getting bookings for ${product} and staying visible.`,
    days: [
      { day: "Mon", focus: "Plan & post", tasks: [`Post a ${product} spotlight`, "Reply to weekend DMs"] },
      { day: "Tue", focus: "Educate", tasks: ["Share a quick tip post", "Save 3 content ideas"] },
      { day: "Wed", focus: "Promote", tasks: [`Launch this week's ${product} offer`, "Add a Story with a DM sticker"] },
      { day: "Thu", focus: "Follow up", tasks: ["Message leads who didn't reply", "Ask a happy client for a review"] },
      { day: "Fri", focus: "Convert", tasks: ["Post a testimonial", "Push remaining weekend slots"] },
      { day: "Sat", focus: "Engage", tasks: ["Behind-the-scenes Story", "Reply to every comment"] },
      { day: "Sun", focus: "Review", tasks: ["Check what performed", "Plan next week in DONE"] },
    ],
  };
}

export function offlineLazyPlan(
  ctx: BusinessContext,
  signals: { hasCampaigns: boolean; hasContent: boolean; dayName: string }
): LazyPlan {
  const product = firstProduct(ctx);
  // Decide the highest-value action from simple, explainable signals.
  if (!ctx.products.length) {
    return {
      objective: "Get your first piece of content live",
      reasoningSummary:
        "Your Business Brain is set up but there isn't much activity yet, so the highest-value move is a strong introductory post.",
      recommendedAction: "content",
      priority: "high",
      audience: audienceLine(ctx),
      message: `Let's get ${ctx.businessName} seen. I put together an introduction post to start attracting customers.`,
      executionSteps: ["Review the post", "Add a photo", "Publish and reply to comments"],
    };
  }
  if (!signals.hasCampaigns) {
    return {
      objective: `Launch a ${product} campaign to get customers`,
      reasoningSummary:
        "You haven't run a campaign yet. A focused promotion is the fastest way to turn attention into bookings.",
      recommendedAction: "campaign",
      priority: "high",
      audience: audienceLine(ctx),
      message: `I noticed you haven't run a campaign yet, so I created a complete ${product} campaign to get customers this week.`,
      executionSteps: ["Review each asset", "Post the feed + Story", "Send DMs to warm leads"],
    };
  }
  const weekend = ["Fri", "Sat"].includes(signals.dayName);
  if (weekend) {
    return {
      objective: "Fill weekend slots",
      reasoningSummary:
        "It's the end of the week — promoting weekend availability now captures last-minute bookings.",
      recommendedAction: "campaign",
      priority: "high",
      audience: audienceLine(ctx),
      message: `It's ${signals.dayName} — I created a quick weekend booking campaign to fill your remaining slots.`,
      executionSteps: ["Post the Story", "Message recent enquiries", "Reply fast to DMs"],
    };
  }
  return {
    objective: "Stay visible and plan the week",
    reasoningSummary:
      "You've got content and campaigns going. A clear weekly plan keeps momentum without extra effort.",
    recommendedAction: "week_plan",
    priority: "medium",
    audience: audienceLine(ctx),
    message: "You're in good shape. I mapped out a simple plan so this week runs itself.",
    executionSteps: ["Skim the plan", "Do one task today", "Come back tomorrow"],
  };
}
