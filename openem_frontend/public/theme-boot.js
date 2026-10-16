/*
 * Define o tema antes da pintura, para não piscar a cor errada. Carregado
 * pelo index.html no <head>, de forma síncrona, antes do CSS. Fica num arquivo
 * (e não inline no HTML) para a Content-Security-Policy do nginx liberar só
 * scripts da própria origem, sem 'unsafe-inline' nem hash.
 *
 * Não pode importar nada: espelha initialTheme() de src/theme.tsx e
 * applyCustomTheme() de src/theme-custom.ts; theme-boot.test.ts confere os
 * dois lados.
 */
(function () {
  var root = document.documentElement;
  var families = [
    'default', 'sepia', 'azure', 'indigo', 'forest', 'gold', 'fire',
    'cyberpunk', 'synthwave', 'terminal', 'arctic', 'sakura', 'ocean',
    'oled', 'eclipse', 'abyss', 'ember', 'contrast'
  ];
  var keys = ['bg', 'sidebar', 'surface', 'surface-2', 'fg', 'muted', 'line', 'brand', 'brand-2', 'brand-ink'];
  var hex = /^#[0-9a-f]{6}$/i;
  var prefersLight = false;
  try {
    prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  } catch (e) {}
  var theme = prefersLight ? 'default-light' : 'default-dark';
  try {
    if (localStorage.getItem('openem.theme.fx') === 'off') root.dataset.fx = 'off';
    var saved = localStorage.getItem('openem.theme') || '';
    var m = /^([a-z]+)-(light|dark)$/.exec(saved);
    if (m && families.indexOf(m[1]) >= 0) {
      theme = saved;
    } else if (saved === 'custom' || (m && m[1] === 'custom')) {
      var custom = JSON.parse(localStorage.getItem('openem.theme.custom') || 'null');
      var side = null;
      var tokens = null;
      if (custom && typeof custom === 'object') {
        if (custom.light || custom.dark) {
          // Formato atual: os dois lados.
          side = m ? m[2] : 'light';
          tokens = custom[side];
        } else {
          // Formato antigo: um lado só, escolhido pela luminância do fundo.
          tokens = custom;
          var b = /^#?([0-9a-f]{6})$/i.exec(String(custom.bg || '').trim());
          var l = 1;
          if (b) {
            var n = parseInt(b[1], 16);
            var c = function (v) {
              v = v / 255;
              return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            };
            l = 0.2126 * c((n >> 16) & 255) + 0.7152 * c((n >> 8) & 255) + 0.0722 * c(n & 255);
          }
          side = l < 0.18 ? 'dark' : 'light';
        }
      }
      if (tokens && typeof tokens === 'object') {
        theme = 'custom-' + side;
        for (var i = 0; i < keys.length; i++) {
          var v = tokens[keys[i]];
          // Só #rrggbb: nada de url()/var() vindo do armazenamento.
          if (typeof v === 'string' && hex.test(v.trim())) {
            root.style.setProperty('--' + keys[i], v.trim().toLowerCase());
          }
        }
      }
    }
  } catch (e) {}
  root.dataset.theme = theme;
})();
