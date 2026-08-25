export type WeatherContext = {
  temperatureF: number;
  feelsLikeF: number;
  precipitationProbability: number;
  rainNow: boolean;
  severe: boolean;
  outdoorQuality: "great" | "okay" | "poor";
  summary: string;
};

export async function getWeatherContext(lat: number, lng: number): Promise<WeatherContext | null> {
  const params = new URLSearchParams({
    latitude: String(lat), longitude: String(lng), timezone: "auto",
    current: "temperature_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m",
    hourly: "precipitation_probability,weather_code,temperature_2m,apparent_temperature",
    forecast_days: "1",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
  const data = await response.json();
  const current = data.current;
  const hourly = data.hourly;
  const now = new Date();
  const currentIndex = Math.max(0, hourly.time.findIndex((value: string) => new Date(value).getTime() >= now.getTime()));
  const probabilities = (hourly.precipitation_probability ?? []).slice(currentIndex, currentIndex + 4);
  const maxRain = Math.max(0, ...probabilities);
  const code = Number(current.weather_code ?? 0);
  const severe = [65, 66, 67, 77, 80, 81, 82, 95, 96, 99].includes(code);
  const temp = Number(current.temperature_2m ?? 75);
  const rainNow = Number(current.precipitation ?? 0) > 0 || Number(current.rain ?? 0) > 0;
  const poor = severe || rainNow || maxRain >= 60 || temp >= 94 || temp <= 45;
  const okay = !poor && (maxRain >= 30 || temp >= 88 || temp <= 55);
  return {
    temperatureF: temp,
    feelsLikeF: Number(current.apparent_temperature ?? temp),
    precipitationProbability: maxRain,
    rainNow,
    severe,
    outdoorQuality: poor ? "poor" : okay ? "okay" : "great",
    summary: severe ? "Severe weather is possible, so I'm prioritizing indoor options." : rainNow || maxRain >= 60 ? "Rain is likely, so I'm prioritizing reliable indoor options." : temp >= 94 ? "It's very hot, so I'm prioritizing cooler options." : temp >= 88 ? "It's warm today, so I'm balancing shade and indoor options." : "Conditions look good for getting outside.",
  };
}
