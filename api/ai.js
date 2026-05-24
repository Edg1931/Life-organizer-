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

// Subject-specific tutor personas for the Homework Helper.
const SUBJECTS = {
  math: {
    name: "Math",
    persona:
      "an expert, patient math teacher (arithmetic through calculus, plus statistics). Show every step in order, name the concept, rule, or theorem you're using, and explain WHY each step works — not just the how. Write math in clean, readable plain text (x^2, sqrt(x), fractions as a/b, * for multiply). Point out the kind of mistake students usually make here.",
  },
  science: {
    name: "Science",
    persona:
      "an expert science teacher covering biology, chemistry, physics, and earth science. First name which area the problem is from, state the underlying principle, law, or formula, then work it through. Tie it to a quick real-world example so it sticks. Include units in every calculation.",
  },
  english: {
    name: "English",
    persona:
      "an expert English / Language Arts teacher. Help with reading comprehension, grammar, vocabulary, essays, and literary analysis. Explain the reasoning behind good writing, point to evidence in the text, and model strong sentences rather than just correcting.",
  },
  history: {
    name: "History",
    persona:
      "an expert history and social-studies teacher. Give the context, the cause and effect, and the significance. Help the student think like a historian — about sources, bias, and why events mattered then and now.",
  },
  language: {
    name: "Foreign Language",
    persona:
      "an expert foreign-language teacher. Explain grammar and vocabulary clearly, give simple pronunciation hints in plain text, and when you translate, note WHY it's phrased that way so they learn the pattern, not just the answer.",
  },
  cs: {
    name: "Computer Science",
    persona:
      "an expert computer-science teacher. Explain the concept and the logic, trace through code line by line, and guide debugging. Give a hint or the approach before any full solution so the student learns to solve it themselves.",
  },
  other: {
    name: "this subject",
    persona: "a knowledgeable, patient tutor who adapts to whatever subject the work is from.",
  },
};

function tutorSystem(subjectKey) {
  const s = SUBJECTS[subjectKey] || SUBJECTS.other;
  return `You are a ${s.persona}

You are tutoring a high-school student inside "Life Hub". They have shared a homework problem (often as a photo) and want to actually understand it.

How you teach:
- Be warm, encouraging, and patient. Speak to the student as "you". Never make them feel dumb.
- Your goal is UNDERSTANDING, not just the answer. Teach the method so they could do the next one alone.
- Read the problem carefully from the image and/or text. If the photo is blurry or you can't read part of it, say exactly what you can't make out and ask them to retype just that part.
- Break your explanation into clear, numbered steps. Define any term a high-schooler might not know.
- End with a quick "Check yourself" — one short question or a similar practice problem they can try.
- If the work is clearly a graded test they shouldn't get answers to, focus on the concept and method instead of the final answer, and say so kindly.

Format: plain text only. No markdown headers, no code fences. Numbered steps and simple "- " bullets are fine.`;
}

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
    case "nutrition":
      return `The student is a high-school athlete (wrestler) fueling for performance. Today's snapshot:\n${JSON.stringify(p.context || {}, null, 2)}\n\nGoal: ${(p.intent || "maintain their weight and fuel well").slice(0, 200)}.\n\nSuggest 3-5 specific, realistic snacks/meals with rough calorie estimates that fit their remaining calories for the day, favoring nutrient-dense, performance-supporting foods (protein + smart carbs + hydration).\n\nSAFETY — this is non-negotiable: promote healthy fueling and hydration. NEVER recommend skipping meals, severe restriction, dehydration, sweating out water weight, or any rapid weight-cut tactic. If the goal seems to involve unsafe rapid cutting, briefly and kindly steer them to talk with their coach, athletic trainer, or doctor instead. Plain text, simple "- " bullets.`;
    default:
      return null;
  }
}

// Text instruction for the tutor kinds (the image is attached separately).
function tutorInstruction(kind, payload) {
  const p = payload || {};
  const q = (p.question || "").slice(0, 800).trim();
  const hasImg = !!p.image;
  const src = hasImg
    ? "Look at the homework in the attached photo."
    : "Here is the homework problem the student typed.";
  const question = q ? `\n\nThe student also said: "${q}"` : "";

  switch (kind) {
    case "tutor-explain":
      return `${src}${question}\n\nExplain it like a great teacher: walk through it step by step so the student understands how to solve it, not just the final answer. Finish with a short "Check yourself" practice question.`;
    case "tutor-flashcards":
      return `${src}${question}\n\nCreate a set of study flashcards covering the key concepts, terms, formulas, and problem types needed to master this material. Make 8-12 cards. Fronts are short prompts/questions; backs are clear, complete answers a student can learn from.\n\nReturn ONLY valid JSON, no other text, in exactly this shape:\n{"title": "short deck title", "cards": [{"front": "...", "back": "..."}]}`;
    case "tutor-quiz":
      return `${src}${question}\n\nCreate a short practice quiz (5 questions) to test understanding of this material. Mix recall and applying the method. Each question is multiple choice with 4 options.\n\nReturn ONLY valid JSON, no other text, in exactly this shape:\n{"title": "short quiz title", "questions": [{"q": "question text", "choices": ["A","B","C","D"], "answer": 0, "why": "one-sentence explanation of the correct answer"}]}\n"answer" is the 0-based index of the correct choice.`;
    default:
      return null;
  }
}

function isTutorKind(kind) {
  return kind === "tutor-explain" || kind === "tutor-flashcards" || kind === "tutor-quiz";
}

// Pull a JSON object out of the model's reply, tolerating stray text or code fences.
function parseJSON(text) {
  if (!text) return null;
  let t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1));
      } catch {
        return null;
      }
    }
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
  const kind = body && body.kind;
  const payload = (body && body.payload) || {};

  const client = new Anthropic({ apiKey });

  // ---- Homework tutor (subject-aware, supports a photo) ----
  if (isTutorKind(kind)) {
    const instruction = tutorInstruction(kind, payload);
    const img = payload.image;
    if (!instruction || (!img && !(payload.question || "").trim())) {
      return res.status(400).json({ error: "Add a photo of the homework or type the question first." });
    }

    const content = [];
    if (img && img.data && img.mediaType) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.data },
      });
    }
    content.push({ type: "text", text: instruction });

    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 1800,
        system: [{ type: "text", text: tutorSystem(payload.subject), cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content }],
      });
      const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();

      if (kind === "tutor-explain") return res.status(200).json({ text });
      const parsed = parseJSON(text);
      if (!parsed) return res.status(200).json({ text }); // fall back to showing the raw reply
      return res.status(200).json({ data: parsed });
    } catch (e) {
      const status = (e && e.status) || 500;
      return res.status(status).json({ error: (e && e.message) || "AI request failed." });
    }
  }

  // ---- Everything else (text-only coaching) ----
  const prompt = buildPrompt(kind, payload);
  if (!prompt) return res.status(400).json({ error: "Unknown request kind." });

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
