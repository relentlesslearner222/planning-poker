/**
 * storyPanel.js - Story backlog management component
 */
import { showToast } from '../utils/toast.js';

export class StoryPanel {
  constructor(store) {
    this.store = store;
  }

  render() {
    const { stories, activeStoryId, votes, revealed } = this.store.getState();

    const el = document.createElement('div');
    el.className = 'panel';
    el.innerHTML = `
      <div class="panel-title">Stories</div>
      <div class="story-input-row">
        <input type="text" id="story-input" placeholder="Add a user story..." maxlength="100" />
        <button class="btn btn-primary" id="add-story-btn">+</button>
      </div>
      ${stories.length === 0
        ? `
          <div class="empty-state">
            <div class="empty-icon">&#55259;</div>
            <strong>No stories yet</strong><br?>Add a user story to begin
          </div>
        `
        : `
          <ul class="story-list" id="story-list">
            ${stories.map(st => {
              const storyVotes = votes[st.id] || {};
              const voteCount = Object.keys(storyVotes).length;
              const isActive = st.id === activeStoryId;
              const isVoted = revealed[st.id];
              return `
                <li class="story-item ${isActive ? 'active' : ''} ${isVoted ? 'voted' : ''}"
                    data-id="${st.id}">
                  <span class="story-name" title="${st.name}">${st.name}</span>
                  ${voteCount > 0 ? `<span class="story-badge">${voteCount} &#9999;</span>` : ''}
                  <button class="del-btn" title="Remove story" data-id="${st.id}">&#11004;</button>
                </li>
              `;
            }).join('')}
          </ul>
        `}
    `;

    // Add story
    const input = el.querySelector('#story-input');
    el.querySelector('#add-story-btn').addEventListener('click', () => {
      const val = input.value.trim();
      if (!val) return showToast('Story name cannot be empty.', 'warn');
      this.store.addStory(val);
      input.value = '';
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = input.value.trim();
        if (!val) return showToast('Story name cannot be empty.', 'warn');
        this.store.addStory(val);
        input.value = '';
      }
    });

    // Select story
    el.querySelectorAll('.story-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('del-btn')) return;
        this.store.setActiveStory(item.dataset.id);
      });
    });

    // Delete story
    el.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.store.removeStory(btn.dataset.id);
      });
    });

    return el;
  }
}