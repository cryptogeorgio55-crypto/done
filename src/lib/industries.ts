// Industry presets. These bias suggestions and AI guidance but never hard-code
// the product to a single vertical. Add more freely.

export interface IndustryPreset {
  key: string;
  label: string;
  defaultGoals: string[]; // goal keys
  suggestedContentTypes: string[];
  commonCampaigns: string[];
  aiGuidance: string;
}

export const INDUSTRIES: IndustryPreset[] = [
  {
    key: "beauty_salon",
    label: "Beauty / Nail / Hair Salon",
    defaultGoals: ["bookings", "repeat", "engagement"],
    suggestedContentTypes: ["before_after", "reel_idea", "promotional_post", "testimonial"],
    commonCampaigns: ["Weekend bookings", "New client offer", "Refer-a-friend"],
    aiGuidance:
      "Emphasize visual transformation, booking urgency, and trust. Encourage before/after and client results. Keep it warm and confidence-boosting.",
  },
  {
    key: "barber",
    label: "Barbershop",
    defaultGoals: ["bookings", "repeat"],
    suggestedContentTypes: ["reel_idea", "before_after", "promotional_post"],
    commonCampaigns: ["Fresh cut Fridays", "Student discount", "Walk-in slots"],
    aiGuidance: "Confident, sharp, community-focused tone. Highlight clean fades and quick booking.",
  },
  {
    key: "restaurant_cafe",
    label: "Restaurant / Café",
    defaultGoals: ["sales", "awareness", "repeat"],
    suggestedContentTypes: ["promotional_post", "reel_idea", "announcement", "seasonal"],
    commonCampaigns: ["Weekend brunch", "New menu launch", "Happy hour"],
    aiGuidance:
      "Appetite-appeal language, sensory descriptions, clear specials and times. Drive footfall and reservations.",
  },
  {
    key: "clothing_store",
    label: "Clothing / Retail Store",
    defaultGoals: ["sales", "awareness"],
    suggestedContentTypes: ["product_spotlight", "promotional_post", "reel_idea", "seasonal"],
    commonCampaigns: ["New arrivals", "Seasonal sale", "Style guide"],
    aiGuidance: "Trend-aware, aspirational but accessible. Showcase products and limited-time drops.",
  },
  {
    key: "ecommerce",
    label: "Ecommerce",
    defaultGoals: ["sales", "leads"],
    suggestedContentTypes: ["product_spotlight", "promotional_post", "ad", "educational"],
    commonCampaigns: ["Bestseller push", "Cart recovery offer", "Bundle deal"],
    aiGuidance: "Benefit-led, conversion-focused copy with clear CTAs and social proof.",
  },
  {
    key: "gym_fitness",
    label: "Gym / Personal Trainer",
    defaultGoals: ["leads", "bookings", "awareness"],
    suggestedContentTypes: ["educational", "testimonial", "reel_idea", "promotional_post"],
    commonCampaigns: ["Free trial week", "Transformation challenge", "New member offer"],
    aiGuidance: "Motivational, results-driven, supportive. Emphasize transformation and community.",
  },
  {
    key: "clinic",
    label: "Clinic / Health Service",
    defaultGoals: ["bookings", "awareness", "leads"],
    suggestedContentTypes: ["educational", "testimonial", "announcement"],
    commonCampaigns: ["New patient offer", "Health awareness", "Seasonal checkup"],
    aiGuidance:
      "Professional, reassuring, credible. Avoid overclaiming. Focus on care, expertise and easy booking.",
  },
  {
    key: "service_business",
    label: "Service Business (other)",
    defaultGoals: ["leads", "bookings"],
    suggestedContentTypes: ["educational", "testimonial", "promotional_post"],
    commonCampaigns: ["Quote offer", "Seasonal service", "Referral program"],
    aiGuidance: "Trust-building, clear value, strong calls to action for enquiries and quotes.",
  },
];

export const INDUSTRY_MAP: Record<string, IndustryPreset> = Object.fromEntries(
  INDUSTRIES.map((i) => [i.key, i])
);

export function getIndustry(key?: string | null): IndustryPreset | undefined {
  if (!key) return undefined;
  return INDUSTRY_MAP[key];
}
