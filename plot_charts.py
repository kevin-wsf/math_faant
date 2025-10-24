#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pathlib import Path
import numpy as np

def main():
    try:
        data = json.loads(sys.stdin.read())
        
        history = data.get('history', [])
        rewards = data.get('rewards', [])
        current_round = data.get('round', 0)
        epsilon = data.get('epsilon', 0)
        
        charts_dir = Path(__file__).parent / 'charts'
        charts_dir.mkdir(exist_ok=True)
        
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        fig.suptitle(f'Análise de Desempenho Q-Learning - Rodada {current_round}', 
                     fontsize=16, fontweight='bold')
        
        actions_map = {'C': 'Cooperar', 'T': 'Trair', 'D': 'Desconfiar'}
        colors = {'C': '#2ecc71', 'T': '#e74c3c', 'D': '#f39c12'}
        
        # [1] Distribuição de Ações do Oponente
        if history:
            counts = {'C': 0, 'T': 0, 'D': 0}
            for action in history:
                if action in counts:
                    counts[action] += 1
            
            labels = [actions_map[a] for a in ['C', 'T', 'D']]
            values = [counts[a] for a in ['C', 'T', 'D']]
            bar_colors = [colors[a] for a in ['C', 'T', 'D']]
            
            axes[0, 0].bar(labels, values, color=bar_colors, alpha=0.7, edgecolor='black')
            axes[0, 0].set_title('Distribuição de Ações do Oponente', fontweight='bold')
            axes[0, 0].set_ylabel('Frequência')
            axes[0, 0].grid(axis='y', alpha=0.3)
            
            for i, v in enumerate(values):
                percent = (v / len(history) * 100) if len(history) > 0 else 0
                axes[0, 0].text(i, v + 0.5, f'{percent:.1f}%', ha='center', va='bottom')
        
        # [2] Curva de Aprendizado (Recompensas)
        if rewards:
            x = range(1, len(rewards) + 1)
            axes[0, 1].plot(x, rewards, color='#3498db', linewidth=2, marker='o', 
                          markersize=3, alpha=0.6, label='Recompensa')
            
            if len(rewards) >= 10:
                window = 10
                moving_avg = np.convolve(rewards, np.ones(window)/window, mode='valid')
                x_avg = range(window, len(rewards) + 1)
                axes[0, 1].plot(x_avg, moving_avg, color='#e74c3c', linewidth=2.5, 
                              label=f'Média Móvel ({window})')
            
            axes[0, 1].set_title('Curva de Aprendizado', fontweight='bold')
            axes[0, 1].set_xlabel('Rodada')
            axes[0, 1].set_ylabel('Recompensa')
            axes[0, 1].legend()
            axes[0, 1].grid(True, alpha=0.3)
            axes[0, 1].axhline(y=0, color='gray', linestyle='--', linewidth=0.8)
        
        # [3] Histórico de Ações (últimas 30)
        if history:
            recent = history[-30:]
            x_hist = range(len(recent))
            action_to_num = {'C': 1, 'T': 2, 'D': 3}
            y_hist = [action_to_num.get(a, 0) for a in recent]
            color_hist = [colors.get(a, '#95a5a6') for a in recent]
            
            axes[1, 0].scatter(x_hist, y_hist, c=color_hist, s=100, alpha=0.7, edgecolors='black')
            axes[1, 0].set_title('Histórico de Ações (Oponente - últimas 30)', fontweight='bold')
            axes[1, 0].set_xlabel('Rodada')
            axes[1, 0].set_ylabel('Ação')
            axes[1, 0].set_yticks([1, 2, 3])
            axes[1, 0].set_yticklabels(['C', 'T', 'D'])
            axes[1, 0].grid(True, alpha=0.3)
        
        # [4] Estatísticas
        ax_stats = axes[1, 1]
        ax_stats.axis('off')
        
        stats_text = f"""
        ╔════════════════════════════╗
        ║   ESTATÍSTICAS GERAIS      ║
        ╚════════════════════════════╝
        
        Rodadas Jogadas: {current_round}
        Taxa de Exploração (ε): {epsilon * 100:.1f}%
        
        """
        
        if rewards:
            total_reward = sum(rewards)
            avg_reward = total_reward / len(rewards)
            max_reward = max(rewards)
            min_reward = min(rewards)
            
            window_size = min(10, len(rewards))
            recent_rewards = rewards[-window_size:]
            recent_avg = sum(recent_rewards) / len(recent_rewards)
            
            stats_text += f"""
        ─────────────────────────────
        Recompensa Total: {total_reward:.2f}
        Média Geral: {avg_reward:.2f}
        Média Recente (10): {recent_avg:.2f}
        Máxima: {max_reward:.2f}
        Mínima: {min_reward:.2f}
        """
        
        if history:
            stats_text += f"""
        ─────────────────────────────
        Padrão Oponente:
        """
            for action in ['C', 'T', 'D']:
                count = history.count(action)
                percent = (count / len(history) * 100) if len(history) > 0 else 0
                stats_text += f"\n        {actions_map[action]}: {count} ({percent:.1f}%)"
        
        ax_stats.text(0.1, 0.5, stats_text, fontsize=11, verticalalignment='center',
                     fontfamily='monospace', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.3))
        
        plt.tight_layout()
        
        filepath = charts_dir / 'latest.png'
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()
        
        result = {
            'success': True,
            'filepath': str(filepath),
            'round': current_round
        }
        print(json.dumps(result))
        
    except Exception as e:
        result = {
            'success': False,
            'message': str(e)
        }
        print(json.dumps(result))
        sys.exit(1)

if __name__ == '__main__':
    main()
