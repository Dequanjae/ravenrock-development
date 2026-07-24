/* ═══════════════════════════════════════════════════════════════
   RAVENROCK DEVELOPMENT CORP — Main JavaScript
   Navigation, Scroll Animations, Parallax, Counters, Forms
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Page Loader ──
  const loader = document.getElementById('pageLoader');
  if (loader) {
    window.addEventListener('load', function () {
      setTimeout(function () {
        loader.classList.add('hidden');
        setTimeout(function () { loader.remove(); }, 500);
      }, 300);
    });
  }

  // ── Navigation ──
  const nav = document.getElementById('mainNav');
  const navToggle = document.getElementById('navToggle');
  const navMobile = document.getElementById('navMobile');

  // Scroll-based nav styling (only on pages without pre-scrolled nav)
  function handleNavScroll() {
    if (!nav) return;
    if (nav.classList.contains('scrolled')) return; // already pre-scrolled (inner pages)
    if (window.scrollY > 80) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  // Mobile toggle
  if (navToggle && navMobile) {
    navToggle.addEventListener('click', function () {
      navToggle.classList.toggle('active');
      navMobile.classList.toggle('active');
      document.body.style.overflow = navMobile.classList.contains('active') ? 'hidden' : '';
    });

    // Close mobile nav on link click
    navMobile.querySelectorAll('.nav__link').forEach(function (link) {
      link.addEventListener('click', function () {
        navToggle.classList.remove('active');
        navMobile.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        var offset = nav ? nav.offsetHeight + 20 : 80;
        var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: 'smooth' });
        // Close mobile nav if open
        if (navToggle) navToggle.classList.remove('active');
        if (navMobile) navMobile.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });

  // ── Scroll Reveal (IntersectionObserver) ──
  function initRevealAnimations() {
    var reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      });

      reveals.forEach(function (el) { observer.observe(el); });
    } else {
      // Fallback for older browsers
      reveals.forEach(function (el) { el.classList.add('visible'); });
    }
  }

  // ── Counter Animation ──
  function initCounters() {
    var counters = document.querySelectorAll('.counter');
    if (!counters.length) return;

    function animateCounter(el) {
      var target = parseInt(el.getAttribute('data-target'), 10);
      var duration = 2000;
      var start = 0;
      var startTime = null;

      function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
      }

      function update(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        var value = Math.floor(easeOutCubic(progress) * target);
        el.textContent = value.toLocaleString();
        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          el.textContent = target.toLocaleString();
        }
      }

      requestAnimationFrame(update);
    }

    if ('IntersectionObserver' in window) {
      var counterObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });

      counters.forEach(function (el) { counterObserver.observe(el); });
    } else {
      counters.forEach(function (el) { el.textContent = el.getAttribute('data-target'); });
    }
  }

  // ── Hero Parallax ──
  var heroBg = document.getElementById('heroBg');
  function handleParallax() {
    if (!heroBg) return;
    var scrollY = window.pageYOffset;
    var heroSection = heroBg.closest('.hero');
    if (!heroSection) return;
    var rect = heroSection.getBoundingClientRect();
    if (rect.bottom > 0) {
      heroBg.style.transform = 'translateY(' + (scrollY * 0.3) + 'px) scale(1.05)';
    }
  }

  // ── FAQ Accordion ──
  function initFAQ() {
    var faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(function (item) {
      var question = item.querySelector('.faq-item__question');
      if (question) {
        question.addEventListener('click', function () {
          var isActive = item.classList.contains('active');
          // Close all others
          faqItems.forEach(function (i) { i.classList.remove('active'); });
          // Toggle current
          if (!isActive) item.classList.add('active');
        });
      }
    });
  }

  // ── Form Handlers ──
  window.handleContactForm = function (e) {
    e.preventDefault();
    var form = document.getElementById('contactForm');
    var status = document.getElementById('contactFormStatus');
    if (!form || !status) return false;

    // Simulate submission
    var btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'Sending...';
    btn.disabled = true;

    setTimeout(function () {
      status.className = 'form__status form__status--success';
      status.textContent = 'Thank you! Your message has been received. We will respond within 24 hours.';
      status.style.display = 'block';
      form.reset();
      btn.textContent = 'Send Message';
      btn.disabled = false;

      // Hide after 8 seconds
      setTimeout(function () { status.style.display = 'none'; }, 8000);
    }, 1500);

    return false;
  };

  window.handleInvestorForm = function (e) {
    e.preventDefault();
    var form = document.getElementById('investorForm');
    var status = document.getElementById('investorFormStatus');
    if (!form || !status) return false;

    var btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'Submitting...';
    btn.disabled = true;

    setTimeout(function () {
      status.className = 'form__status form__status--success';
      status.textContent = 'Thank you for your interest! Our investor relations team will contact you within 24 hours with a comprehensive investment package.';
      status.style.display = 'block';
      form.reset();
      btn.textContent = 'Request Investment Package';
      btn.disabled = false;

      setTimeout(function () { status.style.display = 'none'; }, 8000);
    }, 1500);

    return false;
  };

  // ── Active Page Highlight ──
  function setActiveNavLink() {
    var currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav__link').forEach(function (link) {
      var href = link.getAttribute('href');
      if (href === currentPage) {
        link.classList.add('nav__link--active');
      }
    });
  }

  // ── Scroll Event Throttle ──
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(function () {
        handleNavScroll();
        handleParallax();
        ticking = false;
      });
      ticking = true;
    }
  });

  // ── Newsletter Form (footer) ──
  document.querySelectorAll('.footer__newsletter-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('.footer__newsletter-input');
      var btn = form.querySelector('.footer__newsletter-btn');
      if (input && input.value) {
        btn.textContent = 'Subscribed!';
        btn.style.background = 'var(--color-olive)';
        input.value = '';
        setTimeout(function () {
          btn.textContent = 'Subscribe';
          btn.style.background = '';
        }, 3000);
      }
    });
  });

  // ── Initialize Everything ──
  document.addEventListener('DOMContentLoaded', function () {
    handleNavScroll();
    setActiveNavLink();
    initRevealAnimations();
    initCounters();
    initFAQ();
  });

  // Run parallax immediately if page is already scrolled
  handleParallax();

})();
