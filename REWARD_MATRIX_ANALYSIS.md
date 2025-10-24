# 📊 Análise da Matriz de Recompensas

## 🎮 Sistema de Pontuação do Jogo

### Tabela Completa (fornecida):
```
IA: C, Jogador: C -> IA +1, Jogador +1
IA: C, Jogador: T -> IA +0, Jogador +3
IA: C, Jogador: D -> IA +2, Jogador +0
IA: T, Jogador: C -> IA +3, Jogador +0
IA: T, Jogador: T -> IA +0, Jogador +0
IA: T, Jogador: D -> IA +0, Jogador +3
IA: D, Jogador: C -> IA +0, Jogador +2
IA: D, Jogador: T -> IA +3, Jogador +0
IA: D, Jogador: D -> IA +0, Jogador +0
```

---

## 📋 Matriz de Recompensas (IA)

### **Formato: IA joga X, Jogador joga Y → Recompensa da IA**

|  | **J: C** | **J: T** | **J: D** |
|---|---|---|---|
| **IA: C** | **1** | **0** | **2** |
| **IA: T** | **3** | **0** | **0** |
| **IA: D** | **0** | **3** | **0** |

---

## 🔄 Comparação: Atual vs Correto

### **Matriz ATUAL no código:**
```javascript
'C': { 'C': 1, 'T': 0, 'D': 2 },
'T': { 'C': 3, 'T': 0, 'D': 0 },
'D': { 'C': 3, 'T': 3, 'D': 0 }  // ❌ INCORRETO!
```

### **Matriz CORRETA (baseada no jogo):**
```javascript
'C': { 'C': 1, 'T': 0, 'D': 2 },
'T': { 'C': 3, 'T': 0, 'D': 0 },
'D': { 'C': 0, 'T': 3, 'D': 0 }  // ✅ CORRIGIDO!
```

---

## 🔴 Problemas Identificados

### **Linha D (Desconfiar)**
```javascript
// ANTES (ERRADO):
'D': { 'C': 3, 'T': 3, 'D': 0 }

// DEPOIS (CORRETO):
'D': { 'C': 0, 'T': 3, 'D': 0 }
```

**Problema**: 
- `D vs C` estava dando **3 pontos** para a IA
- Correto é **0 pontos** para IA (jogador ganha 2)

---

## 📊 Análise do Equilíbrio do Jogo

### **1. Cooperar (C)**
```
IA: C vs Jogador: C → IA: +1  ✅ Melhor mútuo
IA: C vs Jogador: T → IA: +0  ❌ Péssimo (explorado)
IA: C vs Jogador: D → IA: +2  ✅ Bom resultado
```
**Estratégia**: Cooperar é bom contra C e D, ruim contra T

### **2. Trair (T)**
```
IA: T vs Jogador: C → IA: +3  ✅ Melhor individual
IA: T vs Jogador: T → IA: +0  ❌ Ambos perdem
IA: T vs Jogador: D → IA: +0  ❌ Punido por desconfiança
```
**Estratégia**: Trair é ótimo contra C, péssimo contra T e D

### **3. Desconfiar (D)**
```
IA: D vs Jogador: C → IA: +0  ❌ Desperdiçou cooperação
IA: D vs Jogador: T → IA: +3  ✅ Defesa perfeita contra traição
IA: D vs Jogador: D → IA: +0  ❌ Ambos desconfiam
```
**Estratégia**: Desconfiar é ótimo contra T, ruim contra C e D

---

## 🎯 Nash Equilibrium e Estratégias

### **Matriz em Formato de Teoria dos Jogos**

```
            Jogador
           C    T    D
        ┌─────────────┐
IA:  C  │ 1,1  0,3  2,0│
     T  │ 3,0  0,0  0,3│
     D  │ 0,2  3,0  0,0│
        └─────────────┘
```

### **Análise:**

1. **Contra Cooperador (J: C)**:
   - Melhor resposta da IA: **T** (3 pontos)
   - Pior resposta: **D** (0 pontos)

