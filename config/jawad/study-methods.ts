// «الطالب الذكي» — the methods صادق writes by: the strongest proven ways to SUMMARISE, to PRE-READ (before the lesson)
// and to PREPARE, chosen for who is studying (a child, a school student, a university student, a grown-up learner, a
// debater). Researched on 2026-10-11:
// · Dunlosky et al. 2013, "Improving Students' Learning With Effective Learning Techniques" (Psychological Science in
//   the Public Interest): practice testing (retrieval) and distributed (spaced) practice rated HIGH utility;
//   elaborative interrogation, self-explanation and interleaving MODERATE; plain summarising, highlighting and
//   rereading LOW — so every summary here ends in retrieval questions and asks "why", it never only shortens.
// · Harvard Library, "Interrogating Texts: 6 Reading Habits" (Susan Gilroy): previewing, annotating, outlining /
//   summarising / analysing, looking for repetitions and patterns, contextualising, comparing and contrasting.
// · Cornell note-taking (Walter Pauk, Cornell University): cue column of questions, notes, a summary at the bottom.
// · The Feynman technique: explain it simply, find the gaps, simplify again with an analogy.
// · Pre-reading: SQ3R (F. P. Robinson: survey, question, read, recite, review), KWL (Donna Ogle: know / want to know /
//   learned), anticipation guides (agree/disagree before reading), advance organisers (D. Ausubel: the big frame
//   before the details), the flipped / just-in-time-teaching pre-class reading with a few questions to bring
//   (Harvard's Eric Mazur, peer instruction).
// · Concept maps (J. Novak, Cornell), dual coding (words + a simple visual), chunking, worked examples.
// · Debate: claim–warrant–impact for every argument (NSDA training guide), the strongest version of the other side
//   (steelman), anticipated rebuttals and their answers, evidence cited by title, source, author and date.
// Sources: psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html ·
// guides.library.harvard.edu/sixreadinghabits · retrievalpractice.org · speechanddebate.org (Debate Training Guide) ·
// understood.org (advance organizers) · blog.heinemann.com (pre-reading scaffolds).
// Pure: the audiences, the methods, and the lines given to صادق.

export type StudyAudience = "child" | "school" | "university" | "adult" | "debate";

export const STUDY_AUDIENCES: Record<StudyAudience, { name: string; hint: string }> = {
  child: { name: "طفل (ابتدائي)", hint: "قصير، صور ذهنية، أسئلة لعب" },
  school: { name: "طالب مدرسة (متوسط وثانوي)", hint: "هيكل واضح، مصطلحات، أسئلة اختبار" },
  university: { name: "جامعي ودراسات عليا", hint: "تحليل، مقارنة، أسئلة نقدية" },
  adult: { name: "متعلم كبير أو محترف", hint: "خلاصة عملية وتطبيق" },
  debate: { name: "مناظرة", hint: "حجة، دليل، أثر، والرد المتوقع" },
};

/** Who the material is for, from the project's level and purpose. */
export function studyAudience(level: string | null | undefined, purpose?: string | null): StudyAudience {
  if (purpose === "debate") return "debate";
  const l = String(level ?? "");
  if (/ابتدائي|طفل|روضة/.test(l)) return "child";
  if (/متوسط|ثانوي|مدرس/.test(l)) return "school";
  if (/جامع|دراسات|ماجستير|دكتوراه/.test(l)) return "university";
  return "adult";
}

interface Methods {
  summary: string;
  preread: string;
  prepare: string;
}

