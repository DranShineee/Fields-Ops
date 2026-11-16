(function () {
  'use strict';

  var rupiah = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  });

  function money(value) {
    return rupiah.format(Number(value) || 0).replace(/\u00a0/g, ' ');
  }

  /* ---------------- Header ---------------- */
  function setupHeader() {
    var header = document.querySelector('[data-header]');
    if (header) {
      var onScroll = function () {
        header.classList.toggle('is-scrolled', window.scrollY > 8);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.querySelector('[data-nav]');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------------- Hero slider ---------------- */
  function setupSlider() {
    var slider = document.querySelector('[data-slider]');
    if (!slider) return;

    var slides = Array.prototype.slice.call(slider.querySelectorAll('[data-slide]'));
    var counter = document.querySelector('[data-counter]');
    var prev = document.querySelector('[data-prev]');
    var next = document.querySelector('[data-next]');
    if (slides.length === 0) return;

    var index = 0;
    var timer = null;
    var paused = false;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function render() {
      slides.forEach(function (slide, i) {
        slide.classList.toggle('is-active', i === index);
      });
      if (counter) counter.textContent = index + 1 + ' / ' + slides.length;
    }

    function go(step) {
      index = (index + step + slides.length) % slides.length;
      render();
      restart();
    }

    function restart() {
      if (reduceMotion || paused) return;
      window.clearInterval(timer);
      timer = window.setInterval(function () {
        index = (index + 1) % slides.length;
        render();
      }, 7000);
    }

    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });

    slider.addEventListener('mouseenter', function () {
      paused = true;
      window.clearInterval(timer);
    });
    slider.addEventListener('mouseleave', function () {
      paused = false;
      restart();
    });

    var region = slider.closest('.hero-main') || slider;
    region.addEventListener('focusin', function () {
      paused = true;
      window.clearInterval(timer);
    });
    region.addEventListener('focusout', function () {
      paused = false;
      restart();
    });

    render();
    restart();
  }

  /* ---------------- Reveal on scroll ---------------- */
  function setupReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (item) { item.classList.add('is-visible'); });
      return;
    }

    /* Kelas ini baru dipasang bila JS berjalan, sehingga konten tetap
       terlihat pada kondisi JS gagal dimuat. */
    document.documentElement.classList.add('reveal-ready');

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    items.forEach(function (item) { observer.observe(item); });
  }

  /* ---------------- Count-up ---------------- */
  function setupCounters() {
    var counters = document.querySelectorAll('[data-count]');
    if (!counters.length || !('IntersectionObserver' in window)) return;

    var animate = function (el) {
      var target = Number(el.getAttribute('data-count')) || 0;
      var start = performance.now();
      var duration = 900;
      var step = function (now) {
        var progress = Math.min(1, (now - start) / duration);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = String(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = String(target);
      };
      requestAnimationFrame(step);
    };

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        animate(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    counters.forEach(function (counter) { observer.observe(counter); });
  }

  /* ---------------- Toast ---------------- */
  function setupToasts() {
    document.querySelectorAll('[data-toast]').forEach(function (toast) {
      requestAnimationFrame(function () { toast.classList.add('show'); });
      var close = toast.querySelector('[data-toast-close]');
      var dismiss = function () {
        toast.classList.remove('show');
        setTimeout(function () { toast.remove(); }, 300);
      };
      if (close) close.addEventListener('click', dismiss);
      setTimeout(dismiss, 5200);
    });
  }

  /* ---------------- Confirm dialog ---------------- */
  function setupConfirm() {
    var forms = document.querySelectorAll('form[data-confirm]');
    if (!forms.length) return;

    if (typeof HTMLDialogElement === 'undefined') {
      forms.forEach(function (form) {
        form.addEventListener('submit', function (event) {
          if (!window.confirm(form.getAttribute('data-confirm'))) event.preventDefault();
        });
      });
      return;
    }

    var dialog = document.createElement('dialog');
    dialog.className = 'confirm';
    dialog.innerHTML =
      '<div class="confirm-body"><div class="confirm-head">' +
      '<span class="confirm-icon">!</span>' +
      '<div><h3>Konfirmasi tindakan</h3><p data-confirm-text></p></div>' +
      '</div></div><div class="confirm-actions">' +
      '<button type="button" class="btn" data-confirm-cancel>Batal</button>' +
      '<button type="button" class="btn danger" data-confirm-ok>Ya, lanjutkan</button></div>';
    document.body.appendChild(dialog);

    var pending = null;
    var text = dialog.querySelector('[data-confirm-text]');

    dialog.querySelector('[data-confirm-cancel]').addEventListener('click', function () {
      pending = null;
      dialog.close();
    });
    dialog.querySelector('[data-confirm-ok]').addEventListener('click', function () {
      var form = pending;
      pending = null;
      dialog.close();
      if (form) form.submit();
    });
    dialog.addEventListener('close', function () { pending = null; });

    forms.forEach(function (form) {
      form.addEventListener('submit', function (event) {
        if (!dialog.open && form.dataset.confirmed !== '1') {
          event.preventDefault();
          pending = form;
          text.textContent = form.getAttribute('data-confirm');
          dialog.showModal();
        }
      });
    });
  }

  /* ---------------- Image upload preview ---------------- */
  function setupImagePreview() {
    var input = document.querySelector('[data-image-input]');
    var box = document.getElementById('preview-box');
    var image = document.getElementById('preview-image');
    var placeholder = document.getElementById('preview-placeholder');
    if (!input || !box || !image) return;

    function show(file) {
      if (!file || !/^image\//.test(file.type)) return;
      if (file.size > 3 * 1024 * 1024) {
        window.alert('Ukuran gambar melebihi 3 MB.');
        input.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function (event) {
        image.src = event.target.result;
        image.hidden = false;
        box.classList.add('has-image');
        if (placeholder) placeholder.style.display = 'none';
      };
      reader.readAsDataURL(file);
    }

    input.addEventListener('change', function () { show(input.files && input.files[0]); });

    ['dragenter', 'dragover'].forEach(function (name) {
      box.addEventListener(name, function (event) {
        event.preventDefault();
        box.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (name) {
      box.addEventListener(name, function (event) {
        event.preventDefault();
        box.classList.remove('dragover');
      });
    });
    box.addEventListener('drop', function (event) {
      var files = event.dataTransfer && event.dataTransfer.files;
      if (!files || !files.length) return;
      input.files = files;
      show(files[0]);
    });
  }

  /* ---------------- Quantity stepper ---------------- */
  function setupSteppers() {
    document.querySelectorAll('[data-stepper]').forEach(function (stepper) {
      var input = stepper.querySelector('[data-qty]');
      if (!input) return;

      stepper.querySelectorAll('[data-qty-step]').forEach(function (button) {
        button.addEventListener('click', function () {
          var min = Number(input.min) || 1;
          var max = Number(input.max) || 9999;
          var value = (Number(input.value) || min) + Number(button.getAttribute('data-qty-step'));
          input.value = String(Math.min(max, Math.max(min, value)));
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });

      input.addEventListener('change', function () {
        var min = Number(input.min) || 1;
        var max = Number(input.max) || 9999;
        var value = Math.min(max, Math.max(min, Number(input.value) || min));
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  }

  /* ---------------- Checkout calculator ---------------- */
  function setupCheckout() {
    var form = document.getElementById('checkout-form');
    if (!form) return;

    var price = Number(form.getAttribute('data-price')) || 0;
    var flatShipping = Number(form.getAttribute('data-shipping')) || 0;
    var codFee = Number(form.getAttribute('data-cod-fee')) || 0;
    var freeMin = Number(form.getAttribute('data-free-min')) || 2000000;

    var qtyInput = form.querySelector('[data-qty]');
    var summaries = {
      subtotal: form.querySelector('[data-sum-subtotal]'),
      shipping: form.querySelector('[data-sum-shipping]'),
      cod: form.querySelector('[data-sum-cod]'),
      total: form.querySelector('[data-sum-total]'),
      qty: form.querySelector('[data-sum-qty]'),
    };
    var codRow = form.querySelector('[data-cod-row]');
    var channelBox = form.querySelector('[data-channel-box]');

    function paymentMethod() {
      var checked = form.querySelector('input[name="payment_method"]:checked');
      return checked ? checked.value : 'full';
    }

    function refresh() {
      var qty = Math.max(1, Number(qtyInput && qtyInput.value) || 1);
      var subtotal = price * qty;
      var shipping = subtotal >= freeMin ? 0 : flatShipping;
      var cod = paymentMethod() === 'cod' ? codFee : 0;
      var total = subtotal + shipping + cod;

      if (summaries.subtotal) summaries.subtotal.textContent = money(subtotal);
      if (summaries.shipping) summaries.shipping.textContent = shipping === 0 ? 'Gratis' : money(shipping);
      if (summaries.cod) summaries.cod.textContent = money(cod);
      if (summaries.total) summaries.total.textContent = money(total);
      if (summaries.qty) summaries.qty.textContent = String(qty);
      if (codRow) codRow.hidden = cod === 0;
      if (channelBox) channelBox.hidden = paymentMethod() !== 'full';

      form.querySelectorAll('.pay-option').forEach(function (option) {
        var radio = option.querySelector('input[name="payment_method"]');
        option.classList.toggle('is-selected', !!radio && radio.checked);
      });
    }

    form.addEventListener('change', refresh);
    form.addEventListener('input', function (event) {
      if (event.target && event.target.name === 'qty') refresh();
    });
    refresh();
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupHeader();
    setupSlider();
    setupReveal();
    setupCounters();
    setupToasts();
    setupConfirm();
    setupImagePreview();
    setupSteppers();
    setupCheckout();
  });
})();
