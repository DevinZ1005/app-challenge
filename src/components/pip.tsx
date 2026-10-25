"use client";
import { useState } from "react";
import { useApp } from "./context";

export function Pip({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={"pip " + (small ? "pip-small" : "")}
      viewBox="0 0 240 240"
      aria-hidden="true"
    >
      <ellipse cx="120" cy="219" rx="63" ry="10" fill="#d7e2cd" />
      <g className="pip-bounce">
        <path
          d="M119 74Q117 38 91 28Q72 27 69 43Q78 68 119 63"
          fill="#347749"
        />
        <path d="M120 67Q132 23 174 26Q182 60 120 67" fill="#80b957" />
        <path
          d="M119 80Q119 54 146 43"
          fill="none"
          stroke="#245c46"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M70 142Q38 143 37 163"
          fill="none"
          stroke="#94bd63"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          className="pip-wave"
          d="M171 141Q200 134 201 112"
          fill="none"
          stroke="#94bd63"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M95 194L88 210M145 194L152 210"
          stroke="#42784c"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <path
          d="M65 133Q62 75 120 72Q178 75 175 133L170 166Q165 201 120 202Q75 201 70 166Z"
          fill="#bbdb88"
          stroke="#94bd63"
          strokeWidth="3"
        />
        <path
          d="M80 115Q84 91 104 87"
          stroke="#e6f2cc"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />
        <g className="pip-eyes" fill="#234b36">
          <ellipse cx="99" cy="134" rx="5" ry="8" />
          <ellipse cx="141" cy="134" rx="5" ry="8" />
        </g>
        <ellipse cx="84" cy="151" rx="10" ry="6" fill="#eca28b" />
        <ellipse cx="156" cy="151" rx="10" ry="6" fill="#eca28b" />
        <path
          d="M109 151Q120 164 131 151"
          stroke="#234b36"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M120 186C99 175 111 166 120 175C129 166 141 175 120 186"
          fill="#f8f7e7"
        />
      </g>
    </svg>
  );
}

export function PipTips() {
  const { locale, preferences } = useApp();
  const [topic, setTopic] = useState("budget");
  const en = locale === "en";
  const shelf =
    preferences.shelfStable ||
    preferences.refrigeration === "no" ||
    preferences.refrigeration === "limited";
  const noCook =
    !preferences.equipment.length || preferences.equipment.includes("none");
  const answers: Record<string, string> = en
    ? {
        budget:
          "One small swap is a great start. When buying groceries, compare unit prices on beans, oats and seasonal produce. Pantry staples count, too—choose what fits your budget and what you enjoy.",
        easy: noCook
          ? "No stove? Try ready-to-eat, lower-sodium beans with whole-grain crackers and a piece of fruit. Check preparation instructions and choose portions you can finish if you cannot refrigerate leftovers."
          : "Have cooking equipment? Oats, lentils and whole grains can be affordable meal starters. Add vegetables you enjoy and follow the package cooking directions.",
        storage: shelf
          ? "Let’s keep it practical: look for lower-sodium canned vegetables and fruit packed in water or its own juice. Check the label—shelf-stable foods may need refrigeration after opening."
          : "If you have freezer space, frozen vegetables can be a handy option. Otherwise, buy a small amount of fresh produce you can use soon, or choose canned options.",
      }
    : {
        budget:
          "Un pequeño cambio es un buen comienzo. Al comprar, compara precios por unidad de frijoles, avena y productos de temporada. Elige lo que te gusta y se ajusta a tu presupuesto.",
        easy: noCook
          ? "¿Sin estufa? Prueba frijoles listos para comer con menos sodio, galletas integrales y fruta. Revisa las instrucciones y elige porciones que puedas terminar si no puedes refrigerar las sobras."
          : "La avena, las lentejas y los granos integrales pueden ser opciones económicas. Añade verduras que te gusten y sigue las instrucciones de cocción.",
        storage: shelf
          ? "Busca verduras enlatadas con menos sodio y fruta en agua o en su propio jugo. Revisa la etiqueta: algunos alimentos necesitan refrigeración después de abrirlos."
          : "Si tienes congelador, las verduras congeladas pueden ser útiles. También puedes comprar cantidades pequeñas de verduras frescas o elegir opciones enlatadas.",
      };
  return (
    <section
      className="pip-tips"
      aria-label={en ? "Chat with Pip" : "Charla con Pip"}
    >
      <Pip small />
      <div>
        <span className="eyebrow">
          PIP · {en ? "YOUR FOOD BUDDY" : "TU COMPAÑERO"}
        </span>
        <h2>
          {en
            ? "A little healthier, one choice at a time."
            : "Un poquito más saludable, paso a paso."}
        </h2>
        <p role="status" aria-live="polite">
          {answers[topic]}
        </p>
        <div className="pip-prompts">
          {[
            [
              "budget",
              en ? "Help me shop on a budget" : "Comprar con poco presupuesto",
            ],
            ["easy", en ? "An easy food idea?" : "¿Una idea fácil?"],
            ["storage", en ? "What will keep well?" : "¿Qué se conserva bien?"],
          ].map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={topic === id}
              onClick={() => setTopic(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="small-text pip-note">
          {en
            ? "Pip is a guided helper with prepared tips. Check ingredients for your dietary needs; availability and prices vary."
            : "Pip es un guía con consejos preparados. Revisa los ingredientes según tus necesidades; los precios y la disponibilidad varían."}
        </p>
        <a
          className="text-link"
          href="https://www.nyc.gov/site/doh/health/health-topics/whole-foods.page"
          target="_blank"
          rel="noopener noreferrer"
        >
          {en
            ? "More food tips from NYC Health ↗"
            : "Más consejos de NYC Health ↗"}
        </a>
      </div>
    </section>
  );
}
