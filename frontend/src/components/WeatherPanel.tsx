import { useEffect, useState } from "react";
import { CloudRain, CloudSun } from "lucide-react";
import Panel from "./Panel.tsx";
import { translate, type Language } from "../i18n.ts";
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

interface WeatherPanelProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
}

export default function WeatherPanel({ language, onLanguageChange }: WeatherPanelProps) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void loadWeather(controller.signal)
      .then(setWeather)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          console.error("Failed to load weather:", reason);
          setHasError(true);
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="weather-panel" lang={language}>
      <Panel>
        <a
          className="weather-brand"
          href="https://www.imr.ovgu.de/IMIQ.html"
          target="_blank"
          rel="noreferrer"
          aria-label="IMIQ – Intelligenter Mobilitätsraum im Quartier"
        >
          <span className="weather-brand-mark">IMIQ</span>
          <span className="weather-brand-name">
            Intelligenter Mobilitätsraum im Quartier
          </span>
        </a>
        {hasError ? (
          <p className="weather-message" role="alert">
            {translate(language, "weatherLoadError")}
          </p>
        ) : weather ? (
          <div className="weather-summary">
            {weather.rainIntensity > 0 ? (
              <CloudRain role="img" aria-label={translate(language, "rain")} />
            ) : (
              <CloudSun role="img" aria-label={translate(language, "dry")} />
            )}
            <span>{weather.temperature}°C</span>
          </div>
        ) : (
          <p className="weather-message" role="status">
            {translate(language, "loadingWeather")}
          </p>
        )}
        <div
          className="weather-language-toggle"
          role="group"
          aria-label={translate(language, "language")}
        >
          <button
            type="button"
            aria-label="Deutsch"
            aria-pressed={language === "de"}
            onClick={() => onLanguageChange("de")}
          >
            DE
          </button>
          <button
            type="button"
            aria-label="English"
            aria-pressed={language === "en"}
            onClick={() => onLanguageChange("en")}
          >
            EN
          </button>
        </div>
      </Panel>
    </div>
  );
}
