export const GENRE_OPTIONS = [
  { id: 28, label: "Action" },
  { id: 12, label: "Adventure" },
  { id: 16, label: "Animation" },
  { id: 35, label: "Comedy" },
  { id: 80, label: "Crime" },
  { id: 99, label: "Documentary" },
  { id: 18, label: "Drama" },
  { id: 10751, label: "Family" },
  { id: 14, label: "Fantasy" },
  { id: 36, label: "History" },
  { id: 27, label: "Horror" },
  { id: 10402, label: "Music" },
  { id: 9648, label: "Mystery" },
  { id: 10749, label: "Romance" },
  { id: 878, label: "Sci-Fi" },
  { id: 53, label: "Thriller" },
  { id: 10752, label: "War" }
] as const;

export const PROVIDER_OPTIONS = [
  "Netflix",
  "Amazon Prime Video",
  "Disney Plus",
  "Apple TV",
  "HBO",
  "Hulu",
  "Paramount Plus"
] as const;

export type SetupMode = "create" | "join";

interface PreferenceStepInfo {
  title: string;
  hint: string;
}

export const STEP_COPY: Record<SetupMode, PreferenceStepInfo[]> = {
  create: [
    {
      title: "Select genres you like",
      hint: "Pick the genres you want to prioritize."
    },
    {
      title: "Select genres you don't like",
      hint: "These genres will be filtered down in matching."
    },
    {
      title: "Select streaming providers you have",
      hint: "Only host selects providers for room filtering."
    }
  ],
  join: [
    {
      title: "Select genres you like",
      hint: "Pick the genres you want to prioritize."
    },
    {
      title: "Select genres you don't like",
      hint: "These genres will be filtered down in matching."
    }
  ]
};

export function setupLastStep(mode: SetupMode) {
  return mode === "create" ? 2 : 1;
}
