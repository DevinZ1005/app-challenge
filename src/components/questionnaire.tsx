"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Navigation,
  Footprints,
  Bus,
  ShieldCheck,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";
import {
  householdSchema,
  type HouseholdPreferences,
  type TimeInterval,
} from "@/lib/model";
import { useApp } from "./context";
import { SuggestedInput } from "./suggested-input";
import { parseTimeInput } from "@/lib/time-input";
import { Pip } from "./pip";
const periods = [
  { key: "morning", start: 480, end: 720 },
  { key: "afternoon", start: 720, end: 1020 },
  { key: "evening", start: 1020, end: 1260 },
] as const;
const clock = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
export function Questionnaire() {
  const { t, locale, preferences, setPreferences } = useApp();
  const en = locale === "en";
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [customDay, setCustomDay] = useState(0);
  const [minimum, setMinimum] = useState(String(preferences.minMinutes));
  const [maximum, setMaximum] = useState(String(preferences.maxMinutes));
  const [start, setStart] = useState("9:00 AM");
  const [end, setEnd] = useState("12:00 PM");
  const [answers, setAnswers] = useState<Record<number, HouseholdPreferences>>(
    {},
  );
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [step]);
  const { register, watch, setValue, getValues } =
    useForm<HouseholdPreferences>({ defaultValues: preferences });
  const values = watch();
  const titles = [
    t.locationTitle,
    t.travelTitle,
    t.availabilityTitle,
    t.equipmentTitle,
    t.storageTitle,
    t.dietTitle,
  ];
  const questions = en
    ? [
        "Hi, I’m Pip! Where should we look for food near you?",
        "How do you like to get around, and how much time works for you?",
        "When can you pick up food? Let’s find a time that fits your day.",
        "What can you cook with? I’ll keep your kitchen in mind.",
        "Do you have room to keep food cold?",
        "One last thing: any food preferences you’d like me to consider?",
      ]
    : [
        "¡Hola, soy Pip! ¿Dónde buscamos comida cerca de ti?",
        "¿Cómo te desplazas y cuánto tiempo te viene bien?",
        "¿Cuándo puedes recoger comida? Busquemos un horario que te convenga.",
        "¿Con qué puedes cocinar? Tendré tu cocina en cuenta.",
        "¿Tienes espacio para mantener la comida fría?",
        "Una última cosa: ¿qué preferencias de comida quieres que considere?",
      ];
  const encouragement = en
    ? [
        "A ZIP code is enough to start. Share only what feels comfortable.",
        "Short trips count! You can type your own range or pick an example.",
        "Pick as many windows as you like. We’ll work around you.",
        "No stove? No problem. There are nourishing foods you can enjoy without cooking.",
        "Canned vegetables and fruit in its own juice can be handy when fridge space is tight.",
        "Your choices matter. I’ll help you compare options, and you can always change your answers.",
      ]
    : [
        "Un código postal es suficiente. Comparte solo lo que te resulte cómodo.",
        "¡Los viajes cortos cuentan! Escribe tu intervalo o elige un ejemplo.",
        "Elige los horarios que quieras. Nos adaptamos a ti.",
        "¿Sin estufa? No pasa nada. Hay alimentos nutritivos que no necesitan cocción.",
        "Las verduras enlatadas y la fruta en su jugo pueden ser útiles si falta espacio en el refrigerador.",
        "Tus preferencias importan. Te ayudaré a comparar opciones y puedes cambiar tus respuestas.",
      ];
  function answerText(index: number, p: HouseholdPreferences) {
    return [
      p.zip,
      `${t[p.mode]} · ${p.minMinutes}–${p.maxMinutes} ${t.minutes}`,
      p.availability.length
        ? `${p.availability.length} ${en ? "pickup windows selected" : "horarios seleccionados"}`
        : en
          ? "My schedule is flexible"
          : "Mi horario es flexible",
      p.equipment.length
        ? p.equipment.map((item) => t[item]).join(", ")
        : t.preferNot,
      `${t[p.refrigeration]}${p.shelfStable ? " · " + t.shelfPreference : ""}`,
      p.diet === "none" ? t.noPreference : t[p.diet],
    ][index];
  }
  function commit() {
    const min = /^\d+$/.test(minimum.trim()) ? Number(minimum) : NaN;
    const max = /^\d+$/.test(maximum.trim()) ? Number(maximum) : NaN;
    if (
      !Number.isInteger(min) ||
      !Number.isInteger(max) ||
      min < 0 ||
      max < 1 ||
      max > 180 ||
      min > max
    ) {
      setError(t.rangeError);
      return false;
    }
    const parsed = householdSchema.safeParse({
      ...getValues(),
      minMinutes: min,
      maxMinutes: max,
    });
    if (!parsed.success) {
      setError(t.validation);
      return false;
    }
    setPreferences(parsed.data);
    setError("");
    return true;
  }
  function move(next: number) {
    if (commit()) {
      if (next > step)
        setAnswers((old) => ({
          ...old,
          [step]: {
            ...getValues(),
            minMinutes: Number(minimum),
            maxMinutes: Number(maximum),
          },
        }));
      setStep(next);
    }
  }
  function toggleInterval(interval: TimeInterval) {
    const current = getValues("availability");
    const exists = current.some(
      (v) =>
        v.day === interval.day &&
        v.start === interval.start &&
        v.end === interval.end,
    );
    setValue(
      "availability",
      exists
        ? current.filter(
            (v) =>
              !(
                v.day === interval.day &&
                v.start === interval.start &&
                v.end === interval.end
              ),
          )
        : [...current, interval],
    );
  }
  function addCustom() {
    const startMinute = parseTimeInput(start);
    const endMinute = parseTimeInput(end, true);
    if (
      startMinute === null ||
      endMinute === null ||
      endMinute <= startMinute
    ) {
      setError(t.timeError);
      return;
    }
    toggleInterval({ day: customDay, start: startMinute, end: endMinute });
    setError("");
  }
  function locate() {
    if (!navigator.geolocation) {
      setLocationMessage(t.locationError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue("location", {
          lat: Math.round(pos.coords.latitude * 1000) / 1000,
          lng: Math.round(pos.coords.longitude * 1000) / 1000,
        });
        setLocationMessage(t.locationSuccess);
      },
      () => setLocationMessage(t.locationError),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }
  async function finish() {
    if (!commit()) return;
    setBusy(true);
    router.push("/results");
  }
  return (
    <section className="container questionnaire-page">
      <div className="pip-chat-heading">
        <Pip small />
        <div>
          <span className="eyebrow">PIP · PANTRYFIT</span>
          <h1>
            {en
              ? "A little chat. A better food fit."
              : "Una charla. Comida a tu medida."}
          </h1>
          <p>
            {en
              ? "Your food buddy, one question at a time."
              : "Tu compañero, una pregunta a la vez."}
          </p>
        </div>
      </div>
      <div className="pip-chat-layout">
        <nav
          className="chat-steps"
          aria-label={en ? "Conversation steps" : "Pasos de la conversación"}
        >
          {titles.map((title, i) => (
            <button
              key={title}
              type="button"
              onClick={() => move(i)}
              aria-current={i === step ? "step" : undefined}
              aria-label={`${i + 1}. ${title}`}
              className={i === step ? "active" : ""}
            >
              {i < step ? <Check size={15} /> : i + 1}
            </button>
          ))}
          <span>
            <ShieldCheck size={15} />
            {t.private}
          </span>
        </nav>
        {step > 0 && (
          <div
            className="chat-history"
            role="log"
            aria-live="off"
            aria-label={
              en ? "Your conversation with Pip" : "Tu conversación con Pip"
            }
          >
            {Object.entries(answers)
              .filter(([i]) => Number(i) < step)
              .map(([i, answer]) => (
                <div key={i} className="chat-exchange">
                  <p className="chat-past-question">
                    <strong>Pip</strong>
                    {questions[Number(i)]}
                  </p>
                  <p className="chat-user">
                    <span>{en ? "You" : "Tú"}</span>
                    {answerText(Number(i), answer)}
                    <button type="button" onClick={() => move(Number(i))}>
                      {en ? "Edit" : "Editar"}
                    </button>
                  </p>
                </div>
              ))}
          </div>
        )}
        <form
          className="question-card pip-question-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 5) {
              move(step + 1);
            } else {
              void finish();
            }
          }}
          noValidate
        >
          <div className="progress-label">
            <span>
              {t.step} {step + 1} {t.of} 6
            </span>
            <span>{Math.round(((step + 1) / 6) * 100)}%</span>
          </div>
          <div className="progress-track">
            <span style={{ width: `${((step + 1) / 6) * 100}%` }} />
          </div>
          <div className="pip-message" key={step}>
            <Pip small />
            <div className="pip-bubble">
              <span className="eyebrow">PIP</span>
              <h2 id="question-title" ref={titleRef} tabIndex={-1}>
                {questions[step]}
              </h2>
              <p>{encouragement[step]}</p>
            </div>
          </div>
          <p className="chat-reply-label">
            {en ? "YOUR REPLY" : "TU RESPUESTA"}
          </p>
          {step === 0 && (
            <div className="form-section">
              <p>{t.locationText}</p>
              <label>
                {t.zip}
                <input
                  inputMode="numeric"
                  maxLength={5}
                  {...register("zip")}
                  aria-invalid={!!error}
                />
              </label>
              <label>
                {t.landmark}
                <input
                  {...register("landmark")}
                  maxLength={120}
                  placeholder="Bedford Park"
                />
              </label>
              <button
                className="button secondary full"
                type="button"
                onClick={locate}
              >
                <Navigation size={17} />
                {t.locate}
              </button>
              {locationMessage && <p role="status">{locationMessage}</p>}
              <div className="notice">{t.locationLimit}</div>
            </div>
          )}
          {step === 1 && (
            <div className="form-section">
              <fieldset className="choice-grid">
                <legend className="sr-only">{t.travelTitle}</legend>
                {(["walking", "transit", "either"] as const).map((mode, i) => {
                  const Icon = [Footprints, Bus, Navigation][i];
                  return (
                    <label
                      className={
                        "choice " + (values.mode === mode ? "selected" : "")
                      }
                      key={mode}
                    >
                      <input type="radio" value={mode} {...register("mode")} />
                      <Icon size={25} />
                      <span>{t[mode]}</span>
                      {values.mode === mode && <Check size={15} />}
                    </label>
                  );
                })}
              </fieldset>
              <fieldset className="range-fieldset">
                <legend>
                  {t.travelRange} ({t.minutes})
                </legend>
                <div className="time-range">
                  <SuggestedInput
                    label={t.rangeFrom}
                    value={minimum}
                    onChange={(value) => {
                      setMinimum(value);
                      setError("");
                    }}
                    numeric
                    suggestions={["0", "5", "10", "15", "20", "30"]}
                  />
                  <span className="range-dash" aria-hidden="true">
                    –
                  </span>
                  <SuggestedInput
                    label={t.rangeTo}
                    value={maximum}
                    onChange={(value) => {
                      setMaximum(value);
                      setError("");
                    }}
                    numeric
                    suggestions={["10", "15", "20", "30", "45", "60", "90"]}
                  />
                </div>
                <p className="small-text">{t.rangeHelp}</p>
              </fieldset>
              <div className="notice">{t.travelNote}</div>
            </div>
          )}
          {step === 2 && (
            <div className="form-section">
              <p>{t.availabilityText}</p>
              <div className="schedule-table">
                <div className="schedule-row">
                  <span />
                  {periods.map((p) => (
                    <span key={p.key}>
                      {t[p.key]}
                      <small>
                        {clock(p.start)}–{clock(p.end)}
                      </small>
                    </span>
                  ))}
                </div>
                {t.days.map((day, d) => (
                  <div className="schedule-row" key={day}>
                    <span>{day}</span>
                    {periods.map((p) => {
                      const selected = values.availability.some(
                        (a) =>
                          a.day === d && a.start === p.start && a.end === p.end,
                      );
                      return (
                        <button
                          key={p.key}
                          type="button"
                          aria-label={`${t.fullDays[d]}, ${t[p.key]}`}
                          aria-pressed={selected}
                          onClick={() =>
                            toggleInterval({
                              day: d,
                              start: p.start,
                              end: p.end,
                            })
                          }
                          className={selected ? "selected" : ""}
                        >
                          {selected ? (
                            <Check size={17} />
                          ) : (
                            <span className="empty-check" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <details>
                <summary>{t.custom}</summary>
                <div className="custom-time">
                  <label>
                    {t.day}
                    <select
                      value={customDay}
                      onChange={(e) => setCustomDay(+e.target.value)}
                    >
                      {t.fullDays.map((d, i) => (
                        <option value={i} key={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="time-range availability-range">
                    <SuggestedInput
                      label={t.start}
                      value={start}
                      onChange={setStart}
                      suggestions={[
                        "8:00 AM",
                        "9:00 AM",
                        "12:00 PM",
                        "3:00 PM",
                        "5:00 PM",
                      ]}
                    />
                    <span className="range-dash" aria-hidden="true">
                      –
                    </span>
                    <SuggestedInput
                      label={t.end}
                      value={end}
                      onChange={setEnd}
                      suggestions={[
                        "10:00 AM",
                        "12:00 PM",
                        "3:00 PM",
                        "6:00 PM",
                        "9:00 PM",
                        "24:00",
                      ]}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="button secondary"
                  onClick={addCustom}
                >
                  <Plus size={16} />
                  {t.addWindow}
                </button>
              </details>
              <div className="window-tags">
                {values.availability
                  .filter(
                    (a) =>
                      !periods.some(
                        (p) => p.start === a.start && p.end === a.end,
                      ),
                  )
                  .map((a, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => toggleInterval(a)}
                    >
                      {t.days[a.day]} {clock(a.start)}–{clock(a.end)}
                      <X size={14} />
                      <span className="sr-only">{t.remove}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="form-section">
              <fieldset className="equipment-grid">
                <legend className="sr-only">{t.equipmentTitle}</legend>
                {(["none", "microwave", "stovetop", "oven"] as const).map(
                  (item) => (
                    <label
                      className={
                        "check-choice " +
                        (values.equipment.includes(item) ? "selected" : "")
                      }
                      key={item}
                    >
                      <input
                        type="checkbox"
                        checked={values.equipment.includes(item)}
                        onChange={() => {
                          const current = values.equipment;
                          setValue(
                            "equipment",
                            item === "none"
                              ? current.includes("none")
                                ? []
                                : ["none"]
                              : current.includes(item)
                                ? current.filter((v) => v !== item)
                                : [
                                    ...current.filter((v) => v !== "none"),
                                    item,
                                  ],
                          );
                        }}
                      />
                      {t[item]}
                    </label>
                  ),
                )}
              </fieldset>
              <button
                className="text-link"
                type="button"
                onClick={() => setValue("equipment", [])}
              >
                {t.preferNot}
              </button>
            </div>
          )}
          {step === 4 && (
            <div className="form-section">
              <fieldset className="equipment-grid">
                <legend className="sr-only">{t.storageTitle}</legend>
                {(["yes", "no", "limited", "unknown"] as const).map((item) => (
                  <label
                    className={
                      "check-choice " +
                      (values.refrigeration === item ? "selected" : "")
                    }
                    key={item}
                  >
                    <input
                      type="radio"
                      value={item}
                      {...register("refrigeration")}
                    />
                    {t[item]}
                  </label>
                ))}
              </fieldset>
              <label className="inline-check">
                <input type="checkbox" {...register("shelfStable")} />
                {t.shelfPreference}
              </label>
            </div>
          )}
          {step === 5 && (
            <div className="form-section">
              <p>{t.dietText}</p>
              <fieldset className="equipment-grid">
                <legend className="sr-only">{t.dietTitle}</legend>
                {(
                  [
                    "none",
                    "vegetarian",
                    "vegan",
                    "halal",
                    "kosher",
                    "other",
                  ] as const
                ).map((item) => (
                  <label
                    className={
                      "check-choice " + (values.diet === item ? "selected" : "")
                    }
                    key={item}
                  >
                    <input type="radio" value={item} {...register("diet")} />
                    {item === "none" ? t.noPreference : t[item]}
                  </label>
                ))}
              </fieldset>
              {values.diet === "other" && (
                <label>
                  {t.dietNote}
                  <input {...register("dietNote")} maxLength={120} />
                </label>
              )}
              {values.diet !== "none" && (
                <label className="inline-check">
                  <input type="checkbox" {...register("strictDiet")} />
                  {t.strict}
                </label>
              )}
            </div>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="question-actions">
            <button
              type="button"
              className="button ghost"
              onClick={() => move(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              <ArrowLeft size={17} />
              {t.back}
            </button>
            <button type="submit" className="button" disabled={busy}>
              {busy ? (
                <>
                  <LoaderCircle size={17} className="spin" />
                  {t.searching}
                </>
              ) : (
                <>
                  {step === 5 ? t.submit : t.next}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
