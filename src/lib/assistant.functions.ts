import { createServerFn } from "@tanstack/react-start";

type Msg = { role: "user" | "model"; text: string };

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((d: { messages: Msg[]; context: string }) => d)
  .handler(async ({ data }) => {
    const key = process.env["GOOGLE_API_KEY"];
    if (!key) return { error: "The assistant isn't configured yet." };
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "You are an agronomy assistant for a smallholder/commercial farmer. Give practical, concise advice using the farm context. Use markdown.\n\nFARM CONTEXT:\n" + data.context }],
          },
          contents: data.messages.slice(-20).map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        }),
      },
    );
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json?.error?.message || `Request failed (${res.status})` };
    const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
    return { text: text || "No answer returned." };
  });
