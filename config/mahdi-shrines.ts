// «لأجل المهدي» · how each shrine's picture is made with GPT Image 2 (from the owner's tool in /admin/mahdi).
// The architecture of each place was checked against published descriptions (Wikipedia and Wikishia pages of each
// shrine, checked 2026-10-04) so the picture shows the real building: its domes, minarets, colours and setting.
// The owner reviews every picture before it is shown, and can edit the description before generating.
// The pictures shipped with the site (public/mahdi/shrines/, set by migration 0022) were made from these same
// descriptions and checked against photographs of each building.

/** The same look as the Najaf picture: a reverent, warm, cinematic illustration with open sky for the text. */
export const SHRINE_STYLE = `A reverent, cinematic digital painting (an illustration, not a photograph) of the real place described below, in warm golden-hour light: a deep blue sky turning amber near the horizon, the first stars, soft glowing clouds and a few white doves in flight. Wide 3:2 landscape composition, the building centred in the lower two thirds with open sky above, a clean marble courtyard or plaza in the foreground. Faithful to the real architecture as described: do not add or remove domes or minarets, do not change their colours. No people in close-up and no faces, no crowds, no text, no letters, no calligraphy that can be read, no watermark, no logo.`;

export interface ShrineArt {
  /** The place and its architecture (the style above is added). */
  prompt: string;
  /** Alternative text (Arabic) for the picture. */
  alt: string;
  /** CSS object-position of the focal point. */
  position: string;
}

export const SHRINE_ART: Record<string, ShrineArt> = {
  "imam-hussain": {
    prompt: `The holy shrine of Imam al-Husayn in Karbala, Iraq: one large dome entirely covered in gold, with a ring of twelve arched windows around its drum and blue-and-gold tilework below it; two tall golden minarets flanking the dome; long walls of the courtyard lined with arched iwans in blue, turquoise and gold tile mosaic; a monumental gate with a golden clock tower. Warm lights glowing from the arches.`,
    alt: "حرم الإمام الحسين عليه السلام في كربلاء المقدسة بقبته الذهبية ومئذنتيه",
    position: "50% 60%",
  },
  abbas: {
    prompt: `The holy shrine of Abu al-Fadl al-Abbas in Karbala, Iraq: a large gilded golden dome above a drum of blue and turquoise tiles; two golden minarets flanking the southern entrance; a large golden enamelled main door in a tall iwan decorated with blue tile mosaic and glimpses of mirror work inside; a square courtyard lined with arched chambers.`,
    alt: "حرم أبي الفضل العباس عليه السلام في كربلاء المقدسة",
    position: "50% 60%",
  },
  prophet: {
    prompt: `Al-Masjid an-Nabawi, the Prophet's Mosque in Madinah: the emerald-green dome over the Prophet's chamber beside the historic Mamluk-style main minaret; vast white marble plazas with large white umbrella canopies, some opened; several very tall, slender minarets of pale stone with green-tinged finials rising around the mosque; white and cream stone arcades glowing warm amber at dusk.`,
    alt: "المسجد النبوي الشريف في المدينة المنورة بقبته الخضراء ومآذنه",
    position: "50% 55%",
  },
  baqi: {
    prompt: `Jannat al-Baqi, the historic cemetery of Madinah, as it is today, shown with reverence: a wide, quiet plain of simple low grave stones and earth mounds with narrow paths, enclosed by a low pale wall, with no domes or buildings over the graves. Beyond it, the pale walls, tall minarets and the green dome of the Prophet's Mosque glow softly in the warm light. A calm, solemn and dignified mood.`,
    alt: "بقيع الغرقد في المدينة المنورة ومن خلفه المسجد النبوي الشريف",
    position: "50% 55%",
  },
  kadhimiya: {
    prompt: `The holy shrine of al-Kadhimiya in Baghdad, Iraq (the shrine of Imam Musa al-Kadhim and Imam Muhammad al-Jawad): two equal golden domes side by side; four tall golden minarets at the corners and four small golden minaret-shaped towers around the domes; tall iwans with blue and turquoise tile mosaic and mirror work; a golden clock tower over the main gate; a large rectangular marble courtyard.`,
    alt: "الحرم الكاظمي الشريف بقبتيه الذهبيتين ومآذنه في الكاظمية المقدسة",
    position: "50% 60%",
  },
  askariyain: {
    prompt: `The holy shrine of the two Imams al-Askari in Samarra, Iraq: one very large golden dome, among the largest in the world, above a drum and walls of light blue tiles; two tall golden minarets; a golden clock tower; beside it, a smaller domed building marking the cellar (sardab) associated with Imam al-Mahdi; a wide marble courtyard.`,
    alt: "حرم الإمامين العسكريين عليهما السلام في سامراء المقدسة بقبته الذهبية الكبيرة",
    position: "50% 60%",
  },
  "imam-ridha": {
    prompt: `The holy shrine of Imam Ali al-Ridha in Mashhad, Iran: a tall double golden dome with a band of inscription in white on lapis-blue tiles around its base; a monumental golden iwan with muqarnas vaulting; golden minarets beside the dome; courtyards with blue mosaic tilework and a pool; in the background the turquoise-blue dome of the Goharshad Mosque.`,
    alt: "حرم الإمام علي بن موسى الرضا عليه السلام في مشهد المقدسة",
    position: "50% 60%",
  },
  "sayyida-zainab": {
    prompt: `The holy shrine of Sayyida Zaynab near Damascus, Syria: one gilded golden dome above a drum of blue and turquoise Persian tilework; two tall minarets covered in blue and turquoise tiles with golden tops; a square courtyard and an iwan facade richly tiled in blue, turquoise and gold.`,
    alt: "حرم السيدة زينب عليها السلام في دمشق",
    position: "50% 60%",
  },
  masuma: {
    prompt: `The holy shrine of Sayyida Fatima al-Ma'suma in Qom, Iran: a golden dome above the mausoleum; a golden iwan with muqarnas vaulting; slender minarets, golden and blue-tiled; courtyards with turquoise and blue tile mosaics and a pool; glimpses of mirror work glowing inside the halls.`,
    alt: "حرم السيدة فاطمة المعصومة عليها السلام في قم المقدسة",
    position: "50% 60%",
  },
  kufa: {
    prompt: `The Great Mosque of Kufa, Iraq: a large square enclosure with high outer walls, semicircular bastions along them and round towers at the corners; four minarets; a wide marble courtyard; the golden-domed shrines of Muslim ibn Aqil and Hani ibn Urwa attached to the mosque.`,
    alt: "مسجد الكوفة المعظم",
    position: "50% 60%",
  },
  sahla: {
    prompt: `Masjid al-Sahla in Kufa, Iraq, the mosque associated with Imam al-Mahdi: a large rectangular enclosure with tall walls and semicircular towers along them; one dome and two minarets about 30 metres high, finished in traditional Iraqi blue and gold tilework; arcaded walkways (riwaqs) around a wide courtyard, softly lit at dusk.`,
    alt: "مسجد السهلة المعظم في الكوفة، مقام صاحب الزمان عجل الله فرجه",
    position: "50% 60%",
  },
  jamkaran: {
    prompt: `The Jamkaran Mosque near Qom, Iran, associated with Imam al-Mahdi: a large main dome covered in turquoise tiles with geometric patterns, two very tall minarets with octagonal shafts in blue and turquoise tiles, smaller turquoise domes around it, and a vast courtyard.`,
    alt: "مسجد جمكران المقدس قرب قم",
    position: "50% 60%",
  },
};