const METHODS: Record<StudyAudience, Methods> = {
  child: {
    summary:
      "For a CHILD: very short sentences and everyday words; one idea per part; a simple picture-in-words or comparison from the child's world for each idea (dual coding); a 'remember this' line per part; end with 3–5 playful recall questions (who/what/why) answered from memory, not by rereading.",
    preread:
      "PRE-READING for a CHILD (KWL + anticipation): 'What do I already know?' prompts, 3–4 'I wonder…' questions to look for during the lesson, 4–6 key words each with a one-line meaning and an example, and a short 'guess before you learn' activity (true/false statements to revisit after the lesson).",
    prepare:
      "PREPARATION for a CHILD: a tiny plan (what we'll learn, why it matters to me), the key words, one fun question to answer by the end.",
  },
  school: {
    summary:
      "For a SCHOOL student (Cornell + retrieval): sections that follow the lesson's structure; each section opens with a cue QUESTION and is answered in a few tight bullet points; definitions of every term; a worked example where the material has one; a 'why does this matter / why is it true?' line (elaborative interrogation); end with a one-paragraph summary and 6–10 exam-style recall questions with short answers kept separate, to be answered from memory and revisited over the next days (spaced retrieval).",
    preread:
      "PRE-READING for a SCHOOL student (SQ3R + advance organiser): a one-paragraph BIG PICTURE of the lesson and where it fits; a map of its parts in order (survey); the key terms with short meanings; 5–8 guiding QUESTIONS to answer while studying; an anticipation guide (statements to agree/disagree with now and check later); what to pay most attention to; a short self-check to do right after the lesson.",
    prepare:
      "PREPARATION for a SCHOOL student: the lesson's aim, prior knowledge to refresh, key terms, questions to bring to class, and a plan to review it again in 1, 3 and 7 days.",
  },
  university: {
    summary:
      "For a UNIVERSITY student (Harvard's six reading habits + Feynman): state the central thesis/argument first; outline the structure of the argument and its evidence; explain each key concept simply, as if teaching it (Feynman), then precisely; note patterns, assumptions and limitations; contextualise (where the idea comes from, what it answers); compare and contrast with related views when the material allows; include a concept map in words (how the ideas connect); end with critical questions and recall questions for spaced review.",
    preread:
      "PRE-READING for a UNIVERSITY student (previewing + flipped pre-class reading): the thesis and the question the lecture/reading answers; the structure to expect; the concepts and terms you must know beforehand (with precise definitions); 3–5 questions to bring to the lecture (just-in-time teaching); likely difficult points flagged; how this connects to earlier topics; what to look for in the evidence.",
    prepare:
      "PREPARATION for a UNIVERSITY student: objectives, prerequisite concepts, a reading plan (preview → read actively → summarise in own words → test yourself), questions for the lecturer, and a spaced review schedule.",
  },
  adult: {
    summary:
      "For a GROWN-UP or professional learner: the bottom line first (what it is and why it matters); the key ideas as clear, actionable points; how to apply each in practice with a concrete example; common mistakes or misconceptions; a short checklist; end with a few self-test questions.",
    preread:
      "PRE-READING for a GROWN-UP learner (advance organiser): the purpose and the big picture; what you will be able to do afterwards; the key terms; 3–5 questions to keep in mind; how it connects to real work or life; what to skip and what to focus on.",
    prepare:
      "PREPARATION for a GROWN-UP learner: goal, what you already know, the questions you want answered, and how you'll use it.",
  },
  debate: {
    summary:
      "For a DEBATE (claim–warrant–impact): the motion and the definitions that matter; the strongest arguments for EACH side, each written as claim → warrant (the reasoning) → evidence from the material (cited) → impact (why it matters most); the strongest version of the opposing case (steelman); anticipated rebuttals and the answer to each; key facts and figures to quote; end with a one-minute closing summary.",
    preread:
      "PRE-READING for a DEBATE: the motion, its key terms and possible definitions; the main clash points; what each side will likely argue; the evidence to look for in the material and outside it; questions to research before the round.",
    prepare:
      "PREPARATION for a DEBATE (case file): a case outline with 2–3 core arguments (claim/warrant/impact), evidence cards (quote + source + date), a rebuttal bank against the expected opposing arguments, cross-examination questions, and a short opening and closing.",
  },
};

/** The method lines given to صادق for this kind of output and this audience. */
export function methodLine(kind: "summary" | "explain" | "book" | "preread" | "chat", audience: StudyAudience): string {
  const m = METHODS[audience];
  const who = `Audience: ${STUDY_AUDIENCES[audience].name}.`;
  if (kind === "preread") return `${who}\nMETHOD (researched best practice, follow it): ${m.preread}\nAlso, briefly: ${m.prepare}`;
  if (kind === "summary") return `${who}\nMETHOD (researched best practice, follow it): ${m.summary}`;
  if (kind === "chat") return `${who}\nWhen asked to summarise, explain or help prepare, use these methods: ${m.summary} ${m.prepare}`;
  return `${who}\nWhere it helps understanding, use these researched methods: ${m.summary}`;
}
