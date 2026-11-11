import { useEffect, useState } from "react";
import {
  Drumstick,
  Leaf,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";
import Panel from "./Panel.tsx";
import { translate, type Language, type TranslationKey } from "../i18n.ts";
import "./MensaMenuPanel.css";

const MENSA_URL =
  "https://imiq-public.et.uni-magdeburg.de/api/orion/entities/Rest:MensaUni";
const MENSA_REFRESH_INTERVAL = 30 * 60 * 1000;

interface MenuItem {
  nameGerman: string;
  nameEnglish: string;
  category: string;
}

interface DailyMenu {
  items: MenuItem[];
}

function getCategoryIcon(category: string): {
  Icon: LucideIcon;
  label: TranslationKey;
} {
  const normalizedCategory = category.toLowerCase();
  if (normalizedCategory.includes("alcohol") || normalizedCategory.includes("alkohol")) {
    return { Icon: Wine, label: "mensaCategoryAlcohol" };
  }
  if (
    normalizedCategory.includes("non-vegetarian") ||
    normalizedCategory.includes("fleisch")
  ) {
    return { Icon: Drumstick, label: "mensaCategoryMeat" };
  }
  if (normalizedCategory.includes("vegetar") || normalizedCategory.includes("vegan")) {
    return { Icon: Leaf, label: "mensaCategoryVegetarian" };
  }
  return { Icon: UtensilsCrossed, label: "mensaCategoryOther" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readMenuItem(value: unknown): MenuItem {
  if (!isRecord(value)) {
    throw new Error("Mensa service returned an invalid menu item.");
  }

  const {
    name_german: nameGerman,
    name_english: nameEnglish,
    category,
  } = value;
  if (
    typeof nameGerman !== "string" ||
    typeof nameEnglish !== "string" ||
    typeof category !== "string"
  ) {
    throw new Error("Mensa service returned an incomplete menu item.");
  }

  return { nameGerman, nameEnglish, category };
}

async function loadDailyMenu(signal: AbortSignal): Promise<DailyMenu> {
  const response = await fetch(MENSA_URL, { signal });
  if (!response.ok) {
    throw new Error(`Mensa service returned ${response.status}.`);
  }

  const data: unknown = await response.json();
  if (
    !isRecord(data) ||
    !isRecord(data.todaysMenu) ||
    !Array.isArray(data.todaysMenu.value)
  ) {
    throw new Error("Mensa service returned invalid menu data.");
  }

  return { items: data.todaysMenu.value.map(readMenuItem) };
}

interface MensaMenuPanelProps {
  language: Language;
}

export default function MensaMenuPanel({ language }: MensaMenuPanelProps) {
  const [menu, setMenu] = useState<DailyMenu | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const fetchMenu = () => {
      void loadDailyMenu(controller.signal)
        .then((nextMenu) => {
          setMenu(nextMenu);
          setHasError(false);
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            console.error("Failed to load today's Mensa menu:", reason);
            setHasError(true);
          }
        });
    };

    fetchMenu();
    const intervalId = window.setInterval(fetchMenu, MENSA_REFRESH_INTERVAL);

    return () => {
      window.clearInterval(intervalId);
      controller.abort();
    };
  }, []);

  return (
    <aside
      className="mensa-menu-panel"
      lang={language}
      aria-label={translate(language, "mensaMenuTitle")}
    >
      <Panel>
        <div className="mensa-menu-content">
          <h2>{translate(language, "mensaMenuTitle")}</h2>
          {hasError ? (
            <p className="mensa-menu-message" role="alert">
              {translate(language, "mensaMenuLoadError")}
            </p>
          ) : menu ? (
            menu.items.length > 0 ? (
              <ul className="mensa-menu-items">
                {menu.items.map((item, index) => {
                  const { Icon, label } = getCategoryIcon(item.category);
                  return (
                    <li className="mensa-menu-item" key={`${item.nameGerman}-${index}`}>
                      <Icon
                        className="mensa-menu-category-icon"
                        aria-label={translate(language, label)}
                        role="img"
                      />
                      <span className="mensa-menu-item-name">
                        {language === "de" ? item.nameGerman : item.nameEnglish}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mensa-menu-message">{translate(language, "noMensaMenu")}</p>
            )
          ) : (
            <p className="mensa-menu-message" role="status">
              {translate(language, "loadingMensaMenu")}
            </p>
          )}
        </div>
      </Panel>
    </aside>
  );
}
