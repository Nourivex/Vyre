export function headerHTML() {
  return `
    <div class="header">
      <div style="display:flex;align-items:center;gap:12px">
        <button id="sidebarToggle" class="btn sidebar-toggle">☰</button>
        <div class="hero"><div class="logo">V</div><div><div style="font-weight:700">Vyre — Local AI backend</div><div class="lead">Private by default · experiment locally</div></div></div>
      </div>
      <div class="actions"><a class="btn" href="/openapi.json">OpenAPI</a><a class="btn" href="/swagger">Swagger</a><button id="themeBtn" class="btn">Toggle Theme</button></div>
    </div>`;
}
