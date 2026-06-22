/**
 * main.js - Entry point for Timer-Based Planning Poker
 */
import { App } from './app.js';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  if (!root) return;
  const app = new App(root);
  app.render();
});