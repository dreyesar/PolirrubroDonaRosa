const WHATSAPP_NUMBER = "543476495451";

let productos = [];
let carrito = [];
let categorias = [];

/* ================================
   FUNCIONES AUXILIARES
=================================*/
function formatARS(n){ return Number(n||0).toLocaleString('es-AR'); }

function normalizeKey(k){
  if(!k) return "";
  return k.replace(/^\uFEFF/, "").normalize("NFD").replace(/\p{Diacritic}/gu,"").trim().toLowerCase();
}
function normalizeRowKeys(row){
  const out={};
  for(const k in row) out[normalizeKey(k)] = row[k];
  return out;
}
function parseNumberAR(v){
  if(v==null) return 0;
  if(typeof v==="number") return v;
  let s=String(v).trim();
  // Formato argentino: punto como miles, coma como decimal
  if(s.match(/,\d{1,2}$/)) s=s.replace(/\./g,"").replace(",",".");
  return Number(s)||0;
}
async function fetchTextRobust(url){
  const res=await fetch(url+"?cache="+Date.now());
  const buf=await res.arrayBuffer();
  const b=new Uint8Array(buf);
  if(b[0]===0xFF && b[1]===0xFE) return new TextDecoder("utf-16le").decode(buf);
  if(b[0]===0xFE && b[1]===0xFF) return new TextDecoder("utf-16be").decode(buf);
  return new TextDecoder("utf-8").decode(buf);
}

/* ================================
   CARGA DE PRODUCTOS
=================================*/
async function cargarProductos(){
  try{
    const text=await fetchTextRobust("productos.csv");

    // Detectar separador: si la primera línea tiene ";" usarlo
    const firstLine = text.split(/\r?\n/)[0];
    const delimiter = firstLine.includes(";") ? ";" : ",";

    const parsed=Papa.parse(text,{header:true,skipEmptyLines:true,delimiter});
    productos=parsed.data.map(normalizeRowKeys).filter(r=>r["nombre"]||r["descripcion"]).map(r=>{
      const id=r["codigo"]||r["id"]||r["articulo"]||"";
      const nombre=r["nombre"]||r["descripcion"]||"";
      const precio=parseNumberAR(r["precio"]||r["minorista"]||0);
      const categoria=String(r["categoria"]||"").trim();
      const imagen=String(r["imagen"]||"").trim();
      return {
        id:String(id).trim(),
        nombre:String(nombre).trim(),
        precio:Number(precio)||0,
        categoria,
        imagen
      };
    });

    // Poblar select de categorías
    categorias=[...new Set(productos.map(p=>p.categoria).filter(c=>c))].sort();
    const sel=document.getElementById("filtroCategoria");
    if(sel && categorias.length>0){
      categorias.forEach(c=>{
        const opt=document.createElement("option");
        opt.value=c; opt.textContent=c;
        sel.appendChild(opt);
      });
    }

    renderProductos(productos);
  }catch(err){
    console.error("Error cargando CSV",err);
    const grid=document.querySelector(".products");
    if(grid) grid.innerHTML=`<p style="grid-column:1/-1;color:#e33">Error al cargar productos. Intentá recargar la página.</p>`;
  }
}

/* ================================
   IMAGEN AUTOMÁTICA POR CÓDIGO DE BARRAS
=================================*/
// Cache en memoria para no repetir pedidos en la misma sesión
const imgCache = {};

function getImageUrl(id) {
  // Solo busca si parece un EAN/código de barras numérico de 8+ dígitos
  if (/^\d{8,14}$/.test(id)) {
    return `https://images.openfoodfacts.org/images/products/${id}/front_es.400.jpg`;
  }
  return null;
}

function setThumbImage(thumbEl, id, nombre) {
  const url = getImageUrl(id);
  if (!url) {
    thumbEl.innerHTML = `<span>${nombre.charAt(0)}</span>`;
    return;
  }
  const img = document.createElement("img");
  img.alt = nombre;
  img.loading = "lazy";
  img.style.cssText = "width:100%;height:100%;object-fit:cover";
  img.onload = () => { thumbEl.innerHTML = ""; thumbEl.appendChild(img); };
  img.onerror = () => { thumbEl.innerHTML = `<span>${nombre.charAt(0)}</span>`; };
  img.src = url;
}

