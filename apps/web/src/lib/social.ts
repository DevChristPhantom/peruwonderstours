/** New-brand profiles must be confirmed; legacy profiles remain archived in seed data. */
export type SocialNetwork = "facebook" | "tripadvisor";
export const SOCIAL_LINKS: { network: SocialNetwork; url: string }[] = [];