2. **Contra Traidor (J: T)**:
   - Melhor resposta da IA: **D** (3 pontos)
   - Pior resposta: **C** (0 pontos)

3. **Contra Desconfiado (J: D)**:
   - Melhor resposta da IA: **C** (2 pontos)
   - Pior resposta: **T** ou **D** (0 pontos)

### **Nash Equilibrium**:
- Não há equilíbrio de estratégia pura
- Jogo é **não-cooperativo** e **assimétrico**
- Requer estratégias **mistas** ou **adaptativas**

---

## 🧠 Implicações para o Q-Learning

### **1. Recompensas Balanceadas ✅**
```
Máximo:  3 pontos (T vs C ou D vs T)
Médio:   1-2 pontos (C vs C ou C vs D)
Mínimo:  0 pontos (empate ou punição)
```
- Spread de 0-3 é **bom** para Q-Learning
- Não há dominância absoluta de uma ação

### **2. Rock-Paper-Scissors Pattern**
```
T bate C (3-0)
D bate T (3-0)
C bate D (2-0)
```
- Padrão de **pedra-papel-tesoura**
- Cada ação tem **contra-ação**
- IA precisa **aprender padrões** do oponente

### **3. Incentivos Corretos**
- **C vs C**: Cooperação mútua (1,1) → Incentiva cooperação
- **T vs T**: Punição mútua (0,0) → Desencorajá traição cega
- **D**: Defesa contra traição (D vs T = 3)

---

## 📈 Expectativa de Recompensa

### **Contra Oponente Aleatório** (33% cada ação):
```
IA joga C: E[R] = (1×⅓) + (0×⅓) + (2×⅓) = 1.0
IA joga T: E[R] = (3×⅓) + (0×⅓) + (0×⅓) = 1.0
IA joga D: E[R] = (0×⅓) + (3×⅓) + (0×⅓) = 1.0
```
**Todas iguais** → Nenhuma estratégia domina

### **Contra Cooperador (Always-C)**:
```
IA joga C: E[R] = 1
IA joga T: E[R] = 3  ← Melhor
IA joga D: E[R] = 0
```
**T domina**

### **Contra Traidor (Always-T)**:
```
IA joga C: E[R] = 0
IA joga T: E[R] = 0
IA joga D: E[R] = 3  ← Melhor
```
**D domina**

### **Contra Desconfiado (Always-D)**:
```
IA joga C: E[R] = 2  ← Melhor
IA joga T: E[R] = 0
IA joga D: E[R] = 0
```
**C domina**

---

## 🎓 Estratégias Ótimas

### **1. Tit-for-Tat (TFT)**
```
Rodada 1: C
Rodadas seguintes: Copiar última ação do oponente
```
**Expectativa**: ~1.5-2.0 pontos/rodada

### **2. WSLS (Pavlov)**
```
Se ganhou (≥1): Repetir ação
Se perdeu (0): Trocar ação
```
**Expectativa**: ~1.5-2.0 pontos/rodada

### **3. Adaptativa (Q-Learning)**
```
Aprender padrão do oponente
Explorar → Exploitar
```
**Expectativa**: ~2.0-2.5 pontos/rodada (ideal)

---

## ✅ Recomendação Final

### **Matriz Corrigida:**
```javascript
getReward(acaoIA) {
    const acaoJ1 = this.estadoJogador1 || 'C';

    // Matriz de recompensas do jogo real
    const recompensas = {
        'C': { 'C': 1, 'T': 0, 'D': 2 },
        'T': { 'C': 3, 'T': 0, 'D': 0 },
        'D': { 'C': 0, 'T': 3, 'D': 0 }
    };

    return recompensas[acaoIA]?.[acaoJ1] ?? 0;
}
```

### **Mudança:**
- `'D': { 'C': 3, ...}` → `'D': { 'C': 0, ...}`

### **Impacto:**
- IA não será mais enviesada para jogar D contra cooperadores
- Q-Learning aprenderá políticas corretas
- Convergência para estratégias balanceadas

---

**Status**: 🔴 Necessita Correção  
**Prioridade**: Alta  
**Arquivo**: `statemanager.js` linha 25