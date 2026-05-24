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
      return `The student wants a workout. Their request: "${(p.request || "a balanced 45-minute session").slice(0, 300)}".\n\nRecent training context:\n${JSON.stringify(p.context || {}, null, 2)}\n\nDesign one specific, realistic session for a high-school athlete with normal gym access. Return ONLY valid JSON (no markdown, no code fences) in exactly this shape:\n{"title":"short name","focus":"what it trains","minutes":45,"type":"Strength","warmup":["move 1","move 2"],"exercises":[{"name":"Back Squat","sets":4,"reps":"5","note":"explosive up, controlled down"}],"cooldown":["stretch 1"]}\n- 4-7 main exercises. "reps" can be a number, a range like "8-10", or a hold like "30s". "type" is one of Strength, Cardio, Conditioning, Mobility. Keep notes short.`;
    case "nutrition":
      return `The student is a high-school athlete (wrestler) fueling for performance. Today's snapshot:\n${JSON.stringify(p.context || {}, null, 2)}\n\nGoal: ${(p.intent || "maintain their weight and fuel well").slice(0, 200)}.\n\nSuggest 3-5 specific, realistic snacks/meals with rough calorie estimates that fit their remaining calories for the day, favoring nutrient-dense, performance-supporting foods (protein + smart carbs + hydration).\n\nSAFETY — this is non-negotiable: promote healthy fueling and hydration. NEVER recommend skipping meals, severe restriction, dehydration, sweating out water weight, or any rapid weight-cut tactic. If the goal seems to involve unsafe rapid cutting, briefly and kindly steer them to talk with their coach, athletic trainer, or doctor instead. Plain text, simple "- " bullets.`;
    case "wrestling-analysis":
      return `Here is the wrestler's recent match log:\n${JSON.stringify(p.matches || [], null, 2)}\n\nAs their wrestling coach, give a short read on how they're wrestling: their record and any trend, what's working, recurring patterns in how they win or lose, and 2-3 specific things to drill next. Be encouraging and specific. Plain text, simple "- " bullets.`;
    case "baseball-analysis":
      return `Here is the player's recent batting log:\n${JSON.stringify(p.games || [], null, 2)}\n\nAs their hitting coach, give a short read on how they're hitting: trends in average and on-base, any hot or cold stretch, their strikeout-to-walk balance, and 2-3 specific things to work on. Be encouraging and specific. Plain text, simple "- " bullets.`;
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

const SCHEDULE_SYSTEM = `You extract sports and event schedules from images into clean structured calendar data for "Life Hub", a high-school student's planner.

Rules:
- Extract every distinct dated event you can read: games, matches, meets, tournaments, scrimmages, practices, etc.
- Title: use the opponent and/or event name, keeping home/away if shown (e.g. "vs Lakewood", "@ Avon", "Districts", "Practice").
- Dates: strict YYYY-MM-DD. Schedules often omit the year — infer it from the provided "today" date so each event lands in the correct, upcoming season (e.g. a fall schedule belongs to the current school year, not the past).
- Times: 24-hour HH:MM. If no time is shown, use an empty string. Convert "7:00 PM" to "19:00".
- Location: the place/venue if shown (e.g. "Lakewood High", "Home", "Avon Lake HS Gym"). If none is shown, use an empty string. Do not confuse the opponent with the location.
- Type: exactly one of Game, Practice, Exam, Work, Personal. Matches/meets/tournaments/scrimmages are "Game"; team practices are "Practice".
- If a row is unreadable or has no date, skip it rather than guessing.
- Return ONLY valid JSON. No commentary, no code fences.`;

function scheduleInstruction(payload) {
  const p = payload || {};
  const today = (p.today || "").slice(0, 10);
  const note = (p.note || "").slice(0, 300).trim();
  const noteLine = note
    ? `\n\nContext from the student (use it to label titles and pick the right type): "${note}".`
    : "";
  return `Today's date is ${today}. Read this schedule photo and extract every dated event.${noteLine}\n\nReturn ONLY valid JSON in exactly this shape:\n{"events": [{"title": "vs Lakewood", "date": "2026-09-12", "time": "19:00", "location": "Lakewood High", "type": "Game"}]}`;
}

function isImageKind(kind) {
  return isTutorKind(kind) || kind === "schedule-import" || kind === "stats-import";
}

// ---- Video coaching (analyzes still frames pulled from a clip, in time order) ----
const VIDEO_COACHES = {
  swing: { name: "baseball swing", persona: "an expert baseball hitting coach", focus: "stance and setup, load, stride and timing, hip rotation and hip-shoulder separation, hand path to the ball, contact position, and extension and finish" },
  pitching: { name: "pitching delivery", persona: "an expert baseball pitching coach", focus: "balance and leg lift, direction and stride length, hip-shoulder separation, arm action and arm slot, release point, and follow-through and deceleration" },
  wrestling: { name: "wrestling", persona: "an expert wrestling coach", focus: "stance and level changes, motion and hand-fighting, shot setup and penetration step, finishing on the legs, sprawl and down-block defense, and scrambling and position" },
  polevault: { name: "pole vault", persona: "an expert pole vault coach", focus: "approach-run rhythm and acceleration, pole carry and plant timing, takeoff position under the pole, swing-up and trail-leg drive, extension and inversion, and the turn and bar clearance" },
};

