/**
 * Nota Volatile — Creation page logic
 */
(function () {
  'use strict';

  // DOM refs
  const form = document.getElementById('create-form');
  const textarea = document.getElementById('note-text');
  const durationSelect = document.getElementById('duration');
  const submitBtn = document.getElementById('submit-btn');
  const resultPanel = document.getElementById('result-panel');
  const resultCode = document.getElementById('result-code');
  const resultLink = document.getElementById('result-link');
  const copyBtn = document.getElementById('copy-btn');
  const copyLinkBtn = document.getElementById('copy-link-btn');
  const toast = document.getElementById('toast');
  const textError = document.getElementById('text-error');
  const durationError = document.getElementById('duration-error');

  let toastTimer = null;

  // Show a toast notification
  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 2000);
  }

  // Copy text to clipboard
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copiato negli appunti!');
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Copiato negli appunti!');
    }
  }

  // Validate text field on blur/input
  function validateText() {
    const value = textarea.value.trim();
    if (!value) {
      textError.textContent = 'Scrivi qualcosa nella nota prima di generare il codice.';
      textError.hidden = false;
      textarea.setAttribute('aria-invalid', 'true');
      return false;
    }
    if (value.length > 10000) {
      textError.textContent = 'La nota non può superare i 10.000 caratteri.';
      textError.hidden = false;
      textarea.setAttribute('aria-invalid', 'true');
      return false;
    }
    textError.hidden = true;
    textError.textContent = '';
    textarea.removeAttribute('aria-invalid');
    return true;
  }

  function validateDuration() {
    const value = parseInt(durationSelect.value, 10);
    if (isNaN(value) || value < 1 || value > 1440) {
      durationError.textContent = 'Seleziona una durata valida.';
      durationError.hidden = false;
      durationSelect.setAttribute('aria-invalid', 'true');
      return false;
    }
    durationError.hidden = true;
    durationError.textContent = '';
    durationSelect.removeAttribute('aria-invalid');
    return true;
  }

  // Handle form submission
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const textValid = validateText();
    const durationValid = validateDuration();

    if (!textValid || !durationValid) return;

    const text = textarea.value.trim();
    const durationMinutes = parseInt(durationSelect.value, 10);

    // Disable button during request
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-label').textContent = 'Creazione in corso…';

    try {
      const response = await fetch('api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, durationMinutes })
      });

      const data = await response.json();

      if (!response.ok) {
        textError.textContent = data.error || 'Errore durante la creazione della nota.';
        textError.hidden = false;
        return;
      }

      // Show result
      resultCode.textContent = data.code;
      const linkUrl = 'view.html?code=' + encodeURIComponent(data.code);
      resultLink.href = linkUrl;
      resultLink.textContent = linkUrl;
      resultPanel.hidden = false;
      resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      // Reset form for a new note
      textarea.value = '';
      textError.hidden = true;

    } catch (err) {
      textError.textContent = 'Errore di rete. Verifica la connessione e riprova.';
      textError.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-label').textContent = 'Genera codice';
    }
  });

  // Live validation on blur
  textarea.addEventListener('blur', validateText);
  textarea.addEventListener('input', function () {
    if (!textError.hidden) validateText();
  });
  durationSelect.addEventListener('blur', validateDuration);
  durationSelect.addEventListener('change', function () {
    if (!durationError.hidden) validateDuration();
  });

  // Copy buttons
  copyBtn.addEventListener('click', function () {
    copyToClipboard(resultCode.textContent);
  });

  copyLinkBtn.addEventListener('click', function () {
    copyToClipboard(resultLink.href);
  });

  // Keyboard: allow Enter on copy buttons
  copyBtn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      copyToClipboard(resultCode.textContent);
    }
  });

  copyLinkBtn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      copyToClipboard(resultLink.href);
    }
  });
})();
