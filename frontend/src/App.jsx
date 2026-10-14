import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { Activity, ArrowDownToLine, Barcode, Bell, BellRing, Boxes, CheckCircle2, ChevronRight, CircleHelp, ClipboardList, FileSpreadsheet, LayoutDashboard, LogOut, Menu, PackageSearch, Plus, RefreshCw, ScanLine, ShieldCheck, Store, Users, Warehouse, X } from 'lucide-react';
import { api, clearSession, getLocal, getToken, getUser, setLocal, setSession } from './lib/api.js';
import { conectarRealtime } from './lib/realtime.js';
import { colorForUser, initials } from './lib/avatar.js';
import CameraScanner from './components/CameraScanner.jsx';

function Notice({ message, type = 'success', onClose }) { if (!message) return null; return <div className={`notice ${type}`} role="status"><span>{message}</span><button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={16}/></button></div>; }
function Card({ children, className = '' }) { return <section className={`card ${className}`}>{children}</section>; }
function Stat({ icon: Icon, label, value, sub }) { return <Card className="stat"><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={19}/></span></div><div className="stat-value">{value ?? '—'}</div>{sub && <div className="stat-sub">{sub}</div>}</Card>; }
function Login({ onLogin }) {
  const [correo, setCorreo] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function submit(e) { e.preventDefault(); setError(''); setLoading(true); try { const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ correo, password }) }); setSession(data.token, data.usuario); onLogin(data.usuario); } catch (e) { setError(e.message); } finally { setLoading(false); } }
  return <div className="login-layout"><div className="login-brand"><img className="brand-watermark" src="/logo-blesscard.png" alt="" aria-hidden="true"/><img className="brand-logo big" src="/logo-blesscard.png" alt="BLESSCARD"/><p className="eyebrow">BENMOGA Y CÍA S.A.S.</p><h1>El inventario de nuestras tiendas, bajo control.</h1><p className="login-copy">Comercio de prendas de vestir y accesorios. Controla el inventario de los 19 locales con conteo por zonas, seguimiento por empleado y comparación frente al archivo maestro.</p><div className="login-points"><span><CheckCircle2 size={17}/> Conteo desde móvil</span><span><CheckCircle2 size={17}/> Seguimiento por empleado</span><span><CheckCircle2 size={17}/> Reporte de diferencias</span></div></div><div className="login-panel"><form className="login-form" onSubmit={submit}><div className="brand-small">BENMOGA <span>INVENTARIO</span></div><p className="eyebrow">BIENVENIDO</p><h2>Iniciar sesión</h2><p className="muted">Ingresa con la cuenta que creó la administración.</p>{error && <Notice message={error} type="error" onClose={() => setError('')}/>}<label>Correo electrónico<input autoComplete="username" type="email" value={correo} onChange={e=>setCorreo(e.target.value)} placeholder="usuario@empresa.com" required /></label><label>Contraseña<input autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Tu contraseña" required /></label><button className="btn primary full" disabled={loading}>{loading ? 'Validando…' : 'Ingresar'}<ChevronRight size={18}/></button><p className="tiny muted">Acceso restringido a personal autorizado.</p></form></div></div>;
}
function NotifBell({ notificaciones, sinLeer, onMarcarLeidas }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function fuera(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);
  const toggle = () => setOpen((v) => { const nv = !v; if (nv) onMarcarLeidas?.(); return nv; });
  return <div className="notif" ref={ref}>
    <button type="button" className="icon-btn notif-btn" onClick={toggle} title="Notificaciones" aria-label="Notificaciones">
      {sinLeer > 0 ? <BellRing size={19}/> : <Bell size={19}/>}
      {sinLeer > 0 && <span className="notif-badge">{sinLeer > 9 ? '9+' : sinLeer}</span>}
    </button>
    {open && <div className="notif-panel">
      <div className="notif-head"><b>Notificaciones</b><span>{notificaciones.length}</span></div>
      {notificaciones.length ? <div className="notif-list">{notificaciones.map(n => <div className="notif-item" key={n.id}>
        <span className="notif-dot"/>
        <div className="notif-text"><b>Zona terminada: {n.zona}</b><span>{n.empleado} · {n.unidades} unidades · {n.lecturas} lecturas</span></div>
        <time>{new Date(n.hora).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}</time>
      </div>)}</div> : <p className="empty-inline">Sin notificaciones todavía. Aparecerán cuando un empleado finalice una zona.</p>}
    </div>}
  </div>;
}
function ToastNotificacion({ noti, onClose }) {
  if (!noti) return null;
  return <div className="toast-notify" role="alert">
    <div className="toast-icon"><BellRing size={18}/></div>
    <div className="toast-body"><b>Zona terminada: {noti.zona}</b><span>{noti.empleado} · {noti.unidades} unidades · {noti.lecturas} lecturas</span></div>
    <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={15}/></button>
  </div>;
}
function Shell({ user, local, onChangeLocal, onLogout, notificaciones, sinLeer, onMarcarLeidas, children }) {
  const [mobileOpen, setMobileOpen] = useState(false); const loc = useLocation();
  useEffect(() => setMobileOpen(false), [loc.pathname]);
  const admin = user?.rol === 'ADMINISTRADORA';
  const color = colorForUser(user);
  const links = [{ to: '/', label: admin ? 'Resumen' : 'Inicio', icon: LayoutDashboard }, { to: '/inventarios', label: 'Inventarios', icon: FileSpreadsheet, adminOnly: true }, { to: '/conteo', label: 'Escanear productos', icon: ScanLine }, { to: '/zonas', label: 'Zonas', icon: Warehouse }, { to: '/comparativo', label: 'Comparativo', icon: PackageSearch, adminOnly: true }, { to: '/locales', label: 'Locales', icon: Store, adminOnly: true }, { to: '/usuarios', label: 'Usuarios', icon: Users, adminOnly: true }].filter(x => !x.adminOnly || admin);
  return <div className="app-shell"><aside className={`sidebar ${mobileOpen ? 'open' : ''}`}><div className="side-brand"><img className="brand-logo" src="/logo-blesscard.png" alt="BLESSCARD"/><div><b>INVENTARIO</b><span>OPERACIÓN DE TIENDA</span></div><button className="mobile-close icon-btn" onClick={()=>setMobileOpen(false)}><X/></button></div><div className="side-section-label">MENÚ PRINCIPAL</div><nav>{links.map(({to,label,icon:Icon})=><NavLink key={to} end={to==='/'} to={to} className={({isActive})=>`nav-link ${isActive?'active':''}`}><Icon size={19}/><span>{label}</span></NavLink>)}</nav><div className="sidebar-bottom"><div className="connection"><span className="status-dot"/><span>Aplicación conectada</span></div><div className="user-mini"><div className="avatar" style={{background:color.bg,color:color.fg}}>{initials(user?.nombre)}</div><div className="user-info"><b>{user?.nombre}</b><span>{admin?'Administradora':'Empleado'}</span></div><button className="icon-btn logout-btn" onClick={onLogout} title="Cerrar sesión"><LogOut size={17}/></button></div></div></aside>{mobileOpen && <button className="mobile-overlay" onClick={()=>setMobileOpen(false)} aria-label="Cerrar menú"/>}<main className="main-area"><header className="topbar"><button className="mobile-menu icon-btn" onClick={()=>setMobileOpen(true)} aria-label="Abrir menú"><Menu/></button><div><span className="topbar-kicker">BENMOGA / OPERACIONES</span><strong>{links.find(l=>l.to===loc.pathname)?.label || 'Inventario'}</strong></div><div className="topbar-right">{admin && <NotifBell notificaciones={notificaciones || []} sinLeer={sinLeer || 0} onMarcarLeidas={onMarcarLeidas}/>}<button className="btn ghost small-btn local-switch" onClick={onChangeLocal} title="Cambiar de local"><Store size={15}/><span>{local?.nombre || 'Elegir local'}</span></button><div className="avatar" style={{background:color.bg,color:color.fg}}>{initials(user?.nombre)}</div></div></header><div className="page-content">{children}<footer>BENMOGA Inventario <span>•</span> Uso interno de tienda</footer></div></main></div>;
}
function Locales() {
  const [locales, setLocales] = useState([]);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const d = await api('/api/locales'); setLocales(d.locales || []); setError(''); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function crear(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api('/api/locales', { method: 'POST', body: JSON.stringify({ nombre: nombre.trim() }) });
      setNotice('Local creado correctamente.'); setNombre(''); await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="page-stack">
    <div className="page-heading">
      <div><p className="eyebrow">TIENDAS</p><h1>Locales</h1><p className="muted">Administra los locales. Cada jornada se hace el inventario de un local y sus zonas.</p></div>
      <button className="btn secondary" onClick={load}><RefreshCw size={16}/> Actualizar</button>
    </div>
    {error && <Notice type="error" message={error} onClose={() => setError('')}/>}
    {notice && <Notice message={notice} onClose={() => setNotice('')}/>}
    <div className="two-column">
      <Card>
        <div className="card-heading"><div><h2>Crear local</h2><p className="muted">Usa el nombre con el que identifican la tienda.</p></div><div className="heading-icon"><Warehouse/></div></div>
        <form className="form-stack" onSubmit={crear}>
          <label>Nombre del local<input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Local Centro" minLength={2} maxLength={120} required/></label>
          <button className="btn primary full" disabled={busy}>{busy ? <span className="spinner"/> : <Plus size={17}/>} Crear local</button>
        </form>
      </Card>
      <Card>
        <div className="card-heading"><div><h2>Locales registrados</h2><p className="muted">{locales.length} locales configurados.</p></div><button className="btn secondary small-btn" onClick={load}><RefreshCw size={15}/></button></div>
        {locales.length ? <div className="user-list">{locales.map(l => <div className="user-row" key={l.id}><div className="avatar">{String(l.id).padStart(2,'0')}</div><div className="user-row-info"><b>{l.nombre}</b><span>{l._count?.zonas || 0} zonas · {l._count?.inventarios || 0} inventarios</span></div></div>)}</div> : <Empty icon={Warehouse} title="Sin locales" text="Crea el primer local para empezar a organizar el inventario."/>}
      </Card>
    </div>
  </div>;
}
function LocalPicker({ user, onPick, onLogout }) {
  const [locales, setLocales] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { const d = await api('/api/locales'); setLocales(d.locales || []); }
      catch (e) { setError(e.message); } finally { setLoading(false); }
    })();
  }, []);
  const filtro = q.trim().toLowerCase();
  const visibles = filtro ? locales.filter(l => l.nombre.toLowerCase().includes(filtro)) : locales;
  return <div className="picker-layout">
    <header className="picker-head">
      <div className="picker-brand"><img className="brand-logo" src="/logo-blesscard.png" alt="BLESSCARD"/><div><b>INVENTARIO</b><span>OPERACIÓN DE TIENDA</span></div></div>
      <div className="picker-user"><span>Hola, {user?.nombre}</span><button className="btn ghost small-btn" onClick={onLogout}><LogOut size={15}/> Salir</button></div>
    </header>
    <div className="picker-intro">
      <p className="eyebrow">SELECCIÓN DE LOCAL</p>
      <h1>¿En qué local vas a trabajar?</h1>
      <p className="muted">Elige la tienda donde vas a hacer el inventario. Los {locales.length || 19} locales de BENMOGA están disponibles.</p>
    </div>
    <div className="search-box"><PackageSearch size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar local por nombre…"/><span className="search-count">{visibles.length}</span></div>
    {error && <Notice type="error" message={error} onClose={()=>setError('')}/>}
    {loading ? <div className="loading-inline"><span className="spinner"/> Cargando locales…</div> : (visibles.length ? <div className="local-grid">{visibles.map(l => {
      const c = colorForUser({ id: l.id, nombre: l.nombre });
      return <button key={l.id} type="button" className="local-card" onClick={()=>onPick(l)}>
        <div className="local-card-main">
          <div className="avatar" style={{background:c.bg,color:c.fg}}>{initials(l.nombre)}</div>
          <div className="local-card-info"><b>{l.nombre}</b><span>{l._count?.zonas || 0} zonas · {l._count?.inventarios || 0} inventarios</span></div>
        </div>
        <span className={`pill ${l.inventarioActivo ? 'green' : 'gray'}`}>{l.inventarioActivo ? 'Inventario activo' : 'Sin inventario'}</span>
        <span className="zone-go"><ChevronRight size={17}/></span>
      </button>;
    })}</div> : <Empty icon={Store} title="Sin locales" text="No hay locales que coincidan con la búsqueda."/>)}
    <footer className="picker-foot">BENMOGA Y CÍA S.A.S. · Comercio de prendas de vestir y accesorios · Popayán</footer>
  </div>;
}
function Dashboard({ local }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { const d = await api(`/api/dashboard${local?.id ? `?localId=${local.id}` : ''}`); setData(d); setError(''); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [local?.id]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  // Actualización en vivo por WebSocket: cada lectura o cambio de zona recarga el panel.
  useEffect(() => {
    let t = null;
    const handler = (e) => {
      const ev = e.detail;
      if (!ev || !['escaneo', 'sesion', 'zona_finalizada'].includes(ev.tipo)) return;
      if (t) clearTimeout(t);
      t = setTimeout(load, 400);
    };
    window.addEventListener('levis:realtime', handler);
    return () => { window.removeEventListener('levis:realtime', handler); if (t) clearTimeout(t); };
  }, [load]);
  const zonas = data?.zonas || [];
  const active = data?.inventario;
  const zonasConConteo = zonas.filter(z => (z.unidadesContadas || 0) > 0).length;
  return <div className="page-stack">
    <div className="page-heading">
      <div><p className="eyebrow">PANEL DE CONTROL</p><h1>Resumen del inventario</h1><p className="muted">Supervisa en vivo el conteo del local y la actividad del equipo.</p></div>
      <button className="btn secondary" onClick={load}><RefreshCw size={16}/> Actualizar</button>
    </div>
    {error && <Notice type="error" message={error} onClose={() => setError('')}/>}
    {local && <div className="selected-zone big-zone"><Warehouse size={18}/><span>Local en proceso: <b>{local.nombre}</b></span><span className={`pill ${active ? 'green' : 'gray'}`}>{active ? active.estado : 'SIN INVENTARIO'}</span></div>}
    <div className="stats-grid">
      <Stat icon={Boxes} label="Productos en catálogo" value={data?.resumen?.productosEnCatalogo?.toLocaleString('es-CO') ?? '—'} sub="Referencias del inventario activo"/>
      <Stat icon={Barcode} label="Lecturas registradas" value={data?.resumen?.lecturasRegistradas?.toLocaleString('es-CO') ?? '—'} sub="Escaneos realizados"/>
      <Stat icon={Activity} label="Unidades contadas" value={data?.resumen?.unidadesContadas?.toLocaleString('es-CO') ?? '—'} sub="Conteo físico acumulado"/>
      <Stat icon={Warehouse} label="Zonas del local" value={zonas.length} sub={`${zonasConConteo} zonas con conteo`}/>
    </div>
    <Card>
      <div className="card-heading"><div><h2>Inventario en curso</h2><p className="muted">Estado del archivo maestro activo</p></div><span className={`pill ${active ? 'green' : 'gray'}`}>{active?.estado || 'SIN INVENTARIO'}</span></div>
      {active ? <div className="active-inventory"><div className="file-tile"><FileSpreadsheet size={24}/></div><div className="inventory-info"><b>{active.nombre}</b><span>{(local?.nombre || active.archivoOrigen || 'Archivo maestro')} · Creado {new Date(active.fechaInventario).toLocaleDateString('es-CO')}</span></div><div className="inventory-metric"><strong>{data?.resumen?.productosEnCatalogo?.toLocaleString('es-CO') || 0}</strong><span>productos</span></div></div> : <Empty icon={FileSpreadsheet} title="Todavía no hay un inventario activo" text="Importa el Excel maestro desde Inventarios y actívalo para comenzar."/>}
    </Card>
    <Card>
      <div className="card-heading"><div><h2>Avance por zona</h2><p className="muted">Quién escanea cada zona y cuántas unidades. Actualización en vivo.</p></div><span className="live-tag"><span className="status-dot"/> EN VIVO</span></div>
      {zonas.length ? <div className="zone-grid">{zonas.map(z => <div className="zone-card" key={z.id}>
        <div className="zone-card-top"><div className="zone-number">{String(z.numero).padStart(2,'0')}</div><div><b>{z.nombre || `Zona ${z.numero}`}</b><span>{(z.empleadosActivos?.length || 0) > 0 ? `${z.empleadosActivos.length} escaneando ahora` : `${z.empleados?.length || 0} empleado(s) con conteo`}</span></div></div>
        <div className="zone-stats"><div><b>{(z.unidadesContadas || 0).toLocaleString('es-CO')}</b><span>unidades</span></div><div><b>{(z.lecturas || 0).toLocaleString('es-CO')}</b><span>lecturas</span></div></div>
        {(z.empleados?.length > 0) && <div className="employee-tags">{z.empleados.map(e => <span key={e.id} style={{background:colorForUser(e).bg,color:colorForUser(e).fg}}>{e.nombre} · {e.unidades}</span>)}</div>}
      </div>)}</div> : <Empty icon={Warehouse} title="No hay zonas en este local" text="Crea las zonas o estantes del local desde la sección Zonas."/>}
    </Card>
    <Card>
      <div className="card-heading"><div><h2>Actividad reciente</h2><p className="muted">Últimas lecturas realizadas por el equipo.</p></div></div>
      {data?.actividadReciente?.length ? <div className="table-wrap"><table><thead><tr><th>Código</th><th>Producto</th><th>Empleado</th><th>Zona</th><th>Hora</th></tr></thead><tbody>{data.actividadReciente.map(e => <tr key={e.id}><td className="mono">{e.codigoBarras}</td><td><b>{e.item || '—'}</b><span className="table-sub">{e.producto || 'Sin descripción'}</span></td><td>{e.empleado}</td><td><span className="zone-chip">{e.zona}</span></td><td>{new Date(e.fecha).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}</td></tr>)}</tbody></table></div> : <p className="empty-inline">{loading ? 'Cargando actividad…' : 'Aún no hay lecturas registradas.'}</p>}
    </Card>
  </div>;
}
function EmployeeHome({ user, local }) {
  const navigate = useNavigate();
  const color = colorForUser(user);
  const [zones, setZones] = useState([]);
  const [summary, setSummary] = useState({ unidades: 0, productosDistintos: 0, zonaActiva: null, inventario: null });
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyZone, setBusyZone] = useState(null);
  const load = useCallback(async () => {
    try {
      const q = local?.id ? `?localId=${local.id}` : '';
      const [z, s] = await Promise.all([api(`/api/zonas${q}`), api(`/api/escaneos/resumen-mio${q}`)]);
      setZones(z.zonas || []);
      setSummary(s || {});
      if (s?.zonaActiva?.id) localStorage.setItem('levis_zone', String(s.zonaActiva.id));
      else localStorage.removeItem('levis_zone');
      setError('');
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [local?.id]);
  useEffect(() => { load(); }, [load]);
  function enterZone(zona) {
    setBusyZone(zona.id);
    localStorage.setItem('levis_zone', String(zona.id));
    navigate('/conteo');
  }
  const zona = summary.zonaActiva;
  const filtro = q.trim().toLowerCase();
  const visibles = filtro ? zones.filter(z => String(z.numero).includes(filtro) || (z.nombre || '').toLowerCase().includes(filtro)) : zones;
  return <div className="page-stack">
    <div className="page-heading">
      <div><p className="eyebrow">MI CONTEO</p><h1>Hola, {(user?.nombre || '').split(' ')[0] || 'empleado'}</h1><p className="muted">Este es tu panel. Elige la zona donde vas a contar y empieza a escanear.</p></div>
      <button className="btn secondary" onClick={load}><RefreshCw size={16}/> Actualizar</button>
    </div>
    {error && <Notice type="error" message={error} onClose={() => setError('')}/>}
    <Card className="profile-card">
      <div className="profile-main">
        <div className="avatar profile-avatar" style={{ background: color.bg, color: color.fg }}>{initials(user?.nombre)}</div>
        <div className="profile-info"><b>{user?.nombre}</b><span>{user?.correo}</span><span className="profile-role">Empleado · conteo de tienda</span></div>
      </div>
      <span className="profile-badge" style={{ background: color.bg, color: color.fg }}>Tu color de identificación</span>
    </Card>
    <div className="stats-grid">
      <Stat icon={ScanLine} label="Unidades escaneadas" value={loading ? '—' : (summary.unidades || 0).toLocaleString('es-CO')} sub="En el inventario activo"/>
      <Stat icon={Boxes} label="Productos distintos" value={loading ? '—' : (summary.productosDistintos || 0).toLocaleString('es-CO')} sub="Referencias que has contado"/>
      <Stat icon={Warehouse} label="Zona actual" value={zona ? `Zona ${zona.numero}` : 'Sin zona'} sub={zona?.nombre || 'Selecciona una zona abajo'}/>
      <Stat icon={FileSpreadsheet} label="Inventario activo" value={summary.inventario ? 'En curso' : 'Ninguno'} sub={summary.inventario?.nombre || 'Sin inventario activo'}/>
    </div>
    {zona && <div className="selected-zone big-zone">
      <CheckCircle2 size={18}/>
      <span>Estás contando en <b>{zona.nombre || `Zona ${zona.numero}`}</b>.</span>
      <button className="btn primary" onClick={() => navigate('/conteo')}><ScanLine size={16}/> Continuar escaneando</button>
    </div>}
    <Card>
      <div className="card-heading"><div><h2>Zonas de trabajo</h2><p className="muted">{local?.nombre || 'Local'} · {zones.length} zonas. Toca una para entrar a escanear.</p></div><div className="heading-icon"><Warehouse/></div></div>
      {zones.length > 8 && <div className="search-box"><PackageSearch size={17}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar zona por número o nombre…" inputMode="numeric"/></div>}
      {zones.length ? (visibles.length ? <div className="zone-grid">{visibles.map(z => <button key={z.id} type="button" className={`zone-card zone-pick ${zona?.id === z.id ? 'active' : ''}`} onClick={() => enterZone(z)} disabled={busyZone === z.id}>
        <div className="zone-card-top"><div className="zone-number" style={{ background: color.bg, color: color.fg }}>{String(z.numero).padStart(2, '0')}</div><div><b>{z.nombre || `Zona ${z.numero}`}</b><span>{zona?.id === z.id ? 'Zona en uso' : 'Entrar a contar'}</span></div></div>
        <span className="zone-go">{busyZone === z.id ? <span className="spinner"/> : <ChevronRight size={17}/>}</span>
      </button>)}</div> : <p className="empty-inline">No hay zonas que coincidan con "{q}".</p>) : <Empty icon={Warehouse} title="Sin zonas en este local" text="Pide a la administradora que cree las zonas del local."/>}
    </Card>
  </div>;
}
function Empty({ icon: Icon, title, text }) { return <div className="empty-state"><div><Icon size={25}/></div><b>{title}</b><p>{text}</p></div>; }
function Inventories({ local }) {
  const [items, setItems] = useState([]);
  const [locals, setLocals] = useState([]);
  const [localId, setLocalId] = useState(local?.id ? String(local.id) : '');
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    try {
      const [inv, loc] = await Promise.all([api('/api/inventarios'), api('/api/locales')]);
      setItems(inv.inventarios || []);
      setLocals(loc.locales || []);
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function importFile(e) {
    e.preventDefault();
    if (!file) return setError('Selecciona el archivo Excel (.xlsx).');
    if (!localId) return setError('Selecciona el local al que pertenece el inventario.');
    setBusy(true); setError(''); setNotice('');
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      fd.append('localId', localId);
      if (name.trim()) fd.append('nombre', name.trim());
      const d = await api('/api/inventarios/importar', { method: 'POST', body: fd });
      setNotice(`${d.mensaje} ${d.productosImportados.toLocaleString('es-CO')} productos procesados; ${d.totalErrores} filas con error.`);
      setFile(null); setName(''); e.target.reset(); await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function activate(id) {
    if (!window.confirm('¿Activar este inventario? El inventario activo actual pasará a cerrado.')) return;
    try { await api(`/api/inventarios/${id}/activar`, { method: 'PATCH' }); setNotice('Inventario activado correctamente.'); await load(); }
    catch (e) { setError(e.message); }
  }
  async function report(id) {
    try {
      const blob = await api(`/api/inventarios/${id}/reporte.xlsx`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `inventario-${id}.xlsx`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
  }
  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">ARCHIVO MAESTRO</p><h1>Inventarios</h1><p className="muted">Importa el Excel de referencia por local, revisa el estado y exporta el comparativo.</p></div></div>
    {error && <Notice type="error" message={error} onClose={() => setError('')}/>}
    {notice && <Notice message={notice} onClose={() => setNotice('')}/>}
    <div className="two-column">
      <Card>
        <div className="card-heading"><div><h2>Importar Excel</h2><p className="muted">El archivo debe contener la hoja INVENTARIO.</p></div><div className="heading-icon"><FileSpreadsheet/></div></div>
        <form className="form-stack" onSubmit={importFile}>
          <label>Local del inventario<input list="locales-lista" value={locals.find(l => String(l.id) === String(localId))?.nombre || ''} onChange={e => { const l = locals.find(x => x.nombre === e.target.value); setLocalId(l ? String(l.id) : ''); }} placeholder="Escribe o elige un local" required/></label>
          <datalist id="locales-lista">{locals.map(l => <option key={l.id} value={l.nombre}/>)}</datalist>
          <label>Nombre del inventario <span className="optional">(opcional)</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Inventario octubre 2026" maxLength={180}/></label>
          <label className="upload-area"><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e => setFile(e.target.files?.[0] || null)}/><div className="upload-icon"><FileSpreadsheet size={25}/></div><b>{file ? file.name : 'Selecciona el Excel maestro'}</b><span>{file ? `${(file.size/1024/1024).toFixed(2)} MB` : 'Formato .xlsx · máximo 25 MB'}</span><em>Buscar archivo</em></label>
          <div className="hint-box"><CircleHelp size={17}/><span>Se importa a modo borrador. Las zonas se crean aparte en la sección Zonas, porque no vienen en el Excel.</span></div>
          <button className="btn primary full" disabled={busy || !file || !localId}>{busy ? <><span className="spinner"/> Procesando Excel…</> : <><ArrowDownToLine size={17}/> Importar archivo</>}</button>
        </form>
      </Card>
      <Card>
        <div className="card-heading"><div><h2>Cómo funciona</h2><p className="muted">Flujo recomendado de inventario</p></div></div>
        <div className="steps-list">
          <div><span>01</span><div><b>Elige el local</b><p>Cada local tiene su propio Excel maestro e inventario.</p></div></div>
          <div><span>02</span><div><b>Importa y revisa</b><p>El inventario queda en borrador con productos y existencias.</p></div></div>
          <div><span>03</span><div><b>Define las zonas</b><p>Crea las zonas o estantes del local (una a una o por rango).</p></div></div>
          <div><span>04</span><div><b>Activa y cuenta</b><p>Los empleados escanean; tú supervisas en vivo.</p></div></div>
          <div><span>05</span><div><b>Descarga el Excel</b><p>Resumen por zona + comparativo de existencias.</p></div></div>
        </div>
      </Card>
    </div>
    <Card>
      <div className="card-heading"><div><h2>Historial de inventarios</h2><p className="muted">{items.length} inventarios registrados.</p></div><button className="btn secondary small-btn" onClick={load}><RefreshCw size={15}/></button></div>
      {items.length ? <div className="table-wrap"><table><thead><tr><th>Inventario</th><th>Local</th><th>Estado</th><th>Productos</th><th>Lecturas</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>{items.map(i => <tr key={i.id}><td><b>{i.nombre}</b><span className="table-sub">{i.archivoOrigen || '—'}</span></td><td>{i.local?.nombre || '—'}</td><td><span className={`pill ${i.estado === 'ACTIVO' ? 'green' : 'gray'}`}>{i.estado}</span></td><td>{(i._count?.productos || 0).toLocaleString('es-CO')}</td><td>{(i._count?.escaneos || 0).toLocaleString('es-CO')}</td><td>{new Date(i.fechaInventario).toLocaleDateString('es-CO')}</td><td><div className="action-row">{i.estado !== 'ACTIVO' && <button className="btn secondary tiny-btn" onClick={() => activate(i.id)}>Activar</button>}<button className="btn ghost tiny-btn" onClick={() => report(i.id)}><ArrowDownToLine size={14}/> Excel</button></div></td></tr>)}</tbody></table></div> : <Empty icon={FileSpreadsheet} title="Sin inventarios" text="Importa el primer Excel maestro para empezar."/>}
    </Card>
  </div>;
}
function ScanPage({ local }) {
  const [zones,setZones]=useState([]); const [zoneId,setZoneId]=useState(localStorage.getItem('levis_zone')||''); const [code,setCode]=useState(''); const [camera,setCamera]=useState(false); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [error,setError]=useState(''); const [summary,setSummary]=useState({unidades:0,productosDistintos:0}); const [recent,setRecent]=useState([]); const inputRef=useRef(null);
  const load=useCallback(async()=>{try{const q=local?.id?`?localId=${local.id}`:'';const [z,s]=await Promise.all([api(`/api/zonas${q}`),api(`/api/escaneos/resumen-mio${q}`)]);setZones(z.zonas||[]);setSummary(s);}catch(e){setError(e.message);}},[local?.id]); useEffect(()=>{load();},[load]);
  const restoredZone = useRef(false);
  useEffect(()=>{if(!restoredZone.current && zones.length && zoneId){restoredZone.current=true;if(zones.some(z=>String(z.id)===String(zoneId))){api('/api/zonas/seleccionar',{method:'POST',body:JSON.stringify({zonaId:Number(zoneId)})}).catch(e=>setError(e.message));}else{setZoneId('');localStorage.removeItem('levis_zone');}}},[zones,zoneId]);
  async function chooseZone(id){restoredZone.current=true;setZoneId(String(id));localStorage.setItem('levis_zone',String(id));setMessage('');setError('');try{await api('/api/zonas/seleccionar',{method:'POST',body:JSON.stringify({zonaId:Number(id)})});setMessage('Zona seleccionada. Ya puedes escanear.');setTimeout(()=>inputRef.current?.focus(),80);}catch(e){setError(e.message);}}
  async function finishZone(){try{await api('/api/zonas/finalizar',{method:'POST',body:JSON.stringify({})});setZoneId('');localStorage.removeItem('levis_zone');setMessage('Turno de zona finalizado.');}catch(e){setError(e.message);}}
  async function scan(e){e?.preventDefault?.();const value=code.trim();if(!value)return;if(!zoneId){setError('Selecciona una zona antes de escanear.');return;}setBusy(true);setError('');setMessage('');try{const d=await api('/api/escaneos',{method:'POST',body:JSON.stringify({codigoBarras:value})});setMessage(`${d.mensaje} ${d.escaneo.producto?.descripcion||d.escaneo.producto?.item||value}`);setRecent(old=>[{id:d.escaneo.id,codigo:value,descripcion:d.escaneo.producto?.descripcion||'Producto registrado',zona:d.escaneo.zona,fecha:d.escaneo.leidoEn},...old].slice(0,8));setCode('');await load();}catch(e){setError(e.message);}finally{setBusy(false);setTimeout(()=>inputRef.current?.focus(),50);}}
  const handleCameraCode=useCallback((value)=>{setCamera(false);setCode(value);setTimeout(()=>{const form=document.getElementById('scan-form');form?.requestSubmit();},100);},[]);
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">CONTEO FÍSICO</p><h1>Escanear productos</h1><p className="muted">Usa la cámara del dispositivo o el lector físico conectado como teclado.</p></div><span className="live-tag"><span className="status-dot"/> CONTEO ACTIVO</span></div>{error&&<Notice type="error" message={error} onClose={()=>setError('')}/ >}{message&&<Notice message={message} onClose={()=>setMessage('')}/>}<div className="scan-layout"><div className="scan-main"><Card className="scan-card"><div className="scan-card-header"><div className="scan-symbol"><ScanLine size={26}/></div><div><h2>Área de escaneo</h2><p className="muted">Cada lectura válida registra una unidad.</p></div></div><label>Zona de trabajo<select value={zoneId} onChange={e=>chooseZone(e.target.value)}><option value="">Selecciona la zona donde estás contando</option>{zones.map(z=><option value={z.id} key={z.id}>{z.numero} · {z.nombre||`Zona ${z.numero}`}</option>)}</select></label>{zoneId&&<div className="selected-zone"><CheckCircle2 size={17}/><span>Zona seleccionada: <b>{zones.find(z=>String(z.id)===String(zoneId))?.nombre||`Zona ${zones.find(z=>String(z.id)===String(zoneId))?.numero}`}</b></span><button className="text-btn" onClick={finishZone}>Finalizar zona</button></div>}<form id="scan-form" className="scan-form" onSubmit={scan}><label htmlFor="barcode">Código de barras</label><div className="scan-input-wrap"><Barcode size={23}/><input id="barcode" ref={inputRef} value={code} onChange={e=>setCode(e.target.value)} placeholder="Escanea o escribe el código" autoComplete="off" autoFocus inputMode="numeric"/><button type="submit" className="btn primary" disabled={busy||!code.trim()}>{busy?<span className="spinner"/>:<ScanLine size={18}/>}<span>Registrar</span></button></div><p className="muted small">Compatible con el lector Zebra TC21/TC20: apunta al código y se registra solo. También puedes escribirlo.</p></form><div className="scan-tools"><button className="btn secondary" onClick={()=>setCamera(!camera)}><ScanLine size={17}/>{camera?'Ocultar cámara':'Escanear con cámara'}</button><button className="btn ghost" onClick={()=>{setCode('');inputRef.current?.focus();}}>Limpiar</button></div>{camera&&<CameraScanner onCode={handleCameraCode} onClose={()=>setCamera(false)}/>}</Card><Card><div className="card-heading"><div><h2>Últimas lecturas de esta sesión</h2><p className="muted">Las lecturas se guardan inmediatamente en la base de datos.</p></div></div>{recent.length?<div className="recent-list">{recent.map((r,i)=><div className="recent-row" key={`${r.id}-${i}`}><div className="recent-check"><CheckCircle2 size={18}/></div><div className="recent-desc"><b>{r.descripcion}</b><span className="mono">{r.codigo} · Zona {r.zona}</span></div><time>{new Date(r.fecha).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time></div>)}</div>:<p className="empty-inline">Tus lecturas recientes aparecerán aquí.</p>}</Card></div><aside className="scan-aside"><Card><div className="card-heading"><div><h2>Tu conteo</h2><p className="muted">Resumen personal del inventario activo</p></div></div><div className="personal-stat"><span>Unidades registradas</span><b>{summary.unidades?.toLocaleString('es-CO')||0}</b><div className="personal-stat-icon"><Barcode size={20}/></div></div><div className="personal-stat"><span>Productos distintos</span><b>{summary.productosDistintos?.toLocaleString('es-CO')||0}</b><div className="personal-stat-icon"><Boxes size={20}/></div></div><button className="btn secondary full" onClick={load}><RefreshCw size={16}/> Actualizar conteo</button></Card><Card className="tip-card"><div className="tip-icon"><ShieldCheck size={21}/></div><h3>Buenas prácticas</h3><ul><li>Confirma la zona antes de comenzar.</li><li>Escanea cada unidad física una vez.</li><li>Si el código no existe, avisa a administración.</li><li>Finaliza la zona cuando termines.</li></ul></Card></aside></div></div>;
}
function Zones({ local }) {
  const user = getUser();
  const admin = user?.rol === 'ADMINISTRADORA';
  const [zones, setZones] = useState([]);
  const [locales, setLocales] = useState([]);
  const [localId, setLocalId] = useState(local?.id ? String(local.id) : '');
  const [q, setQ] = useState('');
  const [numero, setNumero] = useState('');
  const [nombre, setNombre] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      let lid = localId;
      if (admin) {
        const l = await api('/api/locales');
        const lista = l.locales || [];
        setLocales(lista);
        if (!lid && lista.length) { lid = String(lista[0].id); setLocalId(lid); }
      }
      const d = await api(lid ? `/api/zonas?localId=${lid}` : '/api/zonas');
      setZones(d.zonas || []);
      setError('');
    } catch (e) { setError(e.message); }
  }, [admin, localId]);
  useEffect(() => { load(); }, [load]);
  async function crear(e) {
    e.preventDefault();
    const n = Number(numero);
    if (!Number.isInteger(n) || n <= 0) return setError('Escribe un número de zona válido.');
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/api/zonas', { method: 'POST', body: JSON.stringify({ localId: Number(localId), numero: n, nombre: nombre.trim() || undefined }) });
      setNotice(`Zona ${n} creada.`); setNumero(''); setNombre(''); await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function crearLote(e) {
    e.preventDefault();
    const d = Number(desde), h = Number(hasta);
    if (!Number.isInteger(d) || !Number.isInteger(h) || d <= 0 || h < d) return setError('Rango inválido: revisa desde/hasta.');
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await api('/api/zonas/lote', { method: 'POST', body: JSON.stringify({ localId: Number(localId), desde: d, hasta: h }) });
      setNotice(r.mensaje); setDesde(''); setHasta(''); await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const filtro = q.trim().toLowerCase();
  const visibles = filtro ? zones.filter(z => String(z.numero).includes(filtro) || (z.nombre || '').toLowerCase().includes(filtro)) : zones;
  const localActual = locales.find(l => String(l.id) === String(localId));
  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">ORGANIZACIÓN</p><h1>Zonas</h1><p className="muted">Las zonas (estantes) se definen por local y no vienen en el Excel.</p></div><button className="btn secondary" onClick={load}><RefreshCw size={16}/> Actualizar</button></div>
    {error && <Notice type="error" message={error} onClose={() => setError('')}/>}
    {notice && <Notice message={notice} onClose={() => setNotice('')}/>}
    {admin && <Card>
      <div className="card-heading"><div><h2>Agregar zonas</h2><p className="muted">{localActual ? `Local: ${localActual.nombre}` : 'Selecciona un local'}</p></div><div className="heading-icon"><Warehouse/></div></div>
      <div className="two-column">
        <form className="form-stack" onSubmit={crear}>
          <label>Número de zona<input type="number" min="1" value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ej. 5" required/></label>
          <label>Nombre <span className="optional">(opcional)</span><input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Estante pasillo 2" maxLength={100}/></label>
          <button className="btn primary full" disabled={busy || !localId}><Plus size={17}/> Agregar una zona</button>
        </form>
        <form className="form-stack" onSubmit={crearLote}>
          <div className="field-row"><label>Desde<input type="number" min="1" value={desde} onChange={e => setDesde(e.target.value)} placeholder="1" required/></label><label>Hasta<input type="number" min="1" value={hasta} onChange={e => setHasta(e.target.value)} placeholder="390" required/></label></div>
          <div className="hint-box"><CircleHelp size={17}/><span>Útil para crear muchas zonas de una vez (ej. 1 a 390). No duplica las que ya existen.</span></div>
          <button className="btn secondary full" disabled={busy || !localId}><Plus size={17}/> Agregar por rango</button>
        </form>
      </div>
    </Card>}
    <Card>
      <div className="card-heading"><div><h2>Zonas {localActual ? `de ${localActual.nombre}` : 'del local activo'}</h2><p className="muted">{zones.length} zonas registradas.</p></div></div>
      {zones.length > 8 && <div className="search-box"><PackageSearch size={17}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar zona por número o nombre…" inputMode="numeric"/><span className="search-count">{visibles.length}</span></div>}
      {zones.length ? (visibles.length ? <div className="zone-grid">{visibles.map(z => <div className="zone-card" key={z.id}><div className="zone-card-top"><div className="zone-number">{String(z.numero).padStart(2,'0')}</div><div><b>{z.nombre || `Zona ${z.numero}`}</b><span>Zona #{z.numero}</span></div></div></div>)}</div> : <p className="empty-inline">No hay zonas que coincidan con "{q}".</p>) : <Empty icon={Warehouse} title="Sin zonas en este local" text={admin ? 'Agrega la primera zona arriba.' : 'Pide a la administradora que cree las zonas del local.'}/>}
    </Card>
  </div>;
}
function UsersPage() {
  const [users,setUsers]=useState([]);const [nombre,setNombre]=useState('');const [correo,setCorreo]=useState('');const [password,setPassword]=useState('');const [rol,setRol]=useState('EMPLEADO');const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{try{const d=await api('/api/auth/usuarios');setUsers(d.usuarios||[]);}catch(e){setError(e.message);}},[]);useEffect(()=>{load();},[load]);
  async function create(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{await api('/api/auth/usuarios',{method:'POST',body:JSON.stringify({nombre,correo,password,rol})});setNotice('Usuario creado correctamente.');setNombre('');setCorreo('');setPassword('');setRol('EMPLEADO');await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">EQUIPO DE TRABAJO</p><h1>Usuarios</h1><p className="muted">Administra los accesos de empleados y administradores.</p></div></div>{error&&<Notice type="error" message={error} onClose={()=>setError('')}/ >}{notice&&<Notice message={notice} onClose={()=>setNotice('')}/>}<div className="two-column"><Card><div className="card-heading"><div><h2>Crear usuario</h2><p className="muted">La contraseña debe tener al menos 10 caracteres.</p></div><div className="heading-icon"><Users/></div></div><form className="form-stack" onSubmit={create}><label>Nombre completo<input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Nombre del empleado" minLength={2} maxLength={120} required/></label><label>Correo electrónico<input type="email" value={correo} onChange={e=>setCorreo(e.target.value)} placeholder="empleado@empresa.com" required/></label><label>Contraseña inicial<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 10 caracteres" minLength={10} required/></label><label>Rol<select value={rol} onChange={e=>setRol(e.target.value)}><option value="EMPLEADO">Empleado</option><option value="ADMINISTRADORA">Administradora</option></select></label><button className="btn primary full" disabled={busy}>{busy?<span className="spinner"/>:<Plus size={17}/>} Crear usuario</button></form></Card><Card><div className="card-heading"><div><h2>Usuarios registrados</h2><p className="muted">Cuentas que pueden acceder al sistema.</p></div><button className="btn secondary small-btn" onClick={load}><RefreshCw size={15}/></button></div>{users.length?<div className="user-list">{users.map(u=><div className="user-row" key={u.id}><div className="avatar" style={{background:colorForUser(u).bg,color:colorForUser(u).fg}}>{initials(u.nombre)}</div><div className="user-row-info"><b>{u.nombre}</b><span>{u.correo}</span></div><span className={`pill ${u.rol==='ADMINISTRADORA'?'red':'gray'}`}>{u.rol==='ADMINISTRADORA'?'Administradora':'Empleado'}</span></div>)}</div>:<Empty icon={Users} title="No hay usuarios" text="Crea la primera cuenta de empleado."/>}</Card></div></div>;
}
function NotFound(){return <Card><Empty icon={PackageSearch} title="Página no encontrada" text="Usa el menú para volver a una sección del sistema."/></Card>}
function Comparativo({ local }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('TODOS');
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState('diferencia');
  const [pagina, setPagina] = useState(1);
  const [descargando, setDescargando] = useState(false);
  const POR_PAGINA = 50;
  const load = useCallback(async () => {
    try { const d = await api(`/api/inventarios/comparativo${local?.id ? `?localId=${local.id}` : ''}`); setData(d); setError(''); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [local?.id]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    let t = null;
    const handler = (e) => { const ev = e.detail; if (!ev || !['escaneo', 'sesion', 'zona_finalizada'].includes(ev.tipo)) return; if (t) clearTimeout(t); t = setTimeout(load, 500); };
    window.addEventListener('levis:realtime', handler);
    return () => { window.removeEventListener('levis:realtime', handler); if (t) clearTimeout(t); };
  }, [load]);
  useEffect(() => { setPagina(1); }, [filtro, q, orden]);
  const productos = data?.productos || [];
  const resumen = data?.resumen;
  const inventario = data?.inventario;
  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    let arr = productos;
    if (filtro !== 'TODOS') arr = arr.filter((p) => p.estado === filtro);
    if (texto) arr = arr.filter((p) => p.codigoBarras.includes(texto) || `${p.item} ${p.descripcion} ${p.estilo}`.toLowerCase().includes(texto));
    return [...arr].sort((a, b) => (orden === 'codigo' ? a.codigoBarras.localeCompare(b.codigoBarras) : orden === 'contado' ? b.contado - a.contado : a.diferencia - b.diferencia) || a.codigoBarras.localeCompare(b.codigoBarras));
  }, [productos, filtro, q, orden]);
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const filas = visibles.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  async function descargar() {
    if (!inventario?.id) return;
    setDescargando(true);
    try {
      const blob = await api(`/api/inventarios/${inventario.id}/reporte.xlsx`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `comparativo-${inventario.id}.xlsx`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); } finally { setDescargando(false); }
  }
  const filtros = [
    { k: 'FALTANTE', label: 'Faltantes', n: resumen?.faltantes || 0, cls: 'red' },
    { k: 'SOBRANTE', label: 'Sobrantes', n: resumen?.sobrantes || 0, cls: 'amber' },
    { k: 'OK', label: 'Exactos', n: resumen?.ok || 0, cls: 'green' },
    { k: 'SIN CONTEO', label: 'Sin conteo', n: resumen?.sinConteo || 0, cls: 'gray' },
  ];
  return <div className="page-stack">
    <div className="page-heading">
      <div><p className="eyebrow">MAESTRO VS. CONTADO</p><h1>Comparativo consolidado</h1><p className="muted">Suma todas las lecturas de todos los usuarios y zonas (por unidad) y las compara con el archivo maestro. Reemplaza el trabajo de unir a mano el Excel de cada empleado.</p></div>
      <div className="heading-actions">
        <button className="btn secondary" onClick={load}><RefreshCw size={16}/> Actualizar</button>
        <button className="btn primary" onClick={descargar} disabled={descargando || !inventario}>{descargando ? <span className="spinner"/> : <ArrowDownToLine size={16}/>} Descargar Excel</button>
      </div>
    </div>
    {error && <Notice type="error" message={error} onClose={() => setError('')}/>}
    {local && <div className="selected-zone big-zone"><Warehouse size={18}/><span>Local: <b>{local.nombre}</b></span><span className={`pill ${inventario ? 'green' : 'gray'}`}>{inventario ? inventario.estado : 'SIN INVENTARIO'}</span></div>}
    {!inventario ? (loading ? <div className="loading-inline"><span className="spinner"/> Cargando comparativo…</div> : <Empty icon={FileSpreadsheet} title="No hay inventario activo" text="Importa y activa el archivo maestro del local desde la sección Inventarios."/>) : <>
      <div className="stats-grid">
        <Stat icon={Boxes} label="Productos en maestro" value={resumen?.productosMaestro?.toLocaleString('es-CO')} sub={`${(resumen?.productosConConteo || 0).toLocaleString('es-CO')} con conteo`}/>
        <Stat icon={Barcode} label="Unidades en maestro" value={resumen?.unidadesMaestro?.toLocaleString('es-CO')} sub="Existencia esperada"/>
        <Stat icon={Activity} label="Unidades contadas" value={resumen?.unidadesContadas?.toLocaleString('es-CO')} sub="Conteo físico total"/>
        <Stat icon={ClipboardList} label="Diferencia de unidades" value={(resumen ? resumen.unidadesContadas - resumen.unidadesMaestro : 0).toLocaleString('es-CO')} sub={`${(resumen?.sinConteo || 0).toLocaleString('es-CO')} productos sin conteo`}/>
      </div>
      <Card>
        <div className="card-heading"><div><h2>Resultado por producto</h2><p className="muted">Filtra por estado o busca un código y compara el conteo contra el maestro. Actualización en vivo.</p></div><span className="live-tag"><span className="status-dot"/> EN VIVO</span></div>
        <div className="filtros-barra">
          {filtros.map((f) => <button key={f.k} type="button" className={`filtro-chip ${f.cls} ${filtro === f.k ? 'activo' : ''}`} onClick={() => setFiltro(filtro === f.k ? 'TODOS' : f.k)}><b>{f.n.toLocaleString('es-CO')}</b><span>{f.label}</span></button>)}
          <button type="button" className={`filtro-chip neutral ${filtro === 'TODOS' ? 'activo' : ''}`} onClick={() => setFiltro('TODOS')}><b>{(resumen?.productosMaestro || 0).toLocaleString('es-CO')}</b><span>Todos</span></button>
        </div>
        <div className="tabla-tools">
          <div className="search-box compact"><PackageSearch size={16}/><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, item, descripción o estilo…"/><span className="search-count">{visibles.length.toLocaleString('es-CO')}</span></div>
          <label className="orden-select">Ordenar por<select value={orden} onChange={(e) => setOrden(e.target.value)}><option value="diferencia">Mayor faltante primero</option><option value="contado">Más contado primero</option><option value="codigo">Código de barras</option></select></label>
        </div>
        {filas.length ? <>
          <div className="table-wrap"><table><thead><tr><th>Código</th><th>Producto</th><th className="num">Maestro</th><th className="num">Contado</th><th className="num">Diferencia</th><th>Estado</th></tr></thead><tbody>
            {filas.map((p) => <tr key={p.codigoBarras}>
              <td className="mono">{p.codigoBarras}</td>
              <td><b>{p.item || '—'}</b><span className="table-sub">{p.descripcion || 'Sin descripción'}{p.estilo ? ` · ${p.estilo}` : ''}</span></td>
              <td className="num">{p.existencia.toLocaleString('es-CO')}</td>
              <td className="num">{p.contado.toLocaleString('es-CO')}</td>
              <td className={`num ${p.diferencia < 0 ? 'dif-neg' : p.diferencia > 0 ? 'dif-pos' : ''}`}>{p.diferencia > 0 ? `+${p.diferencia.toLocaleString('es-CO')}` : p.diferencia.toLocaleString('es-CO')}</td>
              <td><span className={`estado-badge ${p.estado.toLowerCase().replace(' ', '-')}`}>{p.estado}</span></td>
            </tr>)}
          </tbody></table></div>
          <div className="paginador">
            <span>Página {paginaActual} de {totalPaginas} · {visibles.length.toLocaleString('es-CO')} productos</span>
            <div>
              <button className="btn ghost small-btn" disabled={paginaActual <= 1} onClick={() => setPagina(1)}>« Primera</button>
              <button className="btn ghost small-btn" disabled={paginaActual <= 1} onClick={() => setPagina(paginaActual - 1)}>Anterior</button>
              <button className="btn ghost small-btn" disabled={paginaActual >= totalPaginas} onClick={() => setPagina(paginaActual + 1)}>Siguiente</button>
              <button className="btn ghost small-btn" disabled={paginaActual >= totalPaginas} onClick={() => setPagina(totalPaginas)}>Última »</button>
            </div>
          </div>
        </> : <Empty icon={PackageSearch} title="Sin resultados" text={q || filtro !== 'TODOS' ? 'No hay productos que coincidan con el filtro o la búsqueda.' : 'Aún no hay productos en el archivo maestro.'}/>}
      </Card>
    </>}
  </div>;
}
export default function App() {
  const [user,setUser]=useState(getUser);const [local,setLocalState]=useState(getLocal);const [ready,setReady]=useState(false);const [notificaciones,setNotificaciones]=useState([]);const [toast,setToast]=useState(null);const navigate=useNavigate();
  useEffect(()=>{let active=true;async function check(){if(!getToken()){setReady(true);return;}try{const d=await api('/api/auth/me');if(active){setUser(d.usuario);localStorage.setItem('levis_user',JSON.stringify(d.usuario));}}catch{if(active){clearSession();setUser(null);}}finally{if(active)setReady(true);}}check();const logout=()=>{setUser(null);setLocalState(null);navigate('/login');};window.addEventListener('levis:logout',logout);return()=>{active=false;window.removeEventListener('levis:logout',logout);};},[navigate]);
  // Tiempo real: el backend avisa de cada lectura y de cada zona terminada.
  useEffect(()=>{
    if(!user||!local)return;
    const soltar=conectarRealtime({ localId: local.id, onEvento: (ev)=>{
      window.dispatchEvent(new CustomEvent('levis:realtime',{detail:ev}));
      if(ev.tipo==='zona_finalizada'&&user.rol==='ADMINISTRADORA'){
        const n={ id:`${Date.now()}-${Math.random().toString(16).slice(2)}`, zona: ev.zona?.nombre||`Zona ${ev.zona?.numero}`, empleado: ev.empleado?.nombre||'Empleado', unidades: ev.unidades||0, lecturas: ev.lecturas||0, hora: ev.hora||new Date().toISOString(), leida:false };
        setNotificaciones(prev=>[n,...prev].slice(0,30));
        setToast(n);
      }
    }});
    return soltar;
  },[user,local]);
  useEffect(()=>{ if(!toast)return; const t=setTimeout(()=>setToast(null),7000); return ()=>clearTimeout(t); },[toast]);
  const logout=()=>{clearSession();setUser(null);setLocalState(null);setNotificaciones([]);navigate('/login');};
  const pickLocal=(l)=>{setLocal(l);setLocalState({id:l.id,nombre:l.nombre});localStorage.removeItem('levis_zone');navigate('/');};
  if(!ready)return <div className="loading-screen"><img className="brand-logo big" src="/logo-blesscard.png" alt="BLESSCARD"/><span className="spinner"/>Cargando aplicación…</div>;
  if(!user)return <Routes><Route path="/login" element={<Login onLogin={u=>{setUser(u);navigate('/');}}/>}/><Route path="*" element={<Navigate to="/login" replace/>}/></Routes>;
  if(!local)return <LocalPicker user={user} onPick={pickLocal} onLogout={logout}/>;
  return <><ToastNotificacion noti={toast} onClose={()=>setToast(null)}/><Shell user={user} local={local} onChangeLocal={()=>setLocalState(null)} onLogout={logout} notificaciones={notificaciones} sinLeer={notificaciones.filter(n=>!n.leida).length} onMarcarLeidas={()=>setNotificaciones(prev=>prev.map(n=>n.leida?n:{...n,leida:true}))}><Routes><Route path="/" element={user.rol==='ADMINISTRADORA'?<Dashboard local={local}/>:<EmployeeHome user={user} local={local}/>}/><Route path="/inventarios" element={user.rol==='ADMINISTRADORA'?<Inventories local={local}/>:<Navigate to="/conteo" replace/>}/><Route path="/conteo" element={<ScanPage local={local}/>}/><Route path="/zonas" element={<Zones local={local}/>}/><Route path="/comparativo" element={user.rol==='ADMINISTRADORA'?<Comparativo local={local}/>:<Navigate to="/conteo" replace/>}/><Route path="/locales" element={user.rol==='ADMINISTRADORA'?<Locales/>:<Navigate to="/conteo" replace/>}/><Route path="/usuarios" element={user.rol==='ADMINISTRADORA'?<UsersPage/>:<Navigate to="/conteo" replace/>}/><Route path="*" element={<NotFound/>}/></Routes></Shell></>;
}
