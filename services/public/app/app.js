// Module-based app bootstrap
import { sidebarHTML, attachSidebarHandlers } from './components/sidebar.js';
import { headerHTML } from './components/header.js';
import { chatHTML, initChatBehavior } from './pages/chat.js';

const root = document.getElementById('app-root');

function buildApp() {
  const html = `
    <div class="layout">
      ${sidebarHTML()}
      <main class="content">
        ${headerHTML()}
        ${chatHTML()}
      </main>
    </div>`;
  root.innerHTML = html;

  // attach sidebar handlers (conversations, agents, collections)
  attachSidebarHandlers(root);

  // hookup page switcher
  const navBtns = document.querySelectorAll('.nav button');
  const pages = document.querySelectorAll('.page');
  navBtns.forEach(b=> b.addEventListener('click', ()=>{
    navBtns.forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const p = b.getAttribute('data-page');
    pages.forEach(pg=> pg.style.display = pg.id === 'page-'+p ? 'block' : 'none');
  }));

  // theme
  const themeBtn = document.getElementById('themeBtn');
  function setTheme(t){ if(t==='light') document.documentElement.classList.add('light'); else document.documentElement.classList.remove('light'); localStorage.setItem('vyre_theme', t); }
  setTheme(localStorage.getItem('vyre_theme') || 'dark');
  if (themeBtn) themeBtn.addEventListener('click', ()=> setTheme(document.documentElement.classList.contains('light') ? 'dark' : 'light'));

  // init chat behaviours
  initChatBehavior();

  // sidebar toggle (collapse/expand)
  const sidebar = document.querySelector('.sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  function toggleSidebar(){
    if(!sidebar) return;
    // on narrow screens, show overlay
    if(window.matchMedia('(max-width:900px)').matches){
      document.body.classList.toggle('show-sidebar');
    } else {
      sidebar.classList.toggle('collapsed');
    }
  }
  if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);

  // close overlay when clicking outside (mobile)
  document.addEventListener('click', (ev)=>{
    if(!document.body.classList.contains('show-sidebar')) return;
    const target = ev.target;
    if(sidebar && !sidebar.contains(target) && !(target && target.id === 'sidebarToggle')){
      document.body.classList.remove('show-sidebar');
    }
  });
}

buildApp();
