// Serverless AI endpoint for Life Hub. Runs on Vercel; the API key stays here,
// never in the browser or the repo. Frontend POSTs { kind, payload }.
import Anthropic from "@anthropic-ai/sdk";

// Switch to "claude-haiku-4-5" or "claude-sonnet-4-6" to lower cost.
const MODEL = "claude-opus-4-7";

const SYSTEM = `You are the built-in AI coach for "Life Hub", a personal dashboard used by a high-school student to manage school, sports (wrestling and baseball), health, and workouts.

Voice: warm, direct, encouraging — like a good coach or older teammate. Speak to the student as "you".

Rules:
- Be concise and practical. Prefer short paragraphs and tight bullet lists over walls of text.
- Give specific, actionable next steps the student can do today.
- When you reference their data, be accurate to what's provided — don't invent assignments, games, or stats.
- For anything involving real injury, pain, mental-health crises, disordered eating, or rapid weight cutting, do not give medical instructions — gently encourage them to talk to a parent, coach, athletic trainer, or doctor.
- Keep a positive, motivating tone, but be honest. Don't flatter.
- Plain text only. No markdown headers, no code fences. Simple "- " bullets are fine.`;

function buildPrompt(kind, payload) {
  const p = payload || {};
  const json = JSON.stringify(p, null, 2);
  switch (kind) {
    case "brief":
      return `Here is the student's data for today:\n${json}\n\nWrite a short, motivating daily brief (about 4-6 sentences or a few bullets). Call out what's due soonest, anything overdue, how their training is going this week, and end with one specific focus for today.`;
    case "breakdown":
      return `Break this school task into a clear, ordered action plan the student can follow:\n${json}\n\nGive 3-7 concrete steps. If a due date is provided, suggest roughly when to do each step (e.g. "tonight", "by Thursday"). Keep each step short.`;
    case "insights":
      return `Here is a snapshot of the student's recent school, sports, health, and workout data:\n${json}\n\nGive a brief "weekly insights" read: 2-4 patterns or trends you notice across school + sports + health, then 2-3 specific suggestions. Be encouraging and specific.`;
    case "coach":
      return `The student asked their coach:\n"${(p.question || "").slice(0, 800)}"\n\nHere is relevant context from their hub:\n${JSON.stringify(p.context || {}, null, 2)}\n\nAnswer helpfully and specifically, using the context where relevant.`;
    case "workout":
      return `The student wants a workout. Their request: "${(p.request || "a balanced 45-minute session").slice(0, 300)}".\n\nRecent training context:\n${JSON.stringify(p.context || {}, null, 2)}\n\nDesign one specific session: a short warm-up, the main work as exercises with sets × reps and rough intensity, and a quick cooldown. Keep it realistic for a high-school athlete with normal gym access. Plain text, simple "- " bullets, no markdown headers.`;
    default:
      return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server isn't configured yet — add ANTHROPIC_API_KEY in Vercel settings." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const prompt = buildPrompt(body && body.kind, body && body.payload);
  if (!prompt) return res.status(400).json({ error: "Unknown request kind." });

  const client = new Anthropic({ apiKey });
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return res.status(200).json({ text });
  } catch (e) {
    const status = (e && e.status) || 500;
    return res.status(status).json({ error: (e && e.message) || "AI request failed." });
  }
}
