class QLearning {
  constructor(actions, alpha = 0.1, gamma = 0.9, epsilon = 0.2) {
    this.actions = actions;
    this.alpha = alpha;   // taxa de aprendizado
    this.gamma = gamma;   // fator de desconto
    this.epsilon = epsilon; // política de exploração
    this.qTable = {};     // tabela Q
  }

  getQValue(state, action) {
    if (!this.qTable[state]) this.qTable[state] = {};
    if (!this.qTable[state][action]) this.qTable[state][action] = 0;
    return this.qTable[state][action];
  }

  chooseAction(state) {
    if (Math.random() < this.epsilon) {
      // exploração
      return this.actions[Math.floor(Math.random() * this.actions.length)];
    } else {
      // exploração greedy
      const qValues = this.actions.map(action => this.getQValue(state, action));
      const maxQ = Math.max(...qValues);
      const bestActions = this.actions.filter((_, idx) => qValues[idx] === maxQ);
      return bestActions[Math.floor(Math.random() * bestActions.length)];
    }
  }

  updateQTable(state, action, reward, nextState) {
    const oldQ = this.getQValue(state, action);
    const nextMax = Math.max(...this.actions.map(a => this.getQValue(nextState, a)));
    const newQ = oldQ + this.alpha * (reward + this.gamma * nextMax - oldQ);
    this.qTable[state][action] = newQ;
    console.log(`[IA] Q(${state}, ${action}) atualizado para ${newQ.toFixed(2)}`);
  }
}

module.exports = QLearning;