
/* =========================================
   ATMOS — LIVE WEATHER EXPERIENCE
   Open-Meteo Geocoding + Forecast APIs
========================================= */

"use strict";

// -----------------------------------------
// 1. API ENDPOINTS & DEFAULT LOCATION
// -----------------------------------------

const GEOCODING_API =
  "https://geocoding-api.open-meteo.com/v1/search";

const WEATHER_API =
  "https://api.open-meteo.com/v1/forecast";

const DEFAULT_LOCATION = {
  name: "Colombo",
  country: "Sri Lanka",
  latitude: 6.9271,
  longitude: 79.8612,
  timezone: "Asia/Colombo"
};

// -----------------------------------------
// 2. SELECT HTML ELEMENTS
// -----------------------------------------

const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const searchButton = document.getElementById("search-button");
const statusMessage = document.getElementById("status-message");

let activeLocation = DEFAULT_LOCATION;

// -----------------------------------------
// 3. HELPER FUNCTIONS
// -----------------------------------------

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function showStatus(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", type === "error");
}

function clearStatus() {
  statusMessage.textContent = "";
  statusMessage.classList.remove("error");
}

function formatNumber(value, decimals = 0) {
  const number = Number(value);

  if (value === null || value === undefined ||
      value === "" || !Number.isFinite(number)) {
    return "--";
  }

  return number.toFixed(decimals);
}

function formatTemperature(value) {
  const temperature = formatNumber(value);

  return temperature === "--" ? "--°" : `${temperature}°`;
}

function formatLocation(location) {
  return `${location.name}, ${location.country}`;
}

// -----------------------------------------
// 4. FETCH JSON WITH ERROR HANDLING
// -----------------------------------------

async function fetchJSON(url) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        `The weather service returned an error (${response.status}). Please try again.`
      );
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(
        data.reason || "The weather service could not process the request."
      );
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "The request took too long. Please check your connection and try again."
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        "Unable to connect to the weather service. Check your internet connection."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// -----------------------------------------
// 5. SEARCH FOR A CITY
// -----------------------------------------

async function searchCity(cityName) {
  const parameters = new URLSearchParams({
    name: cityName,
    count: "10",
    language: "en",
    format: "json"
  });

  const url = `${GEOCODING_API}?${parameters.toString()}`;

  const data = await fetchJSON(url);

  if (!Array.isArray(data.results) || data.results.length === 0) {
    throw new Error(
      `We couldn't find "${cityName}". Try another city or add its country.`
    );
  }

  // Prefer an exact city-name match when one is returned.
  const normalizedQuery = cityName.trim().toLocaleLowerCase();

  const exactMatch = data.results.find((place) =>
    place.name.toLocaleLowerCase() === normalizedQuery
  );

  const place = exactMatch || data.results[0];

  if (
    !Number.isFinite(place.latitude) ||
    !Number.isFinite(place.longitude)
  ) {
    throw new Error("Location coordinates are unavailable for this city.");
  }

  return {
    name: place.name,
    country: place.country || "Unknown country",
    admin1: place.admin1 || "",
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone || "auto"
  };
}

// -----------------------------------------
// 6. REQUEST CURRENT WEATHER + FORECAST
// -----------------------------------------

async function getWeather(location) {
  const parameters = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),

    // Current conditions
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m"
    ].join(","),

    // Hourly data gives us the UV index near the present time.
    hourly: "uv_index",

    // Daily forecast data
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "uv_index_max",
      "wind_speed_10m_max"
    ].join(","),

    forecast_days: "5",
    timezone: "auto",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh"
  });

  const url = `${WEATHER_API}?${parameters.toString()}`;

  const data = await fetchJSON(url);

  if (!data.current || !data.daily || !data.daily.time?.length) {
    throw new Error(
      "Weather data is incomplete. Please search again in a moment."
    );
  }

  return data;
}

// -----------------------------------------
// 7. WEATHER CODE INTERPRETATION
// WMO weather interpretation codes
// -----------------------------------------