/* ================================
   RENDERIZAR CATÁLOGO
=================================*/
function renderProductos(lista){
  const grid=document.querySelector(".products");
  if(!grid) return;
  grid.innerHTML="";
  if(!lista||lista.length===0){
    grid.innerHTML=`<p style="grid-column:1/-1;opacity:.7">Sin resultados…</p>`;
    return;
  }
  lista.forEach(p=>{
    // Si tiene imagen manual en CSV la usa, sino intenta Open Food Facts
    const imgHTML = p.imagen
      ? `<div class="thumb"><img src="assets/productos/${p.imagen}" alt="${p.nombre}" loading="lazy" onerror="this.parentElement.innerHTML='<span>${p.nombre.charAt(0)}</span>'"></div>`
      : `<div class="thumb thumb-lazy"><span>${p.nombre.charAt(0)}</span></div>`;

    const card=document.createElement("article");
    card.className="card";
    card.dataset.id=p.id;
    card.dataset.nombre=p.nombre;
    card.innerHTML=`
      ${imgHTML}
      <div class="info">
        <small style="opacity:.6;font-size:11px">Cód: <b>${p.id||"-"}</b>${p.categoria ? ` • ${p.categoria}` : ""}</small>
        <b class="card-nombre">${p.nombre}</b>
        <div class="price">
          <b>$${p.precio.toLocaleString("es-AR")}</b>
          <div class="qty-control">
            <button class="qty-btn" onclick="changeQty('${p.id}',-1)">−</button>
            <input type="number" id="qty-${p.id}" value="1" min="1" style="width:40px;text-align:center;background:#1a1a1a;border:1px solid #333;color:#fff;border-radius:6px;">
            <button class="qty-btn" onclick="changeQty('${p.id}',1)">+</button>
          </div>
        </div>
        <button class="add" data-id="${p.id}" data-nombre="${p.nombre}" data-precio="${p.precio}">Agregar al pedido</button>
      </div>`;
    grid.appendChild(card);
  });

  // Lazy load imágenes via IntersectionObserver — evita 855 pedidos simultáneos
  if(!p_imagen_observer){
    p_imagen_observer = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(!entry.isIntersecting) return;
        const thumb = entry.target.querySelector(".thumb-lazy");
        if(thumb){
          setThumbImage(thumb, entry.target.dataset.id, entry.target.dataset.nombre);
          thumb.classList.remove("thumb-lazy");
        }
        p_imagen_observer.unobserve(entry.target);
      });
    },{rootMargin:"200px"});
  }
  grid.querySelectorAll(".card").forEach(c=>p_imagen_observer.observe(c));
}

let p_imagen_observer = null;

/* ================================
   CANTIDADES
=================================*/
function changeQty(id,delta){
  const input=document.getElementById("qty-"+id);
  if(!input) return;
  let v=parseInt(input.value)||1;
  v=Math.max(1,v+delta);
  input.value=v;
}

/* ================================
   CARRITO
=================================*/
function refreshCartBadge(){
  const items=carrito.reduce((a,b)=>a+b.cantidad,0);
  const total=carrito.reduce((a,b)=>a+b.precio*b.cantidad,0);
  const elItems=document.getElementById("items");
  const elTotal=document.getElementById("total");
  const elCartTotal=document.getElementById("cartTotal");
  if(elItems) elItems.textContent=items;
  if(elTotal) elTotal.textContent="$"+formatARS(total);
  if(elCartTotal) elCartTotal.textContent="$"+formatARS(total);

  const resumen=document.getElementById("cartSummary");
  if(resumen){
    if(items>0){
      resumen.classList.add("visible");
      resumen.querySelector(".summary-text").textContent=`${items} ítem${items>1?"s":""} – Total: $${formatARS(total)}`;
    }else{
      resumen.classList.remove("visible");
    }
  }
}

