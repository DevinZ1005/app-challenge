"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  Navigation,
  Footprints,
  Bus,
  CalendarDays,
  CookingPot,
  Refrigerator,
  Leaf,
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
  const { t, preferences, setPreferences } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [customDay, setCustomDay] = useState(0);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("12:00");
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
  const icons = [
    MapPin,
    Footprints,
    CalendarDays,
    CookingPot,
    Refrigerator,
    Leaf,
  ];
  function commit() {
    const parsed = householdSchema.safeParse(getValues());
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
      setStep(next);
      document.getElementById("question-title")?.focus();
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
    const m = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
    if (!start || !end || m(end) <= m(start)) {
      setError(t.timeError);
      return;
    }
    toggleInterval({ day: customDay, start: m(start), end: m(end) });
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
      <div className="page-intro">
        <span className="eyebrow">
          {t.noAccount} · {t.private}
        </span>
        <h1>{t.questionTitle}</h1>
        <p>{t.questionIntro}</p>
      </div>
      <div className="question-layout">
        <aside className="step-sidebar">
          <ol>
            {titles.map((title, i) => {
              const Icon = icons[i];
              return (
                <li
                  key={title}
                  className={
                    i === step ? "current" : i < step ? "complete" : ""
                  }
                >
                  <button
                    type="button"
                    onClick={() => move(i)}
                    aria-current={i === step ? "step" : undefined}
                  >
                    <span>
                      {i < step ? <Check size={18} /> : <Icon size={18} />}
                    </span>
                    <div>
                      <small>
                        {t.step} {i + 1}
                      </small>
                      <strong>
                        {
                          [
                            t.zip,
                            t.maxTime,
                            t.hours,
                            t.food,
                            t.storageTitle,
                            t.dietTitle,
                          ][i]
                        }
                      </strong>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
          <p>
            <ShieldCheck size={18} />
            {t.optional}
          </p>
        </aside>
        <form
          className="question-card"
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
          <h2 id="question-title" tabIndex={-1}>
            {titles[step]}
          </h2>
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
              <label>
                {t.maxTime}
                <select {...register("maxMinutes", { valueAsNumber: true })}>
                  {[10, 20, 30, 45].map((n) => (
                    <option key={n} value={n}>
                      {n} {t.minutes}
                    </option>
                  ))}
                  {![10, 20, 30, 45].includes(values.maxMinutes) && (
                    <option value={values.maxMinutes}>
                      {values.maxMinutes} {t.minutes}
                    </option>
                  )}
                </select>
              </label>
              <label>
                {t.custom} ({t.minutes})
                <input
                  type="number"
                  min={1}
                  max={180}
                  {...register("maxMinutes", { valueAsNumber: true })}
                />
              </label>
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
                  <label>
                    {t.start}
                    <input
                      type="time"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  </label>
                  <label>
                    {t.end}
                    <input
                      type="time"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                    />
                  </label>
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
