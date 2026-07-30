const CITACOES = [
  { t: 'Quirrel', q: 'É fácil se perder nestas terras. Eu mesmo já me perdi mais de uma vez.' },
  { t: 'Elderbug', q: 'Dirtmouth já foi mais viva… mas ainda há calor no lar.' },
  { t: 'Cloth', q: 'Às vezes a coragem é só dar o próximo passo.' },
  { t: 'Cornifer', q: 'Mapas, mapas! O mundo fica menor quando se entende o caminho.' },
  { t: 'Hornet', q: 'Não se esqueça… a força que você busca pode destruir você.' },
  { t: 'Myla', q: 'As pedras cantam se você escuta com o coração.' },
  { t: 'Sly', q: 'Um bom negócio é aquele em que os dois saem achando que ganharam.' },
  { t: 'Iselda', q: 'Meu marido some no mapa e eu fico com a loja. Clássico.' },
  { t: 'Nailmaster Sheo', q: 'A lâmina reflete quem a empunha. Pinte com cuidado.' },
  { t: 'Seer', q: 'A essência flui. Sonhos são só outra estrada.' },
  { t: 'The Last Stag', q: 'As estações ainda lembram dos trilhos. Eu também.' },
  { t: 'Zote', q: 'Eu sou o cavaleiro mais forte que estas terras já viram!' }
];

const DEATH_LINES = [
  'O banco te espera.',
  'Respira. De novo.',
  'Hallownest é assim mesmo.',
  'Uma morte a mais no mapa.',
  'O prego volta mais afiado.'
];

const WIN_LINES = [
  'O hall aplaude!',
  'Vitória merecida.',
  'Mais uma lenda no mapa.',
  'Dirtmouth comemora.'
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickQuote() {
  return pick(CITACOES);
}

module.exports = {
  CITACOES,
  DEATH_LINES,
  WIN_LINES,
  pick,
  pickQuote
};
