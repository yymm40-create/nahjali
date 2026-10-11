// «الصحة العلوية» in «لأجل المهدي»: the research the branch is built on. What the international bodies and the
// medical journals recommend for training and nutrition, for men and women, pregnant or not, breastfeeding and after
// birth — gathered into one place, with each source. The plan engine (src/lib/mahdi/health/plan.ts) takes every
// number it uses from REF below, and the page «البحث» (/mahdi/health/research) shows the whole text to the user.
// Pure data. Reviewed 2026-10: WHO 2020, ACOG 2020 (reaffirmed), ACSM 2026, ISSN 2017, DGA 2025–2030, IOM/NAM DRIs.

export interface Source {
  id: string;
  /** who published it */
  org: string;
  title: string;
  year: number;
  /** journal or place */
  where: string;
  url: string;
}

export const SOURCES: Source[] = [
  { id: "who2020", org: "منظمة الصحة العالمية (WHO)", title: "WHO guidelines on physical activity and sedentary behaviour", year: 2020, where: "British Journal of Sports Medicine 54:1451–1462", url: "https://doi.org/10.1136/bjsports-2020-102955" },
  { id: "acog804", org: "الكلية الأمريكية لأطباء النساء والولادة (ACOG)", title: "Committee Opinion No. 804: Physical Activity and Exercise During Pregnancy and the Postpartum Period", year: 2020, where: "Obstetrics & Gynecology 135(4):e178–e188", url: "https://doi.org/10.1097/AOG.0000000000003772" },
  { id: "csep2019", org: "الإرشادات الكندية (SOGC / CSEP)", title: "2019 Canadian guideline for physical activity throughout pregnancy", year: 2019, where: "British Journal of Sports Medicine 52:1339–1346", url: "https://doi.org/10.1136/bjsports-2018-100056" },
  { id: "acsm2026", org: "الكلية الأمريكية للطب الرياضي (ACSM)", title: "Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews (Position Stand)", year: 2026, where: "Medicine & Science in Sports & Exercise 58(4):851–872", url: "https://acsm.org/science-spotlight-acsm-releases-new-position-stand-on-resistance-training/" },
  { id: "acsm2009", org: "الكلية الأمريكية للطب الرياضي (ACSM)", title: "Progression Models in Resistance Training for Healthy Adults (Position Stand)", year: 2009, where: "Medicine & Science in Sports & Exercise 41(3):687–708", url: "https://doi.org/10.1249/MSS.0b013e3181915670" },
  { id: "schoenfeld2017", org: "Schoenfeld, Ogborn, Krieger", title: "Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis", year: 2017, where: "Journal of Sports Sciences 35(11):1073–1082", url: "https://doi.org/10.1080/02640414.2016.1210197" },
  { id: "issn2017", org: "الجمعية الدولية للتغذية الرياضية (ISSN)", title: "Position Stand: protein and exercise", year: 2017, where: "Journal of the International Society of Sports Nutrition 14:20", url: "https://pubmed.ncbi.nlm.nih.gov/28642676/" },
  { id: "morton2018", org: "Morton وآخرون", title: "A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength", year: 2018, where: "British Journal of Sports Medicine 52:376–384", url: "https://doi.org/10.1136/bjsports-2017-097608" },
  { id: "dga2025", org: "وزارتا الزراعة والصحة الأمريكيتان (USDA / HHS)", title: "Dietary Guidelines for Americans, 2025–2030", year: 2026, where: "صدرت 7 يناير 2026", url: "https://extension.okstate.edu/fact-sheets/the-new-dietary-guidelines-for-americans-2025-2030" },
  { id: "whodiet", org: "منظمة الصحة العالمية (WHO)", title: "Healthy diet — Fact sheet (sugars, salt, fats, fruit and vegetables)", year: 2020, where: "who.int", url: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet" },
  { id: "mifflin1990", org: "Mifflin, St Jeor وآخرون", title: "A new predictive equation for resting energy expenditure in healthy individuals", year: 1990, where: "American Journal of Clinical Nutrition 51(2):241–247", url: "https://doi.org/10.1093/ajcn/51.2.241" },
  { id: "iom2009", org: "معهد الطب الأمريكي (IOM / NAM)", title: "Weight Gain During Pregnancy: Reexamining the Guidelines", year: 2009, where: "National Academies Press", url: "https://doi.org/10.17226/12584" },
  { id: "dri", org: "الأكاديميات الوطنية الأمريكية (NASEM)", title: "Dietary Reference Intakes for Energy (2023) and for Macronutrients (2005)", year: 2023, where: "National Academies Press", url: "https://doi.org/10.17226/26818" },
  { id: "whoanc2016", org: "منظمة الصحة العالمية (WHO)", title: "Recommendations on antenatal care for a positive pregnancy experience (folic acid, iron)", year: 2016, where: "who.int", url: "https://www.who.int/publications/i/item/9789241549912" },
  { id: "efsa2010", org: "الهيئة الأوروبية لسلامة الأغذية (EFSA)", title: "Scientific Opinion on Dietary Reference Values for water", year: 2010, where: "EFSA Journal 8(3):1459", url: "https://doi.org/10.2903/j.efsa.2010.1459" },
  { id: "acog462", org: "الكلية الأمريكية لأطباء النساء والولادة (ACOG)", title: "Moderate Caffeine Consumption During Pregnancy (≤200 mg/day)", year: 2010, where: "Committee Opinion No. 462 (reaffirmed)", url: "https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2010/08/moderate-caffeine-consumption-during-pregnancy" },
  { id: "fdafish", org: "إدارة الغذاء والدواء الأمريكية (FDA / EPA)", title: "Advice about Eating Fish — for those who might become or are pregnant or breastfeeding", year: 2021, where: "fda.gov", url: "https://www.fda.gov/food/consumers/advice-about-eating-fish" },
  { id: "paluch2022", org: "Paluch وآخرون", title: "Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts", year: 2022, where: "The Lancet Public Health 7(3):e219–e228", url: "https://doi.org/10.1016/S2468-2667(21)00302-9" },
  { id: "helms2014", org: "Helms, Aragon, Fitschen", title: "Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation", year: 2014, where: "Journal of the International Society of Sports Nutrition 11:20", url: "https://doi.org/10.1186/1550-2783-11-20" },
  { id: "nice2010", org: "المعهد الوطني البريطاني للصحة (NICE)", title: "Weight management before, during and after pregnancy (PH27)", year: 2010, where: "nice.org.uk", url: "https://www.nice.org.uk/guidance/ph27" },
];

/** Every number the plan engine uses, each with where it comes from. */
export const REF = {
  /** WHO 2020: adults 18–64 (and 65+) */
  aerobicModerateMin: 150,
  aerobicModerateMax: 300,
  aerobicVigorousMin: 75,
  /** WHO 2020 + ACSM 2026: every major muscle group, at least 2 days a week */
  strengthDaysMin: 2,
  /** WHO 2020 for children and teens 5–17: an average of 60 minutes a day */
  youthDailyMinutes: 60,
  /** ACOG 804 / WHO 2020 / Canada 2019: pregnancy and after birth, at least 150 min moderate over ≥3 days */
  pregnancyWeeklyMinutes: 150,
  pregnancyDaysMin: 3,
  /** Schoenfeld 2017: ≥10 hard sets per muscle per week for the most growth */
  hypertrophySetsPerMuscle: 10,
  /** Mifflin–St Jeor 1990 */
  mifflin: { weight: 10, height: 6.25, age: 5, male: 5, female: -161 },
  /** physical activity multipliers (FAO/WHO/UNU PAL bands) */
  activity: { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very: 1.9 },
  /** NASEM DRI: extra energy for pregnancy (2nd, 3rd trimester) and breastfeeding (0–6, 7–12 months) */
  pregnancyKcal: { t1: 0, t2: 340, t3: 452 },
  lactationKcal: { early: 330, late: 400 },
  /** a cut of ~20% and a lean bulk of ~10% (Helms 2014; ISSN); never below these floors without a doctor */
  deficit: 0.2,
  surplus: 0.1,
  kcalFloor: { female: 1200, male: 1500 },
  /** protein g/kg/day: DGA 2025–2030 general 1.2–1.6; Morton 2018 ≥1.6 with training; ISSN 1.4–2.0, 2.3–3.1 in a cut */
  protein: { health: 1.2, active: 1.6, muscle: 1.8, cut: 2.0 },
  /** NASEM RDA: pregnancy 1.1 g/kg (≥71 g), breastfeeding 1.3 g/kg */
  proteinPregnancy: 1.1,
  proteinPregnancyMinG: 71,
  proteinLactation: 1.3,
  /** ISSN: 0.25 g/kg (20–40 g) each meal, every 3–4 hours */
  proteinPerMealGkg: 0.25,
  /** AMDR 20–35% of energy from fat; the engine uses 30% (25% when building muscle) */
  fatShare: 0.3,
  fatShareMuscle: 0.25,
  /** 14 g of fibre per 1000 kcal (NASEM) */
  fiberPer1000: 14,
  /** WHO: free sugars <10% of energy (ideally <5%), salt <5 g, fruit and vegetables ≥400 g (5 servings) */
  sugarShareMax: 0.1,
  saltMaxG: 5,
  produceServings: 5,
  /** EFSA 2010: total water a day (food gives ~20%): women 2.0 L, men 2.5 L, +0.3 L pregnant, +0.7 L breastfeeding */
  waterL: { female: 2.0, male: 2.5, pregnancy: 0.3, lactation: 0.7 },
  drinkShare: 0.8,
  cupMl: 250,
  /** ACOG 462 */
  caffeinePregnancyMg: 200,
  /** WHO 2016 ANC */
  folicAcidUg: 400,
  /** Paluch 2022: the benefit levels off at ~6,000–8,000 steps (60+) and ~8,000–10,000 (younger) */
  steps: { under60: 8000, over60: 7000 },
  /** IOM 2009: total gain by pre-pregnancy BMI (kg), single pregnancy */
  gwg: [
    { maxBmi: 18.5, label: "نحافة (أقل من 18.5)", min: 12.5, max: 18 },
    { maxBmi: 25, label: "وزن طبيعي (18.5–24.9)", min: 11.5, max: 16 },
    { maxBmi: 30, label: "زيادة وزن (25–29.9)", min: 7, max: 11.5 },
    { maxBmi: Infinity, label: "سمنة (30 فأكثر)", min: 5, max: 9 },
  ],
} as const;

export interface ResearchSection {
  id: string;
  title: string;
  icon: string;
  /** who it is about */
  for: string;
  points: { text: string; src: string[] }[];
}

export const RESEARCH: ResearchSection[] = [
  {
    id: "activity",
    title: "كم نتحرك؟ التوصيات العامة للنشاط البدني",
    icon: "🏃",
    for: "الرجال والنساء من 18 سنة فأكثر",
    points: [
      { text: "150–300 دقيقة في الأسبوع من نشاط هوائي متوسط الشدة (مشي سريع، دراجة، سباحة) أو 75–150 دقيقة من نشاط عالي الشدة، أو مزيج بينهما.", src: ["who2020"] },
      { text: "تمارين تقوية العضلات لكل المجموعات العضلية الكبيرة يومين أو أكثر في الأسبوع، بشدة متوسطة أو أعلى.", src: ["who2020", "acsm2026"] },
      { text: "أي حركة أفضل من لا شي، وما في حد أدنى لمدة الجلسة: حتى المشي القصير يُحسب. تقليل الجلوس الطويل واستبداله بأي نشاط له فائدة.", src: ["who2020"] },
      { text: "فوق 65 سنة: نفس الكميات مع تمارين توازن متعددة المكوّنات 3 أيام في الأسبوع للوقاية من السقوط.", src: ["who2020"] },
      { text: "الأطفال والمراهقون (5–17): معدل 60 دقيقة يوميًا، وتقوية عضلات وعظام 3 أيام في الأسبوع.", src: ["who2020"] },
      { text: "الخطوات: فائدة تقليل الوفيات تستقر تقريبًا عند 6,000–8,000 خطوة يوميًا فوق الستين، و8,000–10,000 لمن هو أصغر.", src: ["paluch2022"] },
    ],
  },
  {
    id: "strength",
    title: "تمارين المقاومة (الجيم): كم مجموعة وكم تكرار؟",
    icon: "🏋️",
    for: "البالغين الأصحاء، رجال ونساء",
    points: [
      { text: "تحديث ACSM 2026 (مراجعة لـ137 مراجعة منهجية وأكثر من 30 ألف مشارك): الأهم هو الاستمرار وتمرين كل العضلات الكبيرة مرتين على الأقل أسبوعيًا، لا البحث عن برنامج «مثالي» معقد.", src: ["acsm2026"] },
      { text: "للقوة القصوى: أوزان ثقيلة (~80% من أقصى وزن أو أكثر، 3–6 تكرارات). للحجم العضلي: نطاق واسع يعمل (6–30 تكرار) بشرط الاقتراب من التعب، ويكفي ترك 1–3 تكرارات «في الخزان» بدل الوصول للفشل كل مرة.", src: ["acsm2026", "acsm2009"] },
      { text: "الحجم الأسبوعي: كلما زادت المجموعات زاد النمو، وأفضل النتائج عند 10 مجموعات أو أكثر لكل عضلة أسبوعيًا؛ المبتدئ يبدأ بأقل ويزيد تدريجيًا.", src: ["schoenfeld2017"] },
      { text: "عدد الأيام: المبتدئ 2–3 أيام (جسم كامل)، المتوسط 3–4 (علوي/سفلي)، المتقدم 4–6 (دفع/سحب/أرجل). البرنامج الأنسب هو اللي تقدر تلتزم فيه وتستمتع فيه.", src: ["acsm2009", "acsm2026"] },
      { text: "الراحة بين المجموعات: 2–3 دقائق للتمارين المركبة الكبيرة، و1–2 للعزل. التدرّج: زد الوزن أو التكرار شوي شوي متى صارت المجموعات أسهل.", src: ["acsm2009"] },
      { text: "المرأة تتمرن بنفس المبادئ ونفس البرامج وتستفيد نفس الفائدة النسبية من المقاومة؛ ما تحتاج «برنامج نسائي» خاص.", src: ["acsm2026"] },
    ],
  },
  {
    id: "energy",
    title: "السعرات: كم يحتاج جسمك؟",
    icon: "🔥",
    for: "الجميع",
    points: [
      { text: "معادلة ميفلين–سانت جيور هي الأدق لتقدير الحرق وقت الراحة: للرجل 10×الوزن + 6.25×الطول − 5×العمر + 5، وللمرأة نفسها − 161. ثم تُضرب في معامل النشاط (1.2 قليل الحركة … 1.9 نشيط جدًا).", src: ["mifflin1990"] },
      { text: "إنقاص الوزن: عجز تقريبًا 20% يعطي نزولًا بحدود 0.5–1% من الوزن أسبوعيًا مع الحفاظ على العضل، بشرط بروتين عالي ومقاومة. لا ننزل تحت 1200 سعرة للمرأة و1500 للرجل بدون إشراف طبي.", src: ["helms2014", "issn2017"] },
      { text: "بناء العضل: زيادة بسيطة 5–10% فوق الحاجة تكفي وتقلل تراكم الدهون.", src: ["helms2014"] },
    ],
  },
  {
    id: "macros",
    title: "البروتين والدهون والكربوهيدرات والألياف",
    icon: "🥩",
    for: "الجميع",
    points: [
      { text: "الإرشادات الأمريكية الجديدة 2025–2030 رفعت البروتين للبالغين إلى 1.2–1.6 غ لكل كيلو يوميًا، وتطلب بروتين في كل وجبة وأطعمة كاملة غير مصنّعة.", src: ["dga2025"] },
      { text: "مع تمارين المقاومة: الفائدة تستقر تقريبًا عند 1.6 غ/كغ (حدها الأعلى المعقول 2.2)، وISSN توصي 1.4–2.0 للرياضيين، و2.3–3.1 أثناء التنشيف الشديد للحفاظ على العضل.", src: ["morton2018", "issn2017"] },
      { text: "توزيع البروتين: 0.25 غ/كغ (20–40 غ) في الوجبة، كل 3–4 ساعات.", src: ["issn2017"] },
      { text: "الدهون 20–35% من السعرات، مع تقليل الدهون المشبعة لأقل من 10% والابتعاد عن المتحولة. الكربوهيدرات تكمل الباقي، ومعظمها من حبوب كاملة وفواكه وخضار.", src: ["dri", "whodiet"] },
      { text: "الألياف: 14 غ لكل 1000 سعرة (تقريبًا 25 غ للمرأة و38 للرجل).", src: ["dri"] },
      { text: "منظمة الصحة العالمية: السكريات الحرة أقل من 10% من السعرات (والأفضل أقل من 5%)، الملح أقل من 5 غ يوميًا، و400 غ فواكه وخضار على الأقل (5 حصص).", src: ["whodiet"] },
      { text: "الماء (EFSA): مجموع الماء اليومي من الأكل والشرب 2 لتر للمرأة و2.5 للرجل؛ تقريبًا 80% منه شرب. يزيد مع الحر والتمرين.", src: ["efsa2010"] },
    ],
  },
  {
    id: "pregnancy-exercise",
    title: "الرياضة أثناء الحمل",
    icon: "🤰",
    for: "الحامل",
    points: [
      { text: "إذا ما فيه مانع طبي، الرياضة أثناء الحمل آمنة ومطلوبة: 150 دقيقة على الأقل أسبوعيًا من نشاط متوسط موزعة على 3 أيام أو أكثر (والأفضل كل يوم)، مع تمارين مقاومة.", src: ["acog804", "who2020", "csep2019"] },
      { text: "فوائدها المثبتة: تقليل سكري الحمل وتسمم الحمل والزيادة الزائدة في الوزن والاكتئاب، بدون زيادة خطر الإجهاض أو انخفاض وزن المولود.", src: ["csep2019", "acog804"] },
      { text: "اللي كانت تتمرن قبل الحمل (حتى المقاومة والجري) تكمل غالبًا بنفس نشاطها مع التعديل حسب الإحساس وبموافقة طبيبتها؛ اللي ما كانت تتمرن تبدأ تدريجيًا.", src: ["acog804"] },
      { text: "الشدة: «اختبار الكلام» — تقدرين تتكلمين وأنتِ تتمرنين. تمارين قاع الحوض (كيجل) يوميًا تقلل سلس البول.", src: ["acog804", "csep2019"] },
      { text: "تجنبي: الاستلقاء الطويل على الظهر بعد منتصف الحمل (استبدليه بمقعد مائل أو جانبي)، حبس النفس مع الأوزان الثقيلة، رياضات الاحتكاك والسقوط، الغوص، التمرين في الحر الشديد أو اليوغا الساخنة، والقفز على البطن.", src: ["acog804"] },
      { text: "موانع تحتاج الطبيبة قبل أي رياضة: أمراض قلب أو رئة مهمة، عنق رحم ضعيف أو مربوط، حمل توأم مع خطر ولادة مبكرة، نزيف مستمر في الثلث الثاني أو الثالث، المشيمة المنزاحة بعد 26 أسبوع، تسمم الحمل أو ضغط غير منضبط، تمزق الأغشية، فقر دم شديد.", src: ["acog804"] },
      { text: "أوقفي التمرين فورًا وكلمي الطبيبة إذا صار: نزيف، انقباضات منتظمة مؤلمة، نزول ماء، ضيق تنفس قبل الجهد، دوخة، صداع، ألم صدر، ضعف عضلات يأثر على التوازن، ألم أو تورم في السمانة.", src: ["acog804"] },
    ],
  },
  {
    id: "pregnancy-nutrition",
    title: "تغذية الحامل",
    icon: "🍼",
    for: "الحامل",
    points: [
      { text: "السعرات: ما فيه زيادة في الثلث الأول، ثم حوالي +340 سعرة يوميًا في الثلث الثاني و+452 في الثلث الثالث. «الأكل عن اثنين» خطأ.", src: ["dri", "iom2009"] },
      { text: "الحمل ليس وقت الرجيم: لا عجز في السعرات حتى مع زيادة الوزن؛ الهدف زيادة صحية ضمن المدى حسب كتلة الجسم قبل الحمل.", src: ["iom2009", "nice2010"] },
      { text: "الزيادة المناسبة في الوزن (IOM 2009، حمل مفرد): نحافة 12.5–18 كغ، طبيعي 11.5–16، زيادة وزن 7–11.5، سمنة 5–9.", src: ["iom2009"] },
      { text: "البروتين: 1.1 غ/كغ يوميًا (71 غ على الأقل) حسب الحد الموصى به، ويحتاج أكثر في آخر الحمل.", src: ["dri"] },
      { text: "حمض الفوليك 400 ميكروغرام يوميًا (يبدأ قبل الحمل لو أمكن) والحديد حسب وصف الطبيبة؛ اليود وفيتامين د وأوميغا-3 (DHA) حسب الطبيبة.", src: ["whoanc2016"] },
      { text: "الكافيين أقل من 200 ملغ يوميًا (كوب أو كوبين قهوة عادية).", src: ["acog462"] },
      { text: "السمك: 2–3 حصص أسبوعيًا من الأنواع قليلة الزئبق (سلمون، سردين، روبيان، بلطي)، وتجنب القرش وسمك السيف والماكريل الملكي. تجنبي اللحم والبيض النيّ والأجبان والحليب غير المبستر.", src: ["fdafish"] },
      { text: "الماء: +300 مل فوق المعتاد.", src: ["efsa2010"] },
    ],
  },
  {
    id: "postpartum",
    title: "بعد الولادة والرضاعة",
    icon: "👶",
    for: "بعد الولادة والمرضعة",
    points: [
      { text: "الرجوع للرياضة تدريجيًا حسب نوع الولادة وموافقة الطبيبة؛ المشي وتمارين قاع الحوض تبدأ مبكرًا، والهدف 150 دقيقة أسبوعيًا.", src: ["acog804", "who2020"] },
      { text: "الرياضة ما تقلل حليب الرضاعة ولا تغيّر نمو الطفل.", src: ["acog804"] },
      { text: "المرضعة تحتاج حوالي +330 سعرة (أول 6 أشهر) و+400 بعدها، والبروتين 1.3 غ/كغ، والماء +700 مل.", src: ["dri", "efsa2010"] },
      { text: "نزول الوزن بعد الولادة يكون بطيء ومعتدل (حوالي نصف كيلو بالأسبوع كحد أعلى) بدون رجيم قاسي أثناء الرضاعة.", src: ["nice2010"] },
    ],
  },
  {
    id: "women-men",
    title: "فروق الرجل والمرأة",
    icon: "⚖️",
    for: "الرجال والنساء",
    points: [
      { text: "نفس توصيات الحركة والمقاومة للجنسين؛ الفرق في الحاجة للطاقة (معادلة الحرق) والماء والألياف.", src: ["who2020", "mifflin1990", "efsa2010"] },
      { text: "المرأة قبل سن اليأس تحتاج حديد أكثر (18 ملغ مقابل 8 للرجل)، ومن تفكر في الحمل تبدأ حمض الفوليك 400 ميكروغرام.", src: ["dri", "whoanc2016"] },
      { text: "بعد سن اليأس: المقاومة وتمارين التحميل تحمي العظام والعضل، مع كالسيوم وفيتامين د كافيين.", src: ["acsm2026", "who2020"] },
    ],
  },
  {
    id: "safety",
    title: "سلامتك أولًا",
    icon: "🩺",
    for: "الجميع",
    points: [
      { text: "هذي توصيات عامة للأصحاء، ما تغني عن الطبيب. من عنده مرض قلب أو ضغط أو سكري أو إصابة، أو حامل، يستشير طبيبه قبل ما يبدأ.", src: ["acog804", "who2020"] },
      { text: "أوقف التمرين إذا حسيت ألم صدر، ضيق تنفس غير طبيعي، دوخة أو إغماء، أو ألم مفاصل حاد.", src: ["acsm2009"] },
      { text: "أقل من 18 سنة: لا رجيم ولا عجز في السعرات بدون طبيب؛ التركيز على الحركة والأكل الصحي.", src: ["who2020"] },
    ],
  },
];

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);