function getWeatherInfo(code, isDay = 1) {
  const weatherCode = Number(code);

  if (weatherCode === 0) {
    return {
      label: "Clear sky",
      icon: Number(isDay) === 1 ? "☀️" : "🌙"
    };
  }

  if (weatherCode === 1) {
    return {
      label: "Mainly clear",
      icon: Number(isDay) === 1 ? "🌤️" : "🌙"
    };
  }

  if (weatherCode === 2) {
    return {
      label: "Partly cloudy",
      icon: "⛅"
    };
  }

  if (weatherCode === 3) {
    return {
      label: "Overcast",
      icon: "☁️"
    };
  }

  if ([45, 48].includes(weatherCode)) {
    return {
      label: "Fog",
      icon: "🌫️"
    };
  }

  if ([51, 53, 55].includes(weatherCode)) {
    return {
      label: "Drizzle",
      icon: "🌦️"
    };
  }

  if ([56, 57].includes(weatherCode)) {
    return {
      label: "Freezing drizzle",
      icon: "🌧️"
    };
  }

  if ([61, 63, 65].includes(weatherCode)) {
    return {
      label: "Rain",
      icon: "🌧️"
    };
  }

  if ([66, 67].includes(weatherCode)) {
    return {
      label: "Freezing rain",
      icon: "🌧️"
    };
  }

  if ([71, 73, 75, 77].includes(weatherCode)) {
    return {
      label: "Snowfall",
      icon: "❄️"
    };
  }

  if ([80, 81, 82].includes(weatherCode)) {
    return {
      label: "Rain showers",
      icon: "🌦️"
    };
  }

  if ([85, 86].includes(weatherCode)) {
    return {
      label: "Snow showers",
      icon: "🌨️"
    };
  }

  if (weatherCode === 95) {
    return {
      label: "Thunderstorm",
      icon: "⛈️"
    };
  }

  if ([96, 99].includes(weatherCode)) {
    return {
      label: "Thunderstorm with hail",
      icon: "⛈️"
    };
  }

  return {
    label: "Conditions unavailable",
    icon: "🌡️"
  };
}

// -----------------------------------------
// 8. CURRENT TIME & DATE
// -----------------------------------------

function formatWeatherDate(dateTime) {
  if (!dateTime) {
    return new Date().toLocaleDateString();
  }

  const datePart = dateTime.split("T")[0];
  const date = new Date(`${datePart}T12:00:00`);

  return date.toLocaleDateString("en", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function formatCityTime(timezone, fallbackTime) {
  try {
    if (timezone && timezone !== "auto") {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date());
    }
  } catch (error) {
    console.warn("Could not format the city's local time:", error);
  }

  return fallbackTime?.split("T")[1]?.slice(0, 5) || "--:--";
}

function getNearestHourlyValue(hourly, targetTime, field) {
  if (
    !hourly ||
    !Array.isArray(hourly.time) ||
    !Array.isArray(hourly[field]) ||
    !targetTime
  ) {
    return null;
  }

  // Prefer the same local date and hour.
  const targetHour = targetTime.slice(0, 13);

  let index = hourly.time.findIndex((time) =>
    time.startsWith(targetHour)
  );

  // Fall back to the closest available timestamp.
  if (index === -1) {
    const targetTimestamp = Date.parse(targetTime);

    let smallestDifference = Infinity;

    hourly.time.forEach((time, i) => {
      const timestamp = Date.parse(time);
      const difference = Math.abs(timestamp - targetTimestamp);

      if (
        Number.isFinite(difference) &&
        difference < smallestDifference
      ) {
        smallestDifference = difference;
        index = i;
      }
    });
  }

  return index >= 0 ? hourly[field][index] ?? null : null;
}

// -----------------------------------------
// 9. RENDER THE CURRENT WEATHER
// -----------------------------------------

function renderCurrentWeather(data, location) {
  const current = data.current;
  const daily = data.daily;
  const weather = getWeatherInfo(
    current.weather_code,
    current.is_day
  );

  const timezone = data.timezone || location.timezone;

  setText("location-name", formatLocation(location));
  setText("current-temperature", formatTemperature(current.temperature_2m));
  setText("current-condition", weather.label);
  setText("current-icon", weather.icon);

  setText(
    "feels-like",
    `${formatNumber(current.apparent_temperature)}°C`
  );

  setText("today-high", formatTemperature(daily.temperature_2m_max?.[0]));
  setText("today-low", formatTemperature(daily.temperature_2m_min?.[0]));

  setText("today-date", formatWeatherDate(current.time));
  setText("weather-date", formatWeatherDate(current.time));
  setText("local-time", formatCityTime(timezone, current.time));

  setText(
    "last-updated",
    `Updated ${new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    })}`
  );

  renderWeatherMetrics(data);
  renderForecast(daily);
  renderWeatherInsight(data, location);
}

// -----------------------------------------
// 10. RENDER WEATHER METRICS
// -----------------------------------------

function setBarWidth(id, value, maximum) {
  const bar = document.getElementById(id);

  if (!bar) {
    return;
  }

  const number = Number(value);

  if (value === null || value === undefined ||
      !Number.isFinite(number)) {
    bar.style.width = "0%";
    return;
  }

  const percentage = Math.min(
    100,
    Math.max(0, (number / maximum) * 100)
  );

  bar.style.width = `${percentage}%`;
}

function getWindDescription(speed) {
  if (!Number.isFinite(Number(speed))) {
    return "Wind information unavailable";
  }

  if (speed < 2) return "Calm conditions";
  if (speed < 12) return "Light breeze";
  if (speed < 29) return "Moderate breeze";
  if (speed < 50) return "Strong wind";

  return "Very strong wind";
}

function getUVDescription(uv) {
  if (!Number.isFinite(Number(uv))) {
    return "UV data unavailable";
  }

  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";

  return "Extreme";
}

function getCompassDirection(degrees) {
  const directions = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW"
  ];

  if (!Number.isFinite(Number(degrees))) {
    return "";
  }

  const index = Math.round(Number(degrees) / 22.5) % 16;

  return directions[index];
}

