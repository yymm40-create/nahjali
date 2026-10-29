-- «وقّف السكرول: دورة صانع المحتوى» (the owner, 29 October 2026): a live + recorded course about carousels and motion graphics,
-- sold on the courses page with the price clock: day one the whole course (live + recorded) 49.99; day two live 49 or the whole
-- 100; after that live 80 and recorded 150 (the usual prices). The clock starts when the owner presses «نزل الريل الآن» in
-- /admin/course. Prices are kept to the halala now (49.99). Safe to run more than once: the course is added once, and the
-- clock's settings are written over (the other settings — bank, Telegram, group link — stay as they are).

-- 1) prices to the halala
alter table public.course_orders alter column amount_sar type numeric(10, 2) using amount_sar::numeric;
alter table public.course_orders alter column was_sar type numeric(10, 2) using was_sar::numeric;

-- 2) the course itself (shown on the courses page; its price_sar is the usual recorded price, the page shows the clock's price)
insert into public.learn_courses (id, title, summary, unlock, published, position, price_sar, was_sar)
values (
  '3b68eb1d-ca1b-4e71-a5f7-78013603b443',
  'وقّف السكرول: دورة صانع المحتوى للكاروسيل والموشن جرافكس',
  $s$دورة مباشرة + مسجلة تطلع منها تسوي كاروسيل يوقّف السكرول وموشن جرافكس احترافي بضغطة زر من منصة الجواد، بأرخص الأسعار، وتعدّل فيه كل شي بنفسك. ينفعك في الإعلانات ونمو حسابك وشرح أي موضوع.
تنبيه مهم: إذا تُوفّي المدرّب أو عجز قبل تقديم الدورة أو قبل رفع نسختها المسجلة، فلا يكون عليه أي التزام مالي تجاه المشتركين.$s$,
  '{}',
  true,
  0,
  150,
  230
)
on conflict (id) do nothing;

-- the recording's two parts (the owner adds the lessons under them after the live session)
insert into public.learn_days (course_id, title, position)
select '3b68eb1d-ca1b-4e71-a5f7-78013603b443', d.title, d.pos
from (values ('الكاروسيل اللي يوقّف السكرول', 0), ('الموشن جرافكس بضغطة زر', 1)) as d(title, pos)
where not exists (select 1 from public.learn_days x where x.course_id = '3b68eb1d-ca1b-4e71-a5f7-78013603b443');

-- 3) the clock now drives this course: its prices, its page's words, its terms (not started: the page says «قريبًا» until he presses the button)
insert into public.course_settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;
update public.course_settings
set data = data || jsonb_build_object(
  'ladderCourseId', '3b68eb1d-ca1b-4e71-a5f7-78013603b443',
  'launchAt', null,
  'hoursA', 24,
  'hoursB', 48,
  'prices', jsonb_build_object('comboA', 49.99, 'liveB', 49, 'recordedB', 0, 'comboB', 100, 'liveC', 80, 'recordedC', 150),
  'was', jsonb_build_object('live', 80, 'recorded', 150),
  'bonus', jsonb_build_object('comboA', 0, 'recordedB', 0, 'recordedC', 0),
  'headline', $h$من فكرة في راسك إلى كاروسيل وموشن جرافكس يوقّف السكرول، بضغطة زر$h$,
  'subhead', $h$دورة مباشرة ومسجلة: نمشي معك على منصة الجواد خطوة بخطوة، تسوي كاروسيل بستايل النوتبوك وموشن جرافكس جاهز للريلز والإعلانات، بأرخص الأسعار، وتعدّل فيه كل شي بنفسك.$h$,
  'problem', $h$تتعب على المحتوى، والسكرول يعدّيه في ثانية. الكاروسيل يبي له مصمم، والموشن جرافكس يبي له برامج مونتاج وشهور تعلّم أو مبالغ كبيرة على كل مقطع. والنتيجة: حساب واقف وإعلانات ما تجيب نتيجة.$h$,
  'days', jsonb_build_array(
    jsonb_build_object('title', 'الكاروسيل اللي يوقّف السكرول', 'points', jsonb_build_array(
      'وش هو الكاروسيل: بوست تقلّبه بالسكرول، ومتى يكون أقوى من الصورة الوحدة',
      'قبل وبعد: كاروسيل سوّاه عميل في الجواد، وكيف صار خرافي بملاحظات بسيطة',
      'ستايل النوتبوك خطوة بخطوة، من الفكرة إلى آخر شريحة',
      'كيف تستخدمه في الإعلانات ونمو حسابك وشرح أي موضوع'
    )),
    jsonb_build_object('title', 'الموشن جرافكس بضغطة زر', 'points', jsonb_build_array(
      'أمثلة موشن جرافكس كاملة، ومقاطع من فيديوهاتي',
      'تسوي موشن جرافكس من الجواد بضغطة زر وبأرخص الأسعار',
      'تعدّل كل كلمة ولون وحركة بنفسك بدون برامج',
      'تطلّعه جاهز للريلز والإعلانات'
    ))
  ),
  'ladderRisks', jsonb_build_array(
    'تطبّق على منصة الجواد نفسها: بدون برامج ولا اشتراك شهري',
    'في البث المباشر تطبّق معي خطوة بخطوة وتسأل عن أي شي',
    'المسجلة (مع الدورة الكاملة أو المسجلة) تظهر لك في «دوراتي» مدى الحياة، تعيد أي درس لين تتقنه',
    'السعر اللي شفته محفوظ لك ٣ ساعات لين تحوّل'
  ),
  'terms', $t$تنبيه مهم: إذا تُوفّي المدرّب أو عجز قبل تقديم الدورة أو قبل رفع نسختها المسجلة، فلا يكون عليه أي التزام مالي تجاه المشتركين.$t$
),
updated_at = now()
where id = 1;
