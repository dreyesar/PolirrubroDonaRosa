const WHATSAPP_NUMBER = "543476495451";

let productos = [];
let carrito = [];

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
    const parsed=Papa.parse(text,{header:true,skipEmptyLines:true});
    productos=parsed.data.map(normalizeRowKeys).filter(r=>r["nombre"]||r["descripcion"]).map(r=>{
      const id=r["codigo"]||r["id"]||r["articulo"]||"";
      const nombre=r["nombre"]||r["descripcion"]||"";
      const precio=parseNumberAR(r["precio"]||r["minorista"]||0);
      return {id:String(id).trim(),nombre:String(nombre).trim(),precio:Number(precio)||0};
    });
    renderProductos(productos);
  }catch(err){
    console.error("Error cargando CSV",err);
  }
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
    const card=document.createElement("article");
    card.className="card";
    card.innerHTML=`
      <div class="info">
        <small style="opacity:.75">Código: <b>${p.id||"-"}</b></small>
        <b>${p.nombre}</b>
        <div class="price">
          <b>$${p.precio.toLocaleString("es-AR")}</b>
          <div class="qty-control">
            <button class="qty-btn" onclick="changeQty('${p.id}',-1)">-</button>
            <input type="number" id="qty-${p.id}" value="1" min="1" style="width:40px;text-align:center;">
            <button class="qty-btn" onclick="changeQty('${p.id}',1)">+</button>
          </div>
          <button class="add" data-id="${p.id}" data-nombre="${p.nombre}" data-precio="${p.precio}">Agregar</button>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

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
  document.getElementById("items").textContent=items;
  document.getElementById("total").textContent="$"+formatARS(total);
  document.getElementById("cartTotal").textContent="$"+formatARS(total);

  // Actualizar resumen flotante
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

function refreshCart() {
  const cont = document.getElementById("cartItems");
  if (!cont) return;
  cont.innerHTML = "";

  carrito.forEach(p => {
    const subtotal = p.precio * p.cantidad;
    const li = document.createElement("div");
    li.className = "cart-item";
    li.innerHTML = `
      <div class="cart-line">
        <span class="cart-name">[${p.id}] ${p.nombre}</span>
        <span class="cart-subtotal">$${formatARS(subtotal)}</span>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="updateQty('${p.id}',-1)">-</button>
        <span>${p.cantidad}</span>
        <button class="qty-btn" onclick="updateQty('${p.id}',1)">+</button>
        <button class="del-btn" onclick="removeItem('${p.id}')">❌</button>
      </div>
    `;
    cont.appendChild(li);
  });

  refreshCartBadge();
}


function addToCart(id, nombre, precio, cantidad){
  const existente=carrito.find(p=>p.id===id);
  if(existente){ existente.cantidad+=cantidad; }
  else carrito.push({id,nombre,precio,cantidad});
  refreshCart();
  // Ya no abre el carrito automáticamente
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
  const list=carrito.map(i=>`• [${i.id}] ${i.nombre} (x${i.cantidad}) - $${(i.precio*i.cantidad).toLocaleString("es-AR")}`).join("%0A");
  const total=carrito.reduce((a,b)=>a+b.precio*b.cantidad,0);
  const pagoSel=document.querySelector("input[name='pago']:checked")?.value || "Sin especificar";
  const msg=`Hola! Quiero hacer este pedido:%0A${list}%0A%0ATotal: $${total.toLocaleString('es-AR')}%0AForma de pago: ${pagoSel}`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`,'_blank');
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

  // Cargar productos y activar buscador
  if (document.querySelector(".products")) {
    cargarProductos().then(() => buscarProductos());
  }

  // Crear resumen flotante
  const resumen=document.createElement("div");
  resumen.id="cartSummary";
  resumen.innerHTML=`
    <span class="summary-text"></span>
    <button class="ver-btn" onclick="toggleCart(true)">Ver pedido</button>
  `;
  document.body.appendChild(resumen);
});


/* ================================
   BÚSQUEDA DE PRODUCTOS
=================================*/
function buscarProductos() {
  const input = document.getElementById("buscador");
  if (!input) return;

  input.addEventListener("input", (e) => {
    const query = e.target.value.trim().toLowerCase();
    const filtrados = productos.filter(p =>
      p.nombre.toLowerCase().includes(query) ||
      p.id.toLowerCase().includes(query)
    );
    renderProductos(filtrados);
  });
}