function videoSystem(disc) {
  const c = VIDEO_COACHES[disc] || VIDEO_COACHES.swing;
  return `You are ${c.persona} reviewing video for a high-school athlete inside "Life Hub". You are shown several still frames captured in time order from a single ${c.name} clip.

How to coach:
- Treat the frames as one motion in sequence (frame 1 is earliest). Reconstruct what's happening across them.
- Focus on ${c.focus}.
- Be specific, concrete, and encouraging. Speak to the athlete as "you".
- Give three things: (1) a quick read of what already looks good, (2) the 2-3 most important fixes in priority order, each with WHY it matters, and (3) 2-3 specific drills or cues to fix them.
- If the frames are blurry or the athlete isn't fully in frame, say what you can and tell them how to film a better clip (side-on, full body, good light, slow-motion if possible).
- If you notice a real injury risk or the athlete mentions pain, gently point them to their coach, athletic trainer, or doctor — don't diagnose.

Format: plain text only. No markdown headers, no code fences. Short paragraphs and simple "- " bullets.`;
}

// ---- Stats import (reads a GameChanger-style screenshot into structured stats) ----
const STATS_SYSTEM = `You read sports stats from a screenshot (for example a GameChanger box score or season stat screen) and return clean structured data for "Life Hub". Return ONLY valid JSON — no commentary, no code fences. If a numeric value isn't shown, use 0. Use strict YYYY-MM-DD for dates; if the year isn't shown, infer it from the provided today date.`;

function statsInstruction(payload) {
  const p = payload || {};
  const today = (p.today || "").slice(0, 10);
  if (p.sport === "wrestling") {
    return `Today is ${today}. Read this wrestling stats screenshot and extract each match.\n\nReturn ONLY JSON in exactly this shape:\n{"matches": [{"date": "2026-01-12", "opponent": "name", "result": "Win", "method": "Decision", "score": "7-3"}]}\n- result is "Win" or "Loss". method is one of: Decision, Major, Tech, Pin, Forfeit.`;
  }
  return `Today is ${today}. Read this baseball stats screenshot (e.g. GameChanger) and extract each game's batting line.\n\nReturn ONLY JSON in exactly this shape:\n{"games": [{"date": "2026-04-03", "opponent": "name", "ab": 3, "h": 2, "rbi": 1, "r": 1, "bb": 0, "k": 1}]}\n- If it only shows season totals rather than per-game lines, return a single entry with opponent "Season totals".`;
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

  // ---- Video coaching: analyze a sequence of frames pulled from a clip ----
  if (kind === "video-analyze") {
    const frames = (Array.isArray(payload.frames) ? payload.frames : [])
      .filter((f) => f && f.data && f.mediaType)
      .slice(0, 8);
    if (!frames.length) return res.status(400).json({ error: "No video frames to analyze — try a different clip." });
    const disc = payload.discipline;
    const name = (VIDEO_COACHES[disc] || VIDEO_COACHES.swing).name;
    const note = (payload.note || "").slice(0, 400).trim();

    const content = frames.map((f) => ({ type: "image", source: { type: "base64", media_type: f.mediaType, data: f.data } }));
    content.push({ type: "text", text: `These are ${frames.length} frames in time order from a ${name} clip.${note ? ` The athlete adds: "${note}".` : ""}\n\nBreak down the ${name} mechanics across the sequence and tell me specifically how to improve.` });

    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: [{ type: "text", text: videoSystem(disc), cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content }],
      });
      const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return res.status(200).json({ text });
    } catch (e) {
      const status = (e && e.status) || 500;
      return res.status(status).json({ error: (e && e.message) || "AI request failed." });
    }
  }

  // ---- Single-image features: homework tutor, schedule import, stats import ----
  if (isImageKind(kind)) {
    const needsImage = kind === "schedule-import" || kind === "stats-import";
    let instruction, system, wantJSON;
    if (kind === "schedule-import") { instruction = scheduleInstruction(payload); system = SCHEDULE_SYSTEM; wantJSON = true; }
    else if (kind === "stats-import") { instruction = statsInstruction(payload); system = STATS_SYSTEM; wantJSON = true; }
    else { instruction = tutorInstruction(kind, payload); system = tutorSystem(payload.subject); wantJSON = kind !== "tutor-explain"; }

    const img = payload.image;
    if (needsImage && !img) {
      return res.status(400).json({ error: kind === "stats-import" ? "Add a screenshot of the stats first." : "Add a photo of the schedule first." });
    }
    if (!instruction || (!img && !(payload.question || "").trim())) {
      return res.status(400).json({ error: "Add a photo of the homework or type the question first." });
    }

    const content = [];
    if (img && img.data && img.mediaType) {
      content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
    }
    content.push({ type: "text", text: instruction });

    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content }],
      });
      const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();

      if (!wantJSON) return res.status(200).json({ text });
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
    if (kind === "workout") {
      const parsed = parseJSON(text);
      if (parsed && Array.isArray(parsed.exercises)) return res.status(200).json({ data: parsed });
    }
    return res.status(200).json({ text });
  } catch (e) {
    const status = (e && e.status) || 500;
    return res.status(status).json({ error: (e && e.message) || "AI request failed." });
  }
}
