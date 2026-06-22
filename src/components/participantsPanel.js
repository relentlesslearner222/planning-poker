/* participantsPanel.js - Participants management and vote status component */
import { showToast } from '../utils/toast.js';

export class ParticipantsPanel {
  constructor(store, onSelect) {
    this.store = store;
    this.onSelect = onSelect;
    this.selectedId = null;
  }

  render() {
    const { participants, activeStoryId, votes, revealed } = this.store.getState();
    const storyVotes = activeStoryId ? (votes[activeStoryId] || {}) : {};
    const isRevealed = activeStoryId ? !!revealed[activeStoryId] : false;

    const el = document.createElement('div');
    el.className = 'panel sidebar-right';

    const listHTML = participants.length === 0
      ? '<div class="empty-state"><div class="empty-icon"></div><br>Add participants to get started.</div>'
      : '<ul class="participants-list">' +
        participants.map(p => {
          const hasVoted = !!storyVotes[p.id];
          const indCls = hasVoted ? (isRevealed ? 'revealed' : 'voted') : '';
          const activeCls = this.selectedId === p.id ? ' style="border-color:var(--clr-accent)"' : '';
          return '<li class="participant-row" data-id="' + p.id + '"' + activeCls + ' style="cursor:pointer">' +
            '<div class="participant-avatar" style="background:' + p.color + ';">' + p.initials + '</div>' +
            '<span class="participant-name-text">' + p.name + '</span>' +
            '<span class="vote-indicator ' + indCls + '"></span>' +
            '<button class="btn btn-xs btn-ghost" style="opacity:0;margin-left:auto" data-remove="' + p.id + '">x]</button>' +
            '</li>';
        }).join('') +
        '</ul>';

    el.innerHTML = [
      '<div class="panel-title">Participants</div>',
      '<div class="add-participant-row">',
      '<input type="text" id="participant-input" placeholder="Add name..." maxlength="40" />',
      '<button class="btn btn-primary btn-sm" id="add-participant-btn">+</button>',
      '</div>',
      listHTML,
      participants.length > 0
        ? '<p class="text-muted mt-2" style="font-size:.7rem">Click your name to set yourself as voter.</p>'
        : ''
    ].join('');

    // Add participant
    const input = el.querySelector('#participant-input');
    const addBtn = el.querySelector('#add-participant-btn');
    const doAdd = () => {
      const val = input.value.trim();
      if (!val) return showToast('Name cannot be empty.', 'warn');
      const { participants: ps } = this.store.getState();
      if (ps.some(p => p.name.toLowerCase() === val.toLowerCase())) return showToast('Participant already exists.', 'warn');
      this.store.addParticipant(val);
      input.value = '';
    };
    addBtn.addEventListener('click', doAdd);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });

    // Select participant
    el.querySelectorAll('.participant-row').forEach(row => {
      row.addEventListener('mouseover', () => {
        const btn = row.querySelector('[data-remove]');
        if (btn) btn.style.opacity = '1';
      });
      row.addEventListener('mouseout', () => {
        const btn = row.querySelector('[data-remove]');
        if (btn) btn.style.opacity = '0';
      });
      row.addEventListener('click', (e) => {
        if (e.target.dataset.remove) return;
        const id = row.dataset.id;
        this.selectedId = id;
        if (this.onSelect) this.onSelect(id);
        showToast('You are voting as ' + participants.find(p => p.id === id)?.name);
      });
    });

    // Remove participant
    el.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.remove;
        if (this.selectedId === id) {
          this.selectedId = null;
          if (this.onSelect) this.onSelect(null);
        }
        this.store.removeParticipant(id);
      });
    });

    return el;
  }
}