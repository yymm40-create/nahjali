-- «لأجل المهدي» · the shrines, completed: the holy places missing from the list are added, every place gets its
-- picture (illustrations made from researched descriptions of each building, shipped with the site under
-- /mahdi/shrines/), and a public folder holds the pictures the owner generates and approves later in /admin/mahdi.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run (after 0021). Safe to run again: a place whose
-- picture the owner has already set keeps it.

insert into public.mahdi_shrines (id, name, place, image_url, image_alt, image_position, is_artwork, sort_order, active) values
  ('abbas', 'حرم أبي الفضل العباس عليه السلام', 'كربلاء المقدسة', null, '', '50% 50%', true, 5, false),
  ('sayyida-zainab', 'حرم السيدة زينب عليها السلام', 'دمشق', null, '', '50% 50%', true, 9, false),
  ('masuma', 'حرم السيدة فاطمة المعصومة عليها السلام', 'قم المقدسة', null, '', '50% 50%', true, 10, false),
  ('kufa', 'مسجد الكوفة المعظم', 'الكوفة', null, '', '50% 50%', true, 11, false),
  ('sahla', 'مسجد السهلة المعظم، مقام صاحب الزمان عجل الله فرجه', 'الكوفة', null, '', '50% 50%', true, 12, false),
  ('jamkaran', 'مسجد جمكران المقدس', 'قم المقدسة', null, '', '50% 50%', true, 13, false)
on conflict (id) do nothing;

-- The order: Najaf, Karbala (al-Hussain, al-Abbas), Madinah, al-Baqi, Kadhimiya, Samarra, Mashhad, then the rest
update public.mahdi_shrines set sort_order = 2 where id = 'imam-hussain';
update public.mahdi_shrines set sort_order = 3 where id = 'abbas';
update public.mahdi_shrines set sort_order = 4 where id = 'prophet';
update public.mahdi_shrines set sort_order = 5 where id = 'baqi';
update public.mahdi_shrines set sort_order = 6 where id = 'kadhimiya';
update public.mahdi_shrines set sort_order = 7 where id = 'askariyain';
update public.mahdi_shrines set sort_order = 8 where id = 'imam-ridha';

-- Approved pictures (public: the home screen shows them to everyone). Only the server writes here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('mahdi-shrines', 'mahdi-shrines', true, 10485760, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- The pictures: only places that have none yet get them (and are shown)
update public.mahdi_shrines s
set image_url = v.url,
    image_alt = v.alt,
    image_position = v.pos,
    image_credit = 'لوحة فنية مولّدة بالذكاء الاصطناعي من وصف معماري للمكان، روجعت مع صوره الحقيقية',
    is_artwork = true,
    active = true
from (values
  ('imam-hussain', '/mahdi/shrines/imam-hussain.jpg', 'حرم الإمام الحسين عليه السلام في كربلاء المقدسة بقبته الذهبية ومئذنتيه', '50% 60%'),
  ('abbas', '/mahdi/shrines/abbas.jpg', 'حرم أبي الفضل العباس عليه السلام في كربلاء المقدسة', '50% 60%'),
  ('prophet', '/mahdi/shrines/prophet.jpg', 'المسجد النبوي الشريف في المدينة المنورة بقبته الخضراء ومآذنه', '50% 55%'),
  ('baqi', '/mahdi/shrines/baqi.jpg', 'بقيع الغرقد في المدينة المنورة ومن خلفه المسجد النبوي الشريف', '50% 55%'),
  ('kadhimiya', '/mahdi/shrines/kadhimiya.jpg', 'الحرم الكاظمي الشريف بقبتيه الذهبيتين ومآذنه في الكاظمية المقدسة', '50% 60%'),
  ('askariyain', '/mahdi/shrines/askariyain.jpg', 'حرم الإمامين العسكريين عليهما السلام في سامراء المقدسة بقبته الذهبية الكبيرة', '50% 60%'),
  ('imam-ridha', '/mahdi/shrines/imam-ridha.jpg', 'حرم الإمام علي بن موسى الرضا عليه السلام في مشهد المقدسة', '50% 60%'),
  ('sayyida-zainab', '/mahdi/shrines/sayyida-zainab.jpg', 'حرم السيدة زينب عليها السلام في دمشق', '50% 60%'),
  ('masuma', '/mahdi/shrines/masuma.jpg', 'حرم السيدة فاطمة المعصومة عليها السلام في قم المقدسة', '50% 60%'),
  ('kufa', '/mahdi/shrines/kufa.jpg', 'مسجد الكوفة المعظم', '50% 60%'),
  ('sahla', '/mahdi/shrines/sahla.jpg', 'مسجد السهلة المعظم في الكوفة، مقام صاحب الزمان عجل الله فرجه', '50% 60%'),
  ('jamkaran', '/mahdi/shrines/jamkaran.jpg', 'مسجد جمكران المقدس قرب قم', '50% 60%')
) as v (id, url, alt, pos)
where s.id = v.id and s.image_url is null;
