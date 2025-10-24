const WHATSAPP_NUMBER = "543476495451"; // +54 9 3476 495451

let productos = [];
let carrito = [];

function formatARS(n){ return Number(n||0).toLocaleString('es-AR'); }

function renderProductos(lista){
  const grid = document.querySelector(".products");
  grid.innerHTML = "";
  if(!lista || lista.length === 0){
    grid.innerHTML = `<p style="grid-column:1/-1;opacity:.7">Sin resultados…</p>`;
    return;
  }
  lista.forEach(p => {
    const precio = Number(p.precio || 0);
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="thumb">${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre}">` : "Imagen producto"}</div>
      <div class="info">
        <b>${p.nombre || ""}</b>
        <div class="price">
          <b>$${formatARS(precio)}</b>
          <button class="add" data-nombre="${(p.nombre||"").replace(/"/g,'\\"')}" data-precio="${precio}">Agregar</button>
        </div>
        <small>${p.categoria || ""}</small>
      </div>`;
    grid.appendChild(card);
  });
}

async function cargarProductos(){
  try{
    const resp = await fetch("productos.csv?cache=" + Date.now());
    const text = await resp.text();
    const parsed = Papa.parse(text, {header:true, skipEmptyLines:true});
    productos = parsed.data.filter(p => p && p.nombre);
    const cats = Array.from(new Set(productos.map(p => (p.categoria||"").trim()).filter(Boolean))).sort();
    const sel = document.getElementById("filtroCategoria");
    sel.innerHTML = `<option value="">Todas las categorías</option>` + cats.map(c=>`<option value="${c}">${c}</option>`).join("");
    renderProductos(productos);
  }catch(err){
    console.error("Error cargando productos.csv", err);
    document.querySelector(".products").innerHTML = `<p style="grid-column:1/-1;color:#f66">No se pudo cargar productos.csv</p>`;
  }
}

function refreshCartBadge(){
  const items = carrito.length;
  const total = carrito.reduce((a,b)=>a+b.precio,0);
  document.getElementById("items").textContent = items;
  document.getElementById("total").textContent = `$${formatARS(total)}`;
}

function addToCart(nombre, precio){
  carrito.push({nombre, precio:Number(precio)||0});
  refreshCartBadge();
}

document.addEventListener("click", (e)=>{
  const btn = e.target.closest(".add");
  if(btn){
    addToCart(btn.dataset.nombre, btn.dataset.precio);
  }
});

function goWhatsApp(){
  if(carrito.length===0){ alert("Agregá productos para enviar el pedido."); return; }
  const list = carrito.map(i=>`• ${i.nombre} - $${formatARS(i.precio)}`).join("%0A");
  const total = carrito.reduce((a,b)=>a+b.precio,0);
  const msg = `Hola! Quiero hacer este pedido:%0A${list}%0A%0ATotal: $${formatARS(total)}`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`,'_blank');
}

function applyFilters(){
  const q = document.getElementById("buscador").value.toLowerCase().trim();
  const cat = document.getElementById("filtroCategoria").value;
  let res = productos.slice();
  if(cat) res = res.filter(p => (p.categoria||"") === cat);
  if(q) res = res.filter(p => (p.nombre||"").toLowerCase().includes(q));
  renderProductos(res);
}

document.addEventListener("input",(e)=>{
  if(e.target.id==="buscador" || e.target.id==="filtroCategoria") applyFilters();
});

window.addEventListener("DOMContentLoaded", ()=>{
  refreshCartBadge();
  cargarProductos();
});
