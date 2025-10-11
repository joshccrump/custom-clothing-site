(function(){
  function qs(name){
    return new URLSearchParams(window.location.search).get(name);
  }

  async function main(){
    if (!window.Square){
      document.getElementById('error').textContent = 'Square SDK failed to load';
      return;
    }

    const variationId = qs('variationId');
    const quantity = Math.max(1, parseInt(qs('quantity') || '1', 10));
    const modifiers = (qs('mods') || '').split(',').map(s => s.trim()).filter(Boolean);
    const note = qs('note') || '';

    const payments = Square.payments(window.SQUARE_APPLICATION_ID, window.SQUARE_LOCATION_ID);
    const card = await payments.card();
    await card.attach('#card-container');

    document.getElementById('summary').textContent = 'Enter your card to complete payment.';

    document.getElementById('pay').addEventListener('click', async () => {
      const button = document.getElementById('pay');
      const errorNode = document.getElementById('error');
      button.disabled = true;
      errorNode.textContent = '';
      try {
        const tokenResult = await card.tokenize();
        if (tokenResult.status !== 'OK'){
          throw new Error(tokenResult.errors?.[0]?.message || 'Tokenization failed');
        }
        const body = {
          variationId,
          quantity,
          token: tokenResult.token,
          modifiers: modifiers.map(id => ({ catalogObjectId: id })),
          note
        };
        const requestInit = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        };
        const response = window.Site?.apiFetch
          ? await window.Site.apiFetch('/api/checkout', requestInit)
          : await fetch((window.API_BASE || '') + '/api/checkout', requestInit);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Payment failed');
        window.location.href = window.Site ? window.Site.join('thank-you.html') : 'thank-you.html';
      } catch (err) {
        errorNode.textContent = err?.message || 'Checkout failed';
        button.disabled = false;
      }
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
      if (window.Site) window.Site.rewriteAnchors();
      main().catch(err => console.error(err));
    }, { once: true });
  } else {
    if (window.Site) window.Site.rewriteAnchors();
    main().catch(err => console.error(err));
  }
})();
