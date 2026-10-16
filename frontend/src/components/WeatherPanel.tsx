import { useEffect, useState } from "react";
import { CloudRain, CloudSun } from "lucide-react";
import Panel from "./Panel.tsx";
import "./WeatherPanel.css";

const WEATHER_URL =
  "https://imiq-public.et.uni-magdeburg.de/api/orion/entities/Sensor:Weather:Winfred";

interface Weather {
  temperature: number;
  rainIntensity: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readMeasurement(entity: Record<string, unknown>, name: string): number {
  const measurement = entity[name];
  if (
    !isRecord(measurement) ||
    typeof measurement.value !== "number" ||
    !Number.isFinite(measurement.value)
  ) {
    throw new Error(`Weather data is missing a valid ${name} value.`);
  }
  return measurement.value;
}

async function loadWeather(signal: AbortSignal): Promise<Weather> {
  const response = await fetch(WEATHER_URL, { signal });
  if (!response.ok) {
    throw new Error(`Weather service returned ${response.status}.`);
  }

  const data: unknown = await response.json();
  if (!isRecord(data)) {
    throw new Error("Weather service returned invalid data.");
  }

  return {
    temperature: readMeasurement(data, "temperature"),
    rainIntensity: readMeasurement(data, "rainIntensity"),
  };
}

export default function WeatherPanel() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void loadWeather(controller.signal)
      .then(setWeather)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Failed to load weather.");
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="weather-panel">
      <Panel>
        {error ? (
          <p className="weather-message" role="alert">{error}</p>
        ) : weather ? (
          <div className="weather-summary">
            {weather.rainIntensity > 0 ? (
              <CloudRain role="img" aria-label="Rain" />
            ) : (
              <CloudSun role="img" aria-label="No rain" />
            )}
            <span>{weather.temperature}°C</span>
          </div>
        ) : (
          <p className="weather-message" role="status">Loading weather...</p>
        )}
      </Panel>
    </div>
  );
}