function renderWeatherMetrics(data) {
  const current = data.current;
  const daily = data.daily;

  const humidity = current.relative_humidity_2m;
  const wind = current.wind_speed_10m;
  const rain = current.precipitation;

  let uv = getNearestHourlyValue(
    data.hourly,
    current.time,
    "uv_index"
  );

  let uvDescription = "Current sun exposure level";

  // Use today's forecast maximum if hourly UV is unavailable.
  if (uv === null || uv === undefined) {
    uv = daily.uv_index_max?.[0] ?? null;
    uvDescription = "Today's peak UV forecast";
  }

  setText("humidity", formatNumber(humidity));
  setText("wind-speed", formatNumber(wind, 1));
  setText("precipitation", formatNumber(rain, 1));
  setText("uv-index", formatNumber(uv, 1));

  setText(
    "wind-description",
    getWindDescription(wind)
  );

  const compass = getCompassDirection(current.wind_direction_10m);

  if (compass) {
    setText(
      "wind-description",
      `${getWindDescription(wind)} · ${compass}`
    );
  }

  setText(
    "uv-description",
    `${uvDescription}: ${getUVDescription(uv)}`
  );

  setBarWidth("humidity-bar", humidity, 100);
  setBarWidth("wind-bar", wind, 50);
  setBarWidth("rain-bar", rain, 10);
  setBarWidth("uv-bar", uv, 11);
}

// -----------------------------------------
// 11. RENDER FIVE-DAY FORECAST
// -----------------------------------------

function renderForecast(daily) {
  const forecastGrid = document.getElementById("forecast-grid");

  if (!forecastGrid) {
    return;
  }

  const days = daily.time || [];

  if (days.length === 0) {
    forecastGrid.textContent = "Forecast information is unavailable.";
    return;
  }

  forecastGrid.replaceChildren();

  days.slice(0, 5).forEach((dateString, index) => {
    const weather = getWeatherInfo(daily.weather_code?.[index]);

    const date = new Date(`${dateString}T12:00:00`);

    const dayLabel = index === 0
      ? "Today"
      : date.toLocaleDateString("en", { weekday: "short" });

    const high = formatTemperature(
      daily.temperature_2m_max?.[index]
    );

    const low = formatTemperature(
      daily.temperature_2m_min?.[index]
    );

    const card = document.createElement("article");
    card.className = "forecast-card panel";

    const day = document.createElement("p");
    day.className = "forecast-day";
    day.textContent = dayLabel;

    const icon = document.createElement("span");
    icon.className = "forecast-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = weather.icon;

    const condition = document.createElement("p");
    condition.className = "forecast-condition";
    condition.textContent = weather.label;

    const temperatures = document.createElement("div");
    temperatures.className = "forecast-temperatures";

    const maximum = document.createElement("strong");
    maximum.textContent = high;

    const minimum = document.createElement("span");
    minimum.textContent = low;

    temperatures.append(maximum, minimum);
    card.append(day, icon, condition, temperatures);
    forecastGrid.appendChild(card);
  });
}

