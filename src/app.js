/* app.js - Root application composer */
import { createStore } from './state/store.js';
import { TimerComponent } from './components/timer.js';
import { StoryPanel } from './components/storyPanel.js';
import { VotingArea } from './components/votingArea.js';
import { ParticipantsPanel } from './components/participantsPanel.js';

export class App {
  constructor(root) {
    this.root = root;
    this.store = createStore();
    this.timerComp = new TimerComponent(this.store);
    this.votingArea = new VotingArea(this.store);
    this.participantsPanel = new ParticipantsPanel(this.store, (id) => {
      this.votingArea.setActiveParticipant(id);
    });
    this._containers = {};
    // When timer expires, auto-reveal votes
    this.timerComp.onExpire(() => {
      const { activeStoryId, revealed } = this.store.getState();
      if (activeStoryId && !revealed[activeStoryId]) {
        this.store.revealVotes(activeStoryId);
      }
    });
  }

  render() {
    this.root.innerHTML = '';
    // Header
    const header = document.createElement('header');
    header.innerHTML = '<h1 id="app-title">Planning <span>Poker</span></h1><span style="font-size:.75rem;color:var(--clr-muted)">Timer Edition</span>';
    this.root.appendChild(header);

    // Main layout
    const main = document.createElement('div');
    main.className = 'main-layout';

    // Left sidebar: Timer + Stories
    const sidebarLeft = document.createElement('div');
    sidebarLeft.className = 'sidebar-left';
    sidebarLeft.style.display = 'flex';
    sidebarLeft.style.flexDirection = 'column';
    sidebarLeft.style.gap = '1.5rem';

    this._containers.timer = document.createElement('div');
    this._containers.stories = document.createElement('div');
    sidebarLeft.appendChild(this._containers.timer);
    sidebarLeft.appendChild(this._containers.stories);

    // Center: Voting
    this._containers.voting = document.createElement('div');

    // Right sidebar: Participants
    this._containers.participants = document.createElement('div');

    main.appendChild(sidebarLeft);
    main.appendChild(this._containers.voting);
    main.appendChild(this._containers.participants);
    this.root.appendChild(main);

    // Initial render
    this._paint();

    // Subscribe to state changes
    this.store.subscribe(() => this._paint());
  }

  _paint() {
    // Re-render each component into its container
    this._swap(this._containers.timer, this.timerComp.render());
    this._swap(this._containers.stories, new StoryPanel(this.store).render());
    this._swap(this._containers.voting, this.votingArea.render());
    this._swap(this._containers.participants, this.participantsPanel.render());
  }

  _swap(container, newNode) {
    container.innerHTML = '';
    container.appendChild(newNode);
  }
}