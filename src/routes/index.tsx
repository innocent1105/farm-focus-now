import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { CloudRain, Droplets, Thermometer, Wind, MapPin, Sprout, Trash2, Send, Leaf, Crosshair } from "lucide-react";
import { type Crop, type Farm, emptyFarm, loadFarm, saveFarm, listCrops, putCrop, deleteCrop } from "@/lib/storage";
import { askAssistant } from "@/lib/assistant.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shamba — Farm & Crop Manager" },
      { name: "description", content: "Track your farm location, live weather, crops, stages and markets, with an AI agronomy assistant." },
      { property: "og:title", content: "Shamba — Farm & Crop Manager" },
      { property: "og:description", content: "Farm location, live weather, crop records and an AI assistant in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Weather = {
  current: { temperature_2m: number; relative_humidity_2m: number; precipitation: number; wind_speed_10m: number };
  daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[]; precipitation_probability_max: number[] };
};

const STAGES = ["Land preparation", "Planting", "Germination", "Vegetative", "Flowering", "Fruiting", "Maturity", "Harvest", "Post-harvest"];

function Index() {
  const [farm, setFarm] = useState<Farm>(emptyFarm);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [live, setLive] = useState<{ lat: number; lon: number; acc: number } | null>(null);
  const [geoErr, setGeoErr] = useState("");
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    setFarm(loadFarm());
    listCrops().then(setCrops);
    if (!navigator.geolocation) return setGeoErr("Location not supported on this device");
    const id = navigator.geolocation.watchPosition(
      (p) => setLive({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
      (e) => setGeoErr(e.message),
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const lat = farm.lat ?? live?.lat;
  const lon = farm.lon ?? live?.lon;

  useEffect(() => {
    if (lat == null || lon == null) return;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=7`)
      .then((r) => r.json()).then(setWeather).catch(() => {});
  }, [lat?.toFixed(3), lon?.toFixed(3)]);

  const updateFarm = (f: Farm) => { setFarm(f); saveFarm(f); };

  return (
    <div className="min-h-screen">
      <header className="bg-soil text-soil-foreground">
        <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-6 py-8">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] opacity-70"><Leaf className="h-4 w-4" /> Shamba</p>
            <h1 className="mt-2 text-4xl font-bold">{farm.name || "Your farm"}</h1>
            <p className="mt-1 text-sm opacity-75">{farm.owner && `${farm.owner} · `}{farm.hectares || 0} ha · {crops.length} crop{crops.length === 1 ? "" : "s"}</p>
          </div>
          {weather && (
            <div className="text-right">
              <p className="font-display text-5xl">{Math.round(weather.current.temperature_2m)}°</p>
              <p className="text-sm opacity-75">{weather.current.relative_humidity_2m}% humidity</p>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FarmPanel farm={farm} live={live} geoErr={geoErr} onChange={updateFarm} />
          <WeatherPanel weather={weather} />
          <CropsPanel crops={crops} setCrops={setCrops} />
        </div>
        <Assistant farm={farm} crops={crops} weather={weather} />
      </main>
    </div>
  );
}

function FarmPanel({ farm, live, geoErr, onChange }: { farm: Farm; live: { lat: number; lon: number; acc: number } | null; geoErr: string; onChange: (f: Farm) => void }) {
  const lat = farm.lat ?? live?.lat;
  const lon = farm.lon ?? live?.lon;
  const d = 0.01;
  return (
    <section className="panel">
      <h2 className="mb-4 flex items-center gap-2 text-2xl"><MapPin className="h-5 w-5 text-primary" /> Farm data</h2>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <div><label className="label">Farm name</label><input className="field" value={farm.name} onChange={(e) => onChange({ ...farm, name: e.target.value })} /></div>
          <div><label className="label">Farmer</label><input className="field" value={farm.owner} onChange={(e) => onChange({ ...farm, owner: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Hectares</label><input type="number" className="field" value={farm.hectares || ""} onChange={(e) => onChange({ ...farm, hectares: +e.target.value })} /></div>
            <div><label className="label">Area / district</label><input className="field" value={farm.locationName} onChange={(e) => onChange({ ...farm, locationName: e.target.value })} /></div>
          </div>
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold"><span className={`h-2 w-2 rounded-full ${live ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} /> Device location (live)</p>
            {live ? <p className="mt-1 font-mono text-xs">{live.lat.toFixed(5)}, {live.lon.toFixed(5)} · ±{Math.round(live.acc)} m</p> : <p className="mt-1 text-xs text-muted-foreground">{geoErr || "Waiting for location…"}</p>}
            <p className="mt-2 text-xs text-muted-foreground">Farm pin: {farm.lat != null ? `${farm.lat.toFixed(5)}, ${farm.lon!.toFixed(5)}` : "not set (using device)"}</p>
            <div className="mt-2 flex gap-2">
              <button className="btn-ghost" disabled={!live} onClick={() => live && onChange({ ...farm, lat: live.lat, lon: live.lon })}><Crosshair className="h-4 w-4" /> Set farm here</button>
              {farm.lat != null && <button className="btn-ghost" onClick={() => onChange({ ...farm, lat: undefined, lon: undefined })}>Clear pin</button>}
            </div>
          </div>
        </div>
        <div className="min-h-64 overflow-hidden rounded-lg border bg-muted">
          {lat != null && lon != null ? (
            <iframe title="Farm map" className="h-full min-h-64 w-full" src={`https://www.openstreetmap.org/export/embed.html?bbox=${lon - d},${lat - d},${lon + d},${lat + d}&layer=mapnik&marker=${lat},${lon}`} />
          ) : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Map appears once location is available</div>}
        </div>
      </div>
    </section>
  );
}

function WeatherPanel({ weather }: { weather: Weather | null }) {
  if (!weather) return <section className="panel text-sm text-muted-foreground">Loading weather for your farm…</section>;
  const c = weather.current;
  const total = weather.daily.precipitation_sum.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...weather.daily.precipitation_sum);
  const stats = [
    { icon: Thermometer, label: "Temperature", v: `${c.temperature_2m}°C` },
    { icon: Droplets, label: "Humidity", v: `${c.relative_humidity_2m}%` },
    { icon: CloudRain, label: "Rain now", v: `${c.precipitation} mm` },
    { icon: Wind, label: "Wind", v: `${c.wind_speed_10m} km/h` },
  ];
  return (
    <section className="panel">
      <div className="mb-4 flex items-baseline justify-between"><h2 className="text-2xl">Weather & rainfall</h2><span className="text-sm text-muted-foreground">7-day rain: <b className="text-foreground">{total.toFixed(1)} mm</b></span></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-secondary p-3">
            <s.icon className="h-4 w-4 text-primary" />
            <p className="mt-2 text-xl font-bold">{s.v}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-7 gap-2">
        {weather.daily.time.map((t, i) => (
          <div key={t} className="flex flex-col items-center text-xs">
            <div className="flex h-24 w-full items-end rounded bg-muted">
              <div className="w-full rounded bg-primary" style={{ height: `${((weather.daily.precipitation_sum[i] ?? 0) / max) * 100}%` }} />
            </div>
            <p className="mt-1 font-semibold">{new Date(t).toLocaleDateString(undefined, { weekday: "short" })}</p>
            <p className="text-muted-foreground">{weather.daily.precipitation_sum[i]}mm · {weather.daily.precipitation_probability_max[i]}%</p>
            <p>{Math.round(weather.daily.temperature_2m_max[i] ?? 0)}°/{Math.round(weather.daily.temperature_2m_min[i] ?? 0)}°</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const blank = (): Crop => ({ id: crypto.randomUUID(), name: "", variety: "", stage: STAGES[0]!, plantedOn: "", area: 0, expectedYield: 0, targetMarket: "", price: 0, notes: "" });

function CropsPanel({ crops, setCrops }: { crops: Crop[]; setCrops: (c: Crop[]) => void }) {
  const [form, setForm] = useState<Crop | null>(null);
  const save = async () => { if (!form?.name) return; await putCrop(form); setCrops(await listCrops()); setForm(null); };
  const f = (k: keyof Crop, num = false) => ({
    value: (form?.[k] as string | number) || "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form!, [k]: num ? +e.target.value : e.target.value }),
  });
  return (
    <section className="panel">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-2xl"><Sprout className="h-5 w-5 text-primary" /> Crops</h2>
        {!form && <button className="btn" onClick={() => setForm(blank())}>Add crop</button>}
      </div>
      {form && (
        <div className="mb-5 grid gap-3 rounded-lg bg-muted p-4 md:grid-cols-3">
          <div><label className="label">Crop</label><input className="field" placeholder="Maize" {...f("name")} /></div>
          <div><label className="label">Variety</label><input className="field" {...f("variety")} /></div>
          <div><label className="label">Stage</label><select className="field" {...f("stage")}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="label">Planted on</label><input type="date" className="field" {...f("plantedOn")} /></div>
          <div><label className="label">Area (ha)</label><input type="number" className="field" {...f("area", true)} /></div>
          <div><label className="label">Expected yield (t)</label><input type="number" className="field" {...f("expectedYield", true)} /></div>
          <div><label className="label">Target market</label><input className="field" placeholder="FRA, local market, export…" {...f("targetMarket")} /></div>
          <div><label className="label">Price per tonne</label><input type="number" className="field" {...f("price", true)} /></div>
          <div className="md:col-span-3"><label className="label">Notes (inputs, pests, irrigation…)</label><textarea className="field" rows={2} {...f("notes")} /></div>
          <div className="flex gap-2 md:col-span-3"><button className="btn" onClick={save}>Save crop</button><button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </div>
      )}
      {crops.length === 0 && !form && <p className="text-sm text-muted-foreground">No crops yet. Add your first crop to start tracking.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {crops.map((c) => {
          const idx = STAGES.indexOf(c.stage);
          return (
            <article key={c.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div><h3 className="text-lg font-bold">{c.name} <span className="text-sm font-normal text-muted-foreground">{c.variety}</span></h3>
                  <p className="text-xs text-muted-foreground">{c.area} ha · planted {c.plantedOn || "—"}</p></div>
                <div className="flex gap-1">
                  <button className="btn-ghost" onClick={() => setForm(c)}>Edit</button>
                  <button className="btn-ghost" aria-label="Delete" onClick={async () => { await deleteCrop(c.id); setCrops(await listCrops()); }}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold text-primary">{c.stage}</p>
              <div className="mt-1 h-1.5 rounded bg-muted"><div className="h-full rounded bg-accent" style={{ width: `${((idx + 1) / STAGES.length) * 100}%` }} /></div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-muted-foreground">Market</p><p className="font-semibold">{c.targetMarket || "—"}</p></div>
                <div><p className="text-muted-foreground">Price/t</p><p className="font-semibold">{c.price || "—"}</p></div>
                <div><p className="text-muted-foreground">Est. value</p><p className="font-semibold">{(c.price * c.expectedYield).toLocaleString()}</p></div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Assistant({ farm, crops, weather }: { farm: Farm; crops: Crop[]; weather: Weather | null }) {
  const [msgs, setMsgs] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, text }];
    setMsgs(next); setInput(""); setBusy(true);
    const context = JSON.stringify({ farm, crops, weather: weather && { current: weather.current, daily: weather.daily } });
    try {
      const r = await askAssistant({ data: { messages: next, context } });
      setMsgs([...next, { role: "model", text: r.text ?? `⚠️ ${r.error}` }]);
    } catch { setMsgs([...next, { role: "model", text: "⚠️ Could not reach the assistant." }]); }
    setBusy(false);
  };

  return (
    <aside className="panel flex h-[calc(100vh-4rem)] flex-col lg:sticky lg:top-8">
      <h2 className="flex items-center gap-2 text-2xl"><Leaf className="h-5 w-5 text-primary" /> Agronomist</h2>
      <p className="text-xs text-muted-foreground">Knows your farm, crops and weather.</p>
      <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {msgs.length === 0 && ["When should I apply fertilizer?", "Is rain coming that affects my harvest?", "Best market for my crop?"].map((q) => (
          <button key={q} className="btn-ghost w-full text-left" onClick={() => send(q)}>{q}</button>
        ))}
        {msgs.map((m, i) => m.role === "user"
          ? <div key={i} className="ml-8 rounded-lg bg-soil px-3 py-2 text-sm text-soil-foreground">{m.text}</div>
          : <div key={i} className="prose prose-sm max-w-none text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5"><ReactMarkdown>{m.text}</ReactMarkdown></div>)}
        {busy && <p className="animate-pulse text-sm text-muted-foreground">Thinking…</p>}
        <div ref={end} />
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input className="field" placeholder="Ask about your crops…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn" disabled={busy} aria-label="Send"><Send className="h-4 w-4" /></button>
      </form>
    </aside>
  );
}
