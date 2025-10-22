class StateManager {
  constructor() {
    this.estadoJogador1 = 'C'; // ação do jogador humano
  }

  atualizarAcaoJogador1(acao) {
    this.estadoJogador1 = acao;
  }

  getReward(acaoIA) {
    const acaoJ1 = this.estadoJogador1 || 'C';

    const recompensas = {
      'C': { 'C': 1, 'T': 0, 'D': 2 },
      'T': { 'C': 3, 'T': 0, 'D': 0 },
      'D': { 'C': 3, 'T': 3, 'D': 0 }
    };

    return recompensas[acaoIA]?.[acaoJ1] ?? 0;
  }

  numeroParaAcao(numero) {
    return { 1: 'C', 2: 'T', 3: 'D' }[numero];
  }

  acaoParaNumero(acao) {
    return { 'C': 1, 'T': 2, 'D': 3 }[acao];
  }
}

module.exports = StateManager;
