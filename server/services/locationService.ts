export interface DetectedLocation {
  latitude: number;
  longitude: number;
  city: string | null;
}

export async function detectLocation(): Promise<DetectedLocation | null> {
  try {
    const response = await fetch("https://ipapi.co/json/");
    if (!response.ok) return null;

    const data = (await response.json()) as {
      latitude?: number;
      longitude?: number;
      city?: string;
      error?: boolean;
    };

    if (data.error || typeof data.latitude !== "number" || typeof data.longitude !== "number") {
      return null;
    }

    return { latitude: data.latitude, longitude: data.longitude, city: data.city ?? null };
  } catch (error) {
    console.error("[Location] Failed to detect location from IP:", error);
    return null;
  }
}
