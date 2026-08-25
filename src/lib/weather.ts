export type WeatherContext = {
  temperatureF: number;
  feelsLikeF: number;
  precipitationProbability: number;
  isRaining: boolean;
  isSevere: boolean;
  isHot: boolean;
  outdoorScore: number;
  label: string;
  recommendation: string;
};

function weatherLabel(code: number) {
  if (code >= 95) return "Severe weather";
  if (code >= 80) return "Showers";
  if (code >= 71) return "Snow";
  if (code >= 61) return "Rain";
  if (code >= 51) return "Drizzle";
  if (code >= 45) return "Foggy";
  if (code >= 1) return "Partly cloudy";
  return "Clear";
}

export async function getWeatherContext(lat: number, lng: number): Promise<WeatherContext | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("current", "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m");
  url.searchParams.set("hourly", "precipitation_probability,weather_code,temperature_2m,apparent_temperature");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "auto");

  try {
    const response = await fetch(url, { next: { revalidate: 900 } });
    if (!response.ok) return null;
    const data = await response.json();
    const current = data.current;
    const hourly = data.hourly;
    const now = new Date();
    const currentHour = now.getHours();
    const probabilities = Array.isArray(hourly?.precipitation_probability)
      ? hourly.precipitation_probability.slice(currentHour, currentHour + 6)
      : [];
    const precipitationProbability = Math.max(0, ...probabilities.map(Number));
    const temperatureF = Number(current.temperature_2m);
    const feelsLikeF = Number(current.apparent_temperature);
    const code = Number(current.weather_code);
    const isRaining = Number(current.precipitation) > 0 || (code >= 51 && code <= 82) || precipitationProbability >= 60;
    const isSevere = code >= 95;
    const isHot = feelsLikeF >= 90;

    let outdoorScore = 100;
    if (isSevere) outdoorScore = 5;
    else {
      if (isRaining) outdoorScore -= 45;
      if (isHot) outdoorScore -= Math.min(35, Math.round((feelsLikeF - 89) * 3));
      if (feelsLikeF < 45) outdoorScore -= 15;
      if (precipitationProbability >= 60) outdoorScore -= 20;
    }
    outdoorScore = Math.max(0, Math.min(100, outdoorScore));

    let recommendation = "Outdoor plans look good today.";
    if (isSevere) recommendation = "Skip outdoor plans and prioritize safe indoor options.";
    else if (isHot && isRaining) recommendation = "It's hot and rain is possible, so prioritize indoor or water-friendly options.";
    else if (isHot) recommendation = "It's hot today, so prioritize indoor, shaded, or water-friendly options.";
    else if (isRaining) recommendation = "Rain is likely, so prioritize indoor options and keep outdoor plans flexible.";
    else if (outdoorScore < 70) recommendation = "Outdoor plans are possible, but an indoor backup is worth having.";

    return {
      temperatureF,
      feelsLikeF,
      precipitationProbability,
      isRaining,
      isSevere,
      isHot,
      outdoorScore,
      label: weatherLabel(code),
      recommendation,
    };
  } catch {
    return null;
  }
}
