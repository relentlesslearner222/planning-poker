/* votingArea.js - Card deck voting component with reveal and summary */
import { showToast } from '../utils/toast.js';

const DECK = ['1', '2', '3', '5', '8', '13', '21', '?', 'COFFEE'];

function getNumericValues(obj) {
  return Object.values(obj || {})
    .filter(v => v !== '?' && v !== 'COFFEE' && !Number.isNaN(Number(v)))
    .map(Number);
}

export class VotingArea {
  constructor(store) {
    this.store = store;
    this.activeParticipantId = null;
  }

  setActiveParticipant(id) {
    this.activeParticipantId = id;
  }

  computeSummary(votesObj) {
    const nums = getNumericValues(votesObj);
    if (!nums.length) return null;
    const avg = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const consensus = nums.every(v => v === nums[0]);
    return { avg, min, max, consensus };
  }

  renderResults(votesObj, participants, revealed) {
    if (!Object.keys(votesObj || {}).length) return '';
    const parts = [];
    parts.push('<div class="results-section"><div class="results-grid">');
    participants.forEach(p => {
      const v = (votesObj || {})[p.id];
      if (!v) return;
      const hidden = revealed ? '' : 'hidden-vote';
      parts.push('<div class="result-card ' + hidden + '"><div class="participant-name">' + p.name + '</div><div class="vote-value">' + v + '</div></div>');
    });
    parts.push('</div>');
    if (revealed) {
      const s = this.computeSummary(votesObj);
      if (s) {
        parts.push(
          '<div class="summary-bar">' +
          '<div class="summary-stat"><span class="stat-label">Avg</span><span class="stat-value">' + s.avg + '</span></div>' +
          '<div class="summary-divider"></div>' +
          '<div class="summary-stat"><span class="stat-label">Min</span><span class="stat-value">' + s.min + '</span></div>' +
          '<div class="summary-divider"></div>' +
          '<div class="summary-stat"><span class="stat-label">Max</span><span class="stat-value">' + s.max + '</span></div>' +
          '<div class="summary-divider"></div>' +
          '<div class="summary-stat"><span class="stat-label">Consensus</span><span class="stat-value ' + (s.consensus ? 'text-success' : 'text-danger') + '">' + (s.consensus ? 'Yes' : 'No') + '</span></div>' +
          '</div>'
        );
      }
    }
    parts.push('</div>');
    return parts.join('');
  }

  render() {
    const { stories, activeStoryId, votes, revealed, participants } = this.store.getState();
    const activeStory = stories.find(s => s.id === activeStoryId);
    const storyVotes = activeStoryId ? (votes[activeStoryId] || {}) : {};
    const isRevealed = activeStoryId ? !!revealed[activeStoryId] : false;
    const voteCount = Object.keys(storyVotes).length;
    const myVote = this.activeParticipantId ? storyVotes[this.activeParticipantId] : null;

    const el = document.createElement('div');
    el.className = 'panel voting-area';

    if (!activeStory) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon"></div><strong>No story selected</strong><br>Add and select a story to start voting.</div>';
      return el;
    }

    const deckHtml = DECK.map(val => {
      const sel = myVote === val ? ' selected' : '';
      return '<div class="poker-card' + sel + '" data-val="' + val + '">' + val + '</div>';
    }).join('');

    const noParticipants = participants.length === 0
      ? '<p class="text-muted mt-1">Add participants to start voting.</p>' : '';

    const noSelection = !this.activeParticipantId
      ? '<p class="text-muted mt-1">Select your name from the Participants panel to vote.</p>' : '';

    const revealBtn = voteCount > 0 && !isRevealed
      ? '<button class="btn btn-accent" id="reveal-btn">Reveal Votes</button>' : '';
    const resetBtn = isRevealed
      ? '<button class="btn btn-ghost" id="reset-votes-btn">Re-vote</button>' : '';

    el.innerHTML = [
      '<div class="active-story-header">',
      '<span class="active-story-name">' + activeStory.name + '</span>',
      '<span class="vote-status">' + voteCount + ' / ' + participants.length + ' voted</span>',
      '</div>',
      noParticipants,
      noSelection,
      '<div class="card-deck">' + deckHtml + '</div>',
      this.renderResults(storyVotes, participants, isRevealed),
      '<div class="reveal-btn-row mt-2">' + revealBtn + resetBtn + '</div>'
    ].join('');

    el.querySelectorAll('.poker-card').forEach(card => {
      card.addEventListener('click', () => {
        if (!this.activeParticipantId) return showToast('Select your name in Participants first.', 'warn');
        if (isRevealed) return showToast('Votes already revealed. Reset to vote again.', 'warn');
        this.store.castVote(this.activeParticipantId, activeStoryId, card.dataset.val);
        showToast('Vote cast: ' + card.dataset.val, 'success');
      });
    });

    const revealBtnEl = el.querySelector('#reveal-btn');
    if (revealBtnEl) {
      revealBtnEl.addEventListener('click', () => {
        this.store.revealVotes(activeStoryId);
        showToast('Votes revealed!', 'success');
      });
    }

    const resetBtnEl = el.querySelector('#reset-votes-btn');
    if (resetBtnEl) {
      resetBtnEl.addEventListener('click', () => {
        this.store.resetVotes(activeStoryId);
        showToast('Votes reset. Lets re-vote!');
      });
    }

    return el;
  }
}