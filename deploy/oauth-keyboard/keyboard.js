(function () {
  const HOSTS = new Set([
    'accounts.google.com',
    'accounts.youtube.com',
    'myaccount.google.com',
    'login.microsoftonline.com',
    'login.live.com',
    'login.microsoft.com',
    'account.live.com'
  ]);

  const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'password', 'tel', 'number', '']);
  const LETTERS = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'backspace'],
    ['symbols', 'space', '.', 'hide']
  ];
  const SYMBOLS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['@', '#', '/', ':', '-', '_', '.', ',', '?', '!'],
    ['letters', '(', ')', '+', '=', '&', "'", '"', 'backspace'],
    ['letters', 'space', 'hide']
  ];

  let focusedHere = false;
  let shift = false;
  let layout = 'letters';
  let keysEl = null;
  let lastField = null;
  let dismissed = false;

  function paint(el, props) {
    el.style.setProperty('all', 'initial', 'important');
    Object.keys(props).forEach((name) => {
      el.style.setProperty(name, props[name], 'important');
    });
  }

  function isField(el) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      return false;
    }
    if (el.disabled || el.readOnly) {
      return false;
    }
    if (el instanceof HTMLTextAreaElement) {
      return true;
    }
    return TEXT_TYPES.has((el.type || 'text').toLowerCase());
  }

  function deepestActive() {
    let el = document.activeElement;
    const seen = new Set();
    while (el && el.shadowRoot && el.shadowRoot.activeElement && !seen.has(el)) {
      seen.add(el);
      el = el.shadowRoot.activeElement;
    }
    return el;
  }

  function visibleField() {
    const found = [];
    const walk = (root) => {
      if (!root || !root.querySelectorAll) {
        return;
      }
      root.querySelectorAll('input, textarea').forEach((el) => {
        if (!isField(el) || el.getClientRects().length === 0) {
          return;
        }
        found.push(el);
      });
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) {
          walk(el.shadowRoot);
        }
      });
    };
    walk(document);
    return found[0] || null;
  }

  function replaceRange(el, start, end, text, inputType) {
    const prototype = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (!setter) {
      return;
    }
    setter.call(el, el.value.slice(0, start) + text + el.value.slice(end));
    const cursor = start + text.length;
    try {
      el.setSelectionRange(cursor, cursor);
    } catch (error) {
      // Some input types reject a selection range.
    }
    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: text || null,
      inputType: inputType
    }));
  }

  function insertInto(el, text) {
    if (!isField(el) || !el.isConnected) {
      return;
    }
    el.focus();
    if (text === 'backspace') {
      if (document.activeElement === el && document.execCommand('delete')) {
        return;
      }
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const from = start === end ? Math.max(0, start - 1) : start;
      replaceRange(el, from, end, '', 'deleteContentBackward');
      return;
    }
    const value = text === 'space' ? ' ' : text;
    if (document.activeElement === el && document.execCommand('insertText', false, value)) {
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    replaceRange(el, start, end, value, 'insertText');
  }

  function labelFor(key) {
    if (key === 'space') return 'space';
    if (key === 'backspace') return '⌫';
    if (key === 'shift') return shift ? '⇧' : 'shift';
    if (key === 'symbols') return '123';
    if (key === 'letters') return 'ABC';
    if (key === 'hide') return 'hide';
    return shift ? key.toUpperCase() : key;
  }

  function renderKeys() {
    if (!keysEl) {
      return;
    }
    keysEl.textContent = '';
    const rows = layout === 'letters' ? LETTERS : SYMBOLS;
    rows.forEach((row) => {
      const line = document.createElement('div');
      paint(line, {
        display: 'flex',
        'justify-content': 'center',
        gap: '6px',
        'margin-top': '6px',
        width: '100%',
        'box-sizing': 'border-box'
      });
      row.forEach((key) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = labelFor(key);
        const wide = ['shift', 'backspace', 'symbols', 'letters', 'hide'].includes(key);
        const space = key === 'space';
        paint(button, {
          flex: space ? '4 1 160px' : wide ? '1.5 1 0' : '1 1 0',
          'max-width': space ? '420px' : wide ? '140px' : '92px',
          'min-height': '52px',
          margin: '0',
          padding: '0',
          border: 'none',
          'border-radius': '10px',
          background: wide ? '#2c3544' : '#f6f3ee',
          color: wide ? '#f6f3ee' : '#1c1917',
          'font-family': 'sans-serif',
          'font-size': '18px',
          'font-weight': '700',
          'box-sizing': 'border-box',
          'pointer-events': 'auto',
          'touch-action': 'manipulation',
          'user-select': 'none'
        });
        button.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          press(key);
        });
        line.appendChild(button);
      });
      keysEl.appendChild(line);
    });
  }

  function fieldInThisFrame() {
    const active = deepestActive();
    if (isField(active)) {
      return active;
    }
    if (lastField && lastField.isConnected && isField(lastField)) {
      return lastField;
    }
    return null;
  }

  function runtime() {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      return null;
    }
    return chrome.runtime;
  }

  function press(key) {
    if (key === 'hide') {
      dismissed = true;
      setOpen(false);
      return;
    }
    if (key === 'shift') {
      shift = !shift;
      renderKeys();
      return;
    }
    if (key === 'symbols') {
      layout = 'symbols';
      shift = false;
      renderKeys();
      return;
    }
    if (key === 'letters') {
      layout = 'letters';
      renderKeys();
      return;
    }
    const typed = shift && key.length === 1 ? key.toUpperCase() : key;
    const local = fieldInThisFrame();
    if (local) {
      insertInto(local, typed);
    } else {
      const messenger = runtime();
      if (messenger) {
        try {
          messenger.sendMessage({ type: 'oauth-key', key: typed });
        } catch (error) {
          // The frame that owns the field may already be gone.
        }
      }
    }
    if (shift) {
      shift = false;
      renderKeys();
    }
  }

  function setOpen(open) {
    if (keysEl) {
      keysEl.style.setProperty('display', open ? 'block' : 'none', 'important');
    }
    if (document.body) {
      document.body.style.setProperty('padding-bottom', open ? '280px' : '0px', 'important');
    }
  }

  function remember(el) {
    if (!isField(el)) {
      return;
    }
    const changed = lastField !== el;
    lastField = el;
    focusedHere = true;
    if (el instanceof HTMLInputElement && el.type === 'number' && layout !== 'symbols') {
      layout = 'symbols';
      renderKeys();
    }
    if (window.top === window && !dismissed) {
      setOpen(true);
      if (changed) {
        window.setTimeout(() => {
          if (el.isConnected) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }, 50);
      }
    } else if (window.top !== window && changed) {
      const messenger = runtime();
      if (messenger) {
        try {
          messenger.sendMessage({ type: 'oauth-focus', focused: true });
        } catch (error) {
          // The top frame opens the keyboard from its own field when this fails.
        }
      }
    }
  }

  function sync() {
    const active = deepestActive();
    if (isField(active)) {
      if (!dismissed) {
        remember(active);
      } else {
        lastField = active;
        focusedHere = true;
      }
      return;
    }
    if (window.top !== window || dismissed) {
      return;
    }
    if (lastField && lastField.isConnected && isField(lastField)) {
      setOpen(true);
      return;
    }
    const next = visibleField();
    if (next) {
      remember(next);
    }
  }

  function mount(root) {
    if (window.top !== window || document.getElementById('hb-oauth-host')) {
      return;
    }
    const host = document.createElement('div');
    host.id = 'hb-oauth-host';
    paint(host, {
      position: 'fixed',
      inset: '0',
      'z-index': '2147483647',
      'pointer-events': 'none',
      background: 'transparent'
    });
    const shadow = host.attachShadow({ mode: 'open' });

    const cancel = document.createElement('button');
    cancel.id = 'hb-oauth-cancel';
    cancel.type = 'button';
    cancel.textContent = 'Cancel sign-in';
    paint(cancel, {
      position: 'fixed',
      top: '16px',
      left: '16px',
      'z-index': '2147483647',
      'min-height': '56px',
      margin: '0',
      padding: '0 18px',
      border: 'none',
      'border-radius': '14px',
      background: '#3d4fdb',
      color: 'white',
      'font-family': 'sans-serif',
      'font-size': '18px',
      'font-weight': '700',
      'pointer-events': 'auto',
      'touch-action': 'manipulation',
      'user-select': 'none'
    });
    cancel.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.location.href = 'http://127.0.0.1/';
    });
    shadow.appendChild(cancel);

    keysEl = document.createElement('div');
    keysEl.id = 'hb-oauth-keys';
    paint(keysEl, {
      position: 'fixed',
      left: '0',
      right: '0',
      bottom: '0',
      'z-index': '2147483646',
      display: 'none',
      'box-sizing': 'border-box',
      padding: '8px 8px 12px',
      background: '#161b24',
      'pointer-events': 'auto'
    });
    shadow.appendChild(keysEl);
    root.appendChild(host);
    renderKeys();
    sync();

    const keep = new MutationObserver(() => {
      if (host.isConnected) {
        return;
      }
      const parent = document.documentElement;
      if (parent) {
        parent.appendChild(host);
      }
    });
    keep.observe(root, { childList: true });
  }

  function boot() {
    if (!HOSTS.has(location.hostname)) {
      return;
    }
    const root = document.documentElement;
    if (!root) {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
      return;
    }
    if (root.dataset.hbOauth === '1') {
      return;
    }
    root.dataset.hbOauth = '1';

    document.addEventListener('focusin', (event) => {
      const target = event.composedPath ? event.composedPath()[0] : event.target;
      if (!isField(target)) {
        return;
      }
      dismissed = false;
      remember(target);
    }, true);

    const messenger = runtime();
    if (messenger && messenger.onMessage) {
      messenger.onMessage.addListener((message) => {
        if (!message || !message.type) {
          return;
        }
        if (message.type === 'oauth-focus' && window.top === window && message.focused && !dismissed) {
          setOpen(true);
        }
        if (message.type === 'oauth-key' && focusedHere) {
          const field = fieldInThisFrame();
          if (field) {
            insertInto(field, message.key);
          }
        }
      });
    }

    mount(root);
    if (window.top === window && !document.getElementById('hb-oauth-host')) {
      document.addEventListener('DOMContentLoaded', () => mount(document.documentElement), { once: true });
    }
    if (window.top !== window) {
      return;
    }
    let pending = 0;
    const observer = new MutationObserver(() => {
      if (pending) {
        return;
      }
      pending = window.setTimeout(() => {
        pending = 0;
        sync();
      }, 50);
    });
    const watch = () => {
      if (!document.documentElement) {
        return;
      }
      observer.observe(document.documentElement, { childList: true, subtree: true });
      sync();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', watch, { once: true });
    } else {
      watch();
    }
    window.setTimeout(sync, 300);
    window.setTimeout(sync, 1000);
  }

  boot();
})();
