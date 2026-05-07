const PROHIBITED_ITEMS = [
  "weapon", "knife", "parang", "gun", "pistol", "rifle", "explosive", "bomb",
  "grenade", "ammo", "ammunition", "firearm", "blade",
  "drug", "weed", "cannabis", "marijuana", "cocaine", "heroin", "meth",
  "ecstasy", "mdma", "ketamine", "ganja", "dadah",
  "porn", "pornography", "sex toy", "dildo", "vibrator", "adult toy",
  "fake id", "fake ic", "counterfeit", "pirated", "bootleg",
  "lottery ticket", "sports bet", "gambling",
];

const INAPPROPRIATE_LANGUAGE = [
  "fuck", "shit", "asshole", "bastard", "bitch", "cunt", "dick", "pussy",
  "nigger", "nigga", "faggot", "retard", "whore", "slut",
  "bodoh", "babi", "puki", "lancau", "sial", "celaka", "anjing", "bangsat",
  "tmd", "nmsl", "sb",
];

export interface FilterResult {
  passed: boolean;
  reason?: string;
}

export function checkContent(title: string, description: string): FilterResult {
  const combined = `${title} ${description}`.toLowerCase();

  for (const word of PROHIBITED_ITEMS) {
    const regex = new RegExp(`\\b${word.replace(/[-]/g, "[-\\s]?")}\\b`, "i");
    if (regex.test(combined)) {
      return {
        passed: false,
        reason: `Your listing appears to contain a prohibited item or keyword: "${word}". Please review our community guidelines.`,
      };
    }
  }

  for (const word of INAPPROPRIATE_LANGUAGE) {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(combined)) {
      return {
        passed: false,
        reason: "Your listing contains inappropriate language. Please keep the marketplace respectful.",
      };
    }
  }

  return { passed: true };
}
