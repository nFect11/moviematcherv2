export function releaseYear(releaseDate: string | null) {
  return releaseDate ? releaseDate.slice(0, 4) : "Unknown";
}
