/* VANBRANSA Landing Page — Scroll Animations & Interactions */

(function () {
  'use strict';

  // === IntersectionObserver: Fade-in on Scroll ===
  const fadeElements = document.querySelectorAll('.fade-in');
  
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  fadeElements.forEach(el => fadeObserver.observe(el));

  // === Animated Number Counter ===
  function animateCounter(element, target, duration = 2000) {
    const start = 0;
    const startTime = performance.now();
    
    function formatNumber(num) {
      if (num >= 1000000) return (num / 1000000).toFixed(0) + 'M+';
      if (num >= 1000) return num.toLocaleString() + '+';
      return num.toString();
    }

    function tick(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (target - start) * eased);
      
      element.textContent = formatNumber(current);
      
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }

  // Observe stats section
  const statNums = document.querySelectorAll('.stat-num[data-count]');
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = parseInt(entry.target.getAttribute('data-count'));
        animateCounter(entry.target, target);
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  statNums.forEach(el => statsObserver.observe(el));

  // === Smooth Scroll for Anchor Links ===
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Close mobile menu if open
        const navBar = document.getElementById('nav-bar');
        if (navBar) navBar.classList.remove('open');
      }
    });
  });

  // === Mobile Hamburger Menu ===
  const hamburger = document.getElementById('hamburger-btn');
  const navBar = document.getElementById('nav-bar');
  
  if (hamburger && navBar) {
    hamburger.addEventListener('click', () => {
      navBar.classList.toggle('open');
      hamburger.textContent = navBar.classList.contains('open') ? '✕' : '☰';
    });
  }

  // === Navbar Background on Scroll ===
  window.addEventListener('scroll', () => {
    if (navBar) {
      navBar.style.background = window.scrollY > 80 
        ? 'rgba(6, 8, 15, 0.92)' 
        : 'rgba(6, 8, 15, 0.7)';
    }
  });

  // === Parallax Effect on Hero Orbs ===
  const orbs = document.querySelectorAll('.orb');
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    orbs.forEach((orb, i) => {
      const speed = (i + 1) * 0.15;
      orb.style.transform = `translateY(${scrollY * speed}px)`;
    });
  });

})();
