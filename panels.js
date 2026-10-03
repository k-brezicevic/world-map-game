/*
Dropdown panels opened by the buttons in the corners of the page (the
logo in the top-left; the info "i" and the settings gear in the top-right).

Each panel opens and closes with its button, and closes on a click
anywhere outside it or on Escape. Opening one panel closes the others,
so they never overlap.
*/

const panels = [];

/*
Tabs inside a panel: an element with role="tablist" holding role="tab"
buttons, each pointing (aria-controls) at a role="tabpanel" element.
Clicking a tab shows its panel and hides the others; with a tab focused,
the left/right arrow keys move to the previous/next tab.
*/
export function initTabs(tablist) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];

  const select = tab => {
    for (const t of tabs) {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
    }
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      select(next);
      next.focus();
    });
  });
}

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
