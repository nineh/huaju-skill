
(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // section reveals, once
  var rises = document.querySelectorAll('.rise');
  if (!('IntersectionObserver' in window)) { rises.forEach(function(e){e.classList.add('in')}); }
  else {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} });
    },{threshold:.15});
    rises.forEach(function(e){io.observe(e)});
  }
  // tagline: words light up one by one as they cross a trigger line
  var words = document.querySelectorAll('#tagline .w');
  if (reduce || !('IntersectionObserver' in window)) { words.forEach(function(w){w.classList.add('on')}); }
  else {
    var wo = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('on'); wo.unobserve(e.target);} });
    },{rootMargin:'0px 0px -45% 0px'});
    words.forEach(function(w,i){ w.style.transitionDelay = (i*60)+'ms'; wo.observe(w); });
  }
  // current nav item
  var links = document.querySelectorAll('.nav-links a');
  var map = {};
  links.forEach(function(a){ map[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window) {
    var so = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ links.forEach(function(a){a.classList.remove('on')}); if(map[e.target.id]) map[e.target.id].classList.add('on'); } });
    },{rootMargin:'-40% 0px -55% 0px'});
    Object.keys(map).forEach(function(id){ var s=document.getElementById(id); if(s) so.observe(s); });
  }
})();
