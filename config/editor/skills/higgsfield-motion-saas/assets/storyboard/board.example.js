// Copy next to your film, edit, render: node capture.mjs "<skill>/assets/storyboard/storyboard.html?board=/abs/film/board.js" out --stills 0
// img paths are relative to THIS file.
window.BOARD = {
  title: 'NOVA — launch 15s · 16:9 · сториборд v1',
  subtitle: 'Всё кодом: HTML/Canvas → headless Chromium → motion blur сабфреймами → H.264. 30 fps, склейки на 120 BPM.',
  accent: '#FF6B2C',
  frames: [
    { img: 'stills/sb/still_0.80.png', time: '0.0–1.6', name: 'Хук', text: 'Промпт-бар выезжает с инерционным отскоком, печатает запрос; клик → игла-зум прямо в кнопку, пик скорости на склейке.' },
    { img: 'stills/sb/still_2.90.png', time: '1.6–3.0', name: 'Титр', text: 'Камера продолжает лететь вперёд (масштаб растёт из .38), фон разливается из кнопки; «ships today» поднимается по буквам.' },
  ],
  fonts: [
    { family: 'Unbounded', weight: 900, role: 'дисплей', sample: 'NOVA 2.0' },
    { family: 'Geist', weight: 500, role: 'UI', sample: 'Ship the launch film tonight' },
  ],
  passport: {
    title: 'Паспорт v1',
    swatches: ['#5B3DF5', '#FF6B2C', '#33E0A1', '#EEEAE3', '#14111F'],
    tech: '30 fps · 120 BPM, склейки на бит · моушн-блюр 4/16 сабфреймов · линза: бочка, хроматика, блум, виньетка · звук синтезом (плейсхолдер) + версия без звука',
    diffs: 'своя палитра (фиолетовый + мандарин вместо лайма рефа), свои формы и шрифты, другой сценарий; из рефов взяты только ритм и приёмы переходов.',
    estimate: 'после «гоу» ≈ 30–45 мин до ролика, каждый раунд правок 15–30 мин.',
  },
};
