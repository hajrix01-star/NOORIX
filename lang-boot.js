(function () {
  try {
    var lang = localStorage.getItem('noorix-lang') || 'ar';
    var d = document.documentElement;
    if (lang === 'en') {
      d.setAttribute('dir', 'ltr');
      d.setAttribute('lang', 'en');
    } else {
      d.setAttribute('dir', 'rtl');
      d.setAttribute('lang', 'ar');
    }
  } catch (e) {}
})();
