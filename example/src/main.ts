import './style.css'
import javascriptLogo from './javascript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.ts'

// Declare global window interface extension
declare global {
  interface Window {
    getPageTitle: () => string;
    setOutputText: (text: string) => string;
    getElementCount: () => number;
  }
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank">
      <img src="${javascriptLogo}" class="logo vanilla" alt="JavaScript logo" />
    </a>
    <h1>LLM Browser Command Plugin</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <div class="card">
      <button id="test-command" type="button">Test Command</button>
    </div>
    <div class="card">
      <div id="command-output">Command output will appear here</div>
    </div>
    <p class="read-the-docs">
      Use the CLI to send commands to this browser
    </p>
  </div>
`

setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)

// Add test command functionality
document.querySelector<HTMLButtonElement>('#test-command')!.addEventListener('click', () => {
  console.log('Test command button clicked')
  const output = document.querySelector<HTMLDivElement>('#command-output')!
  output.textContent = 'Button clicked at: ' + new Date().toISOString()
})

// Define some global functions that can be called via the CLI
window.getPageTitle = function(): string {
  return document.title
}

window.setOutputText = function(text: string): string {
  const output = document.querySelector<HTMLDivElement>('#command-output')!
  output.textContent = text
  return 'Output text set to: ' + text
}

window.getElementCount = function(): number {
  return document.querySelectorAll('*').length
}

console.log('Page loaded and ready for commands')
