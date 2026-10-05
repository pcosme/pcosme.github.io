(() => {
  const root = document.getElementById('research-map');
  if (!root) return;
  root.hidden = false;
  const help = document.getElementById('research-map-help');
  if (help) help.hidden = false;
  const disclosure = root.closest('details');
  const host = root.querySelector('.pl-host');
  const svg = root.querySelector('.pl-svg');
  const actions = root.querySelector('.pl-actions');
  const status = root.querySelector('.pl-status');
  const fields = {
    classical: {name:'Classical field theory',core:[177,174],topics:['transport','hydro','nonlinear','symmetry']},
    dynamical: {name:'Dynamical systems',core:[532,220],topics:['lowdim','bifurcations','oscillators','synchronisation','nonlinear']},
    statistical: {name:'Statistical physics',core:[176,511],topics:['kinetic','nonequilibrium','phase-and-order','symmetry','coarse-graining']},
    condensed: {name:'Condensed matter',core:[347,730],topics:['plasma','electron-hydro','soft','active','microswimmers']},
    biophysics: {name:'Biophysics',core:[594,591],topics:['active','microswimmers']}
  };
  const parents = {'hydro':'transport','synchronisation':'oscillators','electron-hydro':'plasma','active':'soft','microswimmers':'active'};
  const links = {
    'kinetic-to-transport':['kinetic','transport'],
    'hydro-to-waves':['hydro','nonlinear'],
    'kinetic-and-plasmas':['kinetic','plasma'],
    'synchronisation-microswimmers':['synchronisation','microswimmers'],
    'synchronisation-collective-order':['synchronisation','phase-and-order'],
    'collective-order-microswimmers':['phase-and-order','microswimmers'],
    'nonequilibrium-active':['nonequilibrium','active'],
    'emergence-coarse-graining':['emergence','coarse-graining']
  };
  let active = null, pinned = null, keyboard = false, exitTimer;
  let geometry = {}, topicElements = [], domainElements = [], connectionElements = [];
  function explore(field) {
    const primary = new Set(field ? [...fields[field].topics,'emergence'] : []);
    const context = new Set();
    for(const [a,b] of Object.values(links)) {
      if(primary.has(a) && !primary.has(b)) context.add(b);
      if(primary.has(b) && !primary.has(a)) context.add(a);
    }
    const structure = new Set();
    for(const topic of [...primary,...context]) {
      let ancestor = parents[topic];
      while(ancestor) {
        if(!primary.has(ancestor) && !context.has(ancestor)) structure.add(ancestor);
        ancestor = parents[ancestor];
      }
    }
    const visible = new Set([...primary,...context]);
    return {primary,context,structure,visible};
  }
  function setField(field) {
    active = field;
    const state = explore(field);
    svg.dataset.exploring = String(Boolean(field));
    for(const element of topicElements) {
      const id = element.dataset.topic;
      const emphasis = state.primary.has(id)?'primary':state.context.has(id)?'context':state.structure.has(id)?'structure':'hidden';
      element.dataset.emphasis = emphasis;
      element.setAttribute('aria-hidden',String(emphasis==='hidden'));
    }
    for(const element of domainElements) {
      const id = element.dataset.field;
      element.dataset.emphasis = id===field?'primary':fields[id].topics.some(topic=>state.context.has(topic))?'context':'background';
      element.dataset.keyboard = String(keyboard && id===field);
    }
    for(const element of connectionElements) {
      const [a,b] = links[element.dataset.connection];
      const shown = state.visible.has(a) && state.visible.has(b);
      element.dataset.shown = String(shown);
      element.setAttribute('aria-hidden',String(!shown));
    }
    for(const button of actions.querySelectorAll('button')) button.setAttribute('aria-pressed',String(button.dataset.field===field));
    status.textContent = field ? fields[field].name + (pinned?' · pinned':'') : 'All fields';
  }
  function curvePoints(path) {
    const tokens = path.match(/[MCZ]|[-+]?(?:\d*\.\d+|\d+)/g);
    const points = []; let i=0,x=0,y=0;
    while(i<tokens.length) {
      const command=tokens[i++];
      if(command==='M') {x=Number(tokens[i++]);y=Number(tokens[i++]);points.push({x,y});}
      else if(command==='C') {
        const [cx1,cy1,cx2,cy2,nx,ny]=tokens.slice(i,i+6).map(Number);i+=6;
        for(let j=1;j<=40;j++) {
          const t=j/40,u=1-t;
          points.push({x:u*u*u*x+3*u*u*t*cx1+3*u*t*t*cx2+t*t*t*nx,y:u*u*u*y+3*u*u*t*cy1+3*u*t*t*cy2+t*t*t*ny});
        }
        x=nx;y=ny;
      }
    }
    return points;
  }
  function contains(point,polygon) {
    let inside=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
      const a=polygon[i],b=polygon[j];
      if(((a.y>point.y)!==(b.y>point.y)) && point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
    }
    return inside;
  }
  function pickField(point,keepCurrent=true) {
    let caption=null,nearest=22;
    for(const [id,area] of Object.entries(geometry)) for(const p of area.caption) {
      const distance=Math.hypot(point.x-p.x,point.y-p.y);
      if(distance<nearest) {nearest=distance;caption=id;}
    }
    if(caption) return caption;
    if(keepCurrent && active && contains(point,geometry[active].polygon)) return active;
    const candidates=Object.entries(geometry).filter(([,area])=>contains(point,area.polygon));
    candidates.sort(([,a],[,b])=>Math.hypot(point.x-a.core.x,point.y-a.core.y)-Math.hypot(point.x-b.core.x,point.y-b.core.y));
    return candidates.length?candidates[0][0]:null;
  }
  const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  function makeSketch(width) {
    const narrow = width < 540;
    const sx = width / 700;
    const sy = narrow ? 1.45 : 1;
    const height = Math.ceil(852 * sy);
    const shapes = [], connections = [], labels = [], definitions = [], areas = {};
    const profiles = [
      'M .15 .08 C .31 -.015 .68 .015 .84 .105 C 1.01 .20 1.02 .59 .89 .80 C .78 .99 .42 1.015 .20 .91 C -.015 .81 -.055 .32 .15 .08 Z',
      'M .18 .06 C .40 -.025 .79 .055 .91 .23 C 1.015 .40 .985 .73 .78 .90 C .62 1.025 .21 .99 .08 .76 C -.035 .56 .015 .18 .18 .06 Z',
      'M .12 .16 C .23 -.015 .67 -.015 .86 .14 C 1.025 .28 1.015 .61 .88 .80 C .73 1.01 .30 1.03 .12 .84 C -.015 .69 -.03 .38 .12 .16 Z'
    ];
    function coordinates(source, x=0, y=0, w=1, h=1) {
      let index = 0;
      return source.replace(/[-+]?(?:\d*\.\d+|\d+)/g, value =>
        (index++ % 2 === 0 ? (x + Number(value)*w)*sx : (y + Number(value)*h)*sy).toFixed(2));
    }
    function region(id, path, fill, edge, opacity=.64) {
      const d=coordinates(path);
      areas[id]={path:d,polygon:curvePoints(d),core:{x:fields[id].core[0]*sx,y:fields[id].core[1]*sy}};
      shapes.push(`<path class="pl-main-region" data-field="${id}" data-region="${id}" d="${d}" fill="var(--pl-${fill})" fill-opacity="${opacity}" stroke="var(--pl-${edge})" stroke-opacity=".5" stroke-width=".85"/>`);
    }
    function blob(id,x,y,w,h,fill,edge,opacity=.6,profile=0) {
      shapes.push(`<path data-topic="${id}" data-region="${id}" d="${coordinates(profiles[profile],x,y,w,h)}" fill="var(--pl-${fill})" fill-opacity="${opacity}" stroke="var(--pl-${edge})" stroke-opacity=".5" stroke-width=".85"/>`);
    }
    function label(id,x,y,lines,size,kind='topic',mobileLines=null) {
      if(narrow) { lines = mobileLines || lines; size = Math.max(11, size*.76); }
      if(narrow && ['hydro','synchronisation','nonequilibrium'].includes(id)) size = 11;
      if(kind==='theme') size = narrow ? 23 : size;
      const family = kind==='small' ? 'Arial, Helvetica, sans-serif' : "Georgia, 'Times New Roman', serif";
      const leading = size * 1.23;
      const first = y*sy - (lines.length-1)*leading/2 + size*.32;
      const spans = lines.map((line,i)=>`<tspan x="${x*sx}" y="${first+i*leading}">${esc(line)}</tspan>`).join('');
      labels.push(`<text data-topic="${id}" data-label="${id}" text-anchor="middle" font-family="${family}" font-size="${size}" font-weight="400" ${kind==='theme' ? 'font-style="italic"' : ''} fill="var(--pl-ink)">${spans}</text>`);
    }
    function boundaryLabel(id,title,path,size=25) {
      const pathId = `research-map-boundary-${id}`;
      areas[id].caption=curvePoints(coordinates(path));
      definitions.push(`<path id="${pathId}" d="${coordinates(path)}"/>`);
      labels.push(`<text class="pl-domain-label" data-field="${id}" data-label="${id}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${narrow?18:size}" font-style="italic" font-weight="400" fill="var(--pl-ink)"><textPath href="#${pathId}" xlink:href="#${pathId}" startOffset="50%">${esc(title)}</textPath></text>`);
    }
    function connection(id,points,arrow=false,both=false) {
      const [x1,y1,cx1,cy1,cx2,cy2,x2,y2] = points;
      const path = coordinates(`M ${x1} ${y1} C ${cx1} ${cy1} ${cx2} ${cy2} ${x2} ${y2}`);
      connections.push(`<path data-connection="${id}" d="${path}" fill="none" stroke="var(--pl-muted)" stroke-opacity=".72" stroke-width="1.1" stroke-linecap="round" ${arrow?'marker-end="url(#research-map-arrow)"':''} ${both?'marker-start="url(#research-map-arrow-start)"':''}/>`);
    }

    region('classical','M 39 97 C 72 36 182 12 278 28 C 367 38 404 103 411 183 C 417 259 394 317 354 367 C 311 419 207 424 120 394 C 39 366 16 279 19 196 C 18 152 24 120 39 97 Z','classical','classical-edge',.60);
    region('dynamical','M 355 63 C 437 18 565 38 634 99 C 693 157 692 292 665 352 C 635 420 546 455 444 427 C 370 406 324 347 306 271 C 287 190 292 112 355 63 Z','dynamical','dynamical-edge',.64);
    region('statistical','M 78 313 C 156 277 259 283 344 331 C 430 376 490 413 489 492 C 495 582 432 662 326 701 C 244 758 98 720 45 637 C 1 566 12 368 78 313 Z','statistical','statistical-edge',.68);
    region('condensed','M 298 453 C 388 416 522 431 610 493 C 675 546 699 670 651 761 C 590 842 397 856 280 809 C 210 781 183 690 199 594 C 214 519 242 477 298 453 Z','condensed','condensed-edge',.69);
    region('biophysics','M 526 395 C 614 380 682 430 690 526 C 712 622 661 725 576 739 C 509 745 446 698 435 628 C 422 539 437 443 526 395 Z','biophysics','biophysics-edge',.57);

    // This continuous translucent region physically intersects each of the five domains.
    shapes.push(`<path data-topic="emergence" data-region="emergence" d="${coordinates('M 214 355 C 220 321 278 319 318 335 C 335 308 376 307 405 329 C 442 311 500 329 518 361 C 554 375 560 412 535 431 C 548 473 492 490 452 470 C 409 496 372 478 340 473 C 303 482 276 455 249 431 C 206 420 183 382 214 355 Z')}" fill="var(--pl-emergence)" fill-opacity=".74"/>`);

    blob('transport',55,123,244,181,'transport','classical-edge',.43,2);
    blob('hydro',83,229,193,59,'hydro','classical-edge',.86,0);
    blob('lowdim',444,112,175,81,'dynamical','dynamical-edge',.55,1);
    blob('bifurcations',428,210,208,89,'dynamical','dynamical-edge',.58,0);
    blob('oscillators',425,316,228,112,'dynamical','dynamical-edge',.68,2);
    blob('synchronisation',narrow?440:451,371,narrow?201:176,47,'small','dynamical-edge',.78,0);
    blob('kinetic',66,424,166,91,'kinetic','statistical-edge',.54,1);
    blob('phase-and-order',263,451,197,89,'kinetic','statistical-edge',.39,0);
    blob('nonequilibrium',246,554,208,86,'kinetic','statistical-edge',.39,2);
    blob('plasma',narrow?215:230,657,narrow?221:193,135,'small','condensed-edge',.71,2);
    blob('electron-hydro',narrow?228:247,715,narrow?200:161,60,'hydro','classical-edge',.84,0);
    blob('soft',441,483,215,215,'soft','condensed-edge',.47,2);
    blob('active',454,501,190,132,'active','condensed-edge',.55,0);
    blob('microswimmers',narrow?465:475,520,narrow?176:157,52,'small','biophysics-edge',.82,1);

    connection('kinetic-to-transport',[144,427,148,384,150,337,151,303],true);
    connection('hydro-to-waves',[272,256,294,257,303,243,318,238],true);
    connection('kinetic-and-plasmas',[208,498,221,545,238,610,263,662],true,true);
    connection('synchronisation-microswimmers',[563,415,562,446,562,484,560,520]);
    connection('synchronisation-collective-order',[479,414,470,430,459,449,448,469]);
    connection('collective-order-microswimmers',[454,502,472,505,483,519,491,531]);
    connection('nonequilibrium-active',[449,596,453,596,457,596,461,596]);
    connection('emergence-coarse-graining',narrow?[242,383,271,390,289,400,304,409]:[253,407,260,408,267,409,274,410]);

    boundaryLabel('classical','Classical field theory','M 39 146 C 69 58 220 21 340 70');
    boundaryLabel('dynamical','Dynamical systems','M 362 79 C 445 42 561 59 631 119');
    boundaryLabel('statistical','Statistical physics',narrow?'M 82 623 C 52 556 50 438 86 356':'M 56 623 C 26 556 24 438 60 356');
    boundaryLabel('condensed','Condensed matter','M 263 761 C 355 835 541 834 636 755');
    boundaryLabel('biophysics','Biophysics','M 494 692 C 552 748 645 707 674 634');
    label('transport',177,174,['Transport equations'],18,'topic',['Transport','equations']);
    label('hydro',180,260,['Hydrodynamics'],17);
    label('lowdim',530,153,['Low-dimensional','models'],15,'topic',['Low-','dimensional','models']);
    label('bifurcations',532,255,['Bifurcations','& instabilities'],16);
    label('oscillators',541,343,['Coupled oscillators'],17,'topic',['Coupled','oscillators']);
    label('synchronisation',538,395,['Synchronisation'],16);
    label('nonlinear',346,217,['Nonlinear','waves'],18);
    label('symmetry',220,351,['Symmetry','breaking'],14,'small');
    label('coarse-graining',223,narrow?375:403,['Coarse-','graining'],12,'small');
    label('emergence',360,narrow?421:410,['Emergence'],30,'theme');
    label('kinetic',150,470,['Kinetic','theory'],19);
    label('phase-and-order',362,496,['Phase transitions','& collective order'],16,'topic',['Phase','transitions','& collective','order']);
    label('nonequilibrium',351,598,['Non-equilibrium','statistical physics'],16,'topic',['Non-equilibrium','statistical','physics']);
    label('plasma',327,686,['Solid-state','quantum plasmas'],15,'topic',['Solid-state','quantum','plasmas']);
    label('electron-hydro',328,746,['Electron','hydrodynamics'],14);
    label('soft',narrow?535:551,narrow?638:666,['Soft matter'],19);
    label('active',551,602,['Active matter'],18,'topic',['Active','matter']);
    label('microswimmers',555,547,['Microswimmers'],13,'small');

    const markers = '<marker id="research-map-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M 1 1 L 7 4 L 1 7" fill="none" stroke="var(--pl-muted)" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></marker><marker id="research-map-arrow-start" viewBox="0 0 8 8" refX="1" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M 7 1 L 1 4 L 7 7" fill="none" stroke="var(--pl-muted)" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></marker>';
    const accessible = '<title id="research-map-title">Research interests: nested and overlapping fields</title><desc id="research-map-description">The names of the five fields follow their outer boundaries. A central continuous emergence region intersects classical field theory, dynamical systems, statistical physics, condensed matter and biophysics. Classical field theory contains transport equations and hydrodynamics. Nonlinear waves occupy its overlap with dynamical systems; symmetry breaking occupies its overlap with statistical physics. Dynamical systems contains low-dimensional models, bifurcations and instabilities, and coupled oscillators containing synchronisation. Statistical physics contains kinetic theory, non-equilibrium statistical physics, and phase transitions and collective order. Condensed matter contains solid-state quantum plasmas, containing electron hydrodynamics, and soft matter, containing active matter. Microswimmers belong to active matter and overlap biophysics. Short links connect synchronisation, collective order and microswimmers; non-equilibrium physics and active matter; kinetic theory, transport and plasmas; and hydrodynamics and nonlinear waves. Coarse-graining connects to emergence.</desc>';
    return {height,areas,body:accessible+`<defs>${markers}${definitions.join('')}</defs>`+shapes.join('')+connections.join('')+labels.join('')};
  }
  let previousWidth = null;
  function render() {
    if (disclosure && !disclosure.open) return;
    const width = Math.round(host.getBoundingClientRect().width);
    if(!width || width===previousWidth) return;
    previousWidth = width;
    const drawing = makeSketch(width);
    svg.setAttribute('viewBox',`0 0 ${width} ${drawing.height}`);
    svg.setAttribute('width',width);
    svg.setAttribute('height',drawing.height);
    svg.innerHTML = drawing.body;
    geometry = drawing.areas;
    topicElements = [...svg.querySelectorAll('[data-topic]')];
    domainElements = [...svg.querySelectorAll('[data-field]')];
    connectionElements = [...svg.querySelectorAll('[data-connection]')];
    if(!actions.children.length) {
      for(const [id,field] of Object.entries(fields)) {
        const button=document.createElement('button');
        button.type='button';button.className='pl-area-trigger';button.dataset.field=id;
        button.setAttribute('aria-label',field.name);button.setAttribute('aria-pressed','false');
        button.addEventListener('focus',()=>{keyboard=button.matches(':focus-visible');if(keyboard){pinned=null;setField(id);}});
        button.addEventListener('click',event=>{
          clearTimeout(exitTimer);
          const box=host.getBoundingClientRect();
          const target=event.detail===0?id:(pickField({x:event.clientX-box.left,y:event.clientY-box.top},false)||id);
          pinned=pinned===target?null:target;
          setField(pinned);
        });
        actions.append(button);
      }
    }
    for(const button of actions.querySelectorAll('button')) button.style.clipPath=`path('${geometry[button.dataset.field].path}')`;
    setField(active);
  }
  host.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch' || pinned) return;
    keyboard=false;
    clearTimeout(exitTimer);
    const box=host.getBoundingClientRect();
    const field=pickField({x:event.clientX-box.left,y:event.clientY-box.top});
    if(field) {if(field!==active)setField(field);}
    else exitTimer=setTimeout(()=>setField(null),160);
  });
  host.addEventListener('pointerleave',()=>{
    clearTimeout(exitTimer);
    if(!pinned && !keyboard) exitTimer=setTimeout(()=>setField(null),180);
  });
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape') {clearTimeout(exitTimer);pinned=null;keyboard=false;setField(null);}
  });
  root.addEventListener('focusout',event=>{
    if(!root.contains(event.relatedTarget)) {keyboard=false;if(!pinned)setField(null);}
  });
  if (disclosure) disclosure.addEventListener('toggle', () => {
    if (disclosure.open) render();
    else {
      clearTimeout(exitTimer);
      pinned = null;
      keyboard = false;
      setField(null);
    }
  });
  new ResizeObserver(render).observe(host);
  render();
})();