// -----------------------------------------
// 12. PERSONALIZED WEATHER INSIGHT
// -----------------------------------------

function renderWeatherInsight(data, location) {
  const current = data.current;
  const daily = data.daily;

  const weather = getWeatherInfo(
    current.weather_code,
    current.is_day
  );

  const wind = Number(current.wind_speed_10m);
  const humidity = Number(current.relative_humidity_2m);
  const precipitation = Number(current.precipitation);

  const uv = getNearestHourlyValue(
    data.hourly,
    current.time,
    "uv_index"
  );

  const dailyRainChance =
    daily.precipitation_probability_max?.[0];

  let message = `Conditions around ${location.name}: ${weather.label.toLowerCase()}.`;

  if ([95, 96, 99].includes(Number(current.weather_code))) {
    message = "Thunderstorm conditions are reported. Check local weather alerts before heading out.";
  } else if (precipitation >= 0.1) {
    message = "Precipitation is being reported now. Consider taking an umbrella when going out.";
  } else if (Number(dailyRainChance) >= 60) {
    message = `Rain is possible today, with a forecast precipitation probability of ${dailyRainChance}%.`;
  } else if (Number(uv) >= 8) {
    message = "The UV index is high. Consider sun protection when spending time outdoors.";
  } else if (wind >= 30) {
    message = "Winds are strong at the moment. Take extra care with outdoor activities.";
  } else if (humidity >= 80) {
    message = "Humidity is high, so the air may feel more humid than usual.";
  } else {
    message = `${weather.label} conditions around ${location.name}. Check the forecast below to plan your day.`;
  }

  const insight = document.getElementById("weather-insight");

  if (insight) {
    const icon = document.createElement("i");
    icon.setAttribute("data-lucide", "sparkles");

    const text = document.createElement("span");
    text.textContent = message;

    insight.replaceChildren(icon, text);

    // Refresh the Lucide icon inserted above.
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

// -----------------------------------------
// 13. MAIN WEATHER LOADING FUNCTION
// -----------------------------------------

async function loadWeather(location) {
  showStatus(`Fetching live weather for ${location.name}...`);

  try {
    const data = await getWeather(location);

    // Update the selected location only after a successful response.
    activeLocation = location;

    renderCurrentWeather(data, location);

    clearStatus();
  } catch (error) {
    console.error("Weather loading error:", error);

    showStatus(
      error.message || "Something went wrong while loading the weather.",
      "error"
    );
  }
}

// -----------------------------------------
// 14. SEARCH FORM EVENT
// -----------------------------------------

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const cityName = cityInput.value.trim();

  if (cityName.length < 2) {
    showStatus("Please enter at least two characters for a city name.", "error");
    cityInput.focus();
    return;
  }

  const originalButtonText = searchButton.textContent;

  searchButton.disabled = true;
  searchButton.textContent = "Searching...";

  try {
    showStatus(`Searching for ${cityName}...`);

    const location = await searchCity(cityName);

    await loadWeather(location);

    if (activeLocation === location) {
      cityInput.value = "";
    }
  } catch (error) {
    console.error("City search error:", error);

    showStatus(
      error.message || "City search failed. Please try again.",
      "error"
    );
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = originalButtonText;
  }
});

// -----------------------------------------
// 15. NAVIGATION ACTIVE STATE
// -----------------------------------------

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((item) => {
      item.classList.remove("active");
    });

    link.classList.add("active");
  });
});

// -----------------------------------------
// 16. START THE APPLICATION
// -----------------------------------------

loadWeather(DEFAULT_LOCATION);