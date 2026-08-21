// router.js – lightweight hash‑based router for VANBRANSA app

export const Router = (function () {
  const viewLinks = document.querySelectorAll('.nav-link[data-target]');
  const sections = document.querySelectorAll('.view-panel');

  function init(defaultView = 'dashboard-view') {
    // attach click listeners
    viewLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('data-target');
        navigate(target);
      });
    });
    // handle hash changes
    window.addEventListener('hashchange', () => {
      const view = location.hash.replace('#', '') || defaultView;
      navigate(view);
    });
    // initial navigation
    const initialView = location.hash.replace('#', '') || defaultView;
    navigate(initialView);
  }

  function navigate(viewId) {
    sections.forEach((sec) => {
      if (sec.id === viewId) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });
    // update active link styling
    viewLinks.forEach((link) => {
      const target = link.getAttribute('data-target');
      if (target === viewId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
    // update URL hash without scrolling
    if (location.hash !== `#${viewId}`) {
      history.replaceState(null, '', `#${viewId}`);
    }
  }

  return {
    init,
    navigate
  };
})();
