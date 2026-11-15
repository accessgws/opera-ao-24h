// =============================================================================
// CONFIGURAÇÕES, CONSTANTES FÍSICAS E CATÁLOGO DA GARAGEM / MISSÕES
// =============================================================================

export const STORAGE_KEY = 'operacao_24h_voo_fuga_highscore_v1';

export const STORAGE_MUSIC_KEY = 'operacao_24h_voo_fuga_music_v1';

export const STORAGE_MUTE_KEY = 'operacao_24h_voo_fuga_mute_v1';

export const STORAGE_TOUCH_MODE_KEY = 'operacao_24h_voo_fuga_touch_v1';

export const IS_COARSE_POINTER = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

export const STORAGE_STARS_KEY = 'operacao_24h_voo_fuga_stars_v1';

export const STORAGE_UPGRADES_KEY = 'operacao_24h_voo_fuga_upgrades_v1';

export const STORAGE_MISSIONS_KEY = 'operacao_24h_voo_fuga_missions_v1';

export const UPGRADE_DEFS = [
  {
    id: 'magnet',
    icon: '🧲',
    badge: 'Atração',
    title: 'Ímã Eleitoral',
    desc: 'Puxa estrelas próximas automaticamente durante a fuga.',
    costs: [20, 45, 85],
    effects: ['Desativado', 'Raio 130px', 'Raio 210px', 'Raio 295px']
  },
  {
    id: 'startShield',
    icon: '🛡️',
    badge: 'Defesa',
    title: 'Blindagem Inicial',
    desc: 'Começa a corrida protegido e amplia imunidade pós-impacto.',
    costs: [25, 55, 95],
    effects: ['Padrão (1.0s)', 'Escudo inicial', 'Escudo + 1.6s imun.', 'Escudo inicial + Ato 3']
  },
  {
    id: 'coffeeBoost',
    icon: '☕',
    badge: 'Tempo',
    title: 'Café Termoelétrico',
    desc: 'Aumenta o congelamento do relógio 24h e ganha respiro.',
    costs: [20, 45, 85],
    effects: ['4.0s padrão', '5.2s congela', '6.4s + respiro', '7.8s + afasta rivais']
  },
  {
    id: 'turboBoost',
    icon: '⚡',
    badge: 'Velocidade',
    title: 'Turbo Supersônico',
    desc: 'Estende o Turbo Asa e dá bônus extra ao quebrar obstáculos.',
    costs: [25, 55, 95],
    effects: ['3.5s • +100 pts', '4.6s • +140 pts', '5.8s • +180 pts', '7.2s • +220 pts']
  }
];

export const MISSION_TEMPLATES = [
  {
    type: 'stars',
    perRun: false,
    targets: [12, 25, 45],
    rewards: [20, 35, 55],
    makeLabel: (t) => `Colete ${t} estrelas`
  },
  {
    type: 'run_dist',
    perRun: true,
    targets: [450, 850, 1250],
    rewards: [25, 40, 65],
    makeLabel: (t) => `Alcance ${t} m em 1 corrida`
  },
  {
    type: 'near_miss',
    perRun: false,
    targets: [3, 6, 10],
    rewards: [25, 45, 70],
    makeLabel: (t) => `Faça ${t} raspões`
  },
  {
    type: 'coffee',
    perRun: false,
    targets: [2, 4, 6],
    rewards: [20, 35, 55],
    makeLabel: (t) => `Pegue ${t} cafés expressos`
  },
  {
    type: 'rings',
    perRun: false,
    targets: [3, 6, 10],
    rewards: [25, 45, 75],
    makeLabel: (t) => `Passe por ${t} anéis aéreos`
  },
  {
    type: 'run_score',
    perRun: true,
    targets: [600, 1400, 2500],
    rewards: [20, 35, 60],
    makeLabel: (t) => `Faça ${t.toLocaleString('pt-BR')} pts em 1 corrida`
  }
];

export const LOGICAL_HEIGHT = 720;

export const MIN_LOGICAL_WIDTH = 720;

export const ceilingY = 44;

export const ACT2_DISTANCE = 450;

export const ACT3_DISTANCE = 1100;

export const HOURS_PER_SECOND = 0.4;

export const COFFEE_FREEZE_SEC = 4.0;

export const TURBO_DURATION = 3.5;
