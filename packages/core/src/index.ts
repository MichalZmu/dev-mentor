export interface ApplicationInfo {
  name: string;
  description: string;
}

export const applicationInfo: Readonly<ApplicationInfo> = Object.freeze({
  name: "DevMentor",
  description: "Przestrzeń do rozwijania umiejętności programistycznych.",
});

export interface RequestMetadata {
  id: string;
}
