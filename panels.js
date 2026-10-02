/*
Dropdown panels opened by the buttons in the top-right corner of the page
(the info "i" and the settings gear).

Each panel opens and closes with its button, and closes on a click
anywhere outside it or on Escape. Opening one panel closes the others,
so they never overlap.
*/

const panels = [];

/*
Wires up one button + panel pair.
  containerId: element wrapping both the button and the panel
  buttonId:    the toggle button (with aria-controls / aria-expanded)
  panelId:     the panel (starts with the "hidden" attribute)
*/
export function initPanel(containerId, buttonId, panelId) {
  const container = document.getElementById(containerId);
  const button = document.getElementById(buttonId);
  const panel = document.getElementById(panelId);

  const entry = {
    isOpen: () => !panel.hidden,
    setOpen(open) {
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    }
  };
  panels.push(entry);

  button.addEventListener('click', () => {
    const open = panel.hidden;
    if (open) panels.forEach(p => { if (p !== entry) p.setOpen(false); });
    entry.setOpen(open);
  });

  document.addEventListener('click', e => {
    if (entry.isOpen() && !container.contains(e.target)) entry.setOpen(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && entry.isOpen()) {
      entry.setOpen(false);
      button.focus();
    }
  });
}
