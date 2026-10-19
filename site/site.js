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
