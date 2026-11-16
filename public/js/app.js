(function () {
  'use strict';

  /* ---------- Toast ---------- */
  function setupToasts() {
    document.querySelectorAll('[data-toast]').forEach(function (toast) {
      requestAnimationFrame(function () {
        toast.classList.add('show');
      });
      var close = toast.querySelector('[data-toast-close]');
      if (close) {
        close.addEventListener('click', function () {
          toast.classList.remove('show');
          setTimeout(function () {
            toast.remove();
          }, 250);
        });
      }
      setTimeout(function () {
        toast.classList.remove('show');
        setTimeout(function () {
          toast.remove();
        }, 250);
      }, 5000);
    });
  }

  /* ---------- Dialog konfirmasi ---------- */
  function setupConfirm() {
    if (typeof HTMLDialogElement === 'undefined') {
      document.querySelectorAll('form[data-confirm]').forEach(function (form) {
        form.addEventListener('submit', function (event) {
          if (!window.confirm(form.getAttribute('data-confirm'))) event.preventDefault();
        });
      });
      return;
    }

    var dialog = document.createElement('dialog');
    dialog.className = 'confirm';
    dialog.innerHTML =
      '<div class="confirm-body">' +
      '<div class="confirm-head">' +
      '<span class="confirm-icon">!</span>' +
      '<div><h3>Konfirmasi tindakan</h3><p data-confirm-text></p></div>' +
      '</div></div>' +
      '<div class="confirm-actions">' +
      '<button type="button" class="btn" data-confirm-cancel>Batal</button>' +
      '<button type="button" class="btn danger" data-confirm-ok>Ya, lanjutkan</button>' +
      '</div>';
    document.body.appendChild(dialog);

    var pendingForm = null;
    var text = dialog.querySelector('[data-confirm-text]');

    dialog.querySelector('[data-confirm-cancel]').addEventListener('click', function () {
      pendingForm = null;
      dialog.close();
    });

    dialog.querySelector('[data-confirm-ok]').addEventListener('click', function () {
      var form = pendingForm;
      pendingForm = null;
      dialog.close();
      if (form) form.submit();
    });

    dialog.addEventListener('close', function () {
      pendingForm = null;
    });

    document.querySelectorAll('form[data-confirm]').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        if (form.dataset.confirmed === '1') return;
        event.preventDefault();
        pendingForm = form;
        text.textContent = form.getAttribute('data-confirm');
        dialog.showModal();
      });
    });
  }

  /* ---------- Pratinjau & drag-and-drop gambar ---------- */
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

    input.addEventListener('change', function () {
      show(input.files && input.files[0]);
    });

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

  /* ---------- Muat ulang otomatis setelah filter diubah ---------- */
  function setupAutoSubmit() {
    document.querySelectorAll('[data-autosubmit]').forEach(function (select) {
      select.addEventListener('change', function () {
        var form = select.closest('form');
        if (form) form.submit();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupToasts();
    setupConfirm();
    setupImagePreview();
    setupAutoSubmit();
  });
})();
