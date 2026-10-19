function retainSection() {
  for (const link of document.querySelectorAll('[data-language]')) {
    const url = new URL(link.href);
    url.hash = location.hash;
    link.href = url.href;
  }
}
retainSection();
addEventListener('hashchange', retainSection);
const details = document.querySelector('.contents details');
const compact = matchMedia('(max-width: 1000px)');
if (compact.matches) details.open = false;
compact.addEventListener('change', event => { details.open = !event.matches; });

const qrTrigger = document.querySelector('.qr-trigger');
const qrDialog = document.querySelector('.qr-dialog');
if (qrTrigger && qrDialog && typeof qrDialog.showModal === 'function') {
  qrTrigger.setAttribute('aria-haspopup', 'dialog');
  qrTrigger.addEventListener('click', event => {
    event.preventDefault();
    qrDialog.showModal();
  });
  qrDialog.addEventListener('click', event => {
    const bounds = qrDialog.getBoundingClientRect();
    if (event.target === qrDialog &&
        (event.clientX < bounds.left || event.clientX > bounds.right ||
         event.clientY < bounds.top || event.clientY > bounds.bottom)) qrDialog.close();
  });
  qrDialog.addEventListener('close', () => qrTrigger.focus({preventScroll:true}));
}
