// sidebar.js

export const sidebarMenu = {
  logo: {
    src: "assets/logo-carze.png",
    alt: "CARZE Contratistas Generales",
    subtitle: "CONTRATISTAS GENERALES"
  },
  items: [
    {
      type: "item",
      label: "DASHBOARD",
      icon: "📊",
      path: "/dashboard"
    },
    {
      type: "section",
      title: "CICLO COMERCIAL",
      children: [
        { label: "COTIZACIONES", icon: "📋", path: "/cotizaciones" },
        { label: "CERTIFICADOS", icon: "🏅", path: "/certificados" },
        { label: "PRESUPUESTO", icon: "📈", path: "/presupuesto" }
      ]
    },
    {
      type: "section",
      title: "GESTIÓN FINANCIERA",
      children: [
        { label: "FACTURAS", icon: "📄", path: "/facturas" },
        { label: "FINANZAS", icon: "💰", path: "/finanzas" },
        { label: "CAJA DIARIA", icon: "💵", path: "/caja-diaria" },
        { label: "FLUJO DE CAJA", icon: "💹", path: "/flujo-de-caja" },
        { label: "PRONTO PAGO", icon: "⏰", path: "/pronto-pago" },
        { label: "IMPUESTOS", icon: "🏛️", path: "/impuestos" }
      ]
    },
    {
      type: "section",
      title: "OPERACIONES Y CONTROL",
      children: [
        { label: "PERSONAL", icon: "👥", path: "/personal" },
        { label: "EVENTOS", icon: "📅", path: "/eventos", active: true },
        { label: "VENCIMIENTO Y ALERTAS", icon: "🚨", path: "/vencimiento-alertas" },
        { label: "SEGUIMIENTO", icon: "🔍", path: "/seguimiento" }
      ]
    }
  ]
};

/**
 * Función opcional para renderizar el sidebar en HTML Vanilla
 */
export function renderSidebar(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let html = `
    <div class="sidebar-header">
      <img src="${sidebarMenu.logo.src}" alt="${sidebarMenu.logo.alt}" class="sidebar-logo" />
      <small>${sidebarMenu.logo.subtitle}</small>
    </div>
    <nav class="sidebar-nav">
  `;

  sidebarMenu.items.forEach(group => {
    if (group.type === "item") {
      html += `
        <a href="${group.path}" class="nav-item">
          <span class="icon">${group.icon}</span>
          <span class="label">${group.label}</span>
        </a>
      `;
    } else if (group.type === "section") {
      html += `<div class="nav-section-title">${group.title}</div>`;
      group.children.forEach(item => {
        const activeClass = item.active ? "active" : "";
        html += `
          <a href="${item.path}" class="nav-item ${activeClass}">
            <span class="icon">${item.icon}</span>
            <span class="label">${item.label}</span>
          </a>
        `;
      });
    }
  });

  html += \`</nav>\`;
  container.innerHTML = html;
}
