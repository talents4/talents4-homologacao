/* Tradução do sistema (início: navegação lateral + rótulos globais).
   O idioma é uma configuração do sistema inteiro (não por pessoa): fica em
   public.t4_system_settings, editável só por administradores em
   Configurações → Idioma. A casca da página (menu lateral) é montada de
   forma síncrona em t4-v2-core.js, antes de qualquer leitura ao Supabase
   ser possível — por isso a tradução acontece como uma segunda passada,
   depois que t4:ready confirma a sessão: os rótulos aparecem em português
   por um instante e trocam para o idioma configurado assim que ele é lido.
   Cobertura desta primeira etapa: menu lateral (áreas do sistema, espaços
   de cada área, "Mais espaços") — a base para expandir a outras telas nas
   próximas rodadas, sem trocar o mecanismo. */
(function () {
  'use strict';

  const SWITCH_LABELS_DE = {
    talents: 'Talente', organization: 'Organisation', contacts: 'Kontakte',
    german: 'Deutsch', documentation: 'Dokumentation', settings: 'Einstellungen'
  };

  // Os ids de "view" se repetem entre módulos com sentidos diferentes
  // (ex.: "opportunities" é "Mercado" em Talentos mas "Oportunidades" em
  // Organizacional) — por isso o dicionário é aninhado por módulo.
  const VIEW_LABELS_DE = {
    talents: {
      overview: 'Mein Tag', talents: 'Talente', processes: 'Auswahlverfahren', presentation: 'Präsentationen',
      agenda: 'Integrierter Kalender', opportunities: 'Marktplatz', mapping: 'Talentverfolgung',
      manual: 'Benutzerhandbuch', archived: 'Talentarchiv'
    },
    organization: {
      overview: 'Mein Tag', employers: 'Arbeitgeber', pipeline: 'Auswahlverfahren', opportunities: 'Chancen',
      calendar: 'Kalender', planning: 'Monatsplanung', meetings: 'Besprechungen', operations: 'Aufgabenplan',
      summary: 'Gesamtübersicht', history: 'Vorheriges Archiv'
    },
    contacts: {
      all: 'Kontaktverzeichnis', people: 'Personen', organizations: 'Organisationen',
      followups: 'Nächste Schritte', categories: 'Kategorien', duplicates: 'Duplikate prüfen'
    },
    german: {
      overview: 'Mein Tag', classes: 'Kurse', students: 'Einschreibungen',
      attention: 'Zu beobachten', history: 'Verlaufshistorie'
    },
    documentation: { home: 'Dokumentation' },
    settings: { language: 'Sprache', users: 'Benutzer' }
  };

  const STATIC_LABELS_DE = {
    moreSpaces: 'Weitere Bereiche',
    systemAreas: 'Systembereiche'
  };

  const state = { language: 'pt', ready: null };

  async function loadLanguage() {
    if (window.T4_DEMO || !window.T4Data) { state.language = 'pt'; return state.language; }
    try {
      const result = await window.T4Data.optionalSelect(window.T4Data.TABLES.systemSettings, 'key,value', (query) => query.eq('key', 'language'));
      if (result.available) {
        const row = (result.data || []).find((item) => item.key === 'language');
        if (row?.value === 'de') state.language = 'de';
      }
    } catch (_) { /* Sem a migração 54 aplicada, o idioma padrão (pt) permanece. */ }
    document.documentElement.lang = state.language === 'de' ? 'de' : 'pt-BR';
    return state.language;
  }

  function applyChrome(root = document) {
    if (state.language !== 'de') return;
    root.querySelectorAll('[data-i18n-switch]').forEach((node) => {
      const label = SWITCH_LABELS_DE[node.dataset.i18nSwitch];
      if (label) node.textContent = label;
    });
    root.querySelectorAll('[data-i18n-module-label]').forEach((node) => {
      const label = SWITCH_LABELS_DE[node.dataset.i18nModuleLabel];
      if (label) node.textContent = label;
    });
    root.querySelectorAll('[data-i18n-view]').forEach((node) => {
      const [moduleId, viewId] = (node.dataset.i18nView || '').split(':');
      const label = VIEW_LABELS_DE[moduleId]?.[viewId];
      if (label) node.textContent = label;
    });
    root.querySelectorAll('[data-i18n-static]').forEach((node) => {
      const label = STATIC_LABELS_DE[node.dataset.i18nStatic];
      if (label) node.textContent = label;
    });
  }

  function start() {
    state.ready = loadLanguage().then(() => applyChrome(document));
    return state.ready;
  }

  document.addEventListener('t4:ready', start, { once: true });
  window.T4I18n = Object.freeze({
    get language() { return state.language; },
    loadLanguage,
    applyChrome,
    ready: () => state.ready || Promise.resolve('pt')
  });
})();
