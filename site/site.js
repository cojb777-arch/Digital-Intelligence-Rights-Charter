if (new URLSearchParams(location.search).has('embed')) {
  document.body.classList.add('charter-embed');
  for (const link of document.querySelectorAll('a[href^="/"],a[href^="https://"]')) {
    link.target = '_blank';
    link.rel = 'noopener';
  }
}

function retainSection() {
  for (const link of document.querySelectorAll('[data-language]')) {
    const url = new URL(link.href);
    url.hash = location.hash;
    link.href = url.href;
  }
}
retainSection();
addEventListener('hashchange', retainSection);
function retainForumSection() {
  for (const link of document.querySelectorAll('[data-forum-link]')) {
    const url = new URL(link.href);
    url.searchParams.delete('section');
    if (location.hash) url.searchParams.set('section',location.hash.slice(1));
    link.href = url.href;
  }
}
retainForumSection();
addEventListener('hashchange',retainForumSection);
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
