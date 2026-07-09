/**
 * Nota Volatile — View page logic
 */
(function () {
  'use strict';

  // DOM refs
  const entryPanel = document.getElementById('entry-panel');
  const loadingPanel = document.getElementById('loading-panel');
  const notePanel = document.getElementById('note-panel');
  const notfoundPanel = document.getElementById('notfound-panel');
  const codeForm = document.getElementById('code-form');
  const codeInput = document.getElementById('code-input');
  const codeError = document.getElementById('code-error');
  const entryError = document.getElementById('entry-error');
  const noteContent = document.getElementById('note-content');

  // Check for ?code= in URL
  const urlParams = new URLSearchParams(window.location.search);
  const codeFromUrl = urlParams.get('code');

  /**
   * Show only one panel, hide the rest
   */
  function showPanel(panel) {
    [entryPanel, loadingPanel, notePanel, notfoundPanel].forEach(function (p) {
      if (p) p.hidden = true;
    });
    if (panel) panel.hidden = false;
  }

  /**
   * Fetch and display a note by code
   */
  async function fetchNote(code) {
    showPanel(loadingPanel);

    try {
      const response = await fetch('api/notes/' + encodeURIComponent(code));

      if (!response.ok) {
        showPanel(notfoundPanel);
        return;
      }

      const data = await response.json();
      noteContent.textContent = data.text;
      showPanel(notePanel);

    } catch (err) {
      showPanel(notfoundPanel);
    }
  }

  /**
   * Validate code format
   */
  function validateCode(code) {
    // 8 chars, alphanumeric uppercase
    const cleaned = code.replace(/\s/g, '').toUpperCase();
    if (cleaned.length !== 8) {
      return { valid: false, cleaned, error: 'Il codice deve essere di 8 caratteri esatti.' };
    }
    if (!/^[A-Z0-9]{8}$/.test(cleaned)) {
      return { valid: false, cleaned, error: 'Il codice può contenere solo lettere maiuscole (A-Z) e numeri (2-9).' };
    }
    return { valid: true, cleaned };
  }

  // If we have a code in URL, auto-fetch it
  if (codeFromUrl) {
    const validation = validateCode(codeFromUrl);
    if (validation.valid) {
      codeInput.value = validation.cleaned;
      fetchNote(validation.cleaned);
    } else {
      codeInput.value = codeFromUrl.replace(/\s/g, '').toUpperCase();
      showPanel(entryPanel);
      entryError.textContent = validation.error;
      entryError.hidden = false;
    }
  }

  // Handle code form submission
  codeForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const rawCode = codeInput.value;
    const validation = validateCode(rawCode);

    if (!validation.valid) {
      codeError.textContent = validation.error;
      codeError.hidden = false;
      codeInput.setAttribute('aria-invalid', 'true');
      return;
    }

    codeError.hidden = true;
    codeError.textContent = '';
    codeInput.removeAttribute('aria-invalid');
    entryError.hidden = true;

    // Update URL without reload
    const newUrl = 'view.html?code=' + encodeURIComponent(validation.cleaned);
    window.history.replaceState(null, '', newUrl);

    fetchNote(validation.cleaned);
  });

  // Live validation on input
  codeInput.addEventListener('input', function () {
    if (!codeError.hidden) {
      const rawCode = codeInput.value.replace(/\s/g, '').toUpperCase();
      codeInput.value = rawCode;
      if (rawCode.length === 8 && /^[A-Z0-9]{8}$/.test(rawCode)) {
        codeError.hidden = true;
        codeInput.removeAttribute('aria-invalid');
      }
    }
  });

  // Auto-uppercase and strip spaces while typing
  codeInput.addEventListener('input', function () {
    const pos = codeInput.selectionStart;
    const oldVal = codeInput.value;
    const newVal = oldVal.replace(/\s/g, '').toUpperCase();
    if (oldVal !== newVal) {
      codeInput.value = newVal;
      // Restore cursor position
      const diff = oldVal.length - newVal.length;
      codeInput.setSelectionRange(pos - diff, pos - diff);
    }
  });

  // Paste handler: clean pasted text
  codeInput.addEventListener('paste', function (e) {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    const cleaned = pasted.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
    codeInput.value = cleaned;
    codeInput.dispatchEvent(new Event('input'));
  });
})();