function refreshCart(){
  const cont=document.getElementById("cartItems");
  if(!cont) return;
  cont.innerHTML="";
  carrito.forEach(p=>{
    const subtotal=p.precio*p.cantidad;
    const li=document.createElement("div");
    li.className="cart-item";
    li.innerHTML=`
      <div class="cart-line">
        <span class="cart-name">${p.nombre}</span>
        <span class="cart-subtotal">$${formatARS(subtotal)}</span>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="updateQty('${p.id}',-1)">−</button>
        <span style="min-width:20px;text-align:center">${p.cantidad}</span>
        <button class="qty-btn" onclick="updateQty('${p.id}',1)">+</button>
        <button class="del-btn" onclick="removeItem('${p.id}')" title="Eliminar">🗑</button>
      </div>`;
    cont.appendChild(li);
  });
  refreshCartBadge();
}

function addToCart(id,nombre,precio,cantidad){
  const existente=carrito.find(p=>p.id===id);
  if(existente){ existente.cantidad+=cantidad; }
  else carrito.push({id,nombre,precio,cantidad});
  refreshCart();

  // Feedback visual en el botón
  const btn=document.querySelector(`.add[data-id="${id}"]`);
  if(btn){
    btn.textContent="✓ Agregado";
    btn.style.background="var(--ok)";
    btn.style.color="#000";
    setTimeout(()=>{ btn.textContent="Agregar al pedido"; btn.style.background=""; btn.style.color=""; },1200);
  }
}

function removeItem(id){
  carrito=carrito.filter(p=>p.id!==id);
  refreshCart();
}

function updateQty(id,delta){
  const item=carrito.find(p=>p.id===id);
  if(!item) return;
  item.cantidad=Math.max(1,item.cantidad+delta);
  refreshCart();
}

/* ================================
   PANEL LATERAL
=================================*/
function toggleCart(open){
  const panel=document.getElementById("cartPanel");
  if(!panel) return;
  if(open) panel.classList.add("open");
  else panel.classList.remove("open");
}

/* ================================
   WHATSAPP
=================================*/
function goWhatsApp(){
  if(carrito.length===0){
    alert("Agregá productos para enviar el pedido.");
    return;
  }
  const list=carrito.map(i=>`• ${i.nombre} (x${i.cantidad}) - $${(i.precio*i.cantidad).toLocaleString("es-AR")}`).join("%0A");
  const total=carrito.reduce((a,b)=>a+b.precio*b.cantidad,0);
  const pagoSel=document.querySelector("input[name='pago']:checked")?.value||"Sin especificar";
  const msg=`Hola! Quiero hacer este pedido:%0A%0A${list}%0A%0A*Total: $${total.toLocaleString("es-AR")}*%0AForma de pago: ${pagoSel}`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`,"_blank");
}

/* ================================
   BÚSQUEDA Y FILTRO
=================================*/
function activarFiltros(){
  const inputBuscar=document.getElementById("buscador");
  const selectCat=document.getElementById("filtroCategoria");
  if(!inputBuscar && !selectCat) return;

  function filtrar(){
    const query=(inputBuscar?.value||"").trim().toLowerCase();
    const cat=(selectCat?.value||"").toLowerCase();
    const filtrados=productos.filter(p=>{
      const matchQuery=!query||
        p.nombre.toLowerCase().includes(query)||
        p.id.toLowerCase().includes(query);
      const matchCat=!cat||p.categoria.toLowerCase()===cat;
      return matchQuery && matchCat;
    });
    renderProductos(filtrados);
  }

  inputBuscar?.addEventListener("input",filtrar);
  selectCat?.addEventListener("change",filtrar);
}

/* ================================
   INICIALIZACIÓN
=================================*/
document.addEventListener("click",(e)=>{
  const btn=e.target.closest(".add");
  if(btn){
    const id=btn.dataset.id;
    const nombre=btn.dataset.nombre;
    const precio=Number(btn.dataset.precio);
    const qtyInput=document.getElementById("qty-"+id);
    const cantidad=parseInt(qtyInput?.value)||1;
    addToCart(id,nombre,precio,cantidad);
  }
});

window.addEventListener("DOMContentLoaded",()=>{
  refreshCartBadge();

  if(document.querySelector(".products")){
    cargarProductos().then(()=>activarFiltros());
  }

  // Resumen flotante (barra inferior)
  const resumen=document.createElement("div");
  resumen.id="cartSummary";
  resumen.innerHTML=`
    <span class="summary-text"></span>
    <button class="ver-btn" onclick="toggleCart(true)">Ver pedido</button>
  `;
  document.body.appendChild(resumen);
});
